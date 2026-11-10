import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server client for API routes: reads the signed-in user from the request's cookies.
export async function createClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Cookies cannot be set from some server contexts; the proxy already refreshes the session.
        }
      },
    },
  });
}
