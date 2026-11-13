"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return <span className="relative block">
    <input {...props} type={visible ? "text" : "password"} className={cn(className, "pr-12")} />
    <button type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted hover:text-text"
      onClick={() => setVisible(v => !v)}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
  </span>;
}
