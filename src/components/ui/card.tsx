import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Base raised surface used across the app. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-card ring-inset-hair",
        className,
      )}
      {...props}
    />
  );
}
