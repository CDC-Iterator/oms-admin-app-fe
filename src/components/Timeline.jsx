import { cn } from "@/lib/utils";

/**
 * Vertical event timeline for an order's lifecycle (received → reserved →
 * cancel/return/RTO restock). `events` = [{ ts, label, channel? }], oldest
 * first — matches the order the events actually happen in.
 */
export function Timeline({ events }) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>;
  }
  return (
    <ol className="space-y-0">
      {events.map((event, i) => (
        <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
          {i < events.length - 1 && (
            <span className="absolute top-2.5 left-[5px] h-full w-px bg-border" aria-hidden />
          )}
          <span
            className={cn(
              "relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full",
              i === events.length - 1 ? "bg-primary" : "bg-muted-foreground/40"
            )}
          />
          <div className="min-w-0 flex-1 pt-0">
            <p className="text-sm text-foreground">{event.label}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {new Date(event.ts).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
