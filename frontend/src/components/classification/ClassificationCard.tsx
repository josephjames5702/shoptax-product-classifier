import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Info,
  Layers,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { ClassificationResult } from '../../types';

interface ClassificationCardProps {
  classification: ClassificationResult;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onOverride?: (classification: ClassificationResult) => void;
  onViewSignals?: (classification: ClassificationResult) => void;
  readOnly?: boolean;
}

export const ClassificationCard: React.FC<ClassificationCardProps> = ({
  classification,
  onApprove,
  onReject,
  onOverride,
  onViewSignals,
  readOnly = false,
}) => {
  const [showAltDetails, setShowAltDetails] = useState(false);

  const getConfidenceBadge = (score: number, level: string) => {
    if (score >= 85) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{score}% HIGH</span>
        </span>
      );
    }
    if (score >= 70) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{score}% MEDIUM</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" />
        <span>{score}% LOW REVIEW</span>
      </span>
    );
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">Approved</span>;
      case 'PENDING_REVIEW':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">Review Needed</span>;
      case 'OVERRIDDEN':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">Overridden</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">Rejected</span>;
      default:
        return null;
    }
  };

  const pathParts = classification.category.full_path.split(' > ');

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4 hover:shadow-2xl transition-all">
      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
              SKU: {classification.product_number || 'N/A'}
            </span>
            {getStatusPill(classification.status)}
          </div>
          <h3 className="text-sm font-semibold text-white line-clamp-1" title={classification.product_title}>
            {classification.product_title}
          </h3>
        </div>
        <div>{getConfidenceBadge(classification.confidence_score, classification.confidence_level)}</div>
      </div>

      {/* Shopify Taxonomy Hierarchy Card */}
      <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
          <Layers className="w-3 h-3 text-indigo-400" />
          <span>Shopify Standard Taxonomy</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {pathParts.map((part, idx) => (
            <React.Fragment key={idx}>
              <span
                className={`px-2 py-0.5 rounded-md ${
                  idx === pathParts.length - 1
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30'
                    : 'bg-slate-800/60 text-slate-300'
                }`}
              >
                {part}
              </span>
              {idx < pathParts.length - 1 && <ChevronRight className="w-3 h-3 text-slate-400" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Category Attributes & Validated Values */}
      {classification.extracted_attributes && classification.extracted_attributes.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Category-Specific Attributes & Values
          </div>
          <div className="grid grid-cols-2 gap-2">
            {classification.extracted_attributes.map((attr) => (
              <div
                key={attr.id}
                className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50 flex flex-col justify-between text-xs"
              >
                <div className="text-[11px] text-slate-400">{attr.attribute_name}</div>
                <div className="font-medium text-slate-200 flex items-center space-x-1 mt-0.5">
                  <span className="truncate">{attr.normalized_value || attr.raw_value}</span>
                  {attr.is_valid_taxonomy_value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Valid Shopify taxonomy value" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence & Rationale */}
      <div className="space-y-1 text-xs bg-slate-900/40 rounded-xl p-2.5 border border-slate-800/50 text-slate-300">
        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Decision Evidence</span>
        </div>
        <p className="text-[11px] text-slate-300 line-clamp-2">{classification.reasoning}</p>
        {classification.text_evidence && (
          <p className="text-[10px] text-slate-400 line-clamp-1 italic">
            Text clues: {classification.text_evidence}
          </p>
        )}
      </div>

      {/* Alternatives Preview */}
      {classification.alternatives && classification.alternatives.length > 0 && (
        <div>
          <button
            onClick={() => setShowAltDetails(!showAltDetails)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 font-medium"
          >
            <span>{showAltDetails ? 'Hide' : 'Show'} Top 3 Alternative Categories</span>
            <ChevronRight className={`w-3 h-3 transform transition-transform ${showAltDetails ? 'rotate-90' : ''}`} />
          </button>
          {showAltDetails && (
            <div className="mt-2 space-y-1.5 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/60">
              {classification.alternatives.map((alt) => (
                <div key={alt.id} className="text-xs flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0">
                  <div className="truncate pr-2">
                    <span className="text-[10px] font-bold text-slate-400 mr-1.5">#{alt.rank}</span>
                    <span className="text-slate-300">{alt.category.name}</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-slate-400">{alt.score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
        <button
          onClick={() => onViewSignals && onViewSignals(classification)}
          className="text-xs text-slate-400 hover:text-indigo-400 flex items-center space-x-1 py-1"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Signals Breakdown</span>
        </button>

        {!readOnly && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOverride && onOverride(classification)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>Override</span>
            </button>
            {classification.status === 'PENDING_REVIEW' && (
              <>
                <button
                  onClick={() => onReject && onReject(classification.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition"
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove && onApprove(classification.id)}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Approve</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
