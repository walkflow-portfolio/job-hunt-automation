'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MANUAL_CLOSED, MANUAL_STATUSES, PLATFORMS, type ManualApplication, type ManualStatus, type Platform } from '@/lib/types';
import { daysSince, plural, todayKey } from '@/lib/format';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const noSubscribe = () => () => {};

export default function ApplicationsPage() {
  // The add form's default date is "today", so it is only drawn in the browser, never while the page is pre-built.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [rows, setRows] = useState<ManualApplication[]>([]);
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const [version, setVersion] = useState(0); // bumped after adding, to reload the list

  useEffect(() => {
    (async () => {
      let q = createClient().from('manual_applications').select('*').order('date_applied', { ascending: false }).order('created_at', { ascending: false });
      if (platform) q = q.eq('platform', platform);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) return setState('error');
      setRows((data ?? []) as ManualApplication[]);
      setState('ready');
    })();
  }, [platform, status, version]);

  async function update(id: string, patch: Partial<ManualApplication>) {
    const { error } = await createClient().from('manual_applications').update(patch).eq('id', id);
    if (error) return setMessage('Could not save that change. Please try again.');
    setMessage('');
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-bold">My Applications</h1>
      <p className="text-slate-700">Jobs you applied to yourself, on LinkedIn, Upwork, Indeed or anywhere else.</p>

      {inBrowser && <AddForm onAdded={() => setVersion((v) => v + 1)} />}

      <div className="card grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block font-semibold">Platform</span>
          <select className="field" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block font-semibold">Status</span>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </label>
      </div>

      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{message}</p>}
      {state === 'loading' && <div className="skeleton h-32" aria-busy="true" />}
      {state === 'error' && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Could not load your applications. Please refresh the page.</p>}
      {state === 'ready' && rows.length === 0 && <p className="card text-slate-600">Nothing here yet. Add your first application above.</p>}

      <ul className="stagger space-y-3">
        {rows.map((r) => {
          const late = r.follow_up_date && !MANUAL_CLOSED.includes(r.status) ? daysSince(r.follow_up_date) : -1;
          return (
            <li key={r.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{r.role_title}</p>
                  <p className="text-slate-700">{r.company} · {r.platform} · applied {r.date_applied}</p>
                </div>
                {r.job_url && <a href={r.job_url} target="_blank" rel="noreferrer" className="btn-quiet">Open job</a>}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-sm font-semibold">Status</span>
                  <select className="field" value={r.status} onChange={(e) => update(r.id, { status: e.target.value as ManualStatus })}>
                    {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                </label>
                <label>
                  <span className={`mb-1 block text-sm font-semibold ${late > 0 ? 'text-red-700' : ''}`}>
                    Follow up on{late > 0 ? ` · ${plural(late, 'day')} overdue` : late === 0 ? ' · due today' : ''}
                  </span>
                  <input
                    type="date"
                    className={`field ${late > 0 ? 'border-red-600 bg-red-50 font-bold text-red-800' : ''}`}
                    value={r.follow_up_date ?? ''}
                    onChange={(e) => update(r.id, { follow_up_date: e.target.value || null })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">Notes</span>
                  <textarea
                    className="field"
                    rows={1}
                    defaultValue={r.notes ?? ''}
                    placeholder="Add a note"
                    onBlur={(e) => e.target.value !== (r.notes ?? '') && update(r.id, { notes: e.target.value })}
                  />
                </label>
              </div>
              <details>
                <summary className="cursor-pointer font-semibold text-blue-900">More details (pay, contact, CV)</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Detail label="Pay or rate" value={r.pay_or_rate} onSave={(v) => update(r.id, { pay_or_rate: v })} />
                  <Detail label="CV version" value={r.cv_version} onSave={(v) => update(r.id, { cv_version: v })} />
                  <Detail label="Contact name" value={r.contact_name} onSave={(v) => update(r.id, { contact_name: v })} />
                  <Detail label="Contact email" value={r.contact_email} onSave={(v) => update(r.id, { contact_email: v })} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Detail({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input className="field" defaultValue={value ?? ''} onBlur={(e) => e.target.value !== (value ?? '') && onSave(e.target.value || null)} />
    </label>
  );
}

function AddForm({ onAdded }: { onAdded: () => void }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [platform, setPlatform] = useState<Platform>('LinkedIn');
  const [link, setLink] = useState('');
  const [date, setDate] = useState(todayKey());
  const [status, setStatus] = useState<ManualStatus>('applied');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await createClient().from('manual_applications').insert({
      company: company.trim(),
      role_title: role.trim(),
      platform,
      job_url: link.trim() || null,
      date_applied: date,
      status,
    });
    setBusy(false);
    if (error) return setError('Could not add it. Please check the details and try again.');
    setCompany('');
    setRole('');
    setLink('');
    setDate(todayKey());
    setStatus('applied');
    onAdded();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-lg font-semibold">Add an application</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className="mb-1 block font-semibold">Company</span><input className="field" required value={company} onChange={(e) => setCompany(e.target.value)} /></label>
        <label><span className="mb-1 block font-semibold">Role</span><input className="field" required value={role} onChange={(e) => setRole(e.target.value)} /></label>
        <label>
          <span className="mb-1 block font-semibold">Where did you apply?</span>
          <select className="field" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label><span className="mb-1 block font-semibold">Link to the job</span><input className="field" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} /></label>
        <label><span className="mb-1 block font-semibold">Date applied</span><input className="field" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>
          <span className="mb-1 block font-semibold">Status</span>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value as ManualStatus)}>
            {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add application'}</button>
    </form>
  );
}
