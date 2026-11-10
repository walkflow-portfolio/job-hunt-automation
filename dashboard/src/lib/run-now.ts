// "Run now": asks n8n to run the JobHunt workflow. This runs on the server only, so the n8n secret never reaches the browser.
// No framework imports on purpose, so it can be tested on its own (tests/run-now.test.mjs).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RunNowConfig {
  url?: string;
  secret?: string;
}

export type RunNowResult = { ok: true } | { ok: false; status: number; message: string };

export async function startRun(profileId: unknown, config: RunNowConfig, fetchImpl: typeof fetch = fetch): Promise<RunNowResult> {
  const wantsOne = profileId !== undefined && profileId !== null && profileId !== '';
  if (wantsOne && !(typeof profileId === 'string' && UUID.test(profileId))) {
    return { ok: false, status: 400, message: 'That search profile is not valid.' };
  }
  if (!config.url || !config.secret) {
    return { ok: false, status: 503, message: 'Run now is not set up yet. Add N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET to dashboard/.env.local.' };
  }

  try {
    const res = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-jobhunt-secret': config.secret },
      body: JSON.stringify(wantsOne ? { search_profile_id: profileId } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 502, message: 'n8n refused the request. Check that N8N_WEBHOOK_SECRET matches the "JobHunt Webhook Secret" credential in n8n.' };
    }
    if (!res.ok) {
      return { ok: false, status: 502, message: `n8n answered with an error (${res.status}). Is the "JobHunt - Find Jobs" workflow switched on?` };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, message: 'Could not reach n8n. Please try again.' };
  }
}
