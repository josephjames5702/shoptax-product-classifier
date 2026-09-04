import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
} from 'lucide-react';
import { Product, Catalog } from '../types';
import { fetchProducts, fetchProduct, deleteProduct, fetchCategorySummary } from '../api/client';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { Pagination } from '../components/common/Pagination';
import { groupProductsByModel } from '../utils/groupProducts';
import { GroupedProductCard } from '../components/products/GroupedProductCard';
import { CategoryFilterBar } from '../components/products/CategoryFilterBar';
import { ALL_ITEMS_CATEGORY, getCategoryCounts, filterProductsByCategory } from '../utils/productCategories';

interface ProductsPageProps {
  catalog: Catalog;
  onProductDeleted?: () => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ catalog, onProductDeleted }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_ITEMS_CATEGORY);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);

  const pageSize = 25;

  // Load real category summary for category tabs
  const loadCategories = async () => {
    try {
      const summary = await fetchCategorySummary(catalog.id);
      if (summary && summary.categories && summary.categories.length > 0) {
        const mapped = summary.categories.map((c: any) => ({
          name: c.name,
          count: c.product_count,
        }));
        setCategories([
          { name: ALL_ITEMS_CATEGORY, count: summary.total_classified ?? summary.total_classified_products ?? totalCount },
          ...mapped,
        ]);
      } else {
        setCategories([]);
      }
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [catalog.id]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetchProducts({
        catalog_id: catalog.id === 'ALL' ? undefined : catalog.id,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        category: selectedCategory !== ALL_ITEMS_CATEGORY ? selectedCategory : undefined,
        page,
        page_size: pageSize,
      });
      setProducts(res.results || []);
      setTotalCount(res.count ?? 0);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [catalog.id, page, statusFilter, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  const handleViewDetail = async (prodId: string) => {
    try {
      const detail = await fetchProduct(prodId);
      setSelectedProduct(detail);
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      setProductToDelete(null);
      if (products.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        loadProducts();
      }
      loadCategories();
      if (onProductDeleted) {
        onProductDeleted();
      }
    } catch (err) {
      console.error('Failed to delete product', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Group products by model for the current page
  const groupedProducts = React.useMemo(() => {
    return groupProductsByModel(products);
  }, [products]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm backdrop-blur-sm">
            <CheckCircle2 className="w-3 h-3" />
            <span>Automatically Approved</span>
          </span>
        );
      case 'MANUAL_REVIEW':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm backdrop-blur-sm">
            <AlertTriangle className="w-3 h-3" />
            <span>Manual Review</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm backdrop-blur-sm">
            <Clock className="w-3 h-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm backdrop-blur-sm">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm backdrop-blur-sm">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Search Controls */}
      <div className="card-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Product Explorer</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {products.length} of {totalCount.toLocaleString()} products in{' '}
              <span className="font-semibold text-slate-700">{catalog.name}</span>
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product title, SKU, brand…"
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </form>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-medium"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Classified</option>
                <option value="MANUAL_REVIEW">Needs Review</option>
                <option value="APPROVED">Admin Approved</option>
                <option value="DECLINED">Admin Declined</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <div className="card-panel overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <CategoryFilterBar 
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        {products.length === 0 ? (
          <div className="py-16 text-center space-y-2 bg-slate-50/50">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No products available</div>
            <div className="text-xs text-slate-400">
              {search || statusFilter || selectedCategory !== ALL_ITEMS_CATEGORY
                ? 'No products match the selected filters or search criteria.'
                : 'No products found in this catalogue.'}
            </div>
            {(search || statusFilter || selectedCategory !== ALL_ITEMS_CATEGORY) && (
              <button 
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setSelectedCategory(ALL_ITEMS_CATEGORY);
                  setPage(1);
                }}
                className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {groupedProducts.map((group, index) => (
                <GroupedProductCard 
                  key={group[0]?.id || `group-${index}`}
                  variants={group}
                  onViewDetail={handleViewDetail}
                  onRemove={(product) => setProductToDelete(product)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div className="px-6 py-4 bg-white border-t border-slate-100">
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Product Details</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedProduct.product_number}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-600">Title:</span>
                <p className="text-slate-800 font-medium mt-0.5">{selectedProduct.title}</p>
              </div>

              {selectedProduct.brand && (
                <div>
                  <span className="font-semibold text-slate-600">Brand:</span>
                  <p className="text-slate-800 mt-0.5">{selectedProduct.brand}</p>
                </div>
              )}

              {selectedProduct.description && (
                <div>
                  <span className="font-semibold text-slate-600">Description:</span>
                  <p className="text-slate-700 mt-0.5 line-clamp-4 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {selectedProduct.classification_summary && (
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1">
                  <div className="font-semibold text-blue-900">Assigned Shopify Category:</div>
                  <div className="text-blue-800 font-medium">
                    {selectedProduct.classification_summary.category_name}
                  </div>
                  <div className="text-[11px] text-blue-600 font-mono">
                    Confidence: {(selectedProduct.classification_summary.confidence_score * 100).toFixed(1)}% (
                    {selectedProduct.classification_summary.confidence_level})
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Remove this product?</h3>
              <p className="text-sm text-slate-500 mt-1">
                Only <span className="font-semibold text-slate-700">{productToDelete.title || productToDelete.product_number}</span> will be removed from this catalogue.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition flex items-center space-x-2 disabled:opacity-50"
              >
                <span>Remove Product</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
