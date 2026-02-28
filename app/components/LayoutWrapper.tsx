"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/app/providers/AuthProvider";
import ToastProvider from "@/app/providers/ToastProvider";
import Sidebar from "./Sidebar/Sidebar";
import "./Sidebar/Sidebar.scss";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex min-h-screen w-full overflow-x-hidden">
          <Sidebar />
          <main className="flex h-screen min-w-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto bg-white px-4 pt-8 pb-20 dark:bg-black sm:items-start md:px-8 md:pb-[7px]">
            {children}
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
