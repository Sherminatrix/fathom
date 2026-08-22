import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 font-mono text-[11px] tracking-wide text-muted shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    />
  );
}
