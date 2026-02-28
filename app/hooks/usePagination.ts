import { useEffect, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function usePagination(
  totalItems: number,
  options?: { defaultPageSize?: number }
) {
  const pageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(pageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeState));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSizeState;
  const endIndex = Math.min(startIndex + pageSizeState, totalItems);

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems]);

  return {
    currentPage,
    setCurrentPage,
    pageSize: pageSizeState,
    setPageSize: setPageSizeState,
    totalPages,
    startIndex,
    endIndex,
  };
}

export function paginate<T>(items: T[], startIndex: number, endIndex: number): T[] {
  return items.slice(startIndex, endIndex);
}
