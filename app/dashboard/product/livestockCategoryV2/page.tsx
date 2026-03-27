"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createLivestockCategory,
  getLivestockCategories,
  type LivestockCategory,
} from "@/handlers/product";
import "./livestockCategoryV2.scss";

const LIVESTOCK_CATEGORY_QUERY_KEY = ["livestockCategories"];

export default function LivestockCategoryV2Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    data: categories = [],
    isLoading,
    isError,
    error: errorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_CATEGORY_QUERY_KEY,
    queryFn: async () => {
      const result = await getLivestockCategories();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(categories.length, { defaultPageSize: 10 });

  const paginatedCategories = useMemo(
    () => paginate(categories, startIndex, endIndex),
    [categories, startIndex, endIndex]
  );

  const createMutation = useMutation({
    mutationFn: createLivestockCategory,
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setError(result.error ?? t("Failed to create livestock category"));
        return;
      }
      setError(null);
      setCategoryName("");
      setIsCreateModalOpen(false);
      queryClient.setQueryData<LivestockCategory[]>(
        LIVESTOCK_CATEGORY_QUERY_KEY,
        (old) => {
          const next = old ?? [];
          if (next.some((item) => item.id === result.data.id)) return next;
          return [result.data, ...next];
        }
      );
    },
    onError: () => {
      setError(t("Something went wrong. Please try again."));
    },
  });

  const handleCreate = () => {
    const name = categoryName.trim();
    if (!name) {
      setError(t("Category name is required."));
      return;
    }
    setError(null);
    createMutation.mutate({ name });
  };

  return (
    <section className="livestockCategoryPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span> {" > "} {t("Livestock Category")}
      </div>

      <div className="header">
        <div className="headerText">
          <h1 className="pageTitle">{t("Livestock Category")}</h1>
          <p className="pageSubtitle">{t("Create and manage livestock categories")}</p>
        </div>
        <button
          type="button"
          className="addBtn"
          onClick={() => {
            setIsCreateModalOpen(true);
            setError(null);
          }}
        >
          {t("Add Livestock Category")}
        </button>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        title={t("Add Livestock Category")}
        subtitle={t("Create a new livestock category")}
        onClose={() => {
          setIsCreateModalOpen(false);
          setError(null);
          setCategoryName("");
        }}
        footer={
          <div className="modalFooter">
            <button
              type="button"
              className="cancelBtn"
              onClick={() => {
                setIsCreateModalOpen(false);
                setError(null);
                setCategoryName("");
              }}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="saveBtn"
              onClick={handleCreate}
              disabled={createMutation.isPending || !categoryName.trim()}
            >
              {createMutation.isPending ? t("Saving...") : t("Create")}
            </button>
          </div>
        }
      >
        <div className="createForm">
          <label className="inputLabel">
            {t("Category Name")}
            <input
              className="categoryInput"
              placeholder={t("Enter livestock category name")}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </label>
        </div>
      </Modal>

      {error && <p className="error">{error}</p>}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Category Name")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="emptyCell">{t("Loading...")}</td>
              </tr>
            )}
            {isError && (
              <tr>
                <td className="emptyCell">
                  {errorDetail instanceof Error ? errorDetail.message : t("Failed to load livestock categories")}
                </td>
              </tr>
            )}
            {!isLoading && !isError && categories.length === 0 && (
              <tr>
                <td className="emptyCell">{t("No livestock categories yet.")}</td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              paginatedCategories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && categories.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={categories.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}
    </section>
  );
}

