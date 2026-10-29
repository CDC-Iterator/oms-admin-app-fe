// How a mapped catalog item is shown: "ItemCode - StyleCode" (just the item code when the style is unknown).
export const mappedLabel = (row) => (row.mapped_style_code ? `${row.mapped_item_code} - ${row.mapped_style_code}` : row.mapped_item_code);
