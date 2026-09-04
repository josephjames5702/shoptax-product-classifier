import React, { useEffect, useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  Database,
  Loader2,
  FolderKanban,
  Tags,
} from 'lucide-react';
import { Catalog, CatalogProgress } from '../types';
import {
  fetchCatalogProgress,
  startClassification,
  fetchCategorySummary,
  CategorySummaryResponse,
} from '../api/client';

interface CatalogOverviewPageProps {
  catalog: Catalog;
  onNavigateTab: (tab: any) => void;
}

export const CatalogOverviewPage: React.FC<CatalogOverviewPageProps> = ({
  catalog,
  onNavigateTab,
}) => {
  const [progress, setProgress] = useState<CatalogProgress | null>(null);
  const [categorySummary, setCategorySummary] = useState<CategorySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const loadProgress = async () => {
    try {
      const data = await fetchCatalogProgress(catalog.id);
      setProgress(data);

      if (data.completed > 0 || data.manual_review > 0) {
        try {
          const summary = await fetchCategorySummary(catalog.id);
          setCategorySummary(summary);
        } catch {
          // Ignore if categories not yet available
        }
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  };

  useEffect(() => {
    loadProgress();
    const interval = setInterval(loadProgress, 2500);
    return () => clearInterval(interval);
  }, [catalog.id]);

  const handleStart = async (retryFailedOnly = false) => {
    setIsTriggering(true);
    try {
      await startClassification(catalog.id, retryFailedOnly);
      loadProgress();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTriggering(false);
    }
  };

  const isProcessing =
    progress?.catalog_status === 'PROCESSING' ||
    (progress?.latest_job && progress.latest_job.status === 'RUNNING');

  const canStart =
    !isProcessing &&
    (progress?.pending ?? catalog.total_products) > 0;

  const canRetry =
    !isProcessing &&
    (progress?.failed ?? 0) > 0;

  const total = progress?.total_products ?? catalog.total_products ?? 0;
  const completed = progress?.completed ?? 0;
  const manualReview = progress?.manual_review ?? 0;
  const failed = progress?.failed ?? 0;
  const pending = progress?.pending ?? (total - completed - manualReview - failed);
  const percent = progress?.progress_percentage ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Catalogue Header Card */}
      <div className="card-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">{catalog.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                catalog.status === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isProcessing
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {catalog.status}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1.5 flex items-center space-x-3">
            <span>Uploaded: {new Date(catalog.created_at).toLocaleString()}</span>
            <span>•</span>
            <span>Total Products: {catalog.total_products.toLocaleString()}</span>
            <span>•</span>
            <span>File: {catalog.file_name}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => onNavigateTab('products')}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition"
          >
            Explore Products
          </button>

          {canStart && (
            <button
              onClick={() => handleStart(false)}
              disabled={isTriggering}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Launching…</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Classification</span>
                </>
              )}
            </button>
          )}

          {canRetry && (
            <button
              onClick={() => handleStart(true)}
              disabled={isTriggering}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Failed</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Classification Progress Bar */}
      {(isProcessing || percent > 0) && (
        <div className="card-panel p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center space-x-2">
              {isProcessing && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
              <span>
                {isProcessing ? 'Classification In Progress' : 'Classification Progress'}
              </span>
            </span>
            <span className="font-bold text-slate-900">{percent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                percent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(percent, isProcessing ? 2 : 0))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {(completed + manualReview + failed).toLocaleString()} of {total.toLocaleString()} products processed
            </span>
            {progress?.latest_job?.current_step && (
              <span className="font-mono text-slate-600">{progress.latest_job.current_step}</span>
            )}
          </div>
        </div>
      )}

      {/* Status Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card-panel p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500">Total</div>
          <div className="text-xl font-bold text-slate-900">{total.toLocaleString()}</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500">Pending</div>
          <div className="text-xl font-bold text-slate-600">{pending.toLocaleString()}</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500">Processing</div>
          <div className="text-xl font-bold text-blue-600">
            {progress?.processing ?? (isProcessing ? total - completed - manualReview : 0)}
          </div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500">Completed</div>
          <div className="text-xl font-bold text-emerald-600">{completed.toLocaleString()}</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500">Manual Review</div>
          <div className="text-xl font-bold text-amber-600">{manualReview.toLocaleString()}</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500">Failed</div>
          <div className="text-xl font-bold text-rose-600">{failed.toLocaleString()}</div>
        </div>
      </div>

      {/* Canonical Category Distribution Table */}
      <div className="card-panel overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
              <Tags className="w-4 h-4 text-blue-600" />
              <span>Shopify Taxonomy Category Distribution</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated canonical Shopify categories identified for products in this catalogue.
            </p>
          </div>
          {categorySummary && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
              {categorySummary.unique_categories_count} Unique Categories
            </span>
          )}
        </div>

        {!categorySummary || categorySummary.categories.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No category distribution available yet. Start classification to view canonical categories.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr className="table-header">
                  <th className="py-2.5 px-4">Shopify Canonical Category Path</th>
                  <th className="py-2.5 px-4">Canonical GID</th>
                  <th className="py-2.5 px-4 text-right">Products</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {categorySummary.categories.map((item) => (
                  <tr key={item.category_id} className="table-row">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {item.full_path || item.name}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {item.category_gid}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                      {item.product_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
