import { NextRequest } from 'next/server';

/**
 * Checks the shared passcode sent by the client against APP_PASSCODE.
 * If APP_PASSCODE isn't set, the app is left open — useful for local dev,
 * but you should always set it once deployed.
 */
export function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return true;

  const provided = req.headers.get('x-app-passcode');
  return provided === expected;
}
