import { m, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { type AppearKind, appear } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof m.a>, "children"> & {
  variant?: "solid" | "glass";
  children: ReactNode;
  /** Optional hero-entrance timing. */
  entrance?: { kind: AppearKind; delay: number };
};

/** Link styled as the page's liquid button; external links open safely. */
export function ActionLink({
  variant = "solid",
  className,
  children,
  entrance,
  href,
  ...rest
}: Props) {
  const reduce = useReducedMotion();
  const external = typeof href === "string" && /^https?:/.test(href);
  return (
    <m.a
      href={href}
      {...(external ? { rel: "noopener noreferrer" } : {})}
      className={cn("btn", variant === "solid" ? "btn-solid" : "btn-glass", className)}
      {...(entrance ? appear(entrance.kind, entrance.delay, reduce) : {})}
      {...rest}
    >
      {children}
    </m.a>
  );
}
