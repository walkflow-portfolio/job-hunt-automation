export function ScoreBadge({ score }: { score: number }) {
  const style =
    score >= 80 ? 'bg-green-100 text-green-900' : score >= 60 ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-800';
  return (
    <span className={`inline-block min-w-14 rounded-full px-2.5 py-0.5 text-center text-sm font-bold ${style}`} title="Match score">
      {score}%
    </span>
  );
}
