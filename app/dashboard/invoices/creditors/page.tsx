"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { FormField } from "@/app/components/ui-ext/FormField";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { createCreditor, getCreditors, type Creditor } from "@/handlers/creditor";
import { creditorSchema, type CreditorFormValues } from "@/schema/creditor";
import "./creditors.scss";

const CREDITORS_QUERY_KEY = ["creditors"];

const defaultFormValues: CreditorFormValues = {
  name: "",
  address: "",
  phone: "",
};

function formatCreatedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString();
}

function formatMoney(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rs.${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CreditorsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { canCreate } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErrorDetail,
  } = useQuery({
    queryKey: CREDITORS_QUERY_KEY,
    queryFn: async () => {
      const result = await getCreditors();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const addForm = useForm<CreditorFormValues>({
    resolver: zodResolver(creditorSchema),
    defaultValues: defaultFormValues,
  });

  const createMutation = useMutation({
    mutationFn: (values: CreditorFormValues) => createCreditor(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        addForm.reset(defaultFormValues);
        void queryClient.invalidateQueries({ queryKey: CREDITORS_QUERY_KEY });
        showToast(t("Creditor created successfully."), "success");
      } else {
        if (result.status === 401) navigate("/login");
        else addForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      addForm.setError("root", {
        message: t("Something went wrong. Please try again."),
      });
    },
  });

  const onAddSubmit = (data: CreditorFormValues) => {
    createMutation.mutate(data);
  };

  const addLoading = addForm.formState.isSubmitting || createMutation.isPending;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredItems.length, { defaultPageSize: 10 });
  const paginatedItems = useMemo(
    () => paginate(filteredItems, startIndex, endIndex),
    [filteredItems, startIndex, endIndex],
  );

  const openDetail = (c: Creditor) => {
    navigate(`/dashboard/invoices/creditors/${encodeURIComponent(c.id)}`);
  };

  return (
    <section className="creditorsPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {"›"} {t("Creditors")}
      </div>

      <div className="creditorsHeader">
        <div className="creditorsHeaderText">
          <h1 className="pageTitle">{t("Creditors")}</h1>
          <p className="pageSubtitle">
            {t("Track customers who buy on credit and settle pending balances")}
          </p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("Add Creditor")}
          </Button>
        )}
      </div>

      <div className="creditorsToolbar">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={t("Search creditors")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search creditors")}
            className="pl-8"
          />
        </div>
      </div>

      {itemsLoading && <TableSkeleton rows={6} columns={5} />}
      {itemsError && (
        <ErrorState
          title={t("Failed to load creditors")}
          description={
            itemsErrorDetail instanceof Error
              ? itemsErrorDetail.message
              : t("We couldn't load this section. Please try again.")
          }
        />
      )}
      {!itemsLoading && !itemsError && items.length === 0 && (
        <EmptyState
          title={t("No creditors yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add Creditor")}
              </Button>
            ) : undefined
          }
        />
      )}
      {!itemsLoading &&
        !itemsError &&
        items.length > 0 &&
        filteredItems.length === 0 && (
          <EmptyState title={`${t("No items match")} "${searchQuery.trim()}"`} />
        )}
      {!itemsLoading && !itemsError && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Phone")}</TableHead>
                <TableHead>{t("Address")}</TableHead>
                <TableHead>{t("Pending")}</TableHead>
                <TableHead>{t("Created")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((c) => {
                const pending = c.pendingAmount;
                const dueClass =
                  pending == null
                    ? ""
                    : pending > 0
                      ? "creditorsPendingCell--due"
                      : "creditorsPendingCell--clear";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{c.address || "—"}</TableCell>
                    <TableCell className={`creditorsPendingCell ${dueClass}`}>
                      {formatMoney(pending)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCreatedAt(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={t("More options")}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => openDetail(c)}>
                            {t("View details")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!itemsLoading && !itemsError && filteredItems.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        title={t("Add Creditor")}
        subtitle={t("Create a new creditor record")}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              {t("Discard")}
            </Button>
            <Button
              type="submit"
              form="add-creditor-form"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-creditor-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="flex flex-col gap-4"
        >
          {addForm.formState.errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>
                {addForm.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}
          <FormField
            id="add-creditor-name"
            label={t("Name")}
            required
            error={addForm.formState.errors.name?.message}
          >
            <Input
              id="add-creditor-name"
              placeholder={t("Creditor name")}
              aria-invalid={Boolean(addForm.formState.errors.name)}
              {...addForm.register("name")}
            />
          </FormField>
          <FormField
            id="add-creditor-phone"
            label={t("Phone")}
            required
            error={addForm.formState.errors.phone?.message}
          >
            <Input
              id="add-creditor-phone"
              placeholder={t("Phone number")}
              aria-invalid={Boolean(addForm.formState.errors.phone)}
              {...addForm.register("phone")}
            />
          </FormField>
          <FormField
            id="add-creditor-address"
            label={t("Address")}
            required
            error={addForm.formState.errors.address?.message}
          >
            <Input
              id="add-creditor-address"
              placeholder={t("Address")}
              aria-invalid={Boolean(addForm.formState.errors.address)}
              {...addForm.register("address")}
            />
          </FormField>
        </form>
      </Modal>
    </section>
  );
}
