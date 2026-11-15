/**
 * Masked line reveal: each line slides up out of a mask when the text scrolls into view.
 * Adapted from the 21st.dev component "Text Reveal (Mask)" by soralabs
 * (https://21st.dev/@soralabs/components/text-reveal-mask): imports switched to framer-motion,
 * split modes reduced to lines, emphasis kept as <strong>.
 */
import { m, useInView, useReducedMotion } from "framer-motion";
import {
  type ElementType,
  isValidElement,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Word = { text: string; emphasized: boolean };

function collectWords(node: ReactNode, emphasized = false): Word[] {
  if (typeof node === "string") {
    return node
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, emphasized }));
  }
  if (Array.isArray(node)) return node.flatMap((child) => collectWords(child, emphasized));
  if (isValidElement(node)) {
    const strong = emphasized || node.type === "strong";
    return collectWords((node.props as { children?: ReactNode }).children, strong);
  }
  return [];
}

/** Groups word indexes by rendered line, measured on an invisible copy at the same width. */
function groupByLine(measure: HTMLElement): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let lastTop = -1;
  measure.querySelectorAll<HTMLElement>("[data-word]").forEach((node, index) => {
    if (lastTop !== -1 && node.offsetTop > lastTop + 1) {
      groups.push(current);
      current = [];
    }
    current.push(index);
    lastTop = node.offsetTop;
  });
  if (current.length > 0) groups.push(current);
  return groups;
}

type Props = {
  as?: ElementType;
  /** Id for the visible element, e.g. the target of a section's aria-labelledby. */
  id?: string;
  children: ReactNode;
  className?: string;
  /** Class for <strong> words. */
  emphasisClassName?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
};

export function MaskedTextReveal({
  as: Tag = "p",
  id,
  children,
  className,
  emphasisClassName,
  delay = 0,
  stagger = 0.08,
  duration = 0.8,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(rootRef, { once: true, margin: "0px 0px -20% 0px" });
  const words = useMemo(() => collectWords(children), [children]);
  const [lines, setLines] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const update = () => setLines(groupByLine(measure));
    update();
    void document.fonts.ready.then(update);
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const label = words.map((w) => w.text).join(" ");
  const renderWord = (index: number) => {
    const word = words[index];
    if (!word) return null;
    const text = index < words.length - 1 ? `${word.text} ` : word.text;
    return word.emphasized ? (
      <strong key={index} className={cn("font-[inherit]", emphasisClassName)}>
        {text}
      </strong>
    ) : (
      <span key={index}>{text}</span>
    );
  };

  if (reduce) {
    return (
      <Tag id={id} className={className}>
        {children}
      </Tag>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Invisible copy used only to find line breaks at the current width. A div, not Tag, so the
          page outline has no duplicate heading; preflight gives both the same type styles. */}
      <div
        aria-hidden="true"
        className={cn(className, "pointer-events-none invisible absolute inset-x-0 top-0")}
      >
        <span ref={measureRef}>
          {words.map((word, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static text; the order never changes.
            <span key={i} data-word className="inline-block">
              {word.text}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </div>
      <Tag id={id} aria-label={label} className={cn(className, !lines && "invisible")}>
        {(lines ?? [words.map((_, i) => i)]).map((line, lineIndex) => (
          <span
            key={line.join("-")}
            aria-hidden="true"
            className="block overflow-hidden pb-[0.08em]"
          >
            <m.span
              className="block"
              initial={{ y: "110%" }}
              animate={inView && lines ? { y: "0%" } : { y: "110%" }}
              transition={{ duration, delay: delay + lineIndex * stagger, ease: EASE_OUT }}
            >
              {line.map(renderWord)}
            </m.span>
          </span>
        ))}
      </Tag>
    </div>
  );
}
