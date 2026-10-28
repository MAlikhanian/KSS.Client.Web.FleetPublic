/**
 * A small, safe Markdown subset for report prose. It never produces HTML: it returns plain blocks that the page
 * renders as React elements, so raw HTML in the source shows as text. Supported:
 *   headings (# to ####), paragraphs, "> " callouts, ordered and unordered lists (nested by indent), pipe tables,
 *   "---" rules, `inline code`, **bold**, a {{chart:id}} line, the {{figures}} and {{timeline}} lines, and
 *   container blocks ":::<kind>" ... ":::" (see CONTAINER_KINDS).
 * Anything else is a paragraph. The text is kept verbatim: no digit or date conversion happens here. A container
 * marker line is never shown: an unknown or misplaced one is dropped and its content renders as ordinary text.
 */

import { STATUS_NOTE, statusOf, type StatusTone } from './status';

export type Block =
  | { t: 'h'; level: 1 | 2 | 3 | 4; text: string }
  | { t: 'p'; text: string }
  | { t: 'quote'; paragraphs: string[] }
  | { t: 'list'; list: List }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'hr' }
  | { t: 'chart'; id: string }
  | { t: 'figures' }
  | { t: 'timeline' }
  | { t: 'container'; kind: ContainerKind; blocks: Block[] };

/**
 * The container kinds. "opening" and "closing" are the report's first and last statements (at most one of each);
 * the callouts are tinted boxes that may appear anywhere, any number of times.
 */
export const CONTAINER_KINDS = ['opening', 'closing', 'callout-warn', 'callout-info', 'callout-ok'] as const;
export type ContainerKind = (typeof CONTAINER_KINDS)[number];

export interface List {
  ordered: boolean;
  items: { text: string; children: List[] }[];
}

export interface ParsedReport {
  blocks: Block[];
  /** The text of the first level-1 heading, if any: the page title. */
  title: string | null;
  /** The first container fault found (its markers were dropped and its content shown as ordinary text), or null. */
  containerProblem: string | null;
  /** Every container fault, in order of the lines. */
  containerProblems: string[];
}

const CONTAINER_OPEN = /^:::([a-z][a-z-]*)$/;
const CONTAINER_END = ':::';
const CHART = /^\{\{chart:([a-z0-9-]+)\}\}$/;
const HEADING = /^(#{1,4})\s+(.+?)\s*#*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

/** Splits a pipe-table row into cells; a pipe inside `code` or escaped as \| does not split. */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  let code = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '`') {
      code = !code;
      cur += ch;
    } else if (ch === '|' && !code) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * The container rules: each marker line stands alone with no indent; no nesting; every block is closed by a ":::"
 * line; no chart placeholder inside. "opening" and "closing" appear at most once; the opening must be the first block
 * (only blank lines before it) and the closing the last (only blank lines after it).
 * A block that breaks a rule, or has an unknown kind, is UNWRAPPED, never shown raw: its marker lines are dropped and
 * its content stays as ordinary text. Valid blocks elsewhere are unaffected.
 */
function findContainers(lines: string[]): { ranges: { kind: ContainerKind; start: number; end: number }[]; drop: Set<number>; problems: string[] } {
  const ranges: { kind: ContainerKind; start: number; end: number }[] = [];
  const drop = new Set<number>();
  const problems: string[] = [];
  let open: { kind: ContainerKind | null; start: number; fault: string | null } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = CONTAINER_OPEN.exec(line);
    if (m) {
      if (open) {
        drop.add(i);
        open.fault ??= 'NESTED';
        continue;
      }
      const kind = (CONTAINER_KINDS as readonly string[]).includes(m[1]) ? (m[1] as ContainerKind) : null;
      open = { kind, start: i, fault: kind ? null : 'UNKNOWN_KIND' };
    } else if (line === CONTAINER_END) {
      if (!open) {
        drop.add(i);
        problems.push('UNOPENED_END');
        continue;
      }
      if (open.kind && !open.fault) ranges.push({ kind: open.kind, start: open.start, end: i });
      else {
        drop.add(open.start).add(i);
        problems.push(open.fault ?? 'UNKNOWN_KIND');
      }
      open = null;
    } else if (/^\s*:::/.test(line)) {
      drop.add(i);
      problems.push('MALFORMED_MARKER');
    } else if (open && CHART.test(line.trim())) {
      open.fault ??= 'CHART_INSIDE';
    }
  }
  if (open) {
    drop.add(open.start);
    problems.push('UNTERMINATED');
  }
  // Placement of the opening and closing statements; a second one of either kind is unwrapped.
  const blank = (a: number, b: number) => lines.slice(a, b).every((l, k) => l.trim() === '' || drop.has(a + k));
  const keep: typeof ranges = [];
  const seen = new Set<ContainerKind>();
  for (const r of ranges) {
    let fault: string | null = null;
    if ((r.kind === 'opening' || r.kind === 'closing') && seen.has(r.kind)) fault = 'REPEATED';
    else if (r.kind === 'opening' && !blank(0, r.start)) fault = 'OPENING_NOT_FIRST';
    else if (r.kind === 'closing' && !blank(r.end + 1, lines.length)) fault = 'CLOSING_NOT_LAST';
    seen.add(r.kind);
    if (fault) {
      drop.add(r.start).add(r.end);
      problems.push(fault);
    } else keep.push(r);
  }
  return { ranges: keep, drop, problems };
}

function parseLines(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  const isBlank = (l: string) => l.trim() === '';
  const startsBlock = (l: string) =>
    isBlank(l) || HEADING.test(l) || l.startsWith('>') || LIST_ITEM.test(l) || l.trimStart().startsWith('|') || /^-{3,}\s*$/.test(l) || CHART.test(l.trim()) || /^\{\{(figures|timeline)\}\}$/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (isBlank(line)) {
      i++;
      continue;
    }
    const chart = CHART.exec(trimmed);
    if (chart) {
      blocks.push({ t: 'chart', id: chart[1] });
      i++;
      continue;
    }
    if (trimmed === '{{figures}}' || trimmed === '{{timeline}}') {
      blocks.push({ t: trimmed === '{{figures}}' ? 'figures' : 'timeline' });
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: 'h', level: h[1].length as 1 | 2 | 3 | 4, text: h[2] });
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const paragraphs: string[] = [];
      let cur: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        const body = lines[i].replace(/^>\s?/, '');
        if (body.trim() === '') {
          if (cur.length) paragraphs.push(cur.join(' '));
          cur = [];
        } else cur.push(body.trim());
        i++;
      }
      if (cur.length) paragraphs.push(cur.join(' '));
      blocks.push({ t: 'quote', paragraphs });
      continue;
    }
    if (trimmed.startsWith('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1].trim())) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const { list, next } = parseList(lines, i);
      blocks.push({ t: 'list', list });
      i = next;
      continue;
    }
    const para: string[] = [trimmed];
    i++;
    while (i < lines.length && !startsBlock(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ t: 'p', text: para.join(' ') });
  }
  return blocks;
}

/** A list and its nested lists, by indent. A non-item line indented under an item continues that item. */
function parseList(lines: string[], start: number): { list: List; next: number } {
  const first = LIST_ITEM.exec(lines[start])!;
  const baseIndent = first[1].length;
  const list: List = { ordered: /\d/.test(first[2]), items: [] };
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      // A blank line ends the list unless the next line is an item of this list or deeper.
      const nextItem = i + 1 < lines.length ? LIST_ITEM.exec(lines[i + 1]) : null;
      if (nextItem && nextItem[1].length >= baseIndent) {
        i++;
        continue;
      }
      break;
    }
    const m = LIST_ITEM.exec(line);
    if (m) {
      const indent = m[1].length;
      if (indent < baseIndent) break;
      if (indent > baseIndent && list.items.length) {
        const { list: child, next } = parseList(lines, i);
        list.items[list.items.length - 1].children.push(child);
        i = next;
        continue;
      }
      if (indent > baseIndent) break;
      if (/\d/.test(m[2]) !== list.ordered) break;
      list.items.push({ text: m[3].trim(), children: [] });
      i++;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent > baseIndent && list.items.length) {
      const last = list.items[list.items.length - 1];
      last.text = `${last.text} ${line.trim()}`;
      i++;
      continue;
    }
    break;
  }
  return { list, next: i };
}

export function parseReportMarkdown(source: string): ParsedReport {
  const lines = source.replace(/^﻿/, '').split(/\r?\n/);
  const found = findContainers(lines);
  // A dropped marker line becomes a blank line, so the text around it parses as it would without it.
  const clean = lines.map((l, i) => (found.drop.has(i) ? '' : l));
  const blocks: Block[] = [];
  let at = 0;
  for (const r of found.ranges.sort((a, b) => a.start - b.start)) {
    blocks.push(...parseLines(clean.slice(at, r.start)));
    blocks.push({ t: 'container', kind: r.kind, blocks: parseLines(clean.slice(r.start + 1, r.end)) });
    at = r.end + 1;
  }
  blocks.push(...parseLines(clean.slice(at)));
  const findTitle = (bs: Block[]): string | null => {
    for (const b of bs) {
      if (b.t === 'h' && b.level === 1) return b.text;
      if (b.t === 'container') {
        const t = findTitle(b.blocks);
        if (t) return t;
      }
    }
    return null;
  };
  return { blocks, title: findTitle(blocks), containerProblem: found.problems[0] ?? null, containerProblems: found.problems };
}

/**
 * Inline spans: `code`, **bold** (code may sit inside bold), and status notes. A parenthesised note that opens with a
 * status word, "(word)" or "(word، …)", becomes a coloured status note; a bold span that is exactly a status word
 * becomes a coloured word (see status.ts). Everything else is text, unchanged.
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; v: Inline[] }
  | { t: 'status'; v: string; tone: StatusTone; bold: boolean };

/** Splits plain text around status notes. */
function withStatusNotes(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  STATUS_NOTE.lastIndex = 0;
  for (let m = STATUS_NOTE.exec(text); m; m = STATUS_NOTE.exec(text)) {
    if (m.index > at) out.push({ t: 'text', v: text.slice(at, m.index) });
    out.push({ t: 'status', v: m[0], tone: statusOf(m[1])!, bold: false });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ t: 'text', v: text.slice(at) });
  return out;
}

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\*\*(.+?)\*\*/g;
  let at = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > at) out.push(...withStatusNotes(s.slice(at, m.index)));
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else {
      const tone = statusOf(m[2]);
      out.push(tone ? { t: 'status', v: m[2], tone, bold: true } : { t: 'bold', v: parseInline(m[2]) });
    }
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push(...withStatusNotes(s.slice(at)));
  return out;
}
