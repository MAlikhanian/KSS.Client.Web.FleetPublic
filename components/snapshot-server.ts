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
 * shown for up to FLEET_PUBLIC_STALE_SECONDS (default 600, ten minutes); after
 * that the page shows its graceful state.
 * Failures are logged here with a code, and never shown to a visitor.
 */
import { parseSnapshot, type Snapshot } from './snapshot';

export type SnapshotState =
  | { state: 'ok'; snapshot: Snapshot }
  | { state: 'empty' }
  | { state: 'unavailable' };

const TIMEOUT_MS = 4000;

let lastGood: { snapshot: Snapshot; at: number } | null = null;

/** Seconds from an env variable, or the default when unset or not a number >= 0. */
function secondsFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? String(fallback));
  return (Number.isFinite(raw) && raw >= 0 ? raw : fallback) * 1000;
}
const cacheMs = () => secondsFromEnv('FLEET_PUBLIC_CACHE_SECONDS', 30);
const staleLimitMs = () => secondsFromEnv('FLEET_PUBLIC_STALE_SECONDS', 600);

function logFailure(code: string, detail?: string) {
  console.error(`[fleet-public] snapshot unavailable: ${code}${detail ? ` (${detail})` : ''}`);
}

function fromStale(): SnapshotState {
  if (lastGood && Date.now() - lastGood.at <= staleLimitMs()) return { state: 'ok', snapshot: lastGood.snapshot };
  return { state: 'unavailable' };
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

  let body: unknown;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logFailure('SNAPSHOT_HTTP_ERROR', `status ${res.status}`);
      return fromStale();
    }
    body = await res.json();
  } catch (e) {
    logFailure(e instanceof Error && e.name === 'TimeoutError' ? 'SNAPSHOT_TIMEOUT' : 'SNAPSHOT_FETCH_FAILED');
    return fromStale();
  }

  const parsed = parseSnapshot(body);
  if (!parsed.ok) {
    logFailure('SNAPSHOT_INVALID', parsed.reason);
    return fromStale();
  }
  if (parsed.snapshot.agents.length === 0) {
    // A valid, empty team is not an error: nothing to log, nothing to keep.
    return { state: 'empty' };
  }
  lastGood = { snapshot: parsed.snapshot, at: Date.now() };
  return { state: 'ok', snapshot: parsed.snapshot };
}
