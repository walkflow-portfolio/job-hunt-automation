import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps everyone who is not signed in out. Signed-out visitors can only see /login.
 * Sign-ups are switched off in Supabase, so the only account is the owner's.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const onLogin = request.nextUrl.pathname === '/login';

  if (!data.user && !onLogin) {
    if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (data.user && onLogin) return NextResponse.redirect(new URL('/', request.url));
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
