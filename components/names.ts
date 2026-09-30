/**
 * Persian names for the roles and departments the Fleet service serves, keyed by
 * the served (English) name. Copied by script from the Fleet web app's own map,
 * so both sites use the same words. An unmapped name is shown as served.
 */
export const ROLE_NAMES_FA: Record<string, string> = {
  CEO: 'مدیرعامل',
  'CEO Advisor': 'مشاور مدیرعامل',
  CTO: 'مدیر ارشد فناوری',
  COO: 'مدیر ارشد عملیات',
  Agent: 'عامل',
  Assistant: 'دستیار',
  Contracts: 'کارشناس قراردادها',
  Secretary: 'دبیر',
  Scheduler: 'برنامه‌ریز',
  Support: 'پشتیبانی',
  'Tech Lead': 'سرپرست فنی',
  DBA: 'مدیر پایگاه داده',
  Backend: 'بک‌اند',
  Frontend: 'فرانت‌اند'
};

export const DEPARTMENT_NAMES_FA: Record<string, string> = {
  Executive: 'مدیریت اجرایی',
  Advisory: 'مشاوره',
  Engineering: 'مهندسی',
  'Board Office': 'دفتر هیئت‌مدیره',
  'Founder\'s Office': 'دفتر بنیان‌گذار',
  'Executive Office': 'دفتر اجرایی',
  Legal: 'حقوقی',
  Secretariat: 'دبیرخانه',
  Operations: 'عملیات',
  'Customer Support': 'پشتیبانی مشتریان',
  Unassigned: 'بدون واحد'
};
