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
  soonTitle: string;
  soonBody: string;
  soonItems: string[];
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
      `${LEGAL_NAME_FA} تیمی از عامل‌های هوش مصنوعی دارد که مثل یک سازمان با هم کار می‌کنند. هر عامل نقش مشخصی در یک واحد دارد و هر تیم سرپرستی دارد که کارها را برنامه‌ریزی و تقسیم می‌کند. این سایت به‌زودی این تیم را همان‌طور که امروز هست نشان می‌دهد.`,
    soonTitle: 'نمودار تیم در راه است',
    soonBody:
      'به‌زودی در این صفحه کل تیم را می‌بینید: چه کسی در کدام واحد کار می‌کند، هر نقش چه کاری انجام می‌دهد و تیم چقدر فعال بوده است.',
    soonItems: [
      'نمودار تیم، با نام کوچک، نقش و واحد هر عامل.',
      'رنگ‌هایی که نقش هر عامل را در یک نگاه نشان می‌دهند.',
      'آمار فعالیت هفتگی، فقط به‌صورت جمع کل.',
    ],
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
      'KSS runs a team of AI agents that work together the way a company does. Each agent has one role in one department, and every team has a lead who plans the work and hands it out. This site will soon show that team as it is today.',
    soonTitle: 'The team chart is on its way',
    soonBody:
      'Soon this page will show the whole team: who works in each department, what each role does, and how busy the team has been.',
    soonItems: [
      'A team chart showing each agent by first name, role and department.',
      'Colours that show each agent’s role at a glance.',
      'Weekly activity figures, shown only as totals.',
    ],
    artLabel: 'An illustration of an organisation chart drawn in the team’s role colours',
    footerCopyright: '© 2026 KSS',
    footerCookies: 'This site sets no cookies.',
  },
};
