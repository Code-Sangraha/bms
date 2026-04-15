import { useLayoutEffect, useRef } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthProvider";
import ToastProvider from "@/app/providers/ToastProvider";
import PageBackBar from "./PageBackBar";
import Sidebar from "./Sidebar/Sidebar";
import "./PageBackBar.scss";
import "./Sidebar/Sidebar.scss";

export default function LayoutWrapper() {
  const { pathname, search, hash } = useLocation();
  const mainScrollRef = useRef<HTMLElement>(null);
  const isAuthRoute = pathname === "/login" || pathname === "/register";

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
        <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-x-hidden overflow-y-hidden">
          <Sidebar />
          <main
            ref={mainScrollRef}
            className="mainScroll flex min-h-0 min-w-0 flex-1 flex-col items-stretch overflow-x-hidden overflow-y-auto bg-white px-4 pt-8 md:px-8 md:pb-[7px] pb-[calc(96px+env(safe-area-inset-bottom,0px)+2rem)]"
          >
            <div className="mainContentWrap flex w-full max-w-full flex-1 flex-col self-stretch">
              <PageBackBar />
              <Outlet />
            </div>
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
