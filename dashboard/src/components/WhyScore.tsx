import type { ScoreBreakdown } from '@/lib/types';

const list = (words?: string[]) => (words && words.length ? words.join(', ') : '');

/** Explains a job's score in plain sentences, line by line. */
export function WhyScore({ breakdown, total }: { breakdown: ScoreBreakdown; total: number }) {
  const p = breakdown.points ?? {};
  const m = breakdown.matched ?? {};
  const lines: { points: number; text: string }[] = [
    {
      points: p.title ?? 0,
      text: m.title?.length ? `The job title matches what you look for (${list(m.title)}).` : 'The job title does not match your title keywords.',
    },
    {
      points: p.skills ?? 0,
      text: m.skills?.length ? `It mentions your skills: ${list(m.skills)}.` : 'It does not mention your skills.',
    },
    { points: p.location ?? 0, text: breakdown.location_reason ? `Location: ${breakdown.location_reason}.` : 'Location is not clear.' },
    {
      points: p.job_type ?? 0,
      text: m.job_type?.length ? `The job type fits (${list(m.job_type)}).` : `The job type is not one you asked for${breakdown.job_type ? ` (${breakdown.job_type})` : ''}.`,
    },
    {
      points: p.industry ?? 0,
      text: m.industry?.length ? `It is in an industry you like (${list(m.industry)}).` : 'It is not in one of your industries.',
    },
  ];

  return (
    <div>
      <p className="mb-2 text-lg font-bold">Why it scored {total}%</p>
      {breakdown.excluded && breakdown.excluded.length > 0 && (
        <p className="mb-2 rounded-lg bg-red-50 p-2 text-red-800">Score set to 0 because it contains: {list(breakdown.excluded)}.</p>
      )}
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.text} className="flex gap-3">
            <span className={`w-12 shrink-0 text-right font-bold ${l.points ? 'text-green-700' : 'text-slate-500'}`}>+{l.points}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
