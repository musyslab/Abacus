import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import axios from "axios";
import ErrorBoundary from "./ErrorComponent";

type ProtectedRouteProps = {
  children?: React.ReactNode;
  /**
   * If set, requires the current user to be an AdminUsers with this role.
   * Role 0 = teacher, Role 1 = admin.
   */
  requiredAdminRole?: 0 | 1;
};

const ProtectedRoute = ({ children, requiredAdminRole }: ProtectedRouteProps) => {
  const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
  const isAuthenticated = token != null;

  const apiBase = (import.meta.env.VITE_API_URL as string) || "";
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAllowed(false);
      return;
    }

    // No role restriction for this route
    if (requiredAdminRole === undefined) {
      setIsAllowed(true);
      return;
    }

    axios
      .get(`${apiBase}/auth/get-role`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const status = String(res.data?.status || "");
        const role = Number(res.data?.role);
        setIsAllowed(status === "admin" && role === requiredAdminRole);
      })
      .catch(() => setIsAllowed(false));
  }, [apiBase, token, isAuthenticated, requiredAdminRole]);

  if (!isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  // While checking role, render nothing (or a spinner if you prefer)
  if (isAllowed === null) {
    return null;
  }

  if (!isAllowed) {
    return <Navigate to="/home" replace />;
  }

  return <ErrorBoundary>{children ? children : <Outlet />}</ErrorBoundary>;
};

export default ProtectedRoute;