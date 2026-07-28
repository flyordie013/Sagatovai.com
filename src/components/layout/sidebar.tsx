import { SidebarContent } from "./sidebar-content";

/** Desktop sidebar (≥ lg). Sticky, full viewport height. */
export function Sidebar({ isStaff = false }: { isStaff?: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-full border-r border-line bg-gradient-to-b from-surface/60 to-ink/20 lg:block">
      <SidebarContent isStaff={isStaff} />
    </aside>
  );
}
