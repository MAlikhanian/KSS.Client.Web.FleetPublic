/**
 * Formatting for report DATA values only (report.data.json): times in Tehran, dates in the Jalali calendar, numbers
 * in Persian digits. The report's prose (report.fa.md) is never passed through here: it renders verbatim.
 */

export const REPORT_TIME_ZONE = 'Asia/Tehran';
const LOCALE = 'fa-IR-u-ca-persian-nu-arabext';

const DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Latin digits to Persian digits; everything else is left as it is. */
export function faDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DIGITS[Number(d)]);
}

/** A number in Persian digits with Persian grouping, at most `maxFraction` decimals. */
export function faNumber(n: number, maxFraction = 2): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxFraction }).format(n);
}

// The runtime joins some Persian date parts with a Latin comma; Persian text uses «،».
const fmt = (opts: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat(LOCALE, { timeZone: REPORT_TIME_ZONE, ...opts });
  return { format: (d: Date) => f.format(d).replace(/,/g, '،') };
};
const DATE_TIME = fmt({ year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY = fmt({ month: 'long', day: 'numeric' });
const DAY_LONG = fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const TIME = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const KEY = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "۲۷ مهر ۱۴۰۵، ۰۰:۰۰" style: the Jalali date and the 24-hour time in Tehran. */
export const tehranDateTime = (iso: string) => DATE_TIME.format(new Date(iso));
/** "۲۷ مهر": the Jalali day and month in Tehran. */
export const tehranDay = (iso: string) => DAY.format(new Date(iso));
/** "دوشنبه ۲۷ مهر ۱۴۰۵": the full Jalali date in Tehran. */
export const tehranDayLong = (iso: string) => DAY_LONG.format(new Date(iso));
/** "۰۰:۰۰": the 24-hour time in Tehran. */
export const tehranTime = (iso: string) => TIME.format(new Date(iso));
/** The calendar day in Tehran as a sortable key, for grouping. */
export const tehranDayKey = (iso: string) => KEY.format(new Date(iso));

/** ISO-8601 in UTC with a Z (no epoch numbers, no offsets other than Z). */
export const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
export const isIsoUtc = (v: unknown): v is string => typeof v === 'string' && ISO_UTC.test(v) && !Number.isNaN(Date.parse(v));
