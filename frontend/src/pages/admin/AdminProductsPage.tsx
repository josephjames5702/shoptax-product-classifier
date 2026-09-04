import React, { useState, useEffect } from 'react';
import { Product, Catalog } from '../../types';
import { fetchProducts, fetchCatalogs, approveClassification, rejectClassification } from '../../api/client';
import { ProductDetailModal } from '../../components/product/ProductDetailModal';
import { Pagination } from '../../components/common/Pagination';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const AdminProductsPage: React.FC<{ initialStatusFilter?: string }> = ({
  initialStatusFilter = '',
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
    setPage(1);
  }, [initialStatusFilter]);

  // Decline Modal state
  const [decliningProduct, setDecliningProduct] = useState<Product | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const loadCatalogs = async () => {
    try {
      const data = await fetchCatalogs();
      setCatalogs(data || []);
    } catch (err) {
      console.error('Failed to load catalogs for filter:', err);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page,
        page_size: pageSize,
      };
      if (catalogFilter) params.catalog_id = catalogFilter;
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await fetchProducts(params);
      setProducts(res.results || []);
      setTotalCount(res.count || 0);
    } catch (err) {
      console.error('Failed to load admin products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, []);

  // Admin live polling (5s)
  useEffect(() => {
    loadProducts();
    const interval = setInterval(loadProducts, 5000);
    return () => clearInterval(interval);
  }, [page, catalogFilter, statusFilter, search]);

  const handleApprove = async (product: Product) => {
    if (!product.classification_summary?.id) {
      alert('Cannot approve: classification result ID not found.');
      return;
    }
    if (!window.confirm(`Approve predicted classification for "${product.title}"?`)) return;

    setActionLoadingId(product.id);
    try {
      await approveClassification(product.classification_summary.id, 'admin', 'Approved by administrator');
      await loadProducts();
    } catch (err) {
      console.error('Approve failed:', err);
      alert('Approval failed. Please check server logs.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDecline = async () => {
    if (!decliningProduct?.classification_summary?.id) return;
    setActionLoadingId(decliningProduct.id);
    try {
      await rejectClassification(
        decliningProduct.classification_summary.id,
        'admin',
        declineReason.trim() || 'Declined by administrator'
      );
      setDecliningProduct(null);
      setDeclineReason('');
      await loadProducts();
    } catch (err) {
      console.error('Decline failed:', err);
      alert('Decline failed. Please check server logs.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Control Header */}
      <div className="card-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-[#0ea5e9]" />
              <span>
                {statusFilter === 'manual review'
                  ? 'Review Queue - Action Required'
                  : 'Admin Product Supervisor'}
              </span>
              {statusFilter === 'manual review' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Needs Review ({totalCount})
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {statusFilter === 'manual review'
                ? 'Review products flagged for human verification. Approve correct mappings or decline with feedback.'
                : 'Inspect products across all user catalogues, verify taxonomy alignments, and execute manual Approve/Decline actions.'}
            </p>
          </div>

          <button
            onClick={loadProducts}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors self-start sm:self-auto cursor-pointer"
            title="Refresh Products"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, SKU, brand..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <select
              value={catalogFilter}
              onChange={(e) => {
                setCatalogFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Catalogues</option>
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.owner_username || 'Anonymous'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved (All)</option>
              <option value="completed">Automatically Approved</option>
              <option value="admin_approved">Admin Approved</option>
              <option value="manual review">Needs Review</option>
              <option value="pending">Pending</option>
              <option value="declined">Admin Declined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card-panel overflow-hidden">
        {isLoading && products.length === 0 ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs">Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-1">
            <Package className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No products matching filter criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Predicted Category</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Classification Status</th>
                  <th className="py-3 px-4">Decision Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {products.map((p) => {
                  const isDeclined = p.decision_status === 'ADMIN_DECLINED';
                  const isApproved = p.decision_status === 'ADMIN_APPROVED';
                  const isReview = p.decision_status === 'REQUIRES_REVIEW' || p.processing_status === 'REQUIRES_REVIEW';
                  const isAutoApproved = !isDeclined && !isApproved && (p.decision_status === 'AUTO_CLASSIFIED' || p.processing_status === 'AUTO_APPROVED' || p.processing_status === 'CLASSIFIED');

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {p.primary_image ? (
                              <img src={p.primary_image} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">{p.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono">SKU: {p.product_number || 'N/A'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1">
                          {p.classification_summary?.category_name || 'Pending'}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {p.classification_summary?.category_path || ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {p.classification_summary ? (
                          <span className="font-bold text-blue-600">
                            {Math.round(p.classification_summary.confidence_score * 100)}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {p.processing_status}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {isDeclined ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                            Admin Declined
                          </span>
                        ) : isApproved ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Admin Approved
                          </span>
                        ) : isReview ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            Needs Review
                          </span>
                        ) : isAutoApproved ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                            Auto Approved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                            Not Reviewed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {p.classification_summary?.id && !isApproved && (
                            <button
                              onClick={() => handleApprove(p)}
                              disabled={actionLoadingId === p.id}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                              title="Approve classification"
                            >
                              {actionLoadingId === p.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              <span>Approve</span>
                            </button>
                          )}

                          {p.classification_summary?.id && !isDeclined && (
                            <button
                              onClick={() => {
                                setDecliningProduct(p);
                                setDeclineReason('');
                              }}
                              disabled={actionLoadingId === p.id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                              title="Decline classification"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Decline</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedProduct(p)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                            title="View details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
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

        {/* Server-Side Pagination */}
        <div className="px-6 py-4 bg-white border-t border-slate-100">
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Decline Reason Modal */}
      {decliningProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Decline Product Classification</span>
            </h3>

            <p className="text-xs text-slate-500">
              You are declining the proposed category for{' '}
              <span className="font-semibold text-slate-800">{decliningProduct.title}</span>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Decline Reason (Optional)
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Category mismatch, requires higher specificity..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDecliningProduct(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecline}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          variants={
            selectedProduct.model_number
              ? products.filter(
                  (p) =>
                    p.model_number === selectedProduct.model_number ||
                    (p.title.split(' by ')[0] === selectedProduct.title.split(' by ')[0])
                )
              : products.filter(
                  (p) => p.title.split(' by ')[0] === selectedProduct.title.split(' by ')[0]
                )
          }
          onClose={() => setSelectedProduct(null)}
          onSelectVariant={(p) => setSelectedProduct(p)}
        />
      )}
    </div>
  );
};
