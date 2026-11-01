import { NextResponse } from 'next/server';
import { COOKIE_SESION } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(COOKIE_SESION);
  return res;
}
