// Quantity filter values for ?qty= — "5" (exactly), "1.." (at least), "..0" (at most) or "2..9".
export const QTY_PRESETS = [
  { value: "1..", label: "Has stock (1 or more)" },
  { value: "0", label: "Zero" },
];

export const parseQtyRange = (value) => {
  const text = String(value ?? "");
  if (!text.includes("..")) return { min: text, max: text };
  const [min = "", max = ""] = text.split("..");
  return { min, max };
};

/** "1 or more", "0", "up to 5", "2–9". */
export function qtyRangeLabel(value) {
  const { min, max } = parseQtyRange(value);
  if (min && max) return min === max ? min : `${min}–${max}`;
  if (min) return `${min} or more`;
  if (max) return `up to ${max}`;
  return String(value);
}

export const buildQtyRange = (min, max) => (min === "" && max === "" ? undefined : min !== "" && min === max ? min : `${min}..${max}`);
