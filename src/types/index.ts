export type CourseAccess = "full" | "trial" | "locked";

export type CourseIcon = "sparkles" | "bot" | "code";

export interface CourseSummary {
  id: number;
  slug: string;
  title: string;
  description: string;
  weeks: number;
  lessons: number;
  rating: number;
  /** completion 0..100 */
  progress: number;
  access: CourseAccess;
  flagship?: boolean;
  icon: CourseIcon;
}

export interface UserSummary {
  name: string;
  /** named rank tied to level (derived from xp) */
  rank: string;
  level: number;
  xp: number;
  currentStreak: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  xpReward: number;
}

export interface DashboardData {
  user: UserSummary;
  courses: CourseSummary[];
  /** null when the student has no active unfinished mission. */
  mission: Mission | null;
  totalLessons: number;
  completedLessons: number;
  achievementsUnlocked: number;
}
