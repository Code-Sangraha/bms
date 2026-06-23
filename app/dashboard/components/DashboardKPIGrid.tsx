import { type ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDashboardMoney, formatDashboardDecimal } from "../utils/dashboardFormatting";

export type KPICard = {
  label: string;
  value: string;
  sub?: string;
  trend?: number; // percentage change vs previous period
  trendLabel?: string;
  icon: ComponentType<{ className?: string }>;
  toneClassName: string;
};

type DashboardKPIGridProps = {
  cards: KPICard[];
};

export default function DashboardKPIGrid({ cards }: DashboardKPIGridProps) {
  return (
    <div className="dashboardKPIGrid">
      {cards.map((card) => (
        <div key={card.label} className={cn("dashboardKPICard", card.toneClassName)}>
          <div className="dashboardKPIHeader">
            <div className="dashboardKPIIconWrap">
              <card.icon className="dashboardKPIIcon" />
            </div>
            <span className="dashboardKPILabel">{card.label}</span>
          </div>
          <div className="dashboardKPIValueRow">
            <span className="dashboardKPIValue">{card.value}</span>
            {card.trend !== undefined && card.trend !== 0 && (
              <span
                className={cn(
                  "dashboardKPITrend",
                  card.trend > 0 ? "dashboardKPITrendUp" : "dashboardKPITrendDown"
                )}
              >
            {card.trend > 0 ? (
              <ArrowUp className="dashboardKPITrendIcon" />
            ) : (
              <ArrowDown className="dashboardKPITrendIcon" />
            )}
                {Math.abs(card.trend).toFixed(1)}%
              </span>
            )}
          </div>
          {card.sub ? <span className="dashboardKPISub">{card.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function createSalesKPICards(
  t: (key: string) => string,
  data: {
    totalRevenue: number;
    totalTransactions: number;
    totalWeight: number;
    totalQuantity: number;
  }
): KPICard[] {
  return [
    {
      label: t("Total Revenue"),
      value: formatDashboardMoney(data.totalRevenue),
      icon: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
      toneClassName: "dashboardKPICardRevenue",
    },
    {
      label: t("Transactions"),
      value: String(data.totalTransactions),
      icon: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>,
      toneClassName: "dashboardKPICardTransactions",
    },
    {
      label: t("Weight Sold"),
      value: `${formatDashboardDecimal(data.totalWeight)} kg`,
      icon: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
      toneClassName: "dashboardKPICardWeight",
    },
    {
      label: t("Quantity Sold"),
      value: formatDashboardDecimal(data.totalQuantity),
      icon: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.97 17.04C2.43 17.58 2 18.48 2 20v2h20v-2c0-1.52-.43-2.42-.97-2.96"/><path d="m22 16-4.6-4.6a2 2 0 0 0-2.82 0L5.2 20.8"/><path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10"/><path d="M3 7h18"/><path d="M5 21h14"/></svg>,
      toneClassName: "dashboardKPICardQuantity",
    },
  ];
}
