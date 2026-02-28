"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CiSettings } from "react-icons/ci";
import { FiUsers } from "react-icons/fi";
import { IoBagHandleOutline } from "react-icons/io5";
import { LuReceiptText, LuUserCog } from "react-icons/lu";
import { TbLayoutDashboard } from "react-icons/tb";
import { usePermissions } from "@/app/providers/AuthProvider";
import { logout as logoutApi } from "@/handlers/auth";
import { clearAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

/** Menu link; permission "create" means link is shown only when user can create. */
type MenuItem = {
  label: string;
  href: string;
  permission?: "create";
};

const sidebarConfig = {
  header: { title: "HMP" },
  sections: [
    {
      items: [
        {
          id: "dashboard",
          href: "#",
          icon: <TbLayoutDashboard size={20} />,
          menu: {
            title: "Dashboard",
            items: [
              { label: "Overview", href: "/dashboard" },
              // { label: "Analytics", href: "/dashboard/analytics" },
              // { label: "Reports", href: "/dashboard/reports" },
            ] as MenuItem[],
          },
        },
        {
          id: "Sales & Billing",
          href: "#",
          icon: <LuReceiptText size={20} />,
          menu: {
            title: "Sales & Billing",
            items: [
              { label: "Analytics", href: "/dashboard/invoices" },
              { label: "Point of Sale", href: "/dashboard/invoices/new", permission: "create" as const },
              { label: "Transactions", href: "/dashboard/invoices/transaction" },
              { label: "Customer Types", href: "/dashboard/invoices/customer-types" },
            ] as MenuItem[],
          },
        },
        {
          id: "orders",
          href: "#",
          icon: <IoBagHandleOutline size={20} />,
          menu: {
            title: "Product",
            items: [
              { label: "Products", href: "/dashboard/product" },
              { label: "Product Type", href: "/dashboard/product/productType" },
              { label: "Pricelist", href: "/dashboard/settings/dualPricing" },

              { label: "Live", href: "/dashboard/product/liveProduct" },
              { label: "Processed", href: "/dashboard/product/processedProduct" },

            ] as MenuItem[],
          },
        },
        {
          id: "accounts",
          href: "#",
          icon: <LuUserCog size={20} />,
          menu: {
            title: "Attendance",
            items: [
              { label: "Analytics", href: "/dashboard/accounts/analytics" },
              { label: "Clock In/Out", href: "/dashboard/accounts/clock-in-out" },
              { label: "Directory", href: "/dashboard/accounts/directory" },
            ] as MenuItem[],
          },
        },
      ],
    },
  ],
  footer: [
    {
      items: [
        // {
        //   id: "teams",
        //   href: "#",
        //   icon: <FiUsers size={20} />,
        //   menu: {
        //     title: "Teams",
        //     items: [
        //       { label: "Team members", href: "/dashboard/teams" },
        //       { label: "Invitations", href: "/dashboard/teams/invitations" },
        //       { label: "Access", href: "/dashboard/teams/access" },
        //     ] as MenuItem[],
        //   },
        // },
        {
          id: "settings",
          href: "#",
          icon: <CiSettings size={20} />,
          menu: {
            title: "Settings",
            items: [
              { label: "Outlets", href: "/dashboard/settings/outlet" },
              { label: "Users", href: "/dashboard/settings/users" },
              { label: "Departments", href: "/dashboard/settings/departments" },
              { label: "Roles", href: "/dashboard/accounts/roles" },  
            ] as MenuItem[],
          },
        },
      ],
    },
  ],
};

export default function Sidebar() {
  const router = useRouter();
  const { canCreate } = usePermissions();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const allItems = useMemo(
    () => [
      ...sidebarConfig.sections.flatMap((section) => section.items),
      ...sidebarConfig.footer.flatMap((section) => section.items),
    ],
    []
  );

  const activeMenu = allItems.find((item) => item.id === activeMenuId)?.menu;
  const handleMenuToggle = (id: string) => {
    setActiveMenuId((current) => (current === id ? null : id));
  };

  const handleLogout = async () => {
    await logoutApi();
    clearAuthToken();
    clearStoredUser();
    setActiveMenuId(null);
    router.push("/login");
  };

  return (
    <div className="sidebarWrapper">
      <aside className="sidebar" aria-label="Primary">
        <div className="header">
          <h2 className="title">{sidebarConfig.header.title}</h2>
        </div>

        <nav className="nav">
          {sidebarConfig.sections.map((section) => (
            <div key={section.items[0].id}>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={
                    activeMenuId === item.id ? "link active" : "link"
                  }
                  type="button"
                  aria-pressed={activeMenuId === item.id}
                  onClick={() => handleMenuToggle(item.id)}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="footer">
          {sidebarConfig.footer[0].items.map((item) => (
            <button
              key={item.id}
              className={activeMenuId === item.id ? "link active" : "link"}
              type="button"
              aria-pressed={activeMenuId === item.id}
              onClick={() => handleMenuToggle(item.id)}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </aside>

      {activeMenu && (
        <button
          type="button"
          className="drawerBackdrop visible"
          onClick={() => setActiveMenuId(null)}
          aria-label="Close menu"
        />
      )}
      <div className={activeMenu ? "drawer open" : "drawer"}>
        <div className="drawerHeader">
          <span className="drawerTitle">{activeMenu?.title}</span>
          <button
            type="button"
            className="drawerClose"
            onClick={() => setActiveMenuId(null)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <div className="drawerBody">
          {activeMenu?.items
            .filter((entry) => (entry.permission === "create" ? canCreate : true))
            .map((entry) => (
              <Link key={entry.href} className="drawerItem" href={entry.href}>
                {entry.label}
              </Link>
            ))}
        </div>
        <div className="drawerFooter">
          <button
            type="button"
            className="drawerItemLogout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
   
    </div>
  );
}
