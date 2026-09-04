import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  Edit3,
  AlertTriangle,
  History,
  X,
  Loader2,
} from 'lucide-react';
import { ClassificationResult, ReviewDecision, Catalog } from '../types';
import {
  fetchReviewQueue,
  fetchReviewHistory,
  approveClassification,
  rejectClassification,
  overrideClassification,
} from '../api/client';

interface ManualReviewQueuePageProps {
  catalog: Catalog;
  onRefreshReviewCount?: () => void;
}

export const ManualReviewQueuePage: React.FC<ManualReviewQueuePageProps> = ({
  catalog,
  onRefreshReviewCount,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [queueItems, setQueueItems] = useState<ClassificationResult[]>([]);
  const [historyItems, setHistoryItems] = useState<ReviewDecision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Override modal state
  const [overrideItem, setOverrideItem] = useState<ClassificationResult | null>(null);
  const [overrideCategoryId, setOverrideCategoryId] = useState<number | null>(null);
  const [overrideNotes, setOverrideNotes] = useState('');

  // Decline modal state
  const [decliningItem, setDecliningItem] = useState<ClassificationResult | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetchReviewQueue({ catalog_id: catalog.id });
      setQueueItems(res.results || []);
      if (onRefreshReviewCount) onRefreshReviewCount();
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetchReviewHistory({ catalog_id: catalog.id });
      setHistoryItems(res.results || []);
    } catch (err) {
      console.error('Failed to load review history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'queue') {
      loadQueue();
    } else {
      loadHistory();
    }
  }, [catalog.id, activeTab]);

  const handleApprove = async (resultId: string) => {
    setActionLoadingId(resultId);
    try {
      await approveClassification(resultId, 'admin', 'Approved by administrator');
      loadQueue();
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDecline = async () => {
    if (!decliningItem) return;
    setActionLoadingId(decliningItem.id);
    try {
      await rejectClassification(decliningItem.id, 'admin', declineReason.trim() || 'Insufficient product information');
      setDecliningItem(null);
      setDeclineReason('');
      loadQueue();
    } catch (err) {
      console.error('Decline failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideItem || !overrideCategoryId) return;
    setActionLoadingId(overrideItem.id);
    try {
      await overrideClassification(overrideItem.id, overrideCategoryId, 'evaluator', overrideNotes || 'Manual override');
      setOverrideItem(null);
      setOverrideCategoryId(null);
      setOverrideNotes('');
      loadQueue();
    } catch (err) {
      console.error('Override failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <span>Manual Review Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Low-confidence classifications requiring human verification for{' '}
            <span className="font-semibold text-slate-700">{catalog.name}</span>
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs border border-slate-200">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1 rounded-md font-medium transition ${
              activeTab === 'queue'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Review ({queueItems.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 rounded-md font-medium transition ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resolved History ({historyItems.length})
          </button>
        </div>
      </div>

      {/* Queue List Table */}
      {activeTab === 'queue' ? (
        <div className="card-panel overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Loading review queue…</span>
            </div>
          ) : queueItems.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">
                All classifications are currently resolved.
              </div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto">
                No products in this catalogue currently require manual review.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="table-header">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Predicted Category</th>
                    <th className="py-3 px-4 text-center">Confidence</th>
                    <th className="py-3 px-4">Top Alternative Suggestions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {queueItems.map((item) => {
                    const isActing = actionLoadingId === item.id;
                    const alts = item.alternatives || [];

                    return (
                      <tr key={item.id} className="table-row">
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {item.product_number || '—'}
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate" title={item.product_title}>
                          {item.product_title}
                        </td>

                        <td className="py-3 px-4 text-slate-800 max-w-xs truncate">
                          <span className="font-semibold text-slate-900">
                            {item.category?.name || 'Unassigned'}
                          </span>
                          <div className="text-[10px] font-mono text-slate-400">
                            {item.category?.external_id}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center font-mono">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {(item.confidence_score * 100).toFixed(1)}%
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {alts.length === 0 ? (
                            <span className="text-slate-400 italic">None</span>
                          ) : (
                            <div className="space-y-1">
                              {alts.slice(0, 2).map((alt) => (
                                <div key={alt.id} className="text-[11px] flex items-center space-x-1.5">
                                  <span className="text-slate-500 font-mono">#{alt.rank}</span>
                                  <span className="font-medium text-slate-800">{alt.category?.name}</span>
                                  <span className="text-slate-400 text-[10px]">
                                    ({(alt.score * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              disabled={isActing}
                              onClick={() => handleApprove(item.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium rounded-md text-xs transition disabled:opacity-40 cursor-pointer"
                              title="Approve current prediction"
                            >
                              Approve
                            </button>
                            <button
                              disabled={isActing}
                              onClick={() => {
                                setDecliningItem(item);
                                setDeclineReason('');
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-md text-xs transition disabled:opacity-40 cursor-pointer"
                              title="Decline prediction"
                            >
                              Decline
                            </button>
                            <button
                              disabled={isActing}
                              onClick={() => {
                                setOverrideItem(item);
                                setOverrideCategoryId(item.category?.id || null);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium rounded-md text-xs shadow-2xs transition disabled:opacity-40 cursor-pointer"
                              title="Override with alternative category"
                            >
                              Override
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* History Table */
        <div className="card-panel overflow-hidden">
          {historyItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No review decisions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="table-header">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Product SKU</th>
                    <th className="py-3 px-4">Approved / Assigned Category</th>
                    <th className="py-3 px-4">Reviewer Notes</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {historyItems.map((dec) => (
                    <tr key={dec.id} className="table-row">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            dec.action === 'APPROVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {dec.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {dec.classification?.product_number || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {dec.new_category?.name || dec.classification?.category?.name || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{dec.notes || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {new Date(dec.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Override Category Modal */}
      {overrideItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Override Category</h3>
                <p className="text-xs text-slate-500">
                  Select an alternative Shopify category for {overrideItem.product_number || overrideItem.product_title}
                </p>
              </div>
              <button
                onClick={() => setOverrideItem(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Choose from Suggested Alternatives:
                </label>
                <div className="space-y-1.5">
                  {overrideItem.alternatives?.map((alt) => (
                    <label
                      key={alt.id}
                      className={`p-2.5 border rounded-lg flex items-center justify-between cursor-pointer transition ${
                        overrideCategoryId === alt.category?.id
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="override_alt"
                          checked={overrideCategoryId === alt.category?.id}
                          onChange={() => setOverrideCategoryId(alt.category?.id || null)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-medium text-slate-900">{alt.category?.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {alt.category?.external_id}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-600 text-[11px]">
                        {(alt.score * 100).toFixed(0)}%
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Review Notes:</label>
                <input
                  type="text"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="Reason for override…"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                onClick={() => setOverrideItem(null)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={!overrideCategoryId || actionLoadingId === overrideItem.id}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-40"
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {decliningItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Decline Classification</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  SKU: {decliningItem.product_number || decliningItem.product_id}
                </p>
              </div>
              <button
                onClick={() => setDecliningItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                You are declining the proposed category for{' '}
                <span className="font-semibold text-slate-800">{decliningItem.product_title}</span>.
              </p>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Decline:</label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Insufficient product information, category mismatch..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                onClick={() => setDecliningItem(null)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecline}
                disabled={actionLoadingId === decliningItem.id}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-40"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
