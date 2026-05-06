"use client";

import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { defaultPathForTier, isPathAllowedForTier } from "@/lib/auth/accessTier";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";

export default function ScopedRoutesGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessTier, lockedOutletId } = useOutletAccess();

  useEffect(() => {
    if (accessTier === "global") return;
    const path = location.pathname;
    if (isPathAllowedForTier(path, accessTier)) return;
    navigate(defaultPathForTier(accessTier, lockedOutletId), { replace: true });
  }, [accessTier, lockedOutletId, location.pathname, navigate]);

  return <>{children}</>;
}
