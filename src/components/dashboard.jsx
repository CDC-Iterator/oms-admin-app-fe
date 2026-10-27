import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

// A label with the dotted underline the analytics cards use.
export function Label({ children }) {
  return <span className="border-b border-dotted border-muted-foreground/60 text-sm font-medium">{children}</span>;
}

// +12% / -8%. `inverted` flips the colour (more failures is bad).
export function Delta({ value, inverted }) {
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const good = value === 0 ? null : inverted ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good === null ? "text-muted-foreground" : good ? "text-emerald-600" : "text-destructive")}>
      {value !== 0 && <Icon className="size-3" />}
      {Math.abs(value)}%
    </span>
  );
}

// Tiny line, no axes — the shape of the last N days.
export function Sparkline({ series, className }) {
  if (!series || series.every((v) => v === 0)) return null;
  const w = 96;
  const h = 30;
  const max = Math.max(...series, 1);
  const points = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - 3 - (v / max) * (h - 6)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-24 shrink-0 text-primary", className)} aria-hidden>
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function MetricCard({ card }) {
  const body = (
    <div className="flex h-full items-end justify-between gap-2 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border transition-colors hover:ring-foreground/20">
      <div className="min-w-0 space-y-1.5">
        <Label>{card.label}</Label>
        <div className="flex items-baseline gap-2">
          <span className={cn("font-mono text-2xl font-semibold tabular-nums", card.tone === "danger" && "text-destructive")}>
            {card.currency ? "₹" : ""}{card.value.toLocaleString("en-IN")}
          </span>
          <Delta value={card.delta} inverted={card.delta_inverted} />
        </div>
      </div>
      <Sparkline series={card.series} />
    </div>
  );
  return card.link ? <Link to={card.link}>{body}</Link> : body;
}

// This week (solid) against last week (dotted), like the analytics line chart.
export function WeekChart({ data, format = (v) => v }) {
  const w = 640;
  const h = 220;
  const pad = { l: 34, r: 10, t: 10, b: 24 };
  const max = Math.max(...data.this_week, ...data.last_week, 1);
  const x = (i) => pad.l + (i / (data.labels.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
  const path = (series) => series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label="Shipments per day, this week against last week">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{format(t)}</text>
        </g>
      ))}
      {data.labels.map((l, i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{l}</text>
      ))}
      <path d={path(data.last_week)} fill="none" className="stroke-primary/40" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d={path(data.this_week)} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.this_week.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" className="fill-primary" />
      ))}
    </svg>
  );
}

export function Panel({ title, children, className }) {
  return (
    <section className={cn("rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border", className)}>
      <h2 className="mb-3"><Label>{title}</Label></h2>
      {children}
    </section>
  );
}

export function BreakdownRow({ children, value, delta, shaded }) {
  return (
    <div className={cn("flex items-center justify-between rounded-lg px-2.5 py-2 text-sm", shaded && "bg-muted/60")}>
      <span>{children}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono tabular-nums">{value.toLocaleString("en-IN")}</span>
        <span className="w-12 text-right"><Delta value={delta} /></span>
      </span>
    </div>
  );
}

