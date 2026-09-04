import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  TrendingUp,
  Tags,
  Loader2,
} from 'lucide-react';
import { Catalog, CatalogProgress } from '../types';
import {
  fetchCatalogProgress,
  fetchCategorySummary,
  CategorySummaryResponse,
} from '../api/client';

interface AnalyticsPageProps {
  catalog: Catalog;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ catalog }) => {
  const [progress, setProgress] = useState<CatalogProgress | null>(null);
  const [categorySummary, setCategorySummary] = useState<CategorySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const prog = await fetchCatalogProgress(catalog.id);
        setProgress(prog);

        if (prog.completed > 0 || prog.manual_review > 0) {
          try {
            const catSum = await fetchCategorySummary(catalog.id);
            setCategorySummary(catSum);
          } catch {
            // ignore if categories not yet available
          }
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [catalog.id]);

  const total = progress?.total_products ?? catalog.total_products ?? 0;
  const completed = progress?.completed ?? 0;
  const manualReview = progress?.manual_review ?? 0;
  const failed = progress?.failed ?? 0;
  const processed = completed + manualReview + failed;
  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

  const hasData = completed > 0 || manualReview > 0 || failed > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-5">
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span>Catalogue Analytics</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real performance and categorization distribution for{' '}
          <span className="font-semibold text-slate-700">{catalog.name}</span>
        </p>
      </div>

      {!hasData && !isLoading ? (
        <div className="card-panel py-16 text-center space-y-2">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-700">No classification data available yet</div>
          <div className="text-xs text-slate-400 max-w-sm mx-auto">
            Start classification on this catalogue to view real-time performance and canonical category distribution.
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-panel p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">Total Products</div>
              <div className="text-2xl font-bold text-slate-900">{total.toLocaleString()}</div>
            </div>

            <div className="card-panel p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">Completed Matches</div>
              <div className="text-2xl font-bold text-emerald-600">{completed.toLocaleString()}</div>
            </div>

            <div className="card-panel p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">Manual Review</div>
              <div className="text-2xl font-bold text-amber-600">{manualReview.toLocaleString()}</div>
            </div>

            <div className="card-panel p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">Completion Rate</div>
              <div className="text-2xl font-bold text-blue-600">{completionRate}%</div>
            </div>
          </div>

          {/* Top Categories Distribution */}
          {categorySummary && categorySummary.categories.length > 0 && (
            <div className="card-panel p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Tags className="w-4 h-4 text-blue-600" />
                    <span>Top Canonical Categories</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Distribution of products across canonical Shopify taxonomy leaf nodes.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                  {categorySummary.unique_categories_count} Total Categories
                </span>
              </div>

              <div className="space-y-3">
                {categorySummary.categories.slice(0, 10).map((cat) => {
                  const share = total > 0 ? (cat.product_count / total) * 100 : 0;
                  return (
                    <div key={cat.category_id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate max-w-lg">
                          {cat.full_path || cat.name}
                        </span>
                        <span className="font-mono text-slate-600 font-semibold">
                          {cat.product_count.toLocaleString()} ({share.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
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
        </>
      )}
    </div>
  );
};
