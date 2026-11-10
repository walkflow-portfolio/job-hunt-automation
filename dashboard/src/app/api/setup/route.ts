import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Tells the Setup page which server-side settings exist. Returns only yes/no, never the values.
export async function GET() {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  return NextResponse.json({ runNow: Boolean(process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET) });
}
