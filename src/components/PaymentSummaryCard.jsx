import { CircleDollarSign, ReceiptText } from "lucide-react";

const inr = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value ?? 0));

// Shopify financial_status -> heading, and whether it needs attention (amber tile) or is settled (grey tile).
const STATUS = {
  paid: { label: "Paid", attention: false },
  partially_paid: { label: "Partially paid", attention: true },
  pending: { label: "Payment pending", attention: true },
  authorized: { label: "Payment authorized", attention: true },
  partially_refunded: { label: "Partially refunded", attention: false },
  refunded: { label: "Refunded", attention: false },
  voided: { label: "Payment voided", attention: false },
};

function Row({ label, detail, amount, strong }) {
  return (
    <div className={"grid grid-cols-[7rem_1fr_auto] items-baseline gap-4 py-1 text-sm " + (strong ? "font-semibold" : "")}>
      <span>{label}</span>
      <span className="min-w-0 truncate font-normal text-muted-foreground">{detail}</span>
      <span className="tabular-nums">{amount}</span>
    </div>
  );
}

// Older API responses only carry `order_summary` — build what the card needs from it so the card never goes blank.
function legacySummary(order) {
  const o = order.order_summary;
  if (!o) return null;
  const paid = o.paid != null ? Number(o.paid) : null;
  const total = Number(o.total ?? order.total_amount ?? 0);
  return {
    financial_status: order.payment_status || "",
    items: (order.line_items ?? []).reduce((n, li) => n + (li.qty ?? 0), 0),
    subtotal: o.subtotal != null ? Number(o.subtotal) + Number(o.discount ?? 0) : null,
    discount: o.discount,
    discount_codes: [],
    shipping: o.shipping,
    shipping_title: "",
    weight_grams: null,
    tax: o.tax,
    tax_label: "",
    taxes_included: true,
    total: o.total ?? order.total_amount,
    paid: o.paid,
    balance: paid != null ? Math.max(total - paid, 0) : null,
  };
}

/** Shopify-style payment card: heading follows the payment status, then subtotal, discount, shipping, taxes,
 *  total, and what's been paid (plus the balance while something is still due). */
export function PaymentSummaryCard({ order }) {
  const s = order.payment_summary ?? legacySummary(order);
  if (!s) return null;

  const status = STATUS[s.financial_status] ?? {
    label: (s.financial_status || "Payment").replace(/_/g, " "),
    attention: false,
  };
  const Icon = status.attention ? CircleDollarSign : ReceiptText;
  const discount = Number(s.discount ?? 0);
  const balance = Number(s.balance ?? 0);
  const refunded = Number(s.refunded ?? 0);
  const shippingDetail = [s.shipping_title, s.weight_grams ? `(${s.weight_grams} g)` : null].filter(Boolean).join(" ");
  const taxDetail = [s.tax != null ? `${inr(s.tax)} INR` : null, s.tax_label].filter(Boolean).join(" • ");

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3">
        <span
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-lg " +
            (status.attention ? "bg-amber-200/70 text-amber-900" : "bg-muted text-foreground")
          }
        >
          <Icon className="size-4" />
        </span>
        <h3 className="text-base font-semibold">{status.label}</h3>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
        {refunded > 0 && (
          <div className="mb-2 border-b border-border pb-2">
            <Row
              label="Original order"
              detail={s.placed_at ? new Date(s.placed_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : ""}
              amount={inr(s.original_total)}
            />
          </div>
        )}
        <Row label="Subtotal" detail={`${s.items} ${s.items === 1 ? "item" : "items"}`} amount={s.subtotal != null ? inr(s.subtotal) : "—"} />
        {discount > 0 && (
          <Row label="Discount" detail={(s.discount_codes ?? []).join(", ")} amount={`-${inr(discount)}`} />
        )}
        {s.shipping != null && <Row label="Shipping" detail={shippingDetail} amount={inr(s.shipping)} />}
        {Number(s.tax ?? 0) > 0 && (
          <Row label="Taxes" detail={taxDetail} amount={s.taxes_included ? "Included" : inr(s.tax)} />
        )}
        <Row label="Total" amount={inr(s.total)} strong />
        {s.paid != null && (
          <div className="mt-2 border-t border-border pt-2">
            <Row label="Paid" amount={inr(s.paid)} />
            {refunded > 0 && (
              <Row
                label="Refunded"
                detail={s.refund_reason ? `Reason: \u201c${s.refund_reason}\u201d` : ""}
                amount={`-${inr(refunded)}`}
              />
            )}
            {refunded > 0 && <Row label="Net payment" amount={inr(s.net_payment)} strong />}
            {balance > 0 && <Row label="Balance" amount={inr(balance)} />}
          </div>
        )}
      </div>
    </section>
  );
}
