import { Check, Copy } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Splits a command into words with their offsets. Lines then break only between words, so a flag
 * like --allow-network stays whole; long words such as URLs break after a slash on narrow screens.
 */
function tokens(command: string) {
  const out: { text: string; at: number }[] = [];
  let at = 0;
  for (const text of command.split(" ")) {
    out.push({ text, at });
    at += text.length + 1;
  }
  return out;
}

/** A shell command with a copy button that confirms the copy for 1.5 seconds. */
export function Command({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[10px] border border-line bg-white/80 py-1.5 pr-1.5 pl-4 font-mono text-[0.8125rem] text-ink",
        className,
      )}
    >
      <code className="min-w-0 py-1.5 leading-[1.5] break-words">
        <span aria-hidden="true" className="mr-2 text-slate select-none">
          $
        </span>
        {tokens(children).map(({ text, at }) => (
          <Fragment key={at}>
            {at > 0 && " "}
            {text.length > 24 ? (
              <span className="[overflow-wrap:anywhere]">
                {text.split("/").map((part, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts of a fixed string, never reordered.
                  <Fragment key={i}>
                    {i > 0 && "/"}
                    {i > 0 && <wbr />}
                    {part}
                  </Fragment>
                ))}
              </span>
            ) : (
              <span className="whitespace-nowrap">{text}</span>
            )}
          </Fragment>
        ))}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy command: ${children}`}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[8px] text-slate transition-colors duration-150 hover:bg-stone hover:text-ink focus-visible:outline-3 focus-visible:outline-signal-deep"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4 text-mint-deep" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Command copied" : ""}
      </span>
    </div>
  );
}
