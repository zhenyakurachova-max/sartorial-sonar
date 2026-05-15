import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function emailHtml(magicLink: string, toEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:56px 24px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding-bottom:48px;">
            <span style="font-size:13px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#1a1a1a;">Atylier</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:20px;">
            <h1 style="margin:0;font-size:30px;font-weight:400;color:#1a1a1a;line-height:1.25;font-family:Georgia,'Times New Roman',serif;">Your Atylier link is ready.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:40px;">
            <p style="margin:0;font-size:15px;color:#737373;line-height:1.65;">Click below to sign in. This link expires in 24 hours and can only be used once.</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:56px;">
            <a href="${magicLink}" style="display:inline-block;background:#1a1a1a;color:#fafaf9;text-decoration:none;padding:15px 36px;font-size:13px;letter-spacing:0.08em;font-weight:500;text-transform:uppercase;">Sign in</a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e5e5e5;padding-top:32px;">
            <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">If you didn't request this email, you can safely ignore it. This link was sent to ${toEmail}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const callbackUrl = redirectTo ?? "https://atylier.style/auth/callback";

    const { data, error: genError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: callbackUrl },
    });

    if (genError || !data?.properties?.action_link) {
      console.error("generateLink error:", genError);
      return new Response(JSON.stringify({ error: genError?.message ?? "Failed to generate link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const magicLink = data.properties.action_link;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Atylier <onboarding@resend.dev>",
        to: [email],
        subject: "Sign in to Atylier",
        html: emailHtml(magicLink, email),
      }),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.json();
      console.error("Resend error:", resendError);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Magic link sent to:", email);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Function error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
