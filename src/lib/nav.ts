import {
  GraduationCap,
  Bot,
  Trophy,
  BarChart3,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary student navigation. `/dashboard` is the courses dashboard. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Мои курсы", icon: GraduationCap },
  { href: "/mentor", label: "AI-Наставник", icon: Bot },
  { href: "/achievements", label: "Достижения", icon: Trophy },
  { href: "/leaderboard", label: "Рейтинг", icon: BarChart3 },
  { href: "/store", label: "Магазин", icon: Store },
  { href: "/profile", label: "Профиль", icon: User },
];
