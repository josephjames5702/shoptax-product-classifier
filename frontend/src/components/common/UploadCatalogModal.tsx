import React, { useState, useRef } from 'react';
import { Catalog } from '../../types';
import { uploadCatalog } from '../../api/client';
import { UploadCloud, X, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';

interface UploadCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (catalog: Catalog) => void;
}

export const UploadCatalogModal: React.FC<UploadCatalogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(/\.[^/.]+$/, ''));
      }
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV or Excel file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Prototype constraint: sample 100 products
      const newCat = await uploadCatalog(file, name || file.name);
      onSuccess(newCat);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Failed to upload catalogue. Please make sure the file format is supported.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Upload Product Catalogue</h3>
              <p className="text-xs text-slate-400">Entry-level prototype: 100-sample limit</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center space-y-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <FileSpreadsheet className="w-8 h-8 text-slate-400" />
            <div className="text-xs font-semibold text-slate-700">
              {file ? file.name : 'Click to select CSV or Excel (.xlsx) file'}
            </div>
            <div className="text-[11px] text-slate-400">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : '100 sample products max'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catalogue Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Autumn 2026 Sample Batch"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-700 space-y-0.5">
            <div className="font-semibold">Notice: Explicit Classification Trigger</div>
            <div className="text-[11px] text-blue-600/80">
              Uploading sets catalogue status to <strong>UPLOADED</strong>. Classification must be triggered explicitly.
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting File...</span>
                </>
              ) : (
                <span>Upload Catalogue</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
