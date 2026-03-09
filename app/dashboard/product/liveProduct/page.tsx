"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { getLivestockItems, type LivestockItem } from "@/handlers/livestock";
import "./liveProduct.scss";

const LIVESTOCK_QUERY_KEY = ["livestock-items"];

export default function LiveProductPage() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  // Livestock items created from the "Live" tab in Add Product modal
  const {
    data: livestockItems = [],
    isLoading: livestockLoading,
    isError: livestockError,
    error: livestockErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_QUERY_KEY,
    queryFn: async () => {
      const result = await getLivestockItems();
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return livestockItems;
    return livestockItems.filter((item: LivestockItem) => {
      const name = item.name.toLowerCase();
      const itemId = item.itemId.toLowerCase();
      return name.includes(q) || itemId.includes(q);
    });
  }, [livestockItems, searchQuery]);

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
    [filteredItems, startIndex, endIndex]
  );

  return (
    <section className="liveProductPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span> {"›"} {t("Live")}
      </div>

      <div className="liveProductHeader">
        <div className="liveProductHeaderText">
          <h1 className="pageTitle">{t("Live Products")}</h1>
          <p className="pageSubtitle">{t("Products of type Live")}</p>
        </div>
        <div className="liveProductSearch">
          <span className="searchIcon">🔍</span>
          <input
            className="searchInput"
            placeholder={t("Search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search live products")}
          />
        </div>
      </div>

      <div className="productsTable">
        <div className="productsRow productsRowHeader">
          <span>{t("Item name")}</span>
          <span>{t("ID Tag")}</span>
          <span>{t("Weight")}</span>
          <span>{t("Price")}</span>
          <span>{t("Status")}</span>
        </div>
        {livestockLoading && (
          <div className="productsRow">
            <span className="productsMessage">{t("Loading…")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {livestockError && (
          <div className="productsRow">
            <span className="productsMessage productsError">
              {livestockErrorDetail instanceof Error
                ? livestockErrorDetail.message
                : t("Failed to load livestock items")}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!livestockLoading &&
          !livestockError &&
          filteredItems.length === 0 && (
            <div className="productsRow">
              <span className="productsMessage">{t("No livestock items yet.")}</span>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!livestockLoading &&
          !livestockError &&
          paginatedItems.length > 0 &&
          paginatedItems.map((item: LivestockItem) => (
            <div key={item.id} className="productsRow">
              <span>{item.name}</span>
              <span>{item.itemId}</span>
              <span>{item.weight}</span>
              <span>{item.price}</span>
              <span>
                <span className={item.status ? "badge badgeActive" : "badge"}>
                  {item.status ? t("Active") : t("Inactive")}
                </span>
              </span>
            </div>
          ))}
      </div>

      {!livestockLoading && !livestockError && filteredItems.length > 0 && (
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
    </section>
  );
}
