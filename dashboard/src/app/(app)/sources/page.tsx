'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { plural } from '@/lib/format';

interface SourceRow {
  rank: number;
  source: string;
  kind: 'workflow' | 'manual';
  total_jobs: number;
  good_matches: number;
  average_score: number | null;
  applied: number;
  interviews: number;
  offers: number;
  interview_rate: number;
  source_points: number;
}

export default function SourcesPage() {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    (async () => {
      const { data, error } = await createClient().from('source_ranking').select('*').order('rank');
      if (error) return setState('error');
      setRows((data ?? []) as SourceRow[]);
      setState('ready');
    })();
  }, []);

  const best = rows[0]?.source_points ? rows[0] : null;
  const mostStrong = [...rows].filter((r) => r.kind === 'workflow').sort((a, b) => b.good_matches - a.good_matches)[0];
  const mostInterviews = [...rows].sort((a, b) => b.interviews - a.interviews)[0];

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-bold">Sources Ranking</h1>
      <p className="text-slate-700">Which places give you the best jobs. This includes sites the workflow searches and platforms you apply on yourself.</p>

      {state === 'loading' && <div className="skeleton h-40" aria-busy="true" />}
      {state === 'error' && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Could not load the ranking. Please refresh the page.</p>}

      {state === 'ready' && rows.length === 0 && <p className="card text-slate-600">Nothing to rank yet. Once jobs are found or you add applications, they appear here.</p>}

      {state === 'ready' && rows.length > 0 && (
        <>
          <section className="card space-y-1 text-lg" aria-label="In plain words">
            {best && (
              <p><strong>{best.source}</strong> is your best source so far, with {plural(best.source_points, 'point')}.</p>
            )}
            {mostStrong && mostStrong.good_matches > 0 && (
              <p><strong>{mostStrong.source}</strong> gives you the most strong matches ({mostStrong.good_matches}).</p>
            )}
            {mostInterviews && mostInterviews.interviews > 0 && (
              <p><strong>{mostInterviews.source}</strong> has brought you the most interviews ({mostInterviews.interviews}).</p>
            )}
            {!best && <p>No strong matches or interviews yet, so there is no clear winner.</p>}
          </section>

          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[44rem] text-left">
              <caption className="p-4 text-left text-sm text-slate-600">
                Points = strong matches + 3 for every interview + 10 for every offer. Interviews include offers.
              </caption>
              <thead className="border-y border-slate-200 bg-slate-50 text-sm">
                <tr>
                  {['#', 'Source', 'Jobs', 'Strong matches', 'Average score', 'Applied', 'Interviews', 'Offers', 'Interview rate', 'Points'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.source}`} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold">{r.rank}</td>
                    <td className="px-3 py-3">
                      <span className="font-semibold">{r.source}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${r.kind === 'manual' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                        {r.kind === 'manual' ? 'By hand' : 'Workflow'}
                      </span>
                    </td>
                    <td className="px-3 py-3">{r.total_jobs}</td>
                    <td className="px-3 py-3">{r.kind === 'manual' ? '–' : r.good_matches}</td>
                    <td className="px-3 py-3">{r.average_score == null ? '–' : `${r.average_score}%`}</td>
                    <td className="px-3 py-3">{r.applied}</td>
                    <td className="px-3 py-3">{r.interviews}</td>
                    <td className="px-3 py-3">{r.offers}</td>
                    <td className="px-3 py-3">{r.applied ? `${r.interview_rate}%` : '–'}</td>
                    <td className="px-3 py-3 font-bold text-blue-800">{r.source_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
