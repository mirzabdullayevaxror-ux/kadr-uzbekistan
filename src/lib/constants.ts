export type AppRole = 'mutaxassis' | 'mijoz' | 'kompaniya' | 'sotuvchi' | 'oquv_markazi' | 'admin';
export type AccountKind = Exclude<AppRole, 'admin'>;

export type AccountStatus =
  | 'draft' | 'submitted' | 'in_review' | 'approved' | 'needs_info' | 'rejected' | 'blocked';

export const KIND_LABEL: Record<AccountKind, string> = {
  mutaxassis: 'Mutaxassis',
  mijoz: 'Mijoz',
  kompaniya: 'Kompaniya',
  sotuvchi: 'Sotuvchi',
  oquv_markazi: 'O‘quv markazi'
};

export const KIND_PATH: Record<AccountKind, string> = {
  mutaxassis: 'talent',
  mijoz: 'client',
  kompaniya: 'company',
  sotuvchi: 'shop',
  oquv_markazi: 'center'
};

export const NEEDS_APPROVAL: Record<AccountKind, boolean> = {
  mutaxassis: true,
  mijoz: false,
  kompaniya: true,
  sotuvchi: true,
  oquv_markazi: true
};

export const STATUS_LABEL: Record<AccountStatus, string> = {
  draft: 'Qoralama',
  submitted: 'Tekshiruvga yuborildi',
  in_review: 'Tekshiruvda',
  approved: 'Tasdiqlangan',
  needs_info: 'Qayta ma’lumot so‘raldi',
  rejected: 'Rad etilgan',
  blocked: 'Bloklangan'
};

export const PROFESSIONS = [
  'Brand Face', 'Mobilograf', 'Videograf', 'Fotograf', 'Montajyor', 'Rejissyor', 'Operator',
  'Dizayner', 'SMM', 'Prodyuser', 'Kinograf', 'Ssenarist', 'Motion Designer', 'Grafik dizayner',
  'UI/UX dizayner', 'Colorist', 'Sound Designer', 'Ovoz rejissyori', 'Diktor / Voice Actor',
  'Aktyor', 'Aktrisa', 'Model', 'Boshlovchi / Presenter', 'Content Creator', 'UGC Creator',
  'Copywriter', 'Targetolog', 'Marketolog', 'PR mutaxassisi', 'Influencer/Blogger', 'Drone Operator',
  'Gaffer/Yorituvchi', 'Grimyor/Make-up Artist', 'Stilist', 'Dekorator', 'Art Director',
  'Creative Director', 'Casting Director', 'Production Assistant', 'Boshqa'
];

export const COMPANY_TYPES = [
  'Production', 'SMM Team', 'Creative Agency', 'Marketing Agency', 'Studio', 'Photo Studio',
  'Video Production', 'TV/Media', 'Design Studio', 'Brand/Agency', 'Other'
];

export const VACANCY_CATEGORIES = [
  'Media & Creative', 'Marketing & SMM', 'IT', 'Design', 'Sales', 'Finance', 'Legal', 'Education',
  'Medicine', 'Construction', 'Manufacturing', 'Logistics', 'Restaurant/Hotel', 'Beauty', 'Auto',
  'Office/Admin', 'Services', 'Other'
];

export const EMPLOYMENT: Record<string, string> = {
  full: 'To‘liq stavka', part: 'Qisman', project: 'Loyiha', freelance: 'Frilans', internship: 'Amaliyot'
};

export const WORK_MODE: Record<string, string> = { office: 'Ofisda', remote: 'Masofadan', hybrid: 'Aralash' };

export const TICKET_CATEGORIES: Record<string, string> = {
  account: 'Akkaunt', verification: 'Tasdiqlash', payment: 'To‘lov', market: 'Market',
  vacancy_casting: 'Vakansiya/Casting', complaint: 'Shikoyat', technical: 'Texnik muammo', other: 'Boshqa'
};
