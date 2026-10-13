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
  reportsTo: (name: string) => string;
  /** When the snapshot was generated, already formatted with its time zone. */
  updated: (time: string) => string;
  /** The IANA zone the update time is shown in, and its label. */
  timeZone: string;
  leadership: string;
  /** Dashboard chrome: section menu, stat tiles, cards. */
  nav: { label: string; overview: string; leadership: string; engineering: string; network: string; departments: string; activity: string };
  statAgents: string;
  statTeams: string;
  statMessages: string;
  statActive: string;
  cLevel: string;
  executiveOffice: string;
  engineeringBody: string;
  departmentsBody: string;
  teamLead: string;
  /** "+3" on an avatar group. */
  more: (n: number) => string;
  /** "Last activity: 5 minutes ago", built from Intl.RelativeTimeFormat output. Never "online" or "active". */
  lastActive: (relative: string) => string;
  sparkLabel: (values: string) => string;
  /** A day the service suppresses (fewer than 3 messages) arrives as 0: never shown as "none". */
  underThree: string;
  /** A total that includes suppressed days is a lower bound. */
  atLeast: (n: string) => string;
  themeLight: string;
  themeDark: string;
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
  /** The build-time page (no service exists at build): replaced within seconds by the first regeneration. */
  pendingTitle: string;
  pendingBody: string;
  locale: string;
  artLabel: string;
  footerCopyright: string;
  footerCookies: string;
  /** The story at the top of the page: what this is, what the agents do, how a request is handled. */
  story: Story;
  /** The dashboard: sidebar, top bar, stat cards and the usage graphs. */
  dash: Dash;
}

export interface Dash {
  pageTitle: string;
  nav: { label: string; overview: string; usage: string; what: string; teams: string; activity: string; how: string };
  /** Opens the phone menu (the sidebar's links). */
  menu: string;
  statDepartments: string;
  statMessagesHint: string;
  statTeamsHint: (products: string | null) => string;
  usageTitle: string;
  messagesTitle: string;
  messagesBody: string;
  /** The first column of the chart's data table. */
  department: string;
  hoursTitle: string;
  hoursBody: string;
  hoursLabel: (values: string) => string;
  accountsTitle: string;
  accountsNone: string;
  accountsBody: string;
  mixTitle: string;
  /** The grouped departments in a chart or the mix: everything but the four named groups. */
  otherDepartments: string;
  /** The chart's day labels: short weekday and day of month, for a UTC date. */
  dayLabel: (isoDay: string) => string;
  colAgents: string;
  colTrend: string;
  totalRow: string;
}

export interface StoryCard {
  key: 'support' | 'engineering' | 'network' | 'leadership';
  title: string;
  /** One plain sentence. Two are approved practice claims: see STORY_CLAIMS. */
  body: string;
}

export interface Story {
  /** The headline with the live agent count; `null` when there is no snapshot (the number is then left out). */
  headline: (count: string | null) => string;
  /** The sub-line: the answers, then the approved changes clause (STORY_CLAIMS), then deletion. */
  subAnswers: string;
  subDeletion: string;
  ctaSite: string;
  live: (time: string) => string;
  whatTitle: string;
  cards: StoryCard[];
  /** Live numbers on the cards. */
  numSupport: string;
  numTeams: (teams: string, products: string | null) => string;
  numSpecialties: string;
  numActiveHour: string;
  howTitle: string;
  /** The five steps: [title, line]. Step 4 is truth-checked: it claims only a recorded approval and the deletion rule. */
  steps: [string, string][];
  teamTitle: string;
  /** Quiet bands for the last activity: today, this week, standby (more than a week, or none). */
  activeToday: string;
  thisWeek: string;
  standby: string;
  headsOfDepartment: string;
  executiveAssistants: string;
}

/**
 * Claims about how the work is done, kept as single strings because each was checked for truth and approved as
 * worded. Change one only with the same check: it is a public statement about our practice.
 *  - changes: the hero's middle clause.
 *  - network, support: the two card sentences.
 */
export const STORY_CLAIMS: Record<Lang, { changes: string; network: string; support: string }> = {
  en: {
    changes: 'Changes to your systems follow a written plan or an approved standing procedure',
    network: 'A specialist for each technology. Every change follows a written plan or an approved standing procedure, with a configuration backup taken first.',
    support: 'Customers are served in their own support rooms. Agents answer in the customer’s language.',
  },
  fa: {
    changes: 'تغییرات در سیستم‌های شما طبق برنامهٔ مکتوب یا یک روال دائمیِ تأییدشده انجام می‌شود',
    network: 'برای هر فناوری یک متخصص. هر تغییر طبق برنامهٔ مکتوب یا یک روال دائمیِ تأییدشده، و پس از تهیهٔ نسخهٔ پشتیبان از پیکربندی، انجام می‌شود.',
    support: 'مشتریان در اتاق‌های پشتیبانی خودشان پشتیبانی می‌شوند. عامل‌ها به زبان مشتری پاسخ می‌دهند.',
  },
};

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
    chartBody: 'هر عامل با نام کوچک، نقش و واحدش، و اینکه به چه کسی گزارش می‌دهد.',
    members: (count) => `${count} عامل`,
    reportsTo: (name) => `گزارش به ${name}`,
    updated: (time) => `به‌روزرسانی: ${time} به وقت تهران`,
    timeZone: 'Asia/Tehran',
    leadership: 'رهبری',
    nav: { label: 'بخش‌ها', overview: 'نمای کلی', leadership: 'رهبری', engineering: 'مهندسی', network: 'شبکه', departments: 'واحدها', activity: 'فعالیت' },
    statAgents: 'عامل‌ها',
    statTeams: 'تیم‌های مهندسی',
    statMessages: 'پیام‌ها در هفت روز گذشته',
    statActive: 'آخرین فعالیت در ۱۵ دقیقهٔ گذشته',
    cLevel: 'مدیران ارشد',
    executiveOffice: 'دفتر اجرایی',
    engineeringBody: 'هر تیم مهندسی با عنوان کارش، سرپرست و اعضایش.',
    departmentsBody: 'واحدهای دیگر، هر کدام با اعضایش.',
    teamLead: 'سرپرست',
    more: (n) => `+${n.toLocaleString('fa-IR')}`,
    lastActive: (relative) => `آخرین فعالیت: ${relative}`,
    sparkLabel: (values) => `پیام‌ها در هفت روز گذشته، از قدیم به جدید: ${values}`,
    underThree: 'کمتر از ۳',
    atLeast: (n) => `دست‌کم ${n}`,
    themeLight: 'حالت روشن',
    themeDark: 'حالت تیره',
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
    pendingTitle: 'در حال بارگذاری تازه‌ترین داده‌های تیم',
    pendingBody: 'داده‌های زنده در راه است؛ این صفحه تا چند لحظهٔ دیگر خودش به‌روز می‌شود.',
    locale: 'fa-IR',
    artLabel: 'تصویری از یک نمودار سازمانی',
    footerCopyright: `© ۲۰۲۶ ${LEGAL_NAME_FA}`,
    footerCookies: 'این سایت هیچ کوکی‌ای ذخیره نمی‌کند.',
    story: {
      headline: (n) =>
        n
          ? `${LEGAL_NAME_FA} پشتیبانی مشتریان، مهندسی نرم‌افزار و عملیات شبکهٔ خود را با تیمی از ${n} عامل هوش مصنوعی، به‌صورت زنده، اداره می‌کند.`
          : `${LEGAL_NAME_FA} پشتیبانی مشتریان، مهندسی نرم‌افزار و عملیات شبکهٔ خود را با تیمی از عامل‌های هوش مصنوعی، به‌صورت زنده، اداره می‌کند.`,
      subAnswers: 'پاسخ سریع و صادقانه به فارسی یا انگلیسی، با متن یا صدا.',
      subDeletion: 'و حذف داده همیشه به تأیید یک شخص نیاز دارد.',
      ctaSite: 'مشاهدهٔ kss.ir',
      live: (time) => `داده‌های زندهٔ تیم، به‌روزرسانی: ${time} به وقت تهران`,
      whatTitle: 'عامل‌ها چه می‌کنند',
      cards: [
        { key: 'support', title: 'پشتیبانی مشتریان', body: STORY_CLAIMS.fa.support },
        { key: 'engineering', title: 'مهندسی نرم‌افزار', body: `تیم‌هایی که محصولات ${LEGAL_NAME_FA} را در سه مرحلهٔ تأییدشده می‌سازند و نگه می‌دارند: رابط کاربری، پایگاه داده، سمت سرور.` },
        { key: 'network', title: 'شبکه و زیرساخت', body: STORY_CLAIMS.fa.network },
        { key: 'leadership', title: 'مدیریت', body: 'مدیرعامل و مدیران بخش‌ها کار را برنامه‌ریزی و میان تیم‌ها تقسیم می‌کنند.' },
      ],
      numSupport: 'پیام در هفت روز گذشته',
      numTeams: (teams, products) => (products ? `تیم، ${products} محصول فعال` : 'تیم'),
      numSpecialties: 'تخصص',
      numActiveHour: 'عامل با فعالیت در یک ساعت گذشته',
      howTitle: 'یک درخواست چطور انجام می‌شود',
      steps: [
        ['شما می‌پرسید', 'در اتاق پشتیبانی خود، با متن یا صدا'],
        ['عامل پشتیبانی پاسخ می‌دهد', 'به زبان شما، و درخواست را ثبت می‌کند'],
        ['متخصص اقدام می‌کند', 'مهندسی یا شبکه، اگر تغییری لازم باشد'],
        ['تأیید', 'تغییرات پایگاه داده با تأیید ثبت‌شده انجام می‌شود؛ حذف داده همیشه به تأیید کتبی یک شخص نیاز دارد'],
        ['انجام شد', 'و به شما اطلاع داده می‌شود؛ اگر چیزی در انتظار باشد، با تاریخ'],
      ],
      teamTitle: 'تیم زنده',
      activeToday: 'فعالیت امروز',
      thisWeek: 'این هفته',
      standby: 'آماده به کار',
      headsOfDepartment: 'مدیران بخش‌ها',
      executiveAssistants: 'دستیاران اجرایی',
    },
    dash: {
      pageTitle: 'داشبورد تیم',
      nav: { label: 'بخش‌ها', overview: 'نمای کلی', usage: 'مصرف و فعالیت', what: 'چه می‌کنند', teams: 'تیم‌ها', activity: 'واحدها', how: 'روند کار' },
      menu: 'بخش‌ها',
      statDepartments: 'واحدها',
      statMessagesHint: 'پیام‌های فرستاده‌شده، روزبه‌روز',
      statTeamsHint: (products) => (products ? `${products} محصول فعال` : 'هر تیم با یک سرپرست'),
      usageTitle: 'مصرف و فعالیت',
      messagesTitle: 'پیام‌ها در هر روز، به تفکیک واحد',
      messagesBody: 'پیام‌هایی که عامل‌ها در هفت روز گذشته فرستاده‌اند (روزها به وقت UTC). تعدادهای کوچک در «واحدهای دیگر» آمده‌اند.',
      department: 'واحد',
      hoursTitle: 'عامل‌های فعال در هر ساعت، امروز',
      hoursBody: 'ساعت‌ها به وقت UTC. ساعتی با کمتر از ۳ عامل، کوتاه و خاکستری نشان داده می‌شود.',
      hoursLabel: (values) => `عامل‌های فعال در هر ساعت امروز، به وقت UTC: ${values}`,
      accountsTitle: 'مصرف حساب‌های هوش مصنوعی',
      accountsNone: 'خوانش تازه‌ای در دسترس نیست',
      accountsBody: 'وقتی خوانش‌ها منتشر شوند، مصرف هفتگی هر حساب اینجا نمایش داده می‌شود.',
      mixTitle: 'تیم به تفکیک واحد',
      otherDepartments: 'واحدهای دیگر',
      dayLabel: (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fa-IR', { timeZone: 'UTC', day: 'numeric', month: 'short' }),
      colAgents: 'عامل‌ها',
      colTrend: 'هفت روز',
      totalRow: 'جمع',
    },
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
    chartBody: 'Every agent by first name, role and department, and who they report to.',
    members: (count) => `${count} agents`,
    reportsTo: (name) => `Reports to ${name}`,
    updated: (time) => `Updated ${time} UTC`,
    timeZone: 'UTC',
    leadership: 'Leadership',
    nav: { label: 'Sections', overview: 'Overview', leadership: 'Leadership', engineering: 'Engineering', network: 'Network', departments: 'Departments', activity: 'Activity' },
    statAgents: 'Agents',
    statTeams: 'Engineering teams',
    statMessages: 'Messages, last 7 days',
    statActive: 'Last activity in the past 15 minutes',
    cLevel: 'C-level',
    executiveOffice: 'Executive Office',
    engineeringBody: 'Every engineering team by what it works on, with its lead and members.',
    departmentsBody: 'The other departments, each with its members.',
    teamLead: 'Lead',
    more: (n) => `+${n}`,
    lastActive: (relative) => `Last activity: ${relative}`,
    sparkLabel: (values) => `Messages over the last seven days, oldest first: ${values}`,
    underThree: 'fewer than 3',
    atLeast: (n) => `at least ${n}`,
    themeLight: 'Light mode',
    themeDark: 'Dark mode',
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
    pendingTitle: 'Loading the latest team data',
    pendingBody: 'The live figures are on their way; this page refreshes by itself in a moment.',
    locale: 'en-GB',
    artLabel: 'An illustration of an organisation chart',
    footerCopyright: '© 2026 KSS',
    footerCookies: 'This site sets no cookies.',
    story: {
      headline: (n) =>
        n
          ? `KSS runs its customer support, software engineering and network operations with a team of ${n} AI agents, working live.`
          : 'KSS runs its customer support, software engineering and network operations with a team of AI agents, working live.',
      subAnswers: 'Fast, honest answers in Persian or English, by text or voice.',
      subDeletion: 'and deleting data always needs a person’s approval.',
      ctaSite: 'Visit kss.ir',
      live: (time) => `Live data from the team, updated ${time} UTC`,
      whatTitle: 'What the agents do',
      cards: [
        { key: 'support', title: 'Customer support', body: STORY_CLAIMS.en.support },
        { key: 'engineering', title: 'Software engineering', body: 'Teams that build and maintain KSS’s products, in three approved stages: interface, database, back end.' },
        { key: 'network', title: 'Network & infrastructure', body: STORY_CLAIMS.en.network },
        { key: 'leadership', title: 'Leadership', body: 'A chief executive and heads of department plan the work and hand it out to each team.' },
      ],
      numSupport: 'messages in the last seven days',
      numTeams: (teams, products) => (products ? `teams · ${products} products in service` : 'teams'),
      numSpecialties: 'specialties',
      numActiveHour: 'agents with activity in the last hour',
      howTitle: 'How a request is handled',
      steps: [
        ['You ask', 'in your support room, by text or voice'],
        ['A support agent answers', 'in your language, and logs the request'],
        ['A specialist acts', 'engineering or network, when a change is needed'],
        ['Approval', 'database changes go through a recorded approval; deleting data always needs a person’s written approval'],
        ['Done', 'and you are told, with the date if anything waits'],
      ],
      teamTitle: 'The live team',
      activeToday: 'Active today',
      thisWeek: 'This week',
      standby: 'Standby',
      headsOfDepartment: 'Heads of department',
      executiveAssistants: 'Executive assistants',
    },
    dash: {
      pageTitle: 'Team dashboard',
      nav: { label: 'Sections', overview: 'Overview', usage: 'Usage & activity', what: 'What they do', teams: 'Teams', activity: 'Departments', how: 'How it works' },
      menu: 'Sections',
      statDepartments: 'Departments',
      statMessagesHint: 'Messages sent, day by day',
      statTeamsHint: (products) => (products ? `${products} products in service` : 'Each with its own lead'),
      usageTitle: 'Usage & activity',
      messagesTitle: 'Messages per day, by department',
      messagesBody: 'Messages the agents sent in the last seven days (UTC days). Small counts are grouped under “other departments”.',
      department: 'Department',
      hoursTitle: 'Active agents per hour, today',
      hoursBody: 'Hours in UTC. An hour with fewer than 3 active agents is drawn short and grey.',
      hoursLabel: (values) => `Active agents per hour today, UTC: ${values}`,
      accountsTitle: 'AI account usage',
      accountsNone: 'No recent reading',
      accountsBody: 'Each account’s weekly usage will appear here once readings are published.',
      mixTitle: 'The team by department',
      otherDepartments: 'Other departments',
      dayLabel: (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }),
      colAgents: 'Agents',
      colTrend: '7 days',
      totalRow: 'Total',
    },
  },
};
