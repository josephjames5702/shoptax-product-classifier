import React from 'react';
import { X, Activity, AlertCircle, ShieldCheck } from 'lucide-react';
import { ClassificationResult } from '../../types';

interface SignalsBreakdownModalProps {
  classification: ClassificationResult | null;
  onClose: () => void;
}

export const SignalsBreakdownModal: React.FC<SignalsBreakdownModalProps> = ({
  classification,
  onClose,
}) => {
  if (!classification) return null;

  const breakdown = classification.signals_breakdown;
  const scores = breakdown?.scores || {
    semantic_similarity: 0,
    lexical_match: 0,
    hierarchical_consistency: 0,
    llm_reranker_score: 0,
    attribute_consistency: 0,
    image_evidence: 0,
    data_completeness: 0,
  };

  const signals = [
    { key: 'semantic_similarity', label: 'Semantic Similarity', weight: '25%', score: scores.semantic_similarity },
    { key: 'llm_reranker_score', label: 'AI Reranker Score', weight: '20%', score: scores.llm_reranker_score },
    { key: 'lexical_match', label: 'BM25 Lexical Match', weight: '15%', score: scores.lexical_match },
    { key: 'hierarchical_consistency', label: 'Hierarchy Consistency', weight: '15%', score: scores.hierarchical_consistency },
    { key: 'attribute_consistency', label: 'Attribute Consistency', weight: '10%', score: scores.attribute_consistency },
    { key: 'image_evidence', label: 'Image Visual Evidence', weight: '10%', score: scores.image_evidence },
    { key: 'data_completeness', label: 'Data Completeness', weight: '5%', score: scores.data_completeness },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Multi-Signal Confidence Scoring Breakdown</h2>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Application-Level Composite Score</div>
              <div className="text-2xl font-black text-white">{classification.confidence_score}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Confidence Band</div>
              <div className="text-sm font-bold text-indigo-400">{classification.confidence_level}</div>
            </div>
          </div>

          {/* Signals Bar Progress */}
          <div className="space-y-3 pt-2">
            {signals.map((sig) => (
              <div key={sig.key} className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    {sig.label}{' '}
                    <span className="text-[10px] text-slate-400 font-mono">({sig.weight} weight)</span>
                  </span>
                  <span className="font-mono font-semibold text-white">{sig.score}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, sig.score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Review Reasons if present */}
          {breakdown?.review_reasons && breakdown.review_reasons.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
              <div className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Manual Review Triggers:</span>
              </div>
              <ul className="text-[11px] text-amber-200/90 list-disc list-inside space-y-0.5">
                {breakdown.review_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
