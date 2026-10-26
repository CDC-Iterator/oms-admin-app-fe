// Mirrors the backend roles (apps.accounts.models.User.Role); operations are scoped to their locations server-side.
export const isAdminUser = (user) => Boolean(user?.is_superuser || user?.role === "admin");
export const canBookShipments = (user) => isAdminUser(user) || user?.role === "operations";
