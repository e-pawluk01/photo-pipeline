import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

function maskString(str: string | undefined) {
  if (!str) return 'MISSING/UNDEFINED';
  if (str.length <= 8) return '*** (TOO SHORT)';
  const hasLeadingSpace = str.startsWith(' ');
  const hasTrailingSpace = str.endsWith(' ');
  const masked = `${str.substring(0, 5)}...${str.substring(str.length - 3)}`;
  return {
    value: masked,
    length: str.length,
    hasLeadingSpace,
    hasTrailingSpace,
  };
}

export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  const diagnostics = {
    GOOGLE_OAUTH_CLIENT_ID: maskString(clientId),
    GOOGLE_OAUTH_CLIENT_SECRET: maskString(clientSecret),
    GOOGLE_OAUTH_REFRESH_TOKEN: maskString(refreshToken),
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || 'Not in Vercel (or missing VERCEL_ENV)',
  };

  try {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: 'v3', auth });

    // Try a simple ping to drive
    const res = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)',
    });

    return NextResponse.json({
      status: 'SUCCESS',
      message: 'Drive API authenticated successfully!',
      diagnostics,
      test_file: res.data.files?.[0] || 'No files found',
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR',
      message: 'Drive API failed to authenticate.',
      diagnostics,
      error_message: error.message,
      error_details: error.response?.data || error.toString(),
    }, { status: 500 });
  }
}
