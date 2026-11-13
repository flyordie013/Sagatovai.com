"use client";
import { useEffect } from "react";

// One confirmation even when several lesson forms/uploads are active.
const guards = new Map<symbol, string>();
function unload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
function navigate(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  const url = new URL(link.href, location.href);
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  if (!window.confirm([...new Set(guards.values())].join("\n") + "\nУйти со страницы?")) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}
export function useLeaveGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const key = Symbol();
    guards.set(key, message);
    if (guards.size === 1) {
      window.addEventListener("beforeunload", unload);
      document.addEventListener("click", navigate, true);
    }
    return () => {
      guards.delete(key);
      if (!guards.size) {
        window.removeEventListener("beforeunload", unload);
        document.removeEventListener("click", navigate, true);
      }
    };
  }, [active, message]);
}
