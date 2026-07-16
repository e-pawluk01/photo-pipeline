import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const expected = process.env.APP_PASSCODE;

  // If no passcode is configured, treat the app as open (local dev only).
  if (!expected) {
    return NextResponse.json({ ok: true });
  }

  const { passcode } = await req.json().catch(() => ({ passcode: '' }));
  const ok = passcode === expected;
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
