'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

// Ticks you make by hand are remembered in this browser only (nothing private is stored).
const KEY = 'jobhunt-setup-done';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
function toggle(id: string) {
  const done = new Set(read().split(',').filter(Boolean));
  if (done.has(id)) done.delete(id);
  else done.add(id);
  try {
    window.localStorage.setItem(KEY, [...done].join(','));
  } catch {
    // Private browsing: the tick just will not be remembered.
  }
  listeners.forEach((cb) => cb());
}

interface Item {
  id: string;
  title: string;
  required: boolean;
  auto?: 'supabase' | 'runNow';
  steps: string[];
  where?: string;
}

const ITEMS: Item[] = [
  {
    id: 'telegram',
    title: 'Create a new Telegram bot (BotFather) and get your chat ID',
    required: true,
    where: 'Token goes in the "JobHunt Telegram Bot" credential in n8n. The chat ID goes in the Send Telegram Alert node.',
    steps: [
      'Open Telegram and search for @BotFather. Send /newbot, pick a name (for example JobHunt Alerts) and a username that ends in "bot".',
      'BotFather sends you a token. Copy it.',
      'Open your new bot and send it any message, such as "hi". The bot cannot message you until you do this.',
      'Search for @userinfobot, press Start, and copy the number it calls Id. That is your chat ID.',
      'Use a brand new bot only for JobHunt. Do not reuse a bot from another project.',
    ],
  },
  {
    id: 'supabase',
    title: 'Supabase project (URL, anon key, service role key)',
    required: true,
    auto: 'supabase',
    where: 'JobHunt/.env (all three) and JobHunt/dashboard/.env.local (URL and anon key only).',
    steps: [
      'Create a free project at supabase.com.',
      'In SQL Editor run supabase/schema.sql.',
      'In Project Settings, API, copy the Project URL, the anon key and the service_role key. The service_role key is secret: never put it in the dashboard.',
    ],
  },
  {
    id: 'signups',
    title: 'Switch off sign-ups and create your own login',
    required: true,
    steps: [
      'In Supabase, go to Authentication, Sign In / Providers, and turn OFF "Allow new users to sign up".',
      'Under Authentication, Users, click Add user and create your email and password. This is how you sign in here.',
      'This matters because any signed-in user can read and write everything. With sign-ups off, only you can have an account.',
    ],
  },
  {
    id: 'n8n',
    title: 'n8n: workflow, credentials and API key',
    required: true,
    where: 'JobHunt/.env: N8N_BASE_URL and N8N_API_KEY.',
    steps: [
      'In n8n, go to Settings, n8n API, and create an API key.',
      'Create three credentials in n8n ("JobHunt Supabase", "JobHunt Telegram Bot", "JobHunt Webhook Secret") and import the "JobHunt - Find Jobs" workflow.',
      'Switch the workflow on (Active). It then runs once a day at the time you choose.',
    ],
  },
  {
    id: 'runnow',
    title: 'Connect the "Run now" button',
    required: true,
    auto: 'runNow',
    where: 'JobHunt/dashboard/.env.local: N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET. Then restart the dashboard.',
    steps: [
      'N8N_WEBHOOK_URL is your n8n address plus /webhook/jobhunt/run.',
      'N8N_WEBHOOK_SECRET is the same value as in JobHunt/.env. The browser never sees it.',
    ],
  },
  {
    id: 'vercel',
    title: 'Vercel (optional): put the dashboard online',
    required: false,
    steps: [
      'Only needed if you want to open the dashboard away from this computer.',
      'Import the JobHunt/dashboard folder in Vercel and add the same four values from .env.local as environment variables.',
    ],
  },
  {
    id: 'github',
    title: 'GitHub (optional): keep a copy of the code',
    required: false,
    steps: ['Create a private repository and push the JobHunt folder. The .gitignore already keeps your keys out.'],
  },
];

const LIMITS = [
  'Supabase free plan: a project that has no activity for about a week is paused until you wake it. Storage is limited, but job text is small.',
  'n8n: your self-hosted n8n has no run limit. On n8n Cloud, plans cap monthly executions; JobHunt uses one per day plus one per Run now.',
  'Telegram bots are free.',
  'Vercel free (Hobby) plan is for personal projects, which this is.',
  'These limits change. Check each provider’s pricing page before you rely on them.',
];

export default function SetupPage() {
  const doneText = useSyncExternalStore(subscribe, read, () => '');
  const manualDone = new Set(doneText.split(',').filter(Boolean));
  const [runNowSet, setRunNowSet] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/setup');
        setRunNowSet(res.ok ? Boolean((await res.json()).runNow) : false);
      } catch {
        setRunNowSet(false);
      }
    })();
  }, []);

  const isDone = (item: Item) =>
    item.auto === 'supabase' ? Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
    : item.auto === 'runNow' ? runNowSet === true
    : manualDone.has(item.id);

  const missing = ITEMS.filter((i) => i.required && !isDone(i));

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-bold">Setup</h1>
      <p className="card text-lg">
        {missing.length === 0 ? (
          <>Everything you need is set up.</>
        ) : (
          <>Still to do: <strong>{missing.length}</strong>. Start at the top. Items marked &ldquo;checked for you&rdquo; tick themselves; tick the others yourself.</>
        )}
      </p>

      <ol className="stagger space-y-3">
        {ITEMS.map((item, n) => {
          const done = isDone(item);
          return (
            <li key={item.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="flex-1 basis-64 text-base font-semibold">{n + 1}. {item.title}</h2>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${done ? 'bg-green-100 text-green-900' : item.required ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                  {done ? 'Done' : item.required ? 'To do' : 'Optional'}
                </span>
              </div>
              <ol className="list-decimal space-y-1 pl-6">
                {item.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              {item.where && <p className="rounded-lg bg-slate-50 p-2 text-sm"><strong>Where it goes:</strong> {item.where}</p>}
              {item.auto ? (
                <p className="text-sm text-slate-600">{item.auto === 'runNow' && runNowSet === null ? 'Checking…' : 'Checked for you.'}</p>
              ) : (
                <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={manualDone.has(item.id)} onChange={() => toggle(item.id)} />
                  I have done this
                </label>
              )}
            </li>
          );
        })}
      </ol>

      <section className="card">
        <h2 className="mb-2 text-base font-semibold">Free plan limits to know about</h2>
        <ul className="list-disc space-y-1 pl-6">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
    </div>
  );
}
