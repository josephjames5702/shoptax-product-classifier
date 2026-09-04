import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
  Copy,
  ArrowRight,
  Play,
  Loader2,
  Plus,
} from 'lucide-react';
import { Catalog } from '../types';
import { uploadCatalog, startClassification } from '../api/client';

interface UploadCatalogPageProps {
  onCatalogUploaded: (catalog: Catalog) => void;
  onStartClassification: (catalog: Catalog) => void;
  onNavigateToProducts: () => void;
}

export const UploadCatalogPage: React.FC<UploadCatalogPageProps> = ({
  onCatalogUploaded,
  onStartClassification,
  onNavigateToProducts,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCatalog, setUploadedCatalog] = useState<Catalog | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadCatalog(file, catalogName || file.name);
      setUploadedCatalog(result);
      onCatalogUploaded(result);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || 'Failed to upload catalog file.');
    } finally {
      setIsUploading(false);
    }
  };

  const stats = uploadedCatalog?.summary_stats || {};

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-black tracking-tight text-white">Upload Product Catalogue</h1>
        <p className="text-sm text-slate-400">
          Upload your product catalogue in CSV or Excel (.xlsx) format to begin automated Shopify Taxonomy classification.
        </p>
      </div>

      {/* Upload Box */}
      {!uploadedCatalog && (
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 rounded-2xl p-10 text-center cursor-pointer transition group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition">
                <UploadCloud className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {file ? file.name : 'Click to upload or drag and drop catalogue'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Supports CSV or XLSX up to 10,000+ products
                </div>
              </div>
              {file && (
                <div className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-3 py-1 rounded-full">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-medium">Catalogue Name (Optional)</label>
              <input
                type="text"
                value={catalogName}
                onChange={(e) => setCatalogName(e.target.value)}
                placeholder="e.g. Modway Autumn Furniture 2026"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <button
                disabled={!file || isUploading}
                onClick={handleUpload}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Parsing & Ingesting Catalogue...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Upload & Process Headers</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Post-Upload Pre-Classification Health & Statistics Card */}
      {uploadedCatalog && (
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Catalogue Ingested Successfully</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                File: <span className="font-mono text-slate-300">{uploadedCatalog.file_name}</span> | Name:{' '}
                <span className="text-slate-300">{uploadedCatalog.name}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white">{uploadedCatalog.total_products}</div>
              <div className="text-[11px] text-slate-400">Total Products</div>
            </div>
          </div>

          {/* Health Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>With Images</span>
              </div>
              <div className="text-xl font-bold text-white">{stats.with_images ?? 0}</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span>Without Images</span>
              </div>
              <div className="text-xl font-bold text-slate-300">{stats.without_images ?? 0}</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Missing Descriptions</span>
              </div>
              <div className="text-xl font-bold text-amber-300">{stats.missing_descriptions ?? 0}</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <Copy className="w-4 h-4 text-rose-400" />
                <span>Duplicate SKUs</span>
              </div>
              <div className="text-xl font-bold text-rose-300">{stats.duplicate_skus ?? 0}</div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="p-6 bg-gradient-to-r from-indigo-950/60 to-slate-900/60 rounded-2xl border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white">Import Complete ({uploadedCatalog.total_products} Products)</div>
              <div className="text-xs text-slate-400">
                Products are stored in database. Inspect imported products or launch Shopify taxonomy classification.
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setUploadedCatalog(null);
                  setFile(null);
                  setCatalogName('');
                }}
                className="px-3 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Another</span>
              </button>
              <button
                onClick={onNavigateToProducts}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-2 whitespace-nowrap"
              >
                <span>Explore Imported Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onStartClassification(uploadedCatalog)}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Classification</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
