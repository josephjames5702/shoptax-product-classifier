import React, { useState } from 'react';
import { Catalog } from '../../types';
import { deleteCatalog, startClassification } from '../../api/client';
import {
  Layers,
  UploadCloud,
  Play,
  Trash2,
  Calendar,
  Package,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  AlertTriangle,
  X,
} from 'lucide-react';

interface UserCataloguesPageProps {
  catalogs: Catalog[];
  onUploadClick: () => void;
  onSelectCatalog: (c: Catalog) => void;
  onRefreshData: () => void;
}

export const UserCataloguesPage: React.FC<UserCataloguesPageProps> = ({
  catalogs,
  onUploadClick,
  onSelectCatalog,
  onRefreshData,
}) => {
  const [actingCatalogId, setActingCatalogId] = useState<string | null>(null);
  const [catalogToDelete, setCatalogToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (!catalogToDelete) return;
    const { id } = catalogToDelete;
    setActingCatalogId(id);
    setCatalogToDelete(null);

    try {
      await deleteCatalog(id);
      onRefreshData();
    } catch (err) {
      console.error('Failed to delete catalogue:', err);
      alert('Failed to delete catalogue. Please try again.');
    } finally {
      setActingCatalogId(null);
    }
  };

  const handleStartClassification = async (id: string) => {
    setActingCatalogId(id);
    try {
      await startClassification(id);
      onRefreshData();
    } catch (err) {
      console.error('Failed to start classification:', err);
      alert('Failed to start classification. Please check backend status.');
    } finally {
      setActingCatalogId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Catalogues</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your imported product files, launch classifications, or remove outdated catalogues.
          </p>
        </div>

        <button
          onClick={onUploadClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center space-x-2 self-start sm:self-auto cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Catalogue</span>
        </button>
      </div>

      {/* Catalogues Table */}
      <div className="card-panel overflow-hidden">
        {catalogs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No Catalogues in Account</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              You haven&apos;t uploaded any product catalogues yet. Click upload to get started.
            </p>
            <button
              onClick={onUploadClick}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Upload New Catalogue
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Catalogue Name</th>
                  <th className="py-3 px-4">Products</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {catalogs.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{cat.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{cat.file_name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {cat.total_products || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(cat.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {cat.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>COMPLETED</span>
                        </span>
                      ) : cat.status === 'PROCESSING' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          <span>PROCESSING</span>
                        </span>
                      ) : cat.status === 'FAILED' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>FAILED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>{cat.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onSelectCatalog(cat)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <span>Explore</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>

                        {cat.status === 'UPLOADED' && (
                          <button
                            disabled={actingCatalogId === cat.id}
                            onClick={() => handleStartClassification(cat.id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                          >
                            {actingCatalogId === cat.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 fill-emerald-700" />
                            )}
                            <span>Classify</span>
                          </button>
                        )}

                        <button
                          disabled={actingCatalogId === cat.id}
                          onClick={() => setCatalogToDelete({ id: cat.id, name: cat.name })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          title="Delete Catalogue"
                        >
                          {actingCatalogId === cat.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── IN-APP CONFIRMATION MODAL (Never blocked by browser dialog settings) ─── */}
      {catalogToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Catalogue</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete catalogue{' '}
              <span className="font-bold text-slate-900">&quot;{catalogToDelete.name}&quot;</span> and all of its imported products from the system?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setCatalogToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Catalogue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
