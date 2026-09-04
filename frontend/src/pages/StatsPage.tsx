import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Catalog, CatalogProgress } from '../types';
import { fetchCatalogProgress } from '../api/client';

interface StatsPageProps {
  catalog: Catalog;
}

export const StatsPage: React.FC<StatsPageProps> = ({ catalog }) => {
  const [progress, setProgress] = useState<CatalogProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCatalogProgress(catalog.id);
        setProgress(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [catalog.id]);

  const total = progress?.total_products ?? catalog.total_products ?? 0;
  const completed = progress?.completed ?? 0;
  const manualReview = progress?.manual_review ?? 0;
  const failed = progress?.failed ?? 0;
  const processed = completed + manualReview + failed;
  const pending = progress?.pending ?? Math.max(0, total - processed);
  const percent = progress?.progress_percentage ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-5">
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span>Catalogue Statistics</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real database execution metrics for{' '}
          <span className="font-semibold text-slate-700">{catalog.name}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="card-panel py-16 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span>Loading statistics…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card-panel p-4 space-y-1">
            <div className="text-xs text-slate-500">Total Products</div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {total.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Database product records</div>
          </div>

          <div className="card-panel p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Completed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 font-mono">
              {completed.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Classified above threshold</div>
          </div>

          <div className="card-panel p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Manual Review</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 font-mono">
              {manualReview.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Awaiting evaluator review</div>
          </div>

          <div className="card-panel p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Completion</span>
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 font-mono">
              {percent.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400">
              {processed.toLocaleString()} of {total.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
