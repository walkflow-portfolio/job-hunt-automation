'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Pages are added here as they are built.
const ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/applications', label: 'My Applications' },
  { href: '/sources', label: 'Sources Ranking' },
  { href: '/profiles', label: 'Search Profiles' },
  { href: '/setup', label: 'Setup' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-display text-lg font-bold text-blue-800">JobHunt</span>
        <nav aria-label="Main" className="flex flex-1 flex-wrap gap-1">
          {ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 font-semibold ${active ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="btn-quiet">
          Sign out
        </button>
      </div>
    </header>
  );
}
