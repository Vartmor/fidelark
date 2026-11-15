import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names and resolves conflicting Tailwind utilities (shadcn/21st convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
