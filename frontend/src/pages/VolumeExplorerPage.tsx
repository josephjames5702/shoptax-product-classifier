import React, { useState, useEffect } from 'react';
import { Layers, Tags, Loader2 } from 'lucide-react';
import { Catalog } from '../types';
import { fetchCategorySummary, CategorySummaryResponse } from '../api/client';

interface VolumeExplorerPageProps {
  catalog: Catalog;
}

export const VolumeExplorerPage: React.FC<VolumeExplorerPageProps> = ({ catalog }) => {
  const [summary, setSummary] = useState<CategorySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCategorySummary(catalog.id);
        setSummary(data);
      } catch (err) {
        console.error('Failed to load volume summary:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, [catalog.id]);

  const total = summary?.total_products ?? catalog.total_products ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Volume Explorer</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Category volume concentration and product distribution in{' '}
            <span className="font-semibold text-slate-700">{catalog.name}</span>
          </p>
        </div>

        {summary && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
            {summary.unique_categories_count} Active Categories
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="card-panel py-16 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span>Loading category volumes…</span>
        </div>
      ) : !summary || summary.categories.length === 0 ? (
        <div className="card-panel py-16 text-center space-y-2">
          <Tags className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-700">No volume data available</div>
          <div className="text-xs text-slate-400 max-w-sm mx-auto">
            Classify products in this catalogue to view taxonomy volume distribution.
          </div>
        </div>
      ) : (
        <div className="card-panel p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-800">
            Volume Concentration by Shopify Leaf Category
          </h2>

          <div className="space-y-3">
            {summary.categories.map((cat) => {
              const share = total > 0 ? (cat.product_count / total) * 100 : 0;

              return (
                <div key={cat.category_id} className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center justify-between text-xs">
                    <div className="truncate max-w-xl">
                      <span className="font-semibold text-slate-900">{cat.full_path || cat.name}</span>
                      <span className="font-mono text-[10px] text-slate-400 ml-2">{cat.category_gid}</span>
                    </div>
                    <div className="font-mono text-slate-800 font-bold flex-shrink-0">
                      {cat.product_count.toLocaleString()} products ({share.toFixed(1)}%)
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(share, 1))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
