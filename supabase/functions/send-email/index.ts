// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GMAIL_USER = 'no.reply.application1234@gmail.com';
const GMAIL_PASS = 'hykispjnytqijaei'; // regenerate this — old one is exposed
const FROM_NAME  = 'Fundy';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const client = new SmtpClient();

    await client.connectTLS({
      hostname: 'smtp.gmail.com',
      port: 465,
      username: GMAIL_USER,
      password: GMAIL_PASS,
    });

    await client.send({
      from: `${FROM_NAME} <${GMAIL_USER}>`,
      to,
      subject,
      html,
      content: 'auto',
    });

    await client.close();

    console.log(`[send-email] Sent to ${to}: ${subject}`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[send-email] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});