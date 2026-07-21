"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import Modal from "@/app/components/Modal/Modal";
import { FormField } from "@/app/components/ui-ext/FormField";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  createCreditor,
  getCreditors,
  type Creditor,
} from "@/handlers/creditor";
import { creditorSchema, type CreditorFormValues } from "@/schema/creditor";
import "../components/sale-entry.scss";

const CREDITORS_QUERY_KEY = ["creditors"];

type CreditorPickerProps = {
  id?: string;
  value: string;
  onChange: (creditor: Creditor) => void;
  disabled?: boolean;
  placeholder?: string;
  t: (key: string) => string;
};

function formatCreditorLabel(c: Creditor): string {
  return `${c.name} — ${c.phone}`;
}

export default function CreditorPicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder,
  t,
}: CreditorPickerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t: tFromContext } = useI18n();
  const tt = t ?? tFromContext;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createFieldErrors, setCreateFieldErrors] = useState<Partial<Record<keyof CreditorFormValues, string>>>({});

  const { data: creditors = [] } = useQuery({
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

  const selected = useMemo(
    () => creditors.find((c) => c.id === value) ?? null,
    [creditors, value],
  );

  const inputValue = selected ? formatCreditorLabel(selected) : query;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return creditors;
    return creditors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [creditors, query]);

  const showList = open && !selected;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, suggestions.length]);

  useEffect(() => {
    if (!showList) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showList]);

  const selectCreditor = (creditor: Creditor) => {
    onChange(creditor);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showList) return;
    if (suggestions.length === 0) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1 >= suggestions.length ? 0 : prev + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        break;
      case "Enter":
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          event.preventDefault();
          selectCreditor(suggestions[activeIndex]);
        }
        break;
      default:
        break;
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: CreditorFormValues) => createCreditor(values),
    onSuccess: (result) => {
      if (result.ok && result.data) {
        void queryClient.invalidateQueries({ queryKey: CREDITORS_QUERY_KEY });
        selectCreditor(result.data);
        setCreateOpen(false);
      } else if (!result.ok) {
        if (result.status === 401) navigate("/login");
      }
    },
  });

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const values: CreditorFormValues = {
      name: String(formData.get("name") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
    };
    const parsed = creditorSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof CreditorFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CreditorFormValues | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setCreateFieldErrors(fieldErrors);
      return;
    }
    setCreateFieldErrors({});
    createMutation.mutate(parsed.data);
  };

  const rootError = createMutation.data && !createMutation.data.ok
    ? createMutation.data.error
    : null;

  return (
    <div className="saleCustomerCombobox" ref={rootRef}>
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        placeholder={placeholder ?? tt("Select creditor")}
        value={inputValue}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          if (selected) {
            onChange({} as Creditor);
          }
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!selected) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="saleCustomerSuggestList"
          aria-label={tt("Matching creditors")}
        >
          {suggestions.length === 0 ? (
            <li className="saleCustomerSuggestEmpty" role="presentation">
              {tt("No matching creditors")}
            </li>
          ) : (
            suggestions.map((creditor, index) => (
              <li
                key={creditor.id}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "saleCustomerSuggestOption saleCustomerSuggestOption--active"
                    : "saleCustomerSuggestOption"
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCreditor(creditor)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="saleCustomerSuggestLabel">{creditor.name}</span>
                <span className="saleCustomerSuggestSub">
                  {creditor.phone}
                  {creditor.address ? ` · ${creditor.address}` : ""}
                </span>
              </li>
            ))
          )}
          <li
            className="saleCreditorNewRow"
            role="presentation"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              setCreateFieldErrors({});
              setCreateOpen(true);
            }}
          >
            <span>{tt("New creditor")}</span>
            <Plus className="h-4 w-4" aria-hidden />
          </li>
        </ul>
      )}

      <Modal
        isOpen={createOpen}
        title={tt("Add Creditor")}
        subtitle={tt("Create a new creditor record")}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              {tt("Discard")}
            </Button>
            <Button
              type="submit"
              form="creditor-picker-create-form"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? tt("Saving…") : tt("Save")}
            </Button>
          </>
        }
      >
        <form
          id="creditor-picker-create-form"
          onSubmit={onCreateSubmit}
          className="flex flex-col gap-4"
        >
          {rootError ? (
            <Alert variant="destructive">
              <AlertDescription>{rootError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField id="creditor-picker-name" label={tt("Name")} required error={createFieldErrors.name}>
            <Input
              id="creditor-picker-name"
              name="name"
              placeholder={tt("Creditor name")}
              required
            />
          </FormField>
          <FormField id="creditor-picker-phone" label={tt("Phone")} required error={createFieldErrors.phone}>
            <Input
              id="creditor-picker-phone"
              name="phone"
              placeholder={tt("Phone number")}
              required
            />
          </FormField>
          <FormField id="creditor-picker-address" label={tt("Address")} required error={createFieldErrors.address}>
            <Input
              id="creditor-picker-address"
              name="address"
              placeholder={tt("Address")}
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
