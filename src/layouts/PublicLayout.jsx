import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth.js";

/**
 * Wraps /login (and any future public routes). Bounces an already
 * authenticated visitor back to the dashboard instead of showing them the
 * login form.
 */
export default function PublicLayout() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return <Outlet />;
}
