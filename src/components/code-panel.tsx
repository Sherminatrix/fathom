import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodePanel({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="font-mono text-[11px] tracking-wide text-subtle">{label ?? "request"}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 text-muted transition-colors duration-150 hover:text-fg"
          aria-label="Copy snippet"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span className="text-[11px] font-medium">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}
