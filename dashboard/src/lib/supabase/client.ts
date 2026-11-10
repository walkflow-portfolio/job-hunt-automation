import { createBrowserClient } from '@supabase/ssr';

// Browser client: uses the anon key plus the logged-in session. Row Level Security lets only a signed-in user in.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
