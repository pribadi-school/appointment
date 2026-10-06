/**
 * Starting list of teachers. Used ONCE to fill an empty database
 * (supabase/seed.sql is generated from this file with `npm run seed:generate`)
 * and by the offline demo mode.
 *
 * After the first setup, school staff should edit teachers from the
 * Admin page → Teachers, not here.
 *
 * Format per line:  name ; subject ; grades taught ; role
 * "-" means empty. Empty grades = the teacher is shown for every grade.
 */
export const TEACHERS_RAW = `
Ana Nur Maulida, B.Sc. ; Religion ; 7,8,9,10,11,12 ; 10A Homeroom Teacher
Ildar Iakhin ; Biology ; 10,11 ; 10B Homeroom Teacher
Nur Annisa, S.Pd. ; Bahasa Indonesia ; - ; 11A Homeroom Teacher
Resky Ervaldi Saputra, B.Sc., M.T. ; Chemistry ; 11,12 ; 11B Homeroom Teacher, Research Project Coordinator
Zalika Putri Intan Palupi ; English ; 12 ; 12A Homeroom Teacher
Muhammad Fadli, S.T. ; - ; - ; 12B Homeroom Teacher
Maulida Indri Nur Azizah, S.Pd. ; Global Perspective - Business - IPS ; 7,8,9,10,11,12 ; 7A Homeroom Teacher
Muhammad Zuhri Agistian ; Computing - ICT ; 7,8,9,10,11,12 ; 7B Homeroom Teacher
Furqon Latif Hamdani, BA. ; Religion ; 7,8,9,10,11,12 ; 7C Homeroom Teacher
Nadiatul Hikmah ; Science ; 7,8 ; 8A Homeroom Teacher
Yusri Ramadhan ; Bahasa Indonesia ; 8,10 ; 8B Homeroom Teacher, OSIS Coordinator (Male)
Nairah Umpa Camid ; English ; 9,11 ; 9A Homeroom Teacher
Abdul Kadir Abdullah, S.E., M.Pd. ; Sundanese ; 7,8,9,10,11,12 ; 9B Homeroom Teacher
Aldila Nimas Savitri, S.Pd. ; English ; 7,12 ; Career Counselor (Girls)
Budi Effendi Nugroho, B.Sc. ; Turkish ; 11 ; Fathers Club
Umedjon Rustamov ; Science ; 7,8 ; Guidance Counselor
Nur Amira Nugroho ; Turkish ; 11 ; Mothers Club
Ujang Irpan, S.Pd. ; Mathematics ; 11,12 ; Olympiad Coordinator
Antinah ; Physics - Mathematics ; 8,10 ; Olympiad Coordinator
Reza Audia ; PPKn ; 9,10 ; OSIS Coordinator (Female)
Siti Masitoh, S.Mat ; Mathematics ; 7 ; School Culture (Girls)
Bibit Wiyana, M.Pd. ; PPKn ; 11,12 ; SMA Principal
Biadelma Nanda Illiandi, B.Sc., M.Sc. ; Physics ; 9 ; SMP Principal
Midyeal Fioleta, M.Pd. ; Bahasa Indonesia ; 7,9 ; -
Alza Kirana Thaharah ; Biology ; 9,10 ; -
Kevin Kaenji Wayoan, S.Psi, M.Sc ; Career Counselor (Boys) ; - ; -
Eki Maulana, B.Sc., M.Si. ; Chemistry ; 9 ; -
Irmaya Sari ; Chemistry ; 10 ; -
Rayhan Baist ; English ; 7,8 ; -
Muhammad Mulyono ; Music ; 7,8,9,10,11,12 ; -
Dhona Chindy Ferdiana ; Physical Education (Female) ; 7,8,9,10,11,12 ; -
Ewa Hilal Kamaluddin, S.Pd. ; Physical Education (Male) ; 7,8,9,10,11,12 ; -
Sutirto, S.Si., MT. ; Physics - Mathematics ; 9,11,12 ; -
Qobul Imron Rosada, S.Sos. ; PPKn ; - ; -
Muslim Mughofar, S.E. ; PPKn - History ; - ; School Culture (Boys)
`;

/**
 * Primary school (SD): one bookable record per class, named after the class's
 * two homeroom teachers (they sit together and share one schedule).
 * Format per line:  grade ; teacher names ; number of slots ("-" = the SD day)
 */
export const SD_RAW = `
1 ; Setyaningsih, S.Pd. & Aqila Rahmi Fauziyyah, S.Pd. ; -
2 ; Humaida Shofya Az Zahra, S.Pd., Gr. & Selvia Noviani, S.Pd., Gr. ; -
3 ; Arinda Lailatul Karimah, M.Pd. & Bekti Nuryati, S.Ag., S.Pd. ; 16
4 ; Gunadi Wicahya, S.S. & Dwi Anjani Hastari, S.Pd., Gr. ; -
5 ; Rahmadhanur Fitri, S.Pd. & Bahr'u Akbar, S.Psi ; 20
6 ; Rizqiah Nurbaiti, S.Pd., Gr. & Fikri Nabhani, S.Pd. ; 19
`;

/** Teachers seeded as not available (hidden from parents). */
export const UNAVAILABLE_RAW = `
Selvia Noviani, S.Pd. ; Art
Muhammad Ishaq Nurdin ; Mathematics
Triyanda, S.Pd. ; Religion
`;

/**
 * PLACEHOLDER room names — replace with the real rooms from the Admin page
 * (Teachers → "Rooms by subject"). Teachers sit in rooms by subject.
 */
export const ROOM_BY_SUBJECT: Record<string, string> = {
  Religion: 'Religion Room',
  Biology: 'Science Lab',
  Chemistry: 'Science Lab',
  Physics: 'Science Lab',
  Science: 'Science Lab',
  'Physics - Mathematics': 'Mathematics Room',
  Mathematics: 'Mathematics Room',
  'Bahasa Indonesia': 'Language Room',
  English: 'Language Room',
  Sundanese: 'Language Room',
  Turkish: 'Language Room',
  'Global Perspective - Business - IPS': 'Social Studies Room',
  PPKn: 'Social Studies Room',
  'PPKn - History': 'Social Studies Room',
  'Computing - ICT': 'Computer Lab',
  Music: 'Arts Room',
  Art: 'Arts Room',
  'Physical Education (Female)': 'Sports Hall',
  'Physical Education (Male)': 'Sports Hall',
  'Career Counselor (Boys)': 'Counseling Room',
};

export type SeedTeacher = {
  name: string;
  level: 'sd' | 'smp_sma';
  /** Own number of slots from the level's start; null = the level's day. */
  slotCount: number | null;
  subject: string | null;
  grades: number[];
  role: string | null;
  homeroomClass: string | null;
  isLeadership: boolean;
  room: string | null;
  available: boolean;
  sortOrder: number;
};

const empty = (s: string | undefined) => (!s || s.trim() === '-' ? null : s.trim());

/** "8B Homeroom Teacher" → "8B" */
export function parseHomeroom(role: string | null): string | null {
  const m = role?.match(/\b(7|8|9|10|11|12)([A-Z])\s+Homeroom/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : null;
}

/** Counselors, principals and coordinators go in "Counselors & Leadership". */
export function isLeadershipRole(role: string | null, subject: string | null): boolean {
  return /counsel|principal|coordinator/i.test(`${role ?? ''} ${subject ?? ''}`);
}

export function parseSeed(): SeedTeacher[] {
  const lines = (raw: string) => raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: SeedTeacher[] = [];
  for (const line of lines(TEACHERS_RAW)) {
    const [name, subjectRaw, gradesRaw, roleRaw] = line.split(';');
    const subject = empty(subjectRaw);
    const role = empty(roleRaw);
    const homeroomClass = parseHomeroom(role);
    out.push({
      name: name.trim(),
      level: 'smp_sma',
      slotCount: null,
      subject,
      grades: (empty(gradesRaw) ?? '').split(',').map((g) => parseInt(g, 10)).filter((g) => g >= 7 && g <= 12),
      role,
      homeroomClass,
      isLeadership: isLeadershipRole(role, subject),
      room: (subject && ROOM_BY_SUBJECT[subject]) || (homeroomClass ? `Classroom ${homeroomClass}` : null),
      available: true,
      sortOrder: out.length + 1,
    });
  }
  for (const line of lines(UNAVAILABLE_RAW)) {
    const [name, subjectRaw] = line.split(';');
    const subject = empty(subjectRaw);
    out.push({
      name: name.trim(),
      level: 'smp_sma',
      slotCount: null,
      subject,
      grades: [],
      role: null,
      homeroomClass: null,
      isLeadership: false,
      room: (subject && ROOM_BY_SUBJECT[subject]) || null,
      available: false,
      sortOrder: out.length + 1,
    });
  }
  for (const line of lines(SD_RAW)) {
    const [gradeRaw, names, countRaw] = line.split(';');
    const grade = gradeRaw.trim();
    const count = empty(countRaw);
    out.push({
      name: names.trim(),
      level: 'sd',
      slotCount: count ? Number(count) : null,
      subject: null,
      grades: [Number(grade)],
      role: null,
      homeroomClass: grade,
      isLeadership: false,
      room: `Grade ${grade}`, // SD rooms are named after the class; rename from the Admin page if needed
      available: true,
      sortOrder: out.length + 1,
    });
  }
  return out;
}
