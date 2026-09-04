import React, { useState, useEffect } from 'react';
import { Catalog, Product } from '../../types';
import { fetchProducts, deleteProduct, createProduct } from '../../api/client';
import { ProductDetailModal } from '../../components/product/ProductDetailModal';
import { Pagination } from '../../components/common/Pagination';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
  X,
} from 'lucide-react';

interface UserProductsPageProps {
  currentCatalog: Catalog | null;
  catalogs: Catalog[];
  initialStatusFilter?: string;
  onSelectCatalog: (c: Catalog) => void;
}

export const UserProductsPage: React.FC<UserProductsPageProps> = ({
  currentCatalog,
  catalogs,
  initialStatusFilter = '',
  onSelectCatalog,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingNewProduct, setIsSubmittingNewProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    title: '',
    product_number: '',
    brand: '',
    product_type: '',
    description: '',
    materials: '',
    color: '',
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.title.trim()) {
      alert('Please provide at least a product title.');
      return;
    }
    const targetCatalogId = (currentCatalog && currentCatalog.id !== 'ALL') ? currentCatalog.id : catalogs[0]?.id;
    if (!targetCatalogId) {
      alert('Please create or select a catalogue first.');
      return;
    }

    setIsSubmittingNewProduct(true);
    try {
      await createProduct({
        catalog: targetCatalogId,
        ...newProductForm,
      });
      setIsAddModalOpen(false);
      setNewProductForm({
        title: '',
        product_number: '',
        brand: '',
        product_type: '',
        description: '',
        materials: '',
        color: '',
      });
      await loadProducts();
    } catch (err: any) {
      console.error('Failed to create product:', err);
      alert(err?.response?.data?.error || 'Failed to create product.');
    } finally {
      setIsSubmittingNewProduct(false);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page,
        page_size: pageSize,
      };
      if (currentCatalog && currentCatalog.id !== 'ALL') {
        params.catalog_id = currentCatalog.id;
      }
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await fetchProducts(params);
      setProducts(res.results || []);
      setTotalCount(res.count || 0);
    } catch (err) {
      console.error('Failed to load user products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialStatusFilter !== undefined) {
      setStatusFilter(initialStatusFilter);
      setPage(1);
    }
  }, [initialStatusFilter]);

  useEffect(() => {
    loadProducts();
    const interval = setInterval(loadProducts, 5000);
    return () => clearInterval(interval);
  }, [currentCatalog?.id, page, statusFilter, search]);

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Delete product "${p.title || p.product_number}"?`)) return;

    setDeletingId(p.id);
    try {
      await deleteProduct(p.id);
      // If deleting the last item on page > 1, decrement page
      if (products.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await loadProducts();
      }
    } catch (err) {
      console.error('Delete product failed:', err);
      alert('Failed to delete product.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Control Header */}
      <div className="card-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Products Explorer</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse products in your catalogue, examine predicted Shopify taxonomy, and review decision states.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>

            {/* Catalogue Selector */}
            {catalogs.length > 0 && (
              <div className="flex items-center space-x-2">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                  Catalogue:
                </label>
                <select
                  value={currentCatalog?.id || 'ALL'}
                  onChange={(e) => {
                    if (e.target.value === 'ALL') {
                      const combinedTotal = catalogs.reduce((sum, c) => sum + (c.total_products || 0), 0);
                      onSelectCatalog({
                        id: 'ALL',
                        name: 'All Catalogues',
                        total_products: combinedTotal,
                      } as any);
                    } else {
                      const found = catalogs.find((c) => c.id === e.target.value);
                      if (found) onSelectCatalog(found);
                    }
                    setPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  {catalogs.length > 1 && (
                    <option value="ALL">
                      All Catalogues ({catalogs.reduce((sum, c) => sum + (c.total_products || 0), 0)} products)
                    </option>
                  )}
                  {catalogs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.total_products} products)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid / Cards */}
      <div className="card-panel overflow-hidden">
        {isLoading && products.length === 0 ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs">Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-1">
            <Package className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No products matching criteria</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              const isApproved = p.decision_status === 'ADMIN_APPROVED';
              const isDeclined = p.decision_status === 'ADMIN_DECLINED';
              const isReview =
                p.decision_status === 'REQUIRES_REVIEW' || p.processing_status === 'REQUIRES_REVIEW';
              const isAutoApproved =
                !isApproved &&
                !isDeclined &&
                (p.decision_status === 'AUTO_CLASSIFIED' ||
                  p.processing_status === 'AUTO_APPROVED' ||
                  p.processing_status === 'CLASSIFIED');

              return (
                <div
                  key={p.id}
                  className="card-panel p-4 flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors cursor-pointer"
                  onClick={() => setSelectedProduct(p)}
                >
                  <div className="space-y-2">
                    <div className="h-40 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden relative border border-slate-100">
                      <ImageWithFallback
                        productId={p.id}
                        initialSrc={p.primary_image}
                        alt={p.title}
                        className="w-full h-full object-contain"
                      />

                      {/* Status Badges */}
                      <div className="absolute top-2 right-2">
                        {isApproved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
                            Admin Approved
                          </span>
                        ) : isDeclined ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white shadow-sm">
                            Declined
                          </span>
                        ) : isReview ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
                            Needs Review
                          </span>
                        ) : isAutoApproved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                            Auto Approved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xs font-bold text-slate-900 line-clamp-1">{p.title}</h2>
                      <div className="text-[11px] text-slate-400 font-mono">SKU: {p.product_number || 'N/A'}</div>
                    </div>

                    {p.classification_summary ? (
                      <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase">Shopify Category:</div>
                        <div className="text-xs font-semibold text-slate-800 line-clamp-1">
                          {p.classification_summary.category_name}
                        </div>
                        <div className="text-[10px] text-blue-600 font-bold">
                          Confidence: {Math.round(p.classification_summary.confidence_score * 100)}%
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-50/60 rounded-lg text-xs text-slate-400 italic">
                        Not classified yet
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(p);
                      }}
                      className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer"
                    >
                      View Details
                    </button>

                    <button
                      disabled={deletingId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProduct(p);
                      }}
                      className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Remove this product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
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

      {/* Modal Detail */}
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

      {/* Add Single Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Product</h3>
                  <p className="text-[11px] text-slate-500">Instantly creates product & triggers admin notification</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={newProductForm.title}
                  onChange={(e) => setNewProductForm({ ...newProductForm, title: e.target.value })}
                  placeholder="e.g. Modern Ergonomic Velvet Armchair"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SKU / Product #
                  </label>
                  <input
                    type="text"
                    value={newProductForm.product_number}
                    onChange={(e) => setNewProductForm({ ...newProductForm, product_number: e.target.value })}
                    placeholder="e.g. MOD-ARM-991"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                    placeholder="e.g. Modway"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Product Type
                  </label>
                  <input
                    type="text"
                    value={newProductForm.product_type}
                    onChange={(e) => setNewProductForm({ ...newProductForm, product_type: e.target.value })}
                    placeholder="e.g. Armchairs"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={newProductForm.color}
                    onChange={(e) => setNewProductForm({ ...newProductForm, color: e.target.value })}
                    placeholder="e.g. Teal / Emerald"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                  placeholder="Comfortable upholstered living room accent chair..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewProduct}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingNewProduct ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create & Notify Admin</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
