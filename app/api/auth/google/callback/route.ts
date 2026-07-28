import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code found in URL' }, { status: 400 });
  }

  try {
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // We render a simple HTML page that displays the token so the user can easily copy it
    const html = `
      <html>
        <body style="font-family: monospace; padding: 40px; background: #000; color: #fff;">
          <h2>Google Authentication Successful!</h2>
          <p>Please copy the refresh token below and save it to your Supabase/Vercel environment variables as <b>GOOGLE_OAUTH_REFRESH_TOKEN</b>.</p>
          <div style="background: #222; padding: 20px; border-radius: 8px; word-break: break-all; margin-top: 20px;">
            ${tokens.refresh_token || 'NO REFRESH TOKEN RECEIVED (You might need to revoke access in your Google Account and try again)'}
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error: any) {
    console.error('Error exchanging code for token', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
