import React, { useState, useEffect } from 'react';
import { Catalog, Product } from '../../types';
import { fetchCatalogStats } from '../../api/client';
import {
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  UploadCloud,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface UserDashboardPageProps {
  catalogs: Catalog[];
  recentProducts: Product[];
  onUploadClick: () => void;
  onViewCatalogues: () => void;
  onViewProducts: (statusFilter?: string) => void;
  onRefreshData?: () => void;
}

export const UserDashboardPage: React.FC<UserDashboardPageProps> = ({
  catalogs,
  recentProducts,
  onUploadClick,
  onViewCatalogues,
  onViewProducts,
}) => {
  const [stats, setStats] = useState({
    total_catalogs: catalogs.length,
    total_products: catalogs.reduce((sum, c) => sum + (c.total_products || 0), 0),
    classified_count: 0,
    needs_review_count: 0,
    approved_count: 0,
    declined_count: 0,
    pending_count: 0,
  });

  const loadStats = async () => {
    try {
      const res = await fetchCatalogStats();
      if (res) setStats(res);
    } catch {
      // Keep fallback
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 3500);
    return () => clearInterval(interval);
  }, [catalogs]);

  const totalProducts = stats.total_products || catalogs.reduce((sum, c) => sum + (c.total_products || 0), 0);
  const classifiedCount = stats.classified_count;
  const pendingCount = stats.pending_count;
  const reviewCount = stats.needs_review_count;
  const declinedCount = stats.declined_count;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Card with Ambient Glow */}
      <div className="relative overflow-hidden card-panel p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-r from-white via-blue-50/20 to-indigo-50/30 border-blue-100/60">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-blue-100/70 text-blue-700 text-[10px] font-bold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Catalogue Workspace</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Seller Classification Hub</h1>
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Monitor real-time taxonomy classifications, manage product batches, and inspect high-confidence category predictions.
          </p>
        </div>

        <button
          onClick={onUploadClick}
          className="btn-primary-gradient px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 self-start sm:self-auto cursor-pointer relative z-10"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Catalogue</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div
          onClick={() => onViewProducts()}
          className="card-panel-hover p-4.5 cursor-pointer space-y-2 border-slate-200/80 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Products</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{totalProducts}</div>
          <div className="text-[11px] text-slate-400 font-medium">In your catalogue</div>
        </div>

        <div
          onClick={() => onViewProducts('completed')}
          className="card-panel-hover p-4.5 cursor-pointer space-y-2 border-emerald-100 bg-gradient-to-b from-white to-emerald-50/20 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Classified</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">{classifiedCount}</div>
          <div className="text-[11px] text-slate-400 font-medium">Shopify matched</div>
        </div>

        <div
          onClick={() => onViewProducts('pending')}
          className="card-panel-hover p-4.5 cursor-pointer space-y-2 border-slate-200/80 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pending</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-700 tracking-tight">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 font-medium">Awaiting classification</div>
        </div>

        <div
          onClick={() => onViewProducts('manual review')}
          className="card-panel-hover p-4.5 cursor-pointer space-y-2 border-amber-100 bg-gradient-to-b from-white to-amber-50/20 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Needs Review</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">{reviewCount}</div>
          <div className="text-[11px] text-slate-400 font-medium">Ambiguous matches</div>
        </div>

        <div
          onClick={() => onViewProducts('declined')}
          className="card-panel-hover p-4.5 cursor-pointer space-y-2 border-rose-100 bg-gradient-to-b from-white to-rose-50/20 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Declined</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">{declinedCount}</div>
          <div className="text-[11px] text-slate-400 font-medium">Admin rejected</div>
        </div>
      </div>

      {/* Catalogues Empty State OR List */}
      {catalogs.length === 0 ? (
        <div className="card-panel p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900">No catalogues yet</h3>
            <p className="text-xs text-slate-500">
              Upload a CSV or Excel file to get started.
            </p>
          </div>
          <button
            onClick={onUploadClick}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            Upload your first catalogue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Catalogues */}
          <div className="card-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>My Catalogues</span>
              </h2>
              <button
                onClick={onViewCatalogues}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {catalogs.slice(0, 5).map((cat) => (
                <div key={cat.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-slate-800 truncate">{cat.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {cat.total_products} products • Uploaded {new Date(cat.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                    {cat.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Start Tip */}
          <div className="card-panel p-5 flex flex-col justify-between bg-gradient-to-br from-blue-50/50 to-white">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                TaxonomyManager Architecture
              </span>
              <h3 className="text-base font-bold text-slate-900">Deterministic Hybrid Classifier</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Products are matched against the canonical Shopify Standard Product Taxonomy using BM25 lexical
                search, SentenceTransformer embeddings, and reciprocal rank fusion.
              </p>
            </div>

            <div className="pt-4 flex items-center space-x-3">
              <button
                onClick={() => onViewProducts()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
              >
                Explore Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
