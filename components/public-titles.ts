import type { Lang } from './copy';
import { DEPARTMENT_NAMES_FA, ROLE_NAMES_FA } from './names';

/**
 * Plain public job titles and department names, by the name the service serves. A DISPLAY mapping only: the
 * served names, and names.ts (the Persian map shared with the signed-in app), are unchanged. An unmapped name
 * falls back to names.ts in Persian and to the served name in English; "<X> expert" reads "<X> specialist".
 */
const ROLE_TITLES: Record<string, { en: string; fa: string }> = {
  CEO: { en: 'Chief executive', fa: 'مدیرعامل' },
  COO: { en: 'Head of operations & support', fa: 'مدیر عملیات و پشتیبانی' },
  CTO: { en: 'Head of engineering', fa: 'مدیر مهندسی' },
  CNO: { en: 'Head of network operations', fa: 'مدیر عملیات شبکه' },
  Assistant: { en: 'Executive assistant', fa: 'دستیار اجرایی' },
  Support: { en: 'Support specialist', fa: 'کارشناس پشتیبانی' },
  'Tech Lead': { en: 'Team lead', fa: 'سرپرست تیم' },
  DBA: { en: 'Database engineer', fa: 'مهندس پایگاه داده' },
  Backend: { en: 'Back-end engineer', fa: 'مهندس سمت سرور' },
  Frontend: { en: 'Front-end engineer', fa: 'مهندس رابط کاربری' },
  'Network Expert': { en: 'Network specialist', fa: 'کارشناس شبکه' },
};

const DEPARTMENT_TITLES: Record<string, { en: string; fa: string }> = {
  Executive: { en: 'Leadership', fa: 'مدیریت' },
  'Executive Office': { en: 'Executive assistants', fa: 'دستیاران اجرایی' },
  Engineering: { en: 'Software engineering', fa: 'مهندسی نرم‌افزار' },
  Network: { en: 'Network & infrastructure', fa: 'شبکه و زیرساخت' },
  'Customer Support': { en: 'Customer support', fa: 'پشتیبانی مشتریان' },
};

export function roleTitle(served: string, lang: Lang): string {
  const mapped = ROLE_TITLES[served];
  if (mapped) return mapped[lang];
  if (lang === 'fa') return ROLE_NAMES_FA[served] || served;
  return served.replace(/ expert$/i, ' specialist');
}

export function departmentTitle(served: string, lang: Lang): string {
  const mapped = DEPARTMENT_TITLES[served];
  if (mapped) return mapped[lang];
  return lang === 'fa' ? DEPARTMENT_NAMES_FA[served] || served : served;
}

