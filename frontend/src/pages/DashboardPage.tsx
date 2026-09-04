import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Clock,
  ArrowRight,
  Play,
  Loader2,
  FolderKanban,
  FileText,
} from 'lucide-react';
import { Catalog } from '../types';
import { uploadCatalog } from '../api/client';

interface DashboardPageProps {
  catalogs: Catalog[];
  currentCatalog: Catalog | null;
  onSelectCatalog: (c: Catalog) => void;
  onCatalogUploaded: (c: Catalog) => void;
  onNavigateToCatalogs: () => void;
  onNavigateToProducts: () => void;
  onStartClassification: (c: Catalog) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  catalogs,
  currentCatalog,
  onSelectCatalog,
  onCatalogUploaded,
  onNavigateToCatalogs,
  onNavigateToProducts,
  onStartClassification,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentlyUploaded, setRecentlyUploaded] = useState<Catalog | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!catalogName) {
        setCatalogName(selected.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      if (!catalogName) {
        setCatalogName(selected.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await uploadCatalog(file, catalogName || file.name);
      setRecentlyUploaded(res);
      onCatalogUploaded(res);
      setFile(null);
      setCatalogName('');
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || 'Failed to upload catalogue file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Compute aggregate metrics from real catalogues data
  const totalProducts = catalogs.reduce((acc, c) => acc + (c.total_products || 0), 0);
  
  // Real stats based on catalog status and summary stats
  const activeStats = currentCatalog?.summary_stats || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Product Taxonomy Classifier
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload product catalogues and classify products against the Shopify Standard Product Taxonomy.
        </p>
      </div>

      {/* Upload Box Area */}
      <div className="card-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Upload Catalogue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select or drop a CSV or Excel (.xlsx) file containing your product list.
            </p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
            Accepted: .csv, .xlsx
          </span>
        </div>

        {/* Upload Form / Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-xl p-8 text-center cursor-pointer transition"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-slate-800">
            {file ? file.name : 'Click to select or drag and drop catalogue file'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports CSV or Excel (.xlsx) files'}
          </div>
        </div>

        {/* Name input & Upload Button */}
        {file && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={catalogName}
              onChange={(e) => setCatalogName(e.target.value)}
              placeholder="Catalogue Name (optional)"
              className="flex-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleUploadSubmit}
              disabled={isUploading}
              className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50 whitespace-nowrap"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing Products…</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Catalogue</span>
                </>
              )}
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Immediate Post-Upload Feedback */}
        {recentlyUploaded && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-900">
                  Catalogue &ldquo;{recentlyUploaded.name}&rdquo; Imported Successfully
                </div>
                <div className="text-xs text-emerald-700">
                  {recentlyUploaded.total_products.toLocaleString()} products stored in database. Ready for classification.
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onSelectCatalog(recentlyUploaded);
                  onNavigateToProducts();
                }}
                className="px-3.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition"
              >
                View Products
              </button>
              <button
                onClick={() => {
                  onSelectCatalog(recentlyUploaded);
                  onStartClassification(recentlyUploaded);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Classification</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Real Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Products</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {totalProducts.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Across {catalogs.length} uploaded catalogue{catalogs.length === 1 ? '' : 's'}</div>
        </div>

        <div className="card-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Successfully Classified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {catalogs.filter((c) => c.status === 'COMPLETED').length > 0
              ? catalogs
                  .filter((c) => c.status === 'COMPLETED')
                  .reduce((sum, c) => sum + c.total_products, 0)
                  .toLocaleString()
              : 0}
          </div>
          <div className="text-[11px] text-slate-400">High-confidence matches</div>
        </div>

        <div className="card-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Manual Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {activeStats.missing_descriptions || 0}
          </div>
          <div className="text-[11px] text-slate-400">Requires human verification</div>
        </div>

        <div className="card-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Catalogues</span>
            <FolderKanban className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {catalogs.length}
          </div>
          <div className="text-[11px] text-slate-400">Available in workspace</div>
        </div>
      </div>

      {/* Recent Catalogues Table */}
      <div className="card-panel overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Catalogues</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All catalogues imported into this workspace.
            </p>
          </div>
        </div>

        {catalogs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700">No catalogues yet</div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload a CSV or XLSX catalogue using the form above to begin.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="table-header">
                  <th className="py-3 px-4">Catalogue</th>
                  <th className="py-3 px-4">Products</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {catalogs.map((c) => {
                  const isCurrent = currentCatalog?.id === c.id;
                  const statusMap: Record<string, { label: string; badge: string }> = {
                    UPLOADED: { label: 'NOT STARTED', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
                    PROCESSING: { label: 'PROCESSING', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
                    COMPLETED: { label: 'COMPLETED', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    FAILED: { label: 'FAILED', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
                  };
                  const currentStatus = statusMap[c.status] || {
                    label: c.status,
                    badge: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <tr key={c.id} className={`table-row ${isCurrent ? 'bg-blue-50/40' : ''}`}>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>{c.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {c.total_products.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentStatus.badge}`}
                        >
                          {currentStatus.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            onSelectCatalog(c);
                            onNavigateToCatalogs();
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-md text-xs shadow-xs transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
