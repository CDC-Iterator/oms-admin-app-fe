/**
 * Normalizes an RTK Query axios-base-query error (`{status, data}`, see
 * api/axiosBaseQuery.js) into a plain string. Handles the shapes the
 * backend actually sends: a plain message string, `common.utils`'s
 * `{message: ...}` (auth/permission errors), and DRF's raw per-field
 * validation error dict (`{username: ["already exists"], ...}`, from
 * ModelSerializer validation — nothing rewraps those into `message`).
 */
export function formatApiError(error) {
  if (!error) return null;
  const data = error.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    if (data.message) return data.message;
    const parts = Object.entries(data)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(" ") : messages;
        if (!text) return null;
        return field === "non_field_errors" ? text : `${field}: ${text}`;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return "Unknown error";
}
