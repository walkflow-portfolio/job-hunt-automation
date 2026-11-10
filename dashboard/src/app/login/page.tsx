'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError('That email or password did not work. Please try again.');
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="font-display mb-1 text-2xl font-bold text-blue-800">JobHunt</h1>
      <p className="mb-6 text-slate-600">Sign in to see your jobs.</p>
      <form onSubmit={submit} className="card space-y-4">
        <label className="block">
          <span className="mb-1 block font-semibold">Email</span>
          <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Password</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
