import { useEffect, useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthProvider";
import ToastProvider from "@/app/providers/ToastProvider";
import { OutletAccessProvider } from "@/app/providers/OutletAccessProvider";
import { OutletScopeProvider } from "@/app/providers/OutletScopeProvider";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import ScopedRoutesGuard from "./ScopedRoutesGuard";
import PageBackBar from "./PageBackBar";
import Sidebar from "./Sidebar/Sidebar";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/auth/authEvents";
import "./Sidebar/Sidebar.scss";
import "./mobile-shell.scss";

export default function LayoutWrapper() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mainScrollRef = useRef<HTMLElement>(null);
const isAuthRoute = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const message =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "Your session has expired. Sign in again.";
      queryClient.clear();
      navigate("/login", { replace: true, state: { authMessage: message } });
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [navigate, queryClient]);

  useLayoutEffect(() => {
    if (isAuthRoute) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      return;
    }
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname, search, hash, isAuthRoute]);

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <OutletAccessProvider>
          <OutletScopeProvider>
            <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-x-hidden overflow-y-hidden">
              <Sidebar />
              <main
                ref={mainScrollRef}
                className="mainScroll mainScroll--mobileShell flex min-h-0 min-w-0 flex-1 flex-col items-stretch overflow-x-hidden overflow-y-auto bg-white px-4 pt-8 max-md:bg-[var(--mobile-page-bg)] max-md:px-3 max-md:pt-3 md:px-8 md:pb-[7px] max-md:pb-0"
              >
                <div className="mainContentWrap flex w-full max-w-full flex-1 flex-col self-stretch">
                  <PageBackBar />
                  <ScopedRoutesGuard>
                    <Outlet />
                  </ScopedRoutesGuard>
                </div>
              </main>
            </div>
            </TooltipProvider>
          </OutletScopeProvider>
        </OutletAccessProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
