// Mirrors the backend roles (apps.accounts.models.User.Role); operations are scoped to their locations server-side.
export const isAdminUser = (user) => Boolean(user?.is_superuser || user?.role === "admin");
export const canBookShipments = (user) => isAdminUser(user) || user?.role === "operations";

export const isOperationsUser = (user) => user?.role === "operations";
// Operations only get the order-handling screens; everything else is hidden and redirected.
export const canOpenPath = (user, pathname) =>
  !isOperationsUser(user) || /^\/(orders(\/.*)?|fulfillments|reports)?$/.test(pathname);
