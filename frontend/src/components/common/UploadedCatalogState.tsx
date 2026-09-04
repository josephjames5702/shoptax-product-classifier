import React, { useState, useEffect } from 'react';
import {
  Play,
  Loader2,
  Package,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Cpu,
  X,
} from 'lucide-react';
import { Catalog, Product, CatalogProgress } from '../../types';
import { fetchProducts, fetchCatalogProgress, startClassification, deleteProduct } from '../../api/client';
import { ImageWithFallback } from './ImageWithFallback';
import { Pagination } from './Pagination';
import { groupProductsByModel } from '../../utils/groupProducts';
import { GroupedProductCard } from '../products/GroupedProductCard';
import { CategoryFilterBar } from '../products/CategoryFilterBar';
import { ALL_ITEMS_CATEGORY, getCategoryCounts, filterProductsByCategory } from '../../utils/productCategories';

interface UploadedCatalogStateProps {
  catalog: Catalog;
  onClassificationStarted?: () => void;
  onProductDeleted?: () => void;
}

export const UploadedCatalogState: React.FC<UploadedCatalogStateProps> = ({
  catalog,
  onClassificationStarted,
  onProductDeleted,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(catalog.total_products || 0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [progress, setProgress] = useState<CatalogProgress | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_ITEMS_CATEGORY);

  const pageSize = 25;

  const loadRealProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetchProducts({
        catalog_id: catalog.id === 'ALL' ? undefined : catalog.id,
        page,
        page_size: pageSize,
      });
      setProducts(res.results || []);
      if (res.count !== undefined) {
        setTotalCount(res.count);
      }
    } catch (err) {
      console.error('Failed to load uploaded products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load real products when catalog or page changes
  useEffect(() => {
    loadRealProducts();
  }, [catalog.id, page]);

  // Reset page when catalog changes
  useEffect(() => {
    setPage(1);
  }, [catalog.id]);

  // If processing, poll progress from existing API
  useEffect(() => {
    let interval: any = null;

    const checkProgress = async () => {
      try {
        const p = await fetchCatalogProgress(catalog.id);
        setProgress(p);
      } catch (err) {
        console.error('Failed to check progress:', err);
      }
    };

    checkProgress();
    interval = setInterval(checkProgress, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [catalog.id]);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startClassification(catalog.id, false);
      if (onClassificationStarted) onClassificationStarted();
    } catch (err) {
      console.error('Failed to start classification:', err);
    } finally {
      setIsStarting(false);
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
        await loadRealProducts();
      }
      if (onProductDeleted) {
        onProductDeleted();
      }
    } catch (err) {
      console.error('Failed to delete product', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isProcessing =
    progress?.catalog_status === 'PROCESSING' ||
    (progress?.latest_job && progress.latest_job.status === 'RUNNING');

  const processed = (progress?.completed || 0) + (progress?.manual_review || 0) + (progress?.failed || 0);
  const percent = progress?.progress_percentage ?? 0;

  const categories = React.useMemo(() => {
    return getCategoryCounts(products);
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    return filterProductsByCategory(products, selectedCategory);
  }, [products, selectedCategory]);

  const groupedProducts = React.useMemo(() => {
    return groupProductsByModel(filteredProducts);
  }, [filteredProducts]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 animate-in fade-in duration-200">
      {/* Top Banner Card */}
      <div className="card-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-slate-900">{catalog.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isProcessing
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {isProcessing ? 'PROCESSING' : 'PENDING CLASSIFICATION'}
            </span>
          </div>

          <div className="text-xs text-slate-500 mt-1.5 flex items-center space-x-2">
            <span>Uploaded Products:</span>
            <span className="font-bold text-slate-900 font-mono">
              {totalCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isProcessing ? (
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Classification Engine Active</span>
            </div>
          ) : (
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Classification</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Processing State Banner if processing */}
      {isProcessing && progress && (
        <div className="card-panel p-5 space-y-3 border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-blue-900 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>Classifying against Shopify Standard Product Taxonomy</span>
            </div>
            <div className="text-sm font-bold font-mono text-blue-900">
              {percent.toFixed(1)}%
            </div>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(percent, 2))}%` }}
            />
          </div>

          <div className="text-[11px] text-slate-600 flex items-center justify-between">
            <span>
              {processed.toLocaleString()} of {totalCount.toLocaleString()} products processed
            </span>
            {progress.latest_job?.current_step && (
              <span className="font-mono text-slate-700">
                {progress.latest_job.current_step}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actual Uploaded Products Table */}
      <div className="card-panel overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Package className="w-4 h-4 text-slate-500" />
            <span>Uploaded Product Records ({totalCount.toLocaleString()})</span>
          </h2>
          <span className="text-xs text-slate-400">
            Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
          </span>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <CategoryFilterBar 
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span>Loading product records…</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            {products.length === 0 ? 'No products found in this catalogue.' : 'No products in this category.'}
          </div>
        ) : (
          <div className="p-4 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {groupedProducts.map((group, index) => (
                <GroupedProductCard 
                  key={group[0]?.id || `group-${index}`}
                  variants={group}
                  onViewDetail={() => {}} // Not fully implemented in UploadedCatalogState yet
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
