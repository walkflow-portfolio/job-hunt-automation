'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildProfile } from '@/lib/keywords';
import type { SearchProfile } from '@/lib/types';

type Profile = SearchProfile & { title_keywords: string[]; skill_keywords: string[]; industry_keywords: string[]; exclude_keywords: string[]; job_types: string[] };
interface RunRow {
  id: string;
  started_at: string;
  search_profile_id: string | null;
  jobs_fetched: number;
  jobs_new: number;
  good_matches: number;
  rejected_by_location: number;
  errors: { source: string; message: string }[];
}

const JOB_TYPES = ['contract', 'freelance', 'full-time'];
const WAIT_MS = 150_000; // how long to keep looking for the run's result

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);

  const loadRuns = useCallback(async () => {
    const { data } = await createClient().from('runs').select('*').order('started_at', { ascending: false }).limit(10);
    setRuns((data ?? []) as RunRow[]);
    return (data ?? []) as RunRow[];
  }, []);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const [p, r] = await Promise.all([
      supabase.from('search_profiles').select('*').order('created_at'),
      supabase.from('runs').select('*').order('started_at', { ascending: false }).limit(10),
    ]);
    if (p.error || r.error) return setState('error');
    setProfiles((p.data ?? []) as Profile[]);
    setRuns((r.data ?? []) as RunRow[]);
    setState('ready');
  }, []);

  useEffect(() => {
    (async () => {
      await loadAll();
    })();
  }, [loadAll]);

  // After "Run now", look for the new run record every few seconds.
  useEffect(() => {
    if (waitingSince === null) return;
    const timer = setInterval(async () => {
      const latest = await loadRuns();
      const arrived = latest.some((r) => new Date(r.started_at).getTime() >= waitingSince - 5000);
      if (arrived) {
        setWaitingSince(null);
        setNotice({ kind: 'ok', text: 'The run finished. Your results are in the table below and in Jobs.' });
      } else if (Date.now() - waitingSince > WAIT_MS) {
        setWaitingSince(null);
        setNotice({ kind: 'bad', text: 'The run is taking longer than usual. Press "Refresh runs" in a minute.' });
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [waitingSince, loadRuns]);

  async function runNow(profile: Profile) {
    setStarting(profile.id);
    setNotice(null);
    try {
      const res = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ search_profile_id: profile.id }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setNotice({ kind: 'bad', text: body.error ?? 'Could not start the run.' });
      setNotice({ kind: 'ok', text: `Started "${profile.name}". This takes about a minute. The result will appear below.` });
      setWaitingSince(Date.now());
    } catch {
      setNotice({ kind: 'bad', text: 'Could not start the run. Please check your internet and try again.' });
    } finally {
      setStarting(null);
    }
  }

  async function toggleActive(profile: Profile) {
    const { error } = await createClient().from('search_profiles').update({ is_active: !profile.is_active }).eq('id', profile.id);
    if (error) return setNotice({ kind: 'bad', text: 'Could not save that change. Please try again.' });
    setProfiles((all) => all.map((p) => (p.id === profile.id ? { ...p, is_active: !p.is_active } : p)));
  }

  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? 'Deleted profile';

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-bold">Search Profiles</h1>
      <p className="text-slate-700">
        A profile tells JobHunt what to look for. Add one for any skill or role. The same workflow searches every active profile, so nothing else needs building.
      </p>

      <AddProfile
        onAdded={async () => {
          setNotice({ kind: 'ok', text: 'Profile saved. It will be searched at the next run, or press "Run now" on it.' });
          await loadAll();
        }}
      />

      {notice && (
        <p role={notice.kind === 'bad' ? 'alert' : 'status'} className={`pop-in rounded-lg p-3 ${notice.kind === 'bad' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}>
          {notice.text}
          {waitingSince !== null && <span className="skeleton ml-3 inline-block h-3 w-16 align-middle" aria-hidden="true" />}
        </p>
      )}

      {state === 'loading' && <div className="skeleton h-40" aria-busy="true" />}
      {state === 'error' && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Could not load your profiles. Please refresh the page.</p>}

      <ul className="stagger space-y-3">
        {profiles.map((p) => (
          <li key={p.id} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <p className="text-slate-700">Looks for: {p.title_keywords.join(', ')}</p>
                <p className="text-sm text-slate-600">
                  {p.skill_keywords.length} skills · {p.industry_keywords.length} industries · {p.exclude_keywords.length} words to avoid · saves at {p.save_score}%, alerts at {p.alert_score}%
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={p.is_active} onChange={() => toggleActive(p)} />
                  {p.is_active ? 'On' : 'Off'}
                </label>
                <button className="btn" disabled={starting !== null || waitingSince !== null} onClick={() => runNow(p)}>
                  {starting === p.id ? 'Starting…' : 'Run now'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="card" aria-labelledby="runs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="runs" className="text-lg font-semibold">Recent runs</h2>
          <button className="btn-quiet" onClick={loadRuns}>Refresh runs</button>
        </div>
        {runs.length === 0 ? (
          <p className="text-slate-600">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="border-b border-slate-200 text-sm">
                <tr>
                  {['When', 'Profile', 'Jobs checked', 'New', 'Strong', 'Not open to you', 'Problems'].map((h) => (
                    <th key={h} scope="col" className="px-2 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                    <td className="px-2 py-2">{new Date(r.started_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-2 py-2">{nameOf(r.search_profile_id)}</td>
                    <td className="px-2 py-2">{r.jobs_fetched}</td>
                    <td className="px-2 py-2 font-bold">{r.jobs_new}</td>
                    <td className="px-2 py-2">{r.good_matches}</td>
                    <td className="px-2 py-2">{r.rejected_by_location}</td>
                    <td className="px-2 py-2">
                      {r.errors?.length ? (
                        <ul className="space-y-1 text-red-800">
                          {r.errors.map((e, i) => <li key={i}><strong>{e.source}</strong>: {e.message}</li>)}
                        </ul>
                      ) : (
                        <span className="text-green-800">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-slate-600">&ldquo;Not open to you&rdquo; means jobs limited to other countries (for example US only).</p>
      </section>
    </div>
  );
}

function AddProfile({ onAdded }: { onAdded: () => void }) {
  const [role, setRole] = useState('');
  const [otherTitles, setOtherTitles] = useState('');
  const [skills, setSkills] = useState('');
  const [industries, setIndustries] = useState('');
  const [excludes, setExcludes] = useState('');
  const [jobTypes, setJobTypes] = useState<string[]>(JOB_TYPES);
  const [alertScore, setAlertScore] = useState(60);
  const [saveScore, setSaveScore] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!jobTypes.length) return setError('Tick at least one job type.');
    setBusy(true);
    const { error } = await createClient().from('search_profiles').insert(buildProfile({ role, otherTitles, skills, industries, excludes, jobTypes, alertScore, saveScore }));
    setBusy(false);
    if (error) return setError(error.code === '23505' ? 'You already have a profile with that name.' : 'Could not save the profile. Please try again.');
    setRole(''); setOtherTitles(''); setSkills(''); setIndustries(''); setExcludes('');
    onAdded();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-lg font-semibold">Add a profile</h2>
      <label className="block">
        <span className="mb-1 block font-semibold">What do you want to find?</span>
        <input className="field" required maxLength={80} placeholder="For example: web design, email marketer, Shopify developer" value={role} onChange={(e) => setRole(e.target.value)} />
        <span className="mt-1 block text-sm text-slate-600">Put the most important job title first. Sites only search with this one.</span>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <Optional label="Other job titles" hint="Separate with commas, e.g. web designer, ui designer" value={otherTitles} onChange={setOtherTitles} />
        <Optional label="Skills" hint="e.g. webflow, framer, figma" value={skills} onChange={setSkills} />
        <Optional label="Industries you like" hint="e.g. real estate, clinics" value={industries} onChange={setIndustries} />
        <Optional label="Words to avoid" hint="Any job with these scores 0, e.g. internship, unpaid" value={excludes} onChange={setExcludes} />
      </div>
      <fieldset>
        <legend className="mb-1 font-semibold">Job types</legend>
        <div className="flex flex-wrap gap-4">
          {JOB_TYPES.map((t) => (
            <label key={t} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={jobTypes.includes(t)} onChange={(e) => setJobTypes((all) => (e.target.checked ? [...all, t] : all.filter((x) => x !== t)))} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <details>
        <summary className="cursor-pointer font-semibold text-blue-900">Scores (you can leave these)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1 block font-semibold">Save jobs scoring at least</span><input className="field" type="number" min={0} max={100} value={saveScore} onChange={(e) => setSaveScore(Number(e.target.value))} /></label>
          <label><span className="mb-1 block font-semibold">Send a Telegram alert at</span><input className="field" type="number" min={0} max={100} value={alertScore} onChange={(e) => setAlertScore(Number(e.target.value))} /></label>
        </div>
      </details>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}

function Optional({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold">{label} <span className="font-normal text-slate-600">(optional)</span></span>
      <input className="field" placeholder={hint} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
