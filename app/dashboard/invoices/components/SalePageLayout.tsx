import type { ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb";
import { PageContent, PageShell } from "@/app/components/ui-ext/PageShell";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";

type SalePageLayoutProps = {
  sectionLabel: string;
  pageTitle: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SalePageLayout({
  sectionLabel,
  pageTitle,
  subtitle,
  actions,
  children,
}: SalePageLayoutProps) {
  return (
    <PageShell>
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="text-muted-foreground">{sectionLabel}</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title={pageTitle}
        subtitle={subtitle}
        actions={actions}
      />
      <PageContent>{children}</PageContent>
    </PageShell>
  );
}
