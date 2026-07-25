import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: Request) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    // Note: ensure this matches the Authorized Redirect URIs in your Google Cloud Console
    'http://localhost:3000/api/auth/google/callback'
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent' // Forces consent screen to ensure refresh token is returned
  });

  return NextResponse.redirect(url);
}
