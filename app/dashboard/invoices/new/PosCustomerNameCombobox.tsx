"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/app/components/ui/input";
import type { Customer } from "@/handlers/customer";
import { filterCustomersForTypeahead, formatCustomerSuggestionLabel } from "./filterCustomersForTypeahead";

type PosCustomerNameComboboxProps = {
  customers: Customer[];
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  disabled?: boolean;
  t: (key: string) => string;
};

export default function PosCustomerNameCombobox({
  customers,
  value,
  onChange,
  onSelectCustomer,
  disabled = false,
  t,
}: PosCustomerNameComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(
    () => filterCustomersForTypeahead(customers, value),
    [customers, value]
  );

  const showList = open && value.trim().length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, suggestions.length]);

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

  const selectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }

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
          selectCustomer(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="saleCustomerCombobox" ref={rootRef}>
      <Input
        ref={inputRef}
        id="pos-customer-name"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        placeholder={t("Enter customer details")}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.trim()) setOpen(true);
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
          aria-label={t("Matching customers")}
        >
          {suggestions.length === 0 ? (
            <li className="saleCustomerSuggestEmpty" role="presentation">
              {t("No matching customers")}
            </li>
          ) : (
            suggestions.map((customer, index) => (
              <li
                key={customer.id}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "saleCustomerSuggestOption saleCustomerSuggestOption--active"
                    : "saleCustomerSuggestOption"
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCustomer(customer)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="saleCustomerSuggestLabel">
                  {formatCustomerSuggestionLabel(customer)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
