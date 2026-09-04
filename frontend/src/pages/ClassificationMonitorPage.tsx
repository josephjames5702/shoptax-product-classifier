import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Catalog, CatalogProgress } from '../types';
import { fetchCatalogProgress, startClassification } from '../api/client';

interface ClassificationMonitorPageProps {
  catalog: Catalog;
  onNavigateToReviews: () => void;
  onNavigateToProducts: () => void;
}

export const ClassificationMonitorPage: React.FC<ClassificationMonitorPageProps> = ({
  catalog,
  onNavigateToReviews,
  onNavigateToProducts,
}) => {
  const [progress, setProgress] = useState<CatalogProgress | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const loadProgress = async () => {
    try {
      const data = await fetchCatalogProgress(catalog.id);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress in monitor:', err);
    }
  };

  useEffect(() => {
    loadProgress();
    const interval = setInterval(loadProgress, 2000);
    return () => clearInterval(interval);
  }, [catalog.id]);

  const handleStart = async (retryFailed = false) => {
    setIsTriggering(true);
    try {
      await startClassification(catalog.id, retryFailed);
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

  const total = progress?.total_products ?? catalog.total_products ?? 0;
  const completed = progress?.completed ?? 0;
  const manualReview = progress?.manual_review ?? 0;
  const failed = progress?.failed ?? 0;
  const processed = completed + manualReview + failed;
  const pending = progress?.pending ?? Math.max(0, total - processed);
  const percent = progress?.progress_percentage ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="card-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Classification Monitor</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isProcessing
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : progress?.catalog_status === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {isProcessing ? 'PROCESSING' : progress?.catalog_status || catalog.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Catalogue: <span className="font-semibold text-slate-700">{catalog.name}</span> • Total Items: {total.toLocaleString()}
          </p>
        </div>

        {/* Start / Action Controls */}
        <div className="flex items-center space-x-2.5">
          {!isProcessing && pending > 0 && (
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

          {!isProcessing && failed > 0 && (
            <button
              onClick={() => handleStart(true)}
              disabled={isTriggering}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Failed</span>
            </button>
          )}
        </div>
      </div>

      {/* Large Progress Indicator */}
      <div className="card-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center space-x-2">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>Engine Running</span>
                </>
              ) : percent >= 100 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Batch Completed</span>
                </>
              ) : (
                <span>Batch Status</span>
              )}
            </h2>
            <div className="text-xs text-slate-500">
              {processed.toLocaleString()} of {total.toLocaleString()} products processed
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono">
            {percent.toFixed(1)}%
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              percent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(percent, isProcessing ? 2 : 0))}%` }}
          />
        </div>

        {progress?.latest_job?.current_step && (
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-500">Current Step:</span>
            <span className="font-mono font-medium text-slate-800">
              {progress.latest_job.current_step}
            </span>
          </div>
        )}
      </div>

      {/* Real Real-Time Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{completed.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">High-confidence auto-approved</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Manual Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{manualReview.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">Queued for review</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-700">{pending.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">Awaiting processing</div>
        </div>

        <div className="card-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Failed</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{failed.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">Errors encountered</div>
        </div>
      </div>

      {/* Navigation Shortcuts */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onNavigateToProducts}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition flex items-center space-x-1.5"
        >
          <span>View All Products</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {manualReview > 0 && (
          <button
            onClick={onNavigateToReviews}
            className="px-4 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg shadow-2xs transition flex items-center space-x-1.5"
          >
            <span>Review Queue ({manualReview})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
