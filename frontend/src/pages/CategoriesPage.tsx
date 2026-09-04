import React, { useState, useEffect } from 'react';
import {
  Tags,
  ChevronDown,
  ChevronRight,
  Package,
  ExternalLink,
  Layers,
  Loader2,
  FolderKanban,
} from 'lucide-react';
import { Catalog } from '../types';
import {
  fetchCategorySummary,
  CategorySummaryResponse,
  fetchGroupedProducts,
  GroupedProductItem,
} from '../api/client';

interface CategoriesPageProps {
  catalog: Catalog;
  onNavigateToProducts: () => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  catalog,
  onNavigateToProducts,
}) => {
  const [summary, setSummary] = useState<CategorySummaryResponse | null>(null);
  const [expandedCategoryGid, setExpandedCategoryGid] = useState<string | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<{ [gid: string]: GroupedProductItem[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProductsGid, setLoadingProductsGid] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCategorySummary(catalog.id);
        setSummary(data);
      } catch (err) {
        console.error('Failed to load category summary:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, [catalog.id]);

  const toggleCategory = async (gid: string) => {
    if (expandedCategoryGid === gid) {
      setExpandedCategoryGid(null);
      return;
    }

    setExpandedCategoryGid(gid);

    // Fetch products for this canonical category if not already fetched
    if (!categoryProducts[gid]) {
      setLoadingProductsGid(gid);
      try {
        const res = await fetchGroupedProducts(catalog.id, gid);
        setCategoryProducts((prev) => ({ ...prev, [gid]: res.products }));
      } catch (err) {
        console.error('Failed to load grouped products for category:', err);
      } finally {
        setLoadingProductsGid(null);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Tags className="w-5 h-5 text-blue-600" />
            <span>Canonical Shopify Categories</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Products grouped by their canonical Shopify Taxonomy Category GID in{' '}
            <span className="font-semibold text-slate-700">{catalog.name}</span>
          </p>
        </div>

        {summary && (
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg">
              {summary.unique_categories_count} Unique Categories
            </span>
          </div>
        )}
      </div>

      {/* Categories Accordion List */}
      <div className="card-panel overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span>Loading category hierarchy…</span>
          </div>
        ) : !summary || summary.categories.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Tags className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No classified categories yet</div>
            <div className="text-xs text-slate-400 max-w-sm mx-auto">
              Start classification to categorize products into the official Shopify taxonomy.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.categories.map((cat) => {
              const isExpanded = expandedCategoryGid === cat.category_gid;
              const prods = categoryProducts[cat.category_gid] || [];
              const isProdsLoading = loadingProductsGid === cat.category_gid;

              return (
                <div key={cat.category_id} className="transition-colors">
                  {/* Category Header Row */}
                  <div
                    onClick={() => toggleCategory(cat.category_gid)}
                    className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition select-none"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {cat.full_path || cat.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {cat.category_gid}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-xs">
                      <div className="text-right">
                        <span className="font-bold text-slate-800">
                          {cat.product_count.toLocaleString()}
                        </span>{' '}
                        <span className="text-slate-500">products</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Product List for Category */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-100 p-4 pl-11 space-y-2">
                      <div className="text-xs font-semibold text-slate-600 mb-2">
                        Individual Products in this Category ({cat.product_count}):
                      </div>

                      {isProdsLoading ? (
                        <div className="py-4 text-xs text-slate-500 flex items-center space-x-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Loading product records…</span>
                        </div>
                      ) : prods.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">No products loaded.</div>
                      ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto">
                          {prods.map((prod) => (
                            <div
                              key={prod.product_id}
                              className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="font-mono text-slate-500 font-medium">
                                  {prod.product_number}
                                </span>
                                <span className="font-medium text-slate-800 truncate max-w-md">
                                  {prod.title}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  prod.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {prod.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
