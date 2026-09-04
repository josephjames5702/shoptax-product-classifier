import React, { useState, useEffect } from 'react';
import { X, Search, Check, Layers, AlertCircle } from 'lucide-react';
import { ClassificationResult, TaxonomyCategory } from '../../types';
import { fetchTaxonomyCategories, overrideClassification } from '../../api/client';

interface OverrideCategoryModalProps {
  classification: ClassificationResult | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const OverrideCategoryModal: React.FC<OverrideCategoryModalProps> = ({
  classification,
  onClose,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [reviewer, setReviewer] = useState('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!classification) return;
    searchCategories('');
  }, [classification]);

  const searchCategories = async (query: string) => {
    setIsLoading(true);
    try {
      const res = await fetchTaxonomyCategories({
        search: query || undefined,
        is_leaf: true,
      });
      setCategories(res.results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    searchCategories(val);
  };

  const handleOverrideSubmit = async () => {
    if (!classification || !selectedCatId) return;
    setIsSubmitting(true);
    try {
      await overrideClassification(classification.id, selectedCatId, reviewer, notes);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!classification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Manual Category Override</h2>
          </div>

          <div className="text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400">Product: <span className="text-white font-medium">{classification.product_title}</span></div>
            <div className="text-slate-400">Current Prediction: <span className="text-amber-400 font-medium">{classification.category.full_path}</span></div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 14,000+ Shopify taxonomy categories (e.g. Sofa, Ski, Shoes)..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Categories List */}
          <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/40 space-y-1 min-h-[220px]">
            {isLoading ? (
              <div className="text-center py-8 text-xs text-slate-500">Searching taxonomy...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">No categories found matching query.</div>
            ) : (
              categories.map((c) => {
                const isSelected = selectedCatId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCatId(c.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-600/30 border border-indigo-500 text-white'
                        : 'bg-slate-900/50 hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.full_path}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Reviewer Note */}
          <div className="space-y-1 text-xs">
            <label className="text-slate-400 font-medium">Reviewer Note / Justification</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why this category is more appropriate..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
            >
              Cancel
            </button>
            <button
              disabled={!selectedCatId || isSubmitting}
              onClick={handleOverrideSubmit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center space-x-1.5"
            >
              {isSubmitting ? 'Saving...' : 'Apply Category Override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
