import React, { useState } from 'react';
import { Product } from '../../types';
import { X, Package, CheckCircle2, AlertTriangle, Clock, XCircle, Palette } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  variants?: Product[];
  onClose: () => void;
  onSelectVariant?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product: initialProduct,
  variants = [],
  onClose,
  onSelectVariant,
}) => {
  const [currentProduct, setCurrentProduct] = useState<Product>(initialProduct);
  const summary = currentProduct.classification_summary;

  // Combine parent item with other color variants sharing model_number or root title
  const allVariants = variants.length > 0
    ? (variants.some((v) => v.id === currentProduct.id) ? variants : [currentProduct, ...variants])
    : [currentProduct];

  const handleVariantPick = (v: Product) => {
    setCurrentProduct(v);
    if (onSelectVariant) onSelectVariant(v);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{currentProduct.title}</h3>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs text-slate-400 font-mono">SKU: {currentProduct.product_number}</span>
              {currentProduct.model_number && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                  ID: {currentProduct.model_number}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="h-44 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
            {currentProduct.primary_image ? (
              <img src={currentProduct.primary_image} alt="" className="w-full h-full object-contain" />
            ) : (
              <Package className="w-8 h-8 text-slate-300" />
            )}
          </div>

          {/* Flipkart-Style Color / Variant Selector */}
          {allVariants.length > 1 && (
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-600" />
                  <span>Choose Color / Variant:</span>
                </span>
                <span className="text-[11px] font-semibold text-blue-600">
                  {currentProduct.color || 'Selected'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {allVariants.map((v) => {
                  const isSelected = v.id === currentProduct.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => handleVariantPick(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/10"
                        style={{
                          backgroundColor:
                            v.color?.toLowerCase() === 'black'
                              ? '#111827'
                              : v.color?.toLowerCase() === 'granite' || v.color?.toLowerCase() === 'grey' || v.color?.toLowerCase() === 'gray'
                              ? '#6b7280'
                              : v.color?.toLowerCase() === 'yellow'
                              ? '#eab308'
                              : v.color?.toLowerCase() === 'pink'
                              ? '#ec4899'
                              : v.color?.toLowerCase() === 'smoke'
                              ? '#94a3b8'
                              : v.color?.toLowerCase() === 'clear'
                              ? '#e2e8f0'
                              : v.color?.toLowerCase() === 'beige' || v.color?.toLowerCase() === 'silver'
                              ? '#d1d5db'
                              : '#3b82f6',
                        }}
                      />
                      <span>{v.color || v.product_number || 'Variant'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="font-semibold text-slate-500">Processing Status:</span>{' '}
              <span className="font-mono text-slate-800 font-bold">{currentProduct.processing_status}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Decision Status:</span>{' '}
              <span className="font-mono text-slate-800 font-bold">{currentProduct.decision_status || 'NOT_REVIEWED'}</span>
            </div>
            {currentProduct.color && (
              <div>
                <span className="font-semibold text-slate-500">Selected Color:</span>{' '}
                <span className="font-semibold text-slate-900">{currentProduct.color}</span>
              </div>
            )}
            {currentProduct.reviewed_by && (
              <div>
                <span className="font-semibold text-slate-500">Reviewed By:</span> {currentProduct.reviewed_by}
              </div>
            )}
          </div>

          {currentProduct.decline_reason && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-0.5">
              <div className="font-bold flex items-center space-x-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Decline Reason:</span>
              </div>
              <div className="text-[11px]">{currentProduct.decline_reason}</div>
            </div>
          )}

          {currentProduct.description && (
            <div>
              <span className="font-semibold text-slate-600">Description:</span>
              <p className="text-slate-700 mt-0.5 line-clamp-3 leading-relaxed">
                {currentProduct.description}
              </p>
            </div>
          )}

          {summary && (
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1">
              <div className="font-semibold text-blue-900">Shopify Standard Product Category:</div>
              <div className="text-blue-800 font-bold">{summary.category_name}</div>
              <div className="text-[11px] text-slate-500">{summary.category_path}</div>
              <div className="text-[11px] text-blue-600 font-mono">
                Confidence: {(summary.confidence_score * 100).toFixed(1)}% ({summary.confidence_level})
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
