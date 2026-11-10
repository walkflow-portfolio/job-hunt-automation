import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startRun } from '@/lib/run-now';

// POST { search_profile_id?: string } -> asks n8n to run now. Only a signed-in user may call it.
export async function POST(request: Request) {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  let body: { search_profile_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body means "all active profiles".
  }

  const result = await startRun(body.search_profile_id, {
    url: process.env.N8N_WEBHOOK_URL,
    secret: process.env.N8N_WEBHOOK_SECRET,
  });
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.message }, { status: result.status });
}
