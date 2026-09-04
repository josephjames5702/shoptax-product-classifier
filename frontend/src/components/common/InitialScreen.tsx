import React, { useState } from 'react';
import { Tags, UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { TaxonomyTreeIcon } from './TaxonomyTreeIcon';
import { uploadCatalog } from '../../api/client';
import { Catalog } from '../../types';

interface InitialScreenProps {
  onCatalogUploaded: (catalog: Catalog) => void;
}

export const InitialScreen: React.FC<InitialScreenProps> = ({ onCatalogUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const catalogName = file.name.replace(/\.[^/.]+$/, '') || 'New Catalogue';
      const newCatalog = await uploadCatalog(file, catalogName);
      onCatalogUploaded(newCatalog);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err?.response?.data?.error || 'Failed to upload catalogue. Please try again.');
    } finally {
      setIsUploading(false);
      const el = document.getElementById('initial-screen-file-input') as HTMLInputElement | null;
      if (el) el.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-6 sm:p-10 relative">
      {/* File Input — linked to label via id, no programmatic click needed */}
      <input
        id="initial-screen-file-input"
        type="file"
        accept=".csv, .xlsx, .xls"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />



      {/* Center: Clean Professional ShopTax Branding & Upload Area */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 -mt-6">
        <div className="max-w-md w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* TaxonomyManager Logo */}
          <div className="flex justify-center mx-auto">
            <TaxonomyTreeIcon size={56} className="w-14 h-14" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              <span className="text-[#0ea5e9]">Taxonomy</span>
              <span className="text-[#475569]">Manager</span>
            </h1>
            <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">
              Product Taxonomy & Classification Platform
            </p>
            <p className="text-sm text-slate-500 leading-relaxed pt-1">
              Upload a CSV or Excel product catalogue to classify products against the Shopify Standard Product Taxonomy.
            </p>
          </div>

          {/* Central Call-to-Action Upload Button */}
          <div className="pt-2 flex flex-col items-center justify-center">
            <label
              htmlFor="initial-screen-file-input"
              className={`w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2.5 cursor-pointer select-none ${
                isUploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading Catalogue...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>Upload CSV or Excel</span>
                </>
              )}
            </label>
            <span className="text-[11px] text-slate-400 mt-2 font-medium">
              Supported formats: .csv, .xlsx, .xls (up to 100 sample products)
            </span>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Subtle bottom note */}
      <div className="text-center text-[11px] text-slate-400">
        Shopify Standard Product Taxonomy (Release 2026-08)
      </div>
    </div>
  );
};
