import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { type ParsedReport, parseReportMarkdown } from './markdown';
import { parseReportData, type ReportData, SLUG } from './schema';

/**
 * Reports are content, not code: each one is a directory holding report.fa.md and report.data.json, mounted into the
 * pod read-only (a ConfigMap volume). They are read at request time, so new content needs no rebuild.
 *
 * - The directory is FLEET_PUBLIC_REPORTS_DIR, or /etc/kss-reports. Missing or unreadable means no reports.
 * - EVERY subdirectory is scanned, whatever its name; a report is found by the "slug" inside its data file, never by
 *   the directory's name. Entries starting with "." (the volume's own "..data" links) are skipped, and directories
 *   are recognised with stat (which follows the volume's symlinks), not by the entry type.
 * - Two directories claiming the same slug: both are refused, never guessed between.
 * - The parsed set is cached and rebuilt only when a file's size or modification time changes, so an updated
 *   ConfigMap is picked up on the next request after the volume refreshes.
 */

export const REPORT_MD = 'report.fa.md';
export const REPORT_DATA = 'report.data.json';
const MAX_BYTES = 1_000_000;

export interface Report {
  slug: string;
  markdown: ParsedReport;
  data: ReportData;
}

export const reportsDir = () => process.env.FLEET_PUBLIC_REPORTS_DIR || '/etc/kss-reports';

let cache: { key: string; reports: Map<string, Report> } | null = null;

function fileStamp(p: string): string | null {
  try {
    const s = statSync(p);
    return s.isFile() && s.size <= MAX_BYTES ? `${s.size}:${s.mtimeMs}` : null;
  } catch {
    return null;
  }
}

/** The report directories present now, with a fingerprint of their files. */
function scan(dir: string): { dirs: string[]; key: string } {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return { dirs: [], key: `${dir}|none` };
  }
  const dirs: string[] = [];
  const parts: string[] = [dir];
  for (const name of names.sort()) {
    if (name.startsWith('.')) continue;
    const sub = path.join(dir, name);
    try {
      if (!statSync(sub).isDirectory()) continue;
    } catch {
      continue;
    }
    const md = fileStamp(path.join(sub, REPORT_MD));
    const data = fileStamp(path.join(sub, REPORT_DATA));
    if (!md || !data) continue;
    dirs.push(sub);
    parts.push(`${name}|${md}|${data}`);
  }
  return { dirs, key: parts.join('\n') };
}

function build(dirs: string[]): Map<string, Report> {
  const found = new Map<string, Report>();
  const refused = new Set<string>();
  for (const dir of dirs) {
    const where = path.basename(dir);
    let raw: unknown;
    let md: string;
    try {
      raw = JSON.parse(readFileSync(path.join(dir, REPORT_DATA), 'utf8'));
      md = readFileSync(path.join(dir, REPORT_MD), 'utf8');
    } catch {
      console.error(`[fleet-public] report skipped (${where}): REPORT_UNREADABLE`);
      continue;
    }
    const parsed = parseReportData(raw);
    if (!parsed.ok) {
      console.error(`[fleet-public] report skipped (${where}): ${parsed.reason}`);
      continue;
    }
    const { slug } = parsed.data;
    if (found.has(slug) || refused.has(slug)) {
      found.delete(slug);
      refused.add(slug);
      console.error(`[fleet-public] report refused: DUPLICATE_SLUG (${where})`);
      continue;
    }
    const markdown = parseReportMarkdown(md);
    if (parsed.data.dropped) console.error(`[fleet-public] report ${slug}: ${parsed.data.dropped} malformed data item(s) dropped`);
    if (markdown.containerProblems.length) console.error(`[fleet-public] report ${slug}: container markers ignored (${markdown.containerProblems.join(', ')})`);
    found.set(slug, { slug, markdown, data: parsed.data });
  }
  return found;
}

/** Every valid report, by slug. Cheap when nothing changed: one directory listing and a stat per file. */
export function loadReports(): Map<string, Report> {
  const { dirs, key } = scan(reportsDir());
  if (cache?.key === key) return cache.reports;
  cache = { key, reports: build(dirs) };
  return cache.reports;
}

/** One report, or null for an unknown or malformed slug. The slug is checked before anything is read. */
export function getReport(slug: string): Report | null {
  if (typeof slug !== 'string' || slug.length > 100 || !SLUG.test(slug)) return null;
  return loadReports().get(slug) ?? null;
}
