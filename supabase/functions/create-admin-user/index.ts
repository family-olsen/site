// Cria um usuário de login real (Supabase Auth) + a linha correspondente em
// admin_users, com papel fixo "admin". Só existe como Edge Function porque
// criar um usuário de Auth exige a service role key, que nunca pode rodar no
// navegador (ela ignora toda regra de RLS). Quem chama isso precisa estar
// logado E ser operador — checado aqui dentro, não só pelo verify_jwt do
// Supabase (que só garante "tem uma sessão válida", não "é operador").
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
    // Cliente com a sessão de quem chamou — só pra descobrir QUEM é.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado." }, 401);

    // Cliente com a service role — pra tudo que precisa poder total.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerRow } = await adminClient
      .from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
    if (callerRow?.role !== "operador") {
      return json({ error: "Só o operador pode criar usuários." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = body?.password ? String(body.password) : null;
    const sendInvite = !!body?.sendInvite;
    const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;

    if (!name || !email) return json({ error: "Informe nome e e-mail." }, 400);
    if (!sendInvite && (!password || password.length < 8)) {
      return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
    }

    let newUserId: string;
    if (sendInvite) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { display_name: name },
        redirectTo,
      });
      if (error) throw error;
      newUserId = data.user.id;
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: password!,
        email_confirm: true,
        user_metadata: { display_name: name },
      });
      if (error) throw error;
      newUserId = data.user.id;
    }

    const { error: insertErr } = await adminClient.from("admin_users").insert({
      user_id: newUserId,
      role: "admin",
      display_name: name,
      email,
      active: true,
    });
    if (insertErr) {
      // Já criou o login mas não conseguiu vincular o papel — desfaz o login
      // pra não deixar um usuário "órfão" (existe no Auth mas sem acesso a
      // nada e sem aparecer na lista de Usuários).
      await adminClient.auth.admin.deleteUser(newUserId);
      throw insertErr;
    }

    return json({ ok: true, user_id: newUserId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
