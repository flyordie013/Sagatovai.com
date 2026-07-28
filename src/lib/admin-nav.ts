import {
  LayoutDashboard,
  Sparkles,
  BookOpen,
  Users,
  Inbox,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Курсы", icon: BookOpen },
  { href: "/admin/leads", label: "Заявки с сайта", icon: MessageSquare },
  { href: "/admin/requests", label: "Запросы на доступ", icon: Inbox },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/gamification", label: "Геймификация", icon: Sparkles },
];
