import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { ClassificationResult, Catalog } from '../types';
import {
  fetchClassifications,
  approveClassification,
  rejectClassification,
} from '../api/client';
import { ClassificationCard } from '../components/classification/ClassificationCard';
import { SignalsBreakdownModal } from '../components/classification/SignalsBreakdownModal';
import { OverrideCategoryModal } from '../components/review/OverrideCategoryModal';

interface ClassificationResultsPageProps {
  catalog: Catalog;
}

export const ClassificationResultsPage: React.FC<ClassificationResultsPageProps> = ({
  catalog,
}) => {
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [confidenceFilter, setConfidenceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [selectedForSignals, setSelectedForSignals] = useState<ClassificationResult | null>(null);
  const [selectedForOverride, setSelectedForOverride] = useState<ClassificationResult | null>(null);

  const loadResults = async () => {
    setIsLoading(true);
    try {
      const res = await fetchClassifications({
        catalog_id: catalog.id,
        confidence_level: confidenceFilter || undefined,
        status: statusFilter || undefined,
        page,
      });
      setClassifications(res.results);
      setTotalCount(res.count);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, [catalog.id, page, confidenceFilter, statusFilter]);

  const handleApprove = async (id: string) => {
    try {
      await approveClassification(id);
      loadResults();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectClassification(id);
      loadResults();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / 25);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">Classification Results</h1>
          </div>
          <p className="text-xs text-slate-400">
            Showing {classifications.length} of {totalCount} classified products with category-specific attributes
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Confidence Filter */}
          <select
            value={confidenceFilter}
            onChange={(e) => {
              setConfidenceFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Confidence Levels</option>
            <option value="HIGH">High (≥85%)</option>
            <option value="MEDIUM">Medium (70-84%)</option>
            <option value="LOW">Low (&lt;70%)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="OVERRIDDEN">Overridden</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Loading classification cards...</div>
      ) : classifications.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 space-y-2">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-400">No classification results found.</div>
          <div className="text-xs text-slate-500">
            Start batch classification from the Overview tab to generate results.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {classifications.map((c) => (
            <ClassificationCard
              key={c.id}
              classification={c}
              onApprove={handleApprove}
              onReject={handleReject}
              onOverride={(item) => setSelectedForOverride(item)}
              onViewSignals={(item) => setSelectedForSignals(item)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <SignalsBreakdownModal
        classification={selectedForSignals}
        onClose={() => setSelectedForSignals(null)}
      />

      <OverrideCategoryModal
        classification={selectedForOverride}
        onClose={() => setSelectedForOverride(null)}
        onSuccess={loadResults}
      />
    </div>
  );
};
