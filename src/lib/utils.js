import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// "Today at 1:42 pm", "Yesterday at 1:42 pm", else "Oct 15 at 1:42 pm" (year added if not this year).
export function formatPlacedDate(value, now = new Date()) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?(AM|PM)$/, (_, m) => ` ${m.toLowerCase()}`);
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round((dayStart(now) - dayStart(date)) / 86400000);
  if (daysAgo === 0) return `Today at ${time}`;
  if (daysAgo === 1) return `Yesterday at ${time}`;
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }) });
  return `${day} at ${time}`;
}
