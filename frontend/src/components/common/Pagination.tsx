import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  pageSize = 25,
  onPageChange,
  isLoading = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Determine which page numbers to show (e.g. 1 2 3 4 or 1 2 ... 12)
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);
  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-2 border-t border-slate-200 mt-6 text-xs text-slate-600">
      <div className="font-medium text-slate-500">
        {totalCount === 0 ? (
          <span>Showing 0 of 0 products</span>
        ) : (
          <span>
            Showing <span className="font-semibold text-slate-800">{startItem}–{endItem}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalCount.toLocaleString()}</span> products
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1.5">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 cursor-pointer"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        {/* Page Numbers */}
        {pageNumbers.map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-slate-400 font-mono select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              disabled={isLoading || currentPage === p}
              className={`min-w-[32px] h-8 px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                currentPage === p
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 cursor-pointer"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
