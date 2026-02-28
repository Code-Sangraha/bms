"use client";

import "./Pagination.scss";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
};

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="pagination" role="navigation" aria-label="Pagination">
      <div className="paginationSummary">
        <span className="paginationSummaryText">
          Showing {start}–{end} of {totalItems}
        </span>
        {onPageSizeChange && pageSizeOptions.length > 0 && (
          <span className="paginationSizeWrap">
            <label htmlFor="pagination-size" className="paginationSizeLabel">
              per page
            </label>
            <select
              id="pagination-size"
              className="paginationSizeSelect"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              aria-label="Items per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>
      <div className="paginationControls">
        <button
          type="button"
          className="paginationBtn paginationPrev"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          Previous
        </button>
        <div className="paginationNumbers" role="group" aria-label="Page numbers">
          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${i}`} className="paginationEllipsis" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`paginationNum ${currentPage === p ? "active" : ""}`}
                onClick={() => onPageChange(p)}
                disabled={currentPage === p}
                aria-label={`Page ${p}`}
                aria-current={currentPage === p ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          className="paginationBtn paginationNext"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
