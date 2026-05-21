"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IoCalculatorOutline, IoChevronDown, IoPencilOutline, IoStatsChartOutline } from "react-icons/io5";
import { LuBeef, LuBoxes, LuList, LuShoppingCart, LuUsers } from "react-icons/lu";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import { getStoredUser } from "@/lib/auth/user";
import "./dashboardMobileHome.scss";

const SHORTCUTS_STORAGE = "bms_dashboard_shortcuts_v1";

export type CashflowDay = {
  dateKey: string;
  label: string;
  moneyIn: number;
  moneyOut: number;
};

type ShortcutDef = {
  id: string;
  labelKey: string;
  href: string;
  icon: import("react").ReactNode;
  requiresCreate?: boolean;
};

type DashboardMobileHomeProps = {
  t: (text: string) => string;
  scopedOutletId: string | null;
  search: string;
  totalRevenue: number;
  totalTransactions: number;
  totalWeight: number;
  cashflowDays: CashflowDay[];
  canCreate: boolean;
  /** Hide livestock and org-only shortcuts (outlet manager tier). */
  outletScopedMobile?: boolean;
};

function workspaceInitial(): string {
  const u = getStoredUser();
  const name =
    (u && typeof u.name === "string" && u.name) ||
    (u && typeof u.email === "string" && u.email) ||
    "B";
  return String(name).trim().charAt(0).toUpperCase() || "B";
}

function workspaceTitle(): string {
  return "BMS";
}

function readShortcutVisibility(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object") return data as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return null;
}

function writeShortcutVisibility(next: Record<string, boolean>) {
  localStorage.setItem(SHORTCUTS_STORAGE, JSON.stringify(next));
}

export default function DashboardMobileHome({
  t,
  scopedOutletId,
  search,
  totalRevenue,
  totalTransactions: _totalTransactions,
  totalWeight,
  cashflowDays,
  canCreate,
  outletScopedMobile = false,
}: DashboardMobileHomeProps) {
  const to = useCallback(
    (path: string) => buildPathWithOutletScope(path, scopedOutletId, search),
    [scopedOutletId, search]
  );

  const allShortcuts = useMemo<ShortcutDef[]>(() => {
    const raw: ShortcutDef[] = [
      {
        id: "pos",
        labelKey: "Processed Sale",
        href: to("/dashboard/invoices/new"),
        icon: <LuShoppingCart size={22} />,
        requiresCreate: true,
      },
      {
        id: "livestock",
        labelKey: "Livestock Sales",
        href: to("/dashboard/invoices/livestock-sales"),
        icon: <LuBeef size={22} />,
        requiresCreate: true,
      },
      {
        id: "transactions",
        labelKey: "Transactions",
        href: to("/dashboard/invoices/transaction"),
        icon: <LuList size={22} />,
      },
      {
        id: "product",
        labelKey: "Products",
        href: to("/dashboard/product"),
        icon: <LuBoxes size={22} />,
      },
      {
        id: "directory",
        labelKey: "Directory",
        href: to("/dashboard/accounts/directory"),
        icon: <LuUsers size={22} />,
      },
      {
        id: "invoices",
        labelKey: "Sales & Billing",
        href: to("/dashboard/invoices"),
        icon: <IoStatsChartOutline size={22} />,
      },
    ];
    if (outletScopedMobile) return raw.filter((s) => s.id !== "livestock");
    return raw;
  }, [to, outletScopedMobile]);

  const defaultVisibility = useMemo(() => {
    const o: Record<string, boolean> = {};
    for (const s of allShortcuts) o[s.id] = true;
    return o;
  }, [allShortcuts]);

  const [visibility, setVisibility] = useState<Record<string, boolean>>(defaultVisibility);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const stored = readShortcutVisibility();
    if (stored) {
      setVisibility({ ...defaultVisibility, ...stored });
    }
  }, [defaultVisibility]);

  const toggleShortcut = (id: string) => {
    setVisibility((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeShortcutVisibility(next);
      return next;
    });
  };

  const totalIn = useMemo(() => cashflowDays.reduce((s, d) => s + d.moneyIn, 0), [cashflowDays]);
  const totalOut = useMemo(() => cashflowDays.reduce((s, d) => s + d.moneyOut, 0), [cashflowDays]);
  const showCashflow = totalIn > 0 || totalOut > 0;

  const chartModel = useMemo(() => {
    const maxVal = Math.max(1, ...cashflowDays.map((d) => Math.max(d.moneyIn, d.moneyOut)));
    const w = 320;
    const h = 140;
    const padL = 28;
    const padR = 8;
    const padT = 8;
    const padB = 36;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const n = cashflowDays.length || 1;
    const barW = Math.max(4, (innerW / n) * 0.35);
    const gap = innerW / n;
    return { maxVal, w, h, padL, padR, padT, padB, innerW, innerH, barW, gap, n };
  }, [cashflowDays]);

  const periodName = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date());
    } catch {
      return "";
    }
  }, []);

  return (
    <div className="dashboardMobileHome">
      <header className="dashboardMobileHome__header">
        <div className="dashboardMobileHome__brand">
          <div className="dashboardMobileHome__avatar" aria-hidden>
            {workspaceInitial()}
          </div>
          <div className="dashboardMobileHome__brandText">
            <p className="dashboardMobileHome__brandTitle">
              {workspaceTitle()}
              <IoChevronDown size={16} aria-hidden style={{ opacity: 0.5 }} />
            </p>
          </div>
        </div>
      </header>

      <div className="dashboardMobileHome__summaryGrid">
        <Link to={to("/dashboard/invoices")} className="dashboardMobileHome__summaryCell">
          <span className="dashboardMobileHome__summaryValue">
            Rs.{totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
          <span className="dashboardMobileHome__summaryLabel">
            {t("Sales")} ({periodName})
          </span>
        </Link>
        <Link to={to("/dashboard/invoices")} className="dashboardMobileHome__summaryCell">
          <span className="dashboardMobileHome__summaryValue">
            Rs.{totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
          <span className="dashboardMobileHome__summaryLabel">{t("Total Balance")}</span>
          <span
            className="dashboardMobileHome__summaryLabel"
            style={{ textTransform: "none", fontSize: 10 }}
          >
            {t("Cash & Bank")} · {totalWeight} kg
          </span>
        </Link>
      </div>

      <div>
        <h2 className="dashboardMobileHome__sectionTitle">{t("Explore App")}</h2>
        <div className="dashboardMobileHome__exploreScroll">
          {canCreate ? (
            <Link to={to("/dashboard/invoices/new")} className="dashboardMobileHome__exploreCard">
              <span className="dashboardMobileHome__exploreIcon" aria-hidden>
                <IoCalculatorOutline size={26} />
              </span>
              <span>{t("Quick Entry")}</span>
            </Link>
          ) : null}
          {canCreate && !outletScopedMobile ? (
            <Link to={to("/dashboard/invoices/livestock-sales")} className="dashboardMobileHome__exploreCard">
              <span className="dashboardMobileHome__exploreIcon" aria-hidden>
                <LuShoppingCart size={26} />
              </span>
              <span>{t("Quick POS")}</span>
            </Link>
          ) : null}
          <Link to={to("/dashboard/invoices")} className="dashboardMobileHome__exploreCard">
            <span className="dashboardMobileHome__exploreIcon" aria-hidden>
              <IoStatsChartOutline size={26} />
            </span>
            <span>{t("View Reports")}</span>
          </Link>
        </div>
      </div>

      <div>
        <div className="dashboardMobileHome__sectionHead">
          <h2 className="dashboardMobileHome__sectionTitle" style={{ margin: 0 }}>
            {t("Shortcuts")}
          </h2>
          <button type="button" className="dashboardMobileHome__editLink" onClick={() => setEditOpen(true)}>
            <IoPencilOutline size={16} aria-hidden />
            {t("Edit Menu")}
          </button>
        </div>
        <div className="dashboardMobileHome__shortcutsCard">
          <div className="dashboardMobileHome__shortcutsGrid">
            {allShortcuts.map((s) => {
              if (s.requiresCreate && !canCreate) return null;
              if (!visibility[s.id]) return null;
              return (
                <Link key={s.id} to={s.href} className="dashboardMobileHome__shortcut">
                  <span className="dashboardMobileHome__shortcutIcon" aria-hidden>
                    {s.icon}
                  </span>
                  <span>{t(s.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {showCashflow ? (
        <div className="dashboardMobileHome__cashflowCard">
          <div className="dashboardMobileHome__cashflowHead">
            <h2 className="dashboardMobileHome__cashflowTitle">{t("Cashflow (Last 7 Days)")}</h2>
            <span className="dashboardMobileHome__cashflowPeriod">
              {t("Daily")} <IoChevronDown size={14} style={{ verticalAlign: "middle" }} aria-hidden />
            </span>
          </div>
          <svg
            className="dashboardMobileHome__chartSvg"
            viewBox={`0 0 ${chartModel.w} ${chartModel.h}`}
            role="img"
            aria-label={t("Cashflow (Last 7 Days)")}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = chartModel.padT + chartModel.innerH * (1 - pct);
              return (
                <g key={pct}>
                  <line
                    x1={chartModel.padL}
                    x2={chartModel.w - chartModel.padR}
                    y1={y}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeDasharray="4 4"
                  />
                  <text x={4} y={y + 4} fontSize="9" fill="#9ca3af">
                    {Math.round(chartModel.maxVal * pct)}
                  </text>
                </g>
              );
            })}
            {cashflowDays.map((d, i) => {
              const cx = chartModel.padL + chartModel.gap * i + chartModel.gap / 2;
              const hIn = (d.moneyIn / chartModel.maxVal) * chartModel.innerH;
              const x = cx - chartModel.barW / 2;
              const y = chartModel.padT + chartModel.innerH - hIn;
              return (
                <g key={d.dateKey}>
                  <rect x={x} y={y} width={chartModel.barW} height={hIn} rx={3} fill="#33b38c" />
                  <text
                    x={cx}
                    y={chartModel.h - 8}
                    fontSize="9"
                    fill="#6b7280"
                    textAnchor="middle"
                    transform={`rotate(-35 ${cx} ${chartModel.h - 8})`}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="dashboardMobileHome__legend">
            <div>
              <div style={{ color: "#6b7280", fontWeight: 500 }}>{t("Total Money In")}</div>
              <div className="dashboardMobileHome__legendIn">
                Rs.{totalIn.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#6b7280", fontWeight: 500 }}>{t("Total Money Out")}</div>
              <div className="dashboardMobileHome__legendOut">
                Rs.{totalOut.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div
          className="dashboardMobileHome__modalOverlay"
          role="presentation"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="dashboardMobileHome__modal"
            role="dialog"
            aria-modal
            aria-labelledby="shortcut-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="shortcut-edit-title" className="dashboardMobileHome__modalTitle">
              {t("Edit Menu")}
            </h3>
            {allShortcuts.map((s) => {
              if (s.requiresCreate && !canCreate) return null;
              return (
                <label key={s.id} className="dashboardMobileHome__modalRow">
                  <span>{t(s.labelKey)}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(visibility[s.id])}
                    onChange={() => toggleShortcut(s.id)}
                  />
                </label>
              );
            })}
            <button type="button" className="dashboardMobileHome__modalClose" onClick={() => setEditOpen(false)}>
              {t("Done")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
