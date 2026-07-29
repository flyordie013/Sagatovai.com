import {
  LayoutDashboard,
  Sparkles,
  BookOpen,
  Users,
  Inbox,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

/** Counters the sidebar can show as a badge next to an item. */
export type AdminBadgeKey = "newLeads" | "openRequests";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which "waiting for you" counter belongs to this screen (0 → no badge). */
  badge?: AdminBadgeKey;
}

/**
 * Two different inboxes, deliberately named apart:
 *   «Лиды с сайта»       — visitors without an account (leads table);
 *   «Запросы на доступ»  — registered students asking for a paid course.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Курсы", icon: BookOpen },
  { href: "/admin/leads", label: "Лиды с сайта", icon: MessageSquare, badge: "newLeads" },
  { href: "/admin/requests", label: "Запросы на доступ", icon: Inbox, badge: "openRequests" },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/gamification", label: "Геймификация", icon: Sparkles },
];
