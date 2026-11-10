// Small date and wording helpers. Dates use the viewer's own time zone.

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in local time. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dayKey(new Date());

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysAgo = (n: number) => {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
};

export const startOfMonth = () => {
  const d = startOfToday();
  d.setDate(1);
  return d;
};

/** Whole days from a YYYY-MM-DD date to today (positive = in the past). */
export const daysSince = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  return Math.round((startOfToday().getTime() - then.getTime()) / 86_400_000);
};

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
