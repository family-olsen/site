// Define a senha de um usuário já existente, direto — sem depender de e-mail
// (útil quando o limite de envio de e-mail do Supabase está bloqueado, ou
// quando a pessoa não tem acesso à caixa de entrada dela). Mesma lógica de
// segurança de create-admin-user: só existe como Edge Function porque
// alterar a senha de OUTRA pessoa exige a service role key (nunca pode
// rodar no navegador), e confere aqui dentro que quem está chamando é
// mesmo operador antes de fazer qualquer coisa.
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
    if (callerRow?.role !== "operador") {
      return json({ error: "Só o operador pode definir senha de outro usuário." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.user_id || "").trim();
    const password = String(body?.password || "");

    if (!targetUserId) return json({ error: "Informe o usuário." }, 400);
    if (password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);

    // Confere que o alvo é mesmo um usuário cadastrado em admin_users — não
    // deixa usar isso pra mexer em qualquer user_id do projeto.
    const { data: targetRow } = await adminClient
      .from("admin_users").select("user_id").eq("user_id", targetUserId).maybeSingle();
    if (!targetRow) return json({ error: "Usuário não encontrado." }, 404);

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
