'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { APPLIED, JOB_STATUSES, JOB_STATUS_LABEL, NOT_APPLIED, type Job, type JobStatus, type SearchProfile } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import { WhyScore } from '@/components/WhyScore';

type Tab = 'todo' | 'applied' | 'skipped';
const TABS: { id: Tab; label: string; statuses: JobStatus[] }[] = [
  { id: 'todo', label: 'Not applied yet', statuses: NOT_APPLIED },
  { id: 'applied', label: 'Applied', statuses: APPLIED },
  { id: 'skipped', label: 'Skipped', statuses: ['skipped'] },
];
const LIMIT = 300;

export default function JobsPage() {
  const [tab, setTab] = useState<Tab>('todo');
  const [minScore, setMinScore] = useState(0);
  const [source, setSource] = useState('');
  const [profileId, setProfileId] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Pick<SearchProfile, 'id' | 'name'>[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState<Job | null>(null);

  // Options for the filters.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [p, s] = await Promise.all([supabase.from('search_profiles').select('id,name').order('name'), supabase.from('jobs').select('source').limit(5000)]);
      setProfiles((p.data ?? []) as typeof profiles);
      const names = ((s.data ?? []) as { source: string }[]).map((r) => r.source);
      setSources([...new Set(names)].sort());
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let q = createClient()
        .from('jobs')
        .select('*')
        .in('status', TABS.find((t) => t.id === tab)!.statuses)
        .gte('match_score', minScore)
        .order('match_score', { ascending: false })
        .order('found_at', { ascending: false })
        .limit(LIMIT);
      if (source) q = q.eq('source', source);
      if (profileId) q = q.eq('search_profile_id', profileId);
      const { data, error } = await q;
      if (error) return setState('error');
      setJobs((data ?? []) as Job[]);
      setState('ready');
    })();
  }, [tab, minScore, source, profileId]);

  async function changeStatus(job: Job, status: JobStatus) {
    const patch: Partial<Job> = { status };
    if (status === 'applied' && !job.applied_at) patch.applied_at = new Date().toISOString();
    const { error } = await createClient().from('jobs').update(patch).eq('id', job.id);
    if (error) return setMessage('Could not save that change. Please try again.');
    setMessage('');
    // The job moves to another tab if its status now belongs there.
    setJobs((rows) => rows.flatMap((r) => (r.id !== job.id ? [r] : TABS.find((t) => t.id === tab)!.statuses.includes(status) ? [{ ...r, ...patch }] : [])));
    setOpen((o) => (o && o.id === job.id ? { ...o, ...patch } : o));
  }

  async function saveNotes(job: Job, notes: string) {
    if ((job.notes ?? '') === notes) return;
    const { error } = await createClient().from('jobs').update({ notes }).eq('id', job.id);
    if (error) return setMessage('Could not save your note. Please try again.');
    setMessage('');
    setJobs((rows) => rows.map((r) => (r.id === job.id ? { ...r, notes } : r)));
  }

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-bold">Jobs</h1>

      <div role="tablist" aria-label="Job groups" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-lg px-4 py-2 font-semibold ${tab === t.id ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card grid gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1 block font-semibold">Lowest score</span>
          <select className="field" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
            <option value={0}>Any score</option>
            {[50, 60, 70, 80, 90].map((n) => (
              <option key={n} value={n}>{n}% or more</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block font-semibold">Source</span>
          <select className="field" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block font-semibold">Search profile</span>
          <select className="field" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">All profiles</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{message}</p>}
      {state === 'loading' && <div className="skeleton h-32" aria-busy="true" />}
      {state === 'error' && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Could not load jobs. Please refresh the page.</p>}
      {state === 'ready' && jobs.length === 0 && <p className="card text-slate-600">No jobs here yet. Try a lower score or another tab.</p>}
      {state === 'ready' && jobs.length === LIMIT && <p className="text-sm text-slate-600">Showing the best {LIMIT}. Use the filters to narrow down.</p>}

      <ul className="stagger space-y-3">
        {jobs.map((job) => (
          <li key={job.id} className="card">
            <div className="flex flex-wrap items-start gap-3">
              <ScoreBadge score={job.match_score} />
              <div className="min-w-0 flex-1 basis-64">
                <button onClick={() => setOpen(job)} className="text-left text-lg font-bold text-blue-900 underline decoration-dotted underline-offset-4">
                  {job.title}
                </button>
                <p className="text-slate-700">
                  {job.company || 'Unknown company'} · {job.location || 'Location not stated'} · <span className="font-semibold">{job.source}</span>
                  {job.posted_at ? ` · posted ${formatDate(job.posted_at)}` : ''}
                </p>
              </div>
              <a href={job.url} target="_blank" rel="noreferrer" className="btn-quiet">Open job</a>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
              <label>
                <span className="mb-1 block text-sm font-semibold">Status</span>
                <select className="field" value={job.status} onChange={(e) => changeStatus(job, e.target.value as JobStatus)}>
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Notes</span>
                <textarea
                  className="field"
                  rows={1}
                  defaultValue={job.notes ?? ''}
                  placeholder="Add a note"
                  onBlur={(e) => saveNotes(job, e.target.value)}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      {open && <JobDetail job={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fade-in fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={job.title}
        className="card pop-in my-8 w-full max-w-3xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{job.title}</h2>
            <p className="text-slate-700">{job.company || 'Unknown company'} · {job.location || 'Location not stated'} · {job.source}</p>
          </div>
          <button onClick={onClose} className="btn-quiet" autoFocus>Close</button>
        </div>
        <WhyScore breakdown={job.score_breakdown ?? {}} total={job.match_score} />
        <div>
          <p className="mb-1 text-lg font-bold">Job description</p>
          <p className="max-h-96 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-3">{job.description || 'No description was provided.'}</p>
        </div>
        <a href={job.url} target="_blank" rel="noreferrer" className="btn">Open job</a>
      </div>
    </div>
  );
}
