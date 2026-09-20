// Cria um login de "usuário comum" (site_visitors) — dá acesso de LEITURA ao
// site público quando ele está marcado como privado; nunca abre o painel
// admin. Mesma lógica de segurança de create-admin-user/set-user-password:
// só existe como Edge Function porque criar/alterar login exige a service
// role key (nunca no navegador). Só quem é "admin" pode chamar isto — o
// operador não gerencia usuário comum, e vice-versa (cada papel cuida do
// que é dele).
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado." }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerRow } = await adminClient
      .from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
    if (callerRow?.role !== "admin") {
      return json({ error: "Só o admin da família pode criar usuários comuns." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const login = String(body?.login || "").trim().toLowerCase();
    const emailInput = String(body?.email || "").trim().toLowerCase();
    const password = body?.password ? String(body.password) : null;
    const sendInvite = !!body?.sendInvite;
    const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;

    if (sendInvite) {
      // Convite por e-mail: só o e-mail é obrigatório — dá pra disparar uma
      // lista inteira sem preencher nome/login de cada um na mão.
      if (!emailInput) {
        return json({ error: "Informe o e-mail pra enviar o convite." }, 400);
      }
    } else {
      // Criação manual (com senha): exige nome e login de verdade.
      if (!name || !login) return json({ error: "Informe nome e login." }, 400);
      if (!password || password.length < 8) {
        return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
      }
    }
    if (login && !/^[a-z0-9._-]{3,40}$/.test(login)) {
      return json({ error: "Login inválido — use só letras, números, ponto, traço ou underline (3 a 40 caracteres)." }, 400);
    }

    // Checa duplicidade ANTES de criar o login no Auth — login e e-mail já
    // vêm normalizados em minúsculas (linhas acima), então dá pra comparar
    // com igualdade direta contra o que foi salvo (mesma normalização).
    if (login) {
      const { data: existingLogin } = await adminClient
        .from("site_visitors").select("user_id").eq("login", login).maybeSingle();
      if (existingLogin) {
        return json({ error: "Esse login já está em uso por outro visitante." }, 409);
      }
    }
    if (emailInput) {
      const { data: existingEmail } = await adminClient
        .from("site_visitors").select("user_id").eq("email", emailInput).maybeSingle();
      if (existingEmail) {
        return json({ error: "Já existe um visitante cadastrado com esse e-mail." }, 409);
      }
    }

    // Sem e-mail de verdade, o Supabase Auth ainda exige ALGO no formato de
    // e-mail — sintetiza um a partir do login, num domínio que não existe de
    // propósito (ninguém recebe nada ali; só serve de identificador interno).
    // (emailInput é sempre obrigatório quando sendInvite, e login é sempre
    // obrigatório na criação manual — então um dos dois sempre existe aqui.)
    const authEmail = emailInput || `${login}@visitante.local`;

    let newUserId: string;
    if (sendInvite) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(authEmail, {
        data: { display_name: name, login },
        redirectTo,
      });
      if (error) throw error;
      newUserId = data.user.id;
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: authEmail,
        password: password!,
        email_confirm: true,
        user_metadata: { display_name: name, login },
      });
      if (error) throw error;
      newUserId = data.user.id;
    }

    const { error: insertErr } = await adminClient.from("site_visitors").insert({
      user_id: newUserId,
      login: login || null,
      email: emailInput || null,
      display_name: name || null,
      active: true,
    });
    if (insertErr) {
      await adminClient.auth.admin.deleteUser(newUserId);
      throw insertErr;
    }

    return json({ ok: true, user_id: newUserId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Rede de segurança: o pré-checa acima cobre duplicidade dentro de
    // site_visitors, mas o e-mail sintético (login@visitante.local) ou um
    // e-mail de verdade já usado por um admin/operador também esbarram na
    // unicidade do próprio Supabase Auth — troca o erro cru dele por algo
    // que a pessoa que está cadastrando entende.
    if (/already.*registered|already.*exists|email_exists|duplicate key/i.test(message)) {
      return json({ error: "Já existe um usuário cadastrado com esse e-mail ou login." }, 409);
    }
    return json({ error: message }, 500);
  }
});
