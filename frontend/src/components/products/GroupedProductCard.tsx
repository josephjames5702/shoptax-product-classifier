import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { CheckCircle2, AlertTriangle, Clock, XCircle, X } from 'lucide-react';

interface GroupedProductCardProps {
  variants: Product[];
  onViewDetail: (id: string) => void;
  onRemove: (product: Product) => void;
}

export const GroupedProductCard: React.FC<GroupedProductCardProps> = ({
  variants,
  onViewDetail,
  onRemove,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // If variants array changes and the selected index is now out of bounds, reset to 0
  useEffect(() => {
    if (selectedIndex >= variants.length) {
      setSelectedIndex(0);
    }
  }, [variants.length, selectedIndex]);

  if (!variants || variants.length === 0) {
    return null;
  }

  const selectedProduct = variants[selectedIndex] || variants[0];
  const summary = selectedProduct.classification_summary;

  const getStatusBadge = (product: Product) => {
    if (product.decision_status === 'ADMIN_APPROVED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm backdrop-blur-sm">
          <CheckCircle2 className="w-3 h-3" />
          <span>Admin Approved</span>
        </span>
      );
    }
    if (product.decision_status === 'ADMIN_DECLINED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm backdrop-blur-sm">
          <XCircle className="w-3 h-3" />
          <span>Admin Declined</span>
        </span>
      );
    }

    switch (product.processing_status) {
      case 'AUTO_APPROVED':
      case 'CLASSIFIED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm backdrop-blur-sm">
            <CheckCircle2 className="w-3 h-3" />
            <span>Classified</span>
          </span>
        );
      case 'MANUAL_REVIEW':
      case 'REQUIRES_REVIEW':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm backdrop-blur-sm">
            <AlertTriangle className="w-3 h-3" />
            <span>Needs Review</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm backdrop-blur-sm">
            <Clock className="w-3 h-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm backdrop-blur-sm">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm backdrop-blur-sm">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const hasMultipleVariants = variants.length > 1;

  // Simple color extractor
  const getColorName = (p: Product, index: number) => {
    if (p.color && p.color.trim() !== '') return p.color.trim();
    if (p.color_collection && p.color_collection.trim() !== '') return p.color_collection.trim();
    return `Variant ${index + 1}`;
  };

  const confidenceScore = summary?.confidence_score ?? 0;
  const confidencePercent = (confidenceScore * 100).toFixed(1);
  const confidenceBadgeColor =
    confidenceScore >= 0.9
      ? 'bg-emerald-100 text-emerald-800'
      : confidenceScore >= 0.7
      ? 'bg-blue-100 text-blue-800'
      : 'bg-amber-100 text-amber-800';

  return (
    <div 
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col cursor-pointer"
      onClick={() => onViewDetail(selectedProduct.id)}
    >
      <div className="h-48 w-full bg-slate-50 relative border-b border-slate-100 flex items-center justify-center overflow-hidden">
        <ImageWithFallback
          productId={selectedProduct.id}
          initialSrc={selectedProduct.primary_image}
          alt={selectedProduct.title || selectedProduct.product_number || ''}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          {getStatusBadge(selectedProduct)}
        </div>
      </div>
      
      {/* Variant Selector */}
      {hasMultipleVariants && (
        <div className="px-4 pt-3 pb-1 border-b border-slate-50" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] font-semibold text-slate-500 mb-2 flex justify-between items-center">
            <span>SELECTED COLOR: <span className="text-slate-800 font-bold">{getColorName(selectedProduct, selectedIndex)}</span></span>
            <span className="text-slate-400">{variants.length} colors</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, i) => {
              const isSelected = i === selectedIndex;
              const colorName = getColorName(v, i);
              return (
                <button
                  key={v.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(i);
                  }}
                  title={colorName}
                  className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all ${
                    isSelected ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                  }`}
                >
                  <ImageWithFallback
                    productId={v.id}
                    initialSrc={v.primary_image}
                    alt={colorName}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="p-4 flex flex-col flex-grow">
        <div className="text-xs font-mono text-slate-500 mb-1">{selectedProduct.product_number || 'No SKU'}</div>
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2" title={selectedProduct.title}>
          {selectedProduct.title || 'Unnamed Product'}
        </h3>
        
        {selectedProduct.brand && (
          <div className="text-xs text-slate-500 mb-2">Brand: <span className="font-medium text-slate-700">{selectedProduct.brand}</span></div>
        )}
        
        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
          {selectedProduct.processing_status !== 'PENDING' && summary?.category_name ? (
            <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Shopify Category</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${confidenceBadgeColor}`}>
                  {confidencePercent}% {confidenceScore >= 0.9 ? 'High' : confidenceScore >= 0.7 ? 'Medium' : 'Review'}
                </span>
              </div>
              <div className="text-xs text-slate-900 font-semibold leading-tight line-clamp-2" title={summary.category_path}>
                {summary.category_path ? summary.category_path.split(' > ').join(' › ') : summary.category_name}
              </div>

              {/* Extracted Attributes */}
              {summary.attributes && summary.attributes.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1">
                  {summary.attributes.slice(0, 3).map((attr: any, aIdx: number) => (
                    <span key={aIdx} className="inline-block text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      <span className="font-semibold text-slate-800">{attr.name}:</span> {attr.value}
                    </span>
                  ))}
                </div>
              )}

              {/* Ambiguous Candidates for Manual Review */}
              {(selectedProduct.processing_status === 'REQUIRES_REVIEW' || selectedProduct.processing_status === 'MANUAL_REVIEW') &&
                summary.alternatives && summary.alternatives.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-slate-200 text-[10px] text-slate-500">
                    <span className="font-semibold text-amber-700">Top Candidates:</span>
                    <ul className="list-disc list-inside space-y-0.5 mt-0.5 text-[10px] text-slate-600">
                      {summary.alternatives.slice(0, 2).map((alt: any, altIdx: number) => (
                        <li key={altIdx} className="truncate">
                          {alt.category_name} ({alt.score}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-2.5 space-y-1 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Shopify Category</span>
                <span className="text-[10px] font-semibold text-slate-400">Confidence: —</span>
              </div>
              <div className="text-xs text-slate-400 italic">Not Classified</div>
            </div>
          )}
          
          <div className="pt-2 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(selectedProduct);
              }}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-medium flex items-center space-x-1 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove {hasMultipleVariants ? 'Variant' : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
