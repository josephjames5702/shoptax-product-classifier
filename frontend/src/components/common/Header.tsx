import React, { useEffect, useState, useRef } from 'react';
import { Database, Wifi, WifiOff, UploadCloud, Loader2, Trash2 } from 'lucide-react';
import { Catalog } from '../../types';
import { fetchHealthCheck, uploadCatalog } from '../../api/client';

interface HeaderProps {
  currentCatalog?: Catalog | null;
  catalogs: Catalog[];
  onSelectCatalog: (c: Catalog) => void;
  onCatalogUploaded?: (c: Catalog) => void;
  onDeleteCatalog?: (catalogId: string) => void;
}

type BackendStatus = 'checking' | 'online' | 'offline';

export const Header: React.FC<HeaderProps> = ({
  currentCatalog,
  catalogs,
  onSelectCatalog,
  onCatalogUploaded,
  onDeleteCatalog,
}) => {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingCatalog, setIsDeletingCatalog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const data = await fetchHealthCheck();
        if (isMounted) {
          setBackendStatus(data.status === 'ok' ? 'online' : 'offline');
        }
      } catch {
        if (isMounted) {
          setBackendStatus('offline');
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const catalogName = file.name.replace(/\.[^/.]+$/, '') || 'New Catalogue';
      const newCat = await uploadCatalog(file, catalogName);
      if (onCatalogUploaded) {
        onCatalogUploaded(newCat);
      }
    } catch (err) {
      console.error('Header upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const statusConfig = {
    checking: {
      dot: 'bg-amber-400 animate-pulse',
      text: 'text-amber-700 bg-amber-50 border-amber-200',
      label: 'Checking API…',
      Icon: Wifi,
    },
    online: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      label: 'API Online',
      Icon: Wifi,
    },
    offline: {
      dot: 'bg-rose-500',
      text: 'text-rose-700 bg-rose-50 border-rose-200',
      label: 'API Offline',
      Icon: WifiOff,
    },
  }[backendStatus];

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Hidden File Input for Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv, .xlsx, .xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Active Catalog Selector */}
      <div className="flex items-center space-x-3">
        {catalogs.length > 0 ? (
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs shadow-sm">
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-500 font-medium">Active Catalogue:</span>
            <select
              value={currentCatalog?.id || ''}
              onChange={(e) => {
                if (e.target.value === 'ALL') {
                  const combinedTotal = catalogs.reduce((sum, c) => sum + (c.total_products || 0), 0);
                  const combinedProcessed = catalogs.reduce((sum, c) => sum + ((c as any).processed_products || 0), 0);
                  onSelectCatalog({
                    id: 'ALL',
                    name: 'All Catalogues (Combined View)',
                    total_products: combinedTotal,
                    processed_products: combinedProcessed,
                    status: 'COMPLETED',
                    file_name: 'All Uploaded Catalogues',
                    file_path: '',
                    file_size_bytes: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  } as any);
                } else {
                  const found = catalogs.find((c) => c.id === e.target.value);
                  if (found) onSelectCatalog(found);
                }
              }}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer pr-1"
            >
              {catalogs.length > 1 && (
                <option value="ALL" className="bg-white font-bold text-blue-700">
                  ⚡ All Catalogues ({catalogs.reduce((sum, c) => sum + (c.total_products || 0), 0).toLocaleString()} products)
                </option>
              )}
              {catalogs.map((c) => (
                <option key={c.id} value={c.id} className="bg-white text-slate-800">
                  {c.name} ({c.total_products.toLocaleString()} products)
                </option>
              ))}
            </select>

            {/* Delete current catalog button */}
            {currentCatalog && currentCatalog.id !== 'ALL' && onDeleteCatalog && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                title="Delete this catalogue and its products"
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition ml-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-medium flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>No Active Catalogue Loaded</span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && currentCatalog && currentCatalog.id !== 'ALL' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete this catalogue?</h3>
              <p className="text-sm text-slate-500 mt-2">
                This will permanently delete the catalogue{' '}
                <span className="font-semibold text-slate-800">"{currentCatalog.name}"</span> and its{' '}
                <span className="font-semibold text-slate-800">{currentCatalog.total_products}</span> products.
                This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingCatalog}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onDeleteCatalog) {
                    setIsDeletingCatalog(true);
                    try {
                      await onDeleteCatalog(currentCatalog.id);
                      setShowDeleteModal(false);
                    } catch (err) {
                      console.error('Delete catalog error:', err);
                    } finally {
                      setIsDeletingCatalog(false);
                    }
                  }
                }}
                disabled={isDeletingCatalog}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingCatalog ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete Catalogue</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Right: Upload Button and Real Backend Status Indicator */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload CSV or Excel</span>
            </>
          )}
        </button>

        <div
          title={`Backend API status: ${backendStatus}`}
          className={`flex items-center space-x-2 px-2.5 py-1 border rounded-full text-xs font-medium ${statusConfig.text}`}
        >
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <statusConfig.Icon className="w-3 h-3" />
          <span>{statusConfig.label}</span>
        </div>
      </div>
    </header>
  );
};
