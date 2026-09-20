// Igual set-user-password, mas pro admin definir a senha de um USUÁRIO
// COMUM (site_visitors) direto, sem depender de e-mail. Função separada de
// propósito — cada uma confere um papel diferente (essa exige "admin", a
// outra exige "operador"), mantém as duas simples e auditáveis sozinhas.
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
      return json({ error: "Só o admin da família pode definir senha de usuário comum." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.user_id || "").trim();
    const password = String(body?.password || "");

    if (!targetUserId) return json({ error: "Informe o usuário." }, 400);
    if (password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);

    const { data: targetRow } = await adminClient
      .from("site_visitors").select("user_id").eq("user_id", targetUserId).maybeSingle();
    if (!targetRow) return json({ error: "Usuário não encontrado." }, 404);

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
