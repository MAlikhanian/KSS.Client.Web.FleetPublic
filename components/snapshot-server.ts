/**
 * Server-only: fetches the public team snapshot from the in-cluster public
 * service. The BROWSER NEVER calls the service; only this server does.
 *
 * FLEET_PUBLIC_API_URL is the service's base URL, from the ConfigMap. It is a
 * server variable (no NEXT_PUBLIC_ prefix), so it never reaches the browser.
 *
 * Caching: the service already caches for 60 seconds, so this keeps the last
 * good snapshot in memory for FLEET_PUBLIC_CACHE_SECONDS (default 30) and asks
 * again after that. If a fetch then fails, the last good snapshot keeps being
 * shown for up to FLEET_PUBLIC_STALE_SECONDS (default 86400, one day); the page
 * names its update time, so an older chart is honest. Only with no good copy at
 * all does the page show its graceful state.
 *
 * A fetch that times out, cannot connect or gets a 5xx is retried ONCE after a
 * short pause: a service that is restarting or still cold answers the second
 * time. Failures are never cached; the next request asks again. Worst case per
 * request: two timeouts plus the pause (13.5 s).
 * Failures are logged here with a code, and never shown to a visitor.
 */
import { parseSnapshot, type Snapshot } from './snapshot';

export type SnapshotState =
  | { state: 'ok'; snapshot: Snapshot }
  | { state: 'empty' }
  | { state: 'unavailable' };

export const TIMEOUT_MS = 6000;
export const RETRY_DELAY_MS = 1500;

let lastGood: { snapshot: Snapshot; at: number } | null = null;

/** Seconds from an env variable, or the default when unset or not a number >= 0. */
function secondsFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? String(fallback));
  return (Number.isFinite(raw) && raw >= 0 ? raw : fallback) * 1000;
}
const cacheMs = () => secondsFromEnv('FLEET_PUBLIC_CACHE_SECONDS', 30);
const staleLimitMs = () => secondsFromEnv('FLEET_PUBLIC_STALE_SECONDS', 86400);

function logFailure(code: string, detail?: string) {
  console.error(`[fleet-public] snapshot unavailable: ${code}${detail ? ` (${detail})` : ''}`);
}

/** What a failure falls back to, for its log line: the last good copy and its age, or nothing. */
function staleNote(): string {
  if (!lastGood) return 'no good copy yet';
  const age = Math.round((Date.now() - lastGood.at) / 1000);
  return Date.now() - lastGood.at <= staleLimitMs() ? `showing the last good copy (${age} s old)` : 'the last good copy is too old';
}

function fromStale(): SnapshotState {
  if (lastGood && Date.now() - lastGood.at <= staleLimitMs()) return { state: 'ok', snapshot: lastGood.snapshot };
  return { state: 'unavailable' };
}

type Attempt = { ok: true; body: unknown } | { ok: false; code: string; detail?: string; retry: boolean };

/** One request to the service. A timeout, a connection error or a 5xx can be retried; anything else cannot. */
async function fetchOnce(url: URL): Promise<Attempt> {
  try {
    const res = await fetch(url, {
      // No fetch-cache option on purpose: 'no-store' would make the whole page dynamic again. Caching is
      // the page's own (ISR, 120 s) plus the memo above; the fetch itself is never stored.
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, code: 'SNAPSHOT_HTTP_ERROR', detail: `status ${res.status}`, retry: res.status >= 500 };
    return { ok: true, body: await res.json() };
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    return { ok: false, code: timeout ? 'SNAPSHOT_TIMEOUT' : 'SNAPSHOT_FETCH_FAILED', retry: true };
  }
}

export async function loadSnapshot(): Promise<SnapshotState> {
  if (lastGood && Date.now() - lastGood.at < cacheMs()) return { state: 'ok', snapshot: lastGood.snapshot };

  const base = process.env.FLEET_PUBLIC_API_URL;
  if (!base) {
    logFailure('SNAPSHOT_NOT_CONFIGURED');
    return { state: 'unavailable' };
  }

  let url: URL;
  try {
    url = new URL('/api/public/snapshot', base);
  } catch {
    logFailure('SNAPSHOT_BAD_BASE_URL');
    return { state: 'unavailable' };
  }

  let attempt = await fetchOnce(url);
  if (!attempt.ok && attempt.retry) {
    logFailure(attempt.code, `${attempt.detail ? `${attempt.detail}, ` : ''}retrying once`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    attempt = await fetchOnce(url);
  }
  if (!attempt.ok) {
    logFailure(attempt.code, `${attempt.detail ? `${attempt.detail}, ` : ''}${staleNote()}`);
    return fromStale();
  }
  const body = attempt.body;

  const parsed = parseSnapshot(body);
  if (!parsed.ok) {
    logFailure('SNAPSHOT_INVALID', `${parsed.reason}, ${staleNote()}`);
    return fromStale();
  }
  if (parsed.snapshot.agents.length === 0) {
    // A valid, empty team is not an error: nothing to log, nothing to keep.
    return { state: 'empty' };
  }
  if (!lastGood) console.log(`[fleet-public] snapshot ok: first live data since start (${parsed.snapshot.agents.length} agents)`);
  lastGood = { snapshot: parsed.snapshot, at: Date.now() };
  return { state: 'ok', snapshot: parsed.snapshot };
}
