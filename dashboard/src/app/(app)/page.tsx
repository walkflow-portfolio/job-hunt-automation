'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { APPLIED, type Job, type ManualApplication, MANUAL_CLOSED, type SearchProfile } from '@/lib/types';
import { dayKey, daysAgo, daysSince, plural, startOfMonth, startOfToday } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';

type JobRow = Pick<Job, 'id' | 'title' | 'company' | 'source' | 'match_score' | 'status' | 'found_at' | 'applied_at' | 'url' | 'search_profile_id'>;
type AppRow = Pick<ManualApplication, 'id' | 'company' | 'role_title' | 'platform' | 'status' | 'date_applied' | 'follow_up_date'>;

const DEFAULT_ALERT = 60;

export default function OverviewPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [profiles, setProfiles] = useState<Pick<SearchProfile, 'id' | 'alert_score' | 'is_active'>[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [j, a, p] = await Promise.all([
        supabase
          .from('jobs')
          .select('id,title,company,source,match_score,status,found_at,applied_at,url,search_profile_id')
          .order('found_at', { ascending: false })
          .limit(5000),
        supabase.from('manual_applications').select('id,company,role_title,platform,status,date_applied,follow_up_date'),
        supabase.from('search_profiles').select('id,alert_score,is_active'),
      ]);
      if (j.error || a.error || p.error) return setState('error');
      setJobs((j.data ?? []) as JobRow[]);
      setApps((a.data ?? []) as AppRow[]);
      setProfiles((p.data ?? []) as typeof profiles);
      setState('ready');
    })();
  }, []);

  const view = useMemo(() => {
    if (state !== 'ready') return null; // dates are only read after the data is in, never while the page is pre-built
    const alertOf = new Map(profiles.map((p) => [p.id, p.alert_score]));
    const strongAt = (j: JobRow) => (j.search_profile_id ? alertOf.get(j.search_profile_id) : undefined) ?? DEFAULT_ALERT;
    const isStrong = (j: JobRow) => j.match_score >= strongAt(j);
    const activeAlerts = profiles.filter((p) => p.is_active).map((p) => p.alert_score);
    const threshold = activeAlerts.length ? Math.min(...activeAlerts) : DEFAULT_ALERT;

    const today = startOfToday().getTime();
    const weekAgo = daysAgo(7).getTime();
    const monthStart = startOfMonth().getTime();
    const at = (iso: string) => new Date(iso).getTime();

    const workflowApplied = jobs.filter((j) => APPLIED.includes(j.status));
    const interviews = jobs.filter((j) => j.status === 'interview' || j.status === 'offer').length + apps.filter((a) => a.status === 'interview' || a.status === 'offer').length;
    const offers = jobs.filter((j) => j.status === 'offer').length + apps.filter((a) => a.status === 'offer').length;
    const totalApplied = workflowApplied.length + apps.length;

    const weekJobs = jobs.filter((j) => at(j.found_at) >= weekAgo);
    const weekApplied =
      workflowApplied.filter((j) => j.applied_at && at(j.applied_at) >= weekAgo).length +
      apps.filter((a) => daysSince(a.date_applied) <= 7).length;

    const waiting = jobs.filter((j) => (j.status === 'new' || j.status === 'saved') && isStrong(j));
    const best = [...jobs.filter((j) => j.status === 'new' || j.status === 'saved')]
      .sort((a, b) => b.match_score - a.match_score || at(b.found_at) - at(a.found_at))
      .slice(0, 5);

    const perDay = Array.from({ length: 14 }, (_, i) => {
      const d = daysAgo(13 - i);
      return { key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 };
    });
    for (const j of jobs) {
      const slot = perDay.find((d) => d.key === dayKey(new Date(j.found_at)));
      if (slot) slot.count += 1;
    }

    // Same points as the Sources Ranking: strong matches + 3 per interview + 10 per offer, for this month only.
    const points = new Map<string, { strong: number; interviews: number; offers: number }>();
    const bump = (name: string, field: 'strong' | 'interviews' | 'offers') => {
      const row = points.get(name) ?? { strong: 0, interviews: 0, offers: 0 };
      row[field] += 1;
      points.set(name, row);
    };
    for (const j of jobs.filter((x) => at(x.found_at) >= monthStart)) {
      if (isStrong(j)) bump(j.source, 'strong');
      if (j.status === 'interview' || j.status === 'offer') bump(j.source, 'interviews');
      if (j.status === 'offer') bump(j.source, 'offers');
    }
    for (const a of apps.filter((x) => new Date(x.date_applied + 'T00:00:00').getTime() >= monthStart)) {
      if (a.status === 'interview' || a.status === 'offer') bump(a.platform, 'interviews');
      if (a.status === 'offer') bump(a.platform, 'offers');
    }
    const topSources = [...points.entries()]
      .map(([name, p]) => ({ name, ...p, score: p.strong + 3 * p.interviews + 10 * p.offers }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const followUps = apps
      .filter((a) => a.follow_up_date && !MANUAL_CLOSED.includes(a.status) && daysSince(a.follow_up_date) >= 0)
      .sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));

    return {
      threshold,
      newToday: jobs.filter((j) => at(j.found_at) >= today).length,
      waiting: waiting.length,
      totalApplied,
      interviews,
      offers,
      weekFound: weekJobs.length,
      weekStrong: weekJobs.filter(isStrong).length,
      weekApplied,
      best,
      perDay,
      topSources,
      followUps,
      funnel: [
        { label: 'Found', count: jobs.length },
        { label: 'Strong match', count: jobs.filter(isStrong).length },
        { label: 'Applied', count: totalApplied },
        { label: 'Interview', count: interviews },
        { label: 'Offer', count: offers },
      ],
    };
  }, [jobs, apps, profiles, state]);

  if (state === 'error') return <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Could not load your data. Please refresh the page.</p>;
  if (!view) return <div className="space-y-4" aria-busy="true"><div className="skeleton h-16" /><div className="skeleton h-28" /><div className="skeleton h-56" /></div>;

  const maxFunnel = Math.max(1, ...view.funnel.map((f) => f.count));
  const maxDay = Math.max(1, ...view.perDay.map((d) => d.count));

  return (
    <div className="stagger space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <section aria-label="Summary" className="card text-lg">
        <p>
          This week you found <strong>{plural(view.weekFound, 'job')}</strong>. <strong>{view.weekStrong}</strong>{' '}
          {view.weekStrong === 1 ? 'is a strong match' : 'are strong matches'} ({view.threshold}%+). You applied to{' '}
          <strong>{view.weekApplied}</strong>.
        </p>
      </section>

      <section aria-label="Numbers" className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="New jobs today" value={view.newToday} />
        <Stat label="Strong matches waiting" value={view.waiting} />
        <Stat label="Total applied" value={view.totalApplied} note="from the workflow and by hand" />
        <Stat label="Interviews" value={view.interviews} />
        <Stat label="Offers" value={view.offers} />
      </section>

      <section className="card" aria-labelledby="best">
        <h2 id="best" className="mb-3 text-lg font-semibold">Best 5 to apply to today</h2>
        {view.best.length === 0 ? (
          <p className="text-slate-600">Nothing waiting. New jobs appear here after the next run.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.best.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                <ScoreBadge score={j.match_score} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{j.title}</p>
                  <p className="text-slate-600">{j.company || 'Unknown company'} · {j.source}</p>
                </div>
                <a href={j.url} target="_blank" rel="noreferrer" className="btn-quiet">Open job</a>
              </li>
            ))}
          </ol>
        )}
        <Link href="/jobs" className="mt-3 inline-block font-semibold text-blue-800 underline">See all jobs</Link>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card" aria-labelledby="funnel">
          <h2 id="funnel" className="mb-3 text-lg font-semibold">From found to offer</h2>
          <ul className="space-y-3">
            {view.funnel.map((f) => (
              <li key={f.label}>
                <div className="mb-1 flex justify-between"><span>{f.label}</span><strong>{f.count}</strong></div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="bar-x h-3 rounded-full bg-blue-600" style={{ width: `${Math.max(2, (f.count / maxFunnel) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="perday">
          <h2 id="perday" className="mb-3 text-lg font-semibold">Jobs found each day</h2>
          <div className="flex h-44 items-end gap-1.5" role="img" aria-label={`Jobs found per day for 14 days: ${view.perDay.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
            {view.perDay.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold">{d.count || ''}</span>
                <div className="bar-y w-full rounded-t bg-blue-600" style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / maxDay) * 120)}px`, opacity: d.count ? 1 : 0.25 }} />
                <span className="text-[11px] text-slate-600">{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card" aria-labelledby="top3">
          <h2 id="top3" className="mb-3 text-lg font-semibold">Top 3 sources this month</h2>
          {view.topSources.length === 0 ? (
            <p className="text-slate-600">No strong matches this month yet.</p>
          ) : (
            <>
              <p className="mb-3"><strong>{view.topSources[0].name}</strong> gives you the most this month.</p>
              <ol className="list-decimal space-y-1 pl-6">
                {view.topSources.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong> · {plural(s.strong, 'strong match', 'strong matches')}
                    {s.interviews ? `, ${plural(s.interviews, 'interview')}` : ''}
                    {s.offers ? `, ${plural(s.offers, 'offer')}` : ''}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="followups">
          <h2 id="followups" className="mb-3 text-lg font-semibold">Follow-ups due</h2>
          {view.followUps.length === 0 ? (
            <p className="text-slate-600">No follow-ups due. Nice.</p>
          ) : (
            <ul className="space-y-2">
              {view.followUps.map((a) => {
                const late = daysSince(a.follow_up_date!);
                return (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2">
                    <span><strong>{a.company}</strong> · {a.role_title} <span className="text-slate-600">({a.platform})</span></span>
                    <span className={late > 0 ? 'font-bold text-red-700' : 'font-semibold'}>{late > 0 ? `${plural(late, 'day')} late` : 'Due today'}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/applications" className="mt-3 inline-block font-semibold text-blue-800 underline">Open My Applications</Link>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="card text-center">
      <p className="font-display text-3xl font-bold text-blue-800">{value}</p>
      <p className="font-semibold">{label}</p>
      {note && <p className="text-sm text-slate-600">{note}</p>}
    </div>
  );
}
