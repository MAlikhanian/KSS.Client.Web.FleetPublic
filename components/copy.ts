/**
 * All text on the public site, in both languages, in one place so the two
 * versions cannot drift. Written for the public: no internal names, systems,
 * hosts or figures.
 */

export type Lang = 'fa' | 'en';

/**
 * The company's legal name in Persian, as its contracts write it. Inserted by
 * script from the source text, not typed, and codepoint-checked: Persian keheh
 * (U+06A9) and yeh (U+06CC), no Arabic kaf or yeh.
 */
export const LEGAL_NAME_FA = 'شرکت راهکار هوشمند کیوی';

export interface Copy {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  siteTitle: string;
  description: string;
  brand: string;
  switchLabel: string;
  switchHref: string;
  switchLang: Lang;
  title: string;
  intro: string;
  chartTitle: string;
  chartBody: string;
  members: (count: string) => string;
  leadership: string;
  activityTitle: string;
  activityBody: string;
  sent: string;
  received: string;
  other: string;
  otherBody: string;
  unavailableTitle: string;
  unavailableBody: string;
  emptyTitle: string;
  emptyBody: string;
  locale: string;
  artLabel: string;
  footerCopyright: string;
  footerCookies: string;
}

export const COPY: Record<Lang, Copy> = {
  fa: {
    lang: 'fa',
    dir: 'rtl',
    siteTitle: `تیم هوش مصنوعی ${LEGAL_NAME_FA}`,
    description: `${LEGAL_NAME_FA} تیمی از عامل‌های هوش مصنوعی دارد که مثل یک سازمان با هم کار می‌کنند.`,
    brand: `ناوگان ${LEGAL_NAME_FA}`,
    switchLabel: 'English',
    switchHref: '/en',
    switchLang: 'en',
    title: `تیم هوش مصنوعی ${LEGAL_NAME_FA}`,
    intro:
      `${LEGAL_NAME_FA} تیمی از عامل‌های هوش مصنوعی دارد که مثل یک سازمان با هم کار می‌کنند. هر عامل نقش مشخصی در یک واحد دارد و هر تیم سرپرستی دارد که کارها را برنامه‌ریزی و تقسیم می‌کند. در ادامه، همین تیم را همان‌طور که امروز هست می‌بینید.`,
    chartTitle: 'تیم امروز',
    chartBody: 'هر عامل با نام کوچک، نقش و واحدش، و اینکه به چه کسی گزارش می‌دهد. رنگ هر عامل نقش او را نشان می‌دهد.',
    members: (count) => `${count} عامل`,
    leadership: 'رهبری',
    activityTitle: 'فعالیت در هفت روز گذشته',
    activityBody: 'پیام‌هایی که عامل‌ها برای هم فرستاده و از هم دریافت کرده‌اند، به تفکیک واحد. تعدادهای کوچک با هم و با عنوان «سایر» نشان داده می‌شوند.',
    sent: 'فرستاده',
    received: 'دریافتی',
    other: 'سایر',
    otherBody: 'تعدادهای کوچک، با هم',
    unavailableTitle: 'نمودار تیم به‌زودی برمی‌گردد',
    unavailableBody: 'نمایش نمودار تیم در این لحظه ممکن نیست. لطفاً چند دقیقه دیگر دوباره سر بزنید.',
    emptyTitle: 'نمودار تیم به‌زودی اینجا نمایش داده می‌شود',
    emptyBody: 'هنوز عاملی برای نمایش وجود ندارد.',
    locale: 'fa-IR',
    artLabel: 'تصویری از یک نمودار سازمانی که با رنگ نقش‌های تیم کشیده شده است',
    footerCopyright: `© ۲۰۲۶ ${LEGAL_NAME_FA}`,
    footerCookies: 'این سایت هیچ کوکی‌ای ذخیره نمی‌کند.',
  },
  en: {
    lang: 'en',
    dir: 'ltr',
    siteTitle: 'The KSS AI team',
    description: 'KSS runs a team of AI agents that work together the way a company does.',
    brand: 'KSS Fleet',
    switchLabel: 'فارسی',
    switchHref: '/',
    switchLang: 'fa',
    title: 'The KSS AI team',
    intro:
      'KSS runs a team of AI agents that work together the way a company does. Each agent has one role in one department, and every team has a lead who plans the work and hands it out. Below is that team as it is today.',
    chartTitle: 'The team today',
    chartBody: 'Every agent by first name, role and department, and who they report to. Each agent’s colour marks their role.',
    members: (count) => `${count} agents`,
    leadership: 'Leadership',
    activityTitle: 'Activity in the last seven days',
    activityBody: 'Messages the agents sent to and received from each other, per department. Small counts are grouped together as “other”.',
    sent: 'Sent',
    received: 'Received',
    other: 'Other',
    otherBody: 'Small counts, grouped',
    unavailableTitle: 'The team chart will be back shortly',
    unavailableBody: 'The team chart can’t be shown right now. Please check again in a few minutes.',
    emptyTitle: 'The team chart will appear here soon',
    emptyBody: 'There are no agents to show yet.',
    locale: 'en-GB',
    artLabel: 'An illustration of an organisation chart drawn in the team’s role colours',
    footerCopyright: '© 2026 KSS',
    footerCookies: 'This site sets no cookies.',
  },
};
