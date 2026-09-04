import React, { useState, useEffect } from 'react';
import { Catalog } from '../../types';
import { fetchCatalogs, deleteCatalog } from '../../api/client';
import {
  Layers,
  Search,
  User,
  ExternalLink,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface AdminUploadsPageProps {
  onSelectCatalog: (catalog: Catalog) => void;
  onRefreshData?: () => void;
}

export const AdminUploadsPage: React.FC<AdminUploadsPageProps> = ({ onSelectCatalog, onRefreshData }) => {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [catalogToDelete, setCatalogToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadCatalogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCatalogs();
      setCatalogs(data || []);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to load uploads in admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteCatalog = async () => {
    if (!catalogToDelete) return;
    const { id } = catalogToDelete;
    setDeletingId(id);
    setCatalogToDelete(null);
    try {
      await deleteCatalog(id);
      await loadCatalogs();
    } catch (err) {
      console.error('Failed to delete catalog:', err);
      alert('Failed to delete catalogue. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadCatalogs();
    const interval = setInterval(loadCatalogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredCatalogs = catalogs.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.file_name.toLowerCase().includes(q) ||
      (c.owner_username && c.owner_username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="card-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>All User Uploads</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervise all uploaded catalogues across all user accounts in the single shared database.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user or catalogue..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            onClick={loadCatalogs}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh Uploads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-panel overflow-hidden">
        {filteredCatalogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No uploads found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Catalogue Name</th>
                  <th className="py-3 px-4">Products</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredCatalogs.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                        {(cat.owner_username || 'U')[0].toUpperCase()}
                      </div>
                      <span>{cat.owner_username || 'Anonymous'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{cat.name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{cat.file_name}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{cat.total_products}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(cat.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {cat.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onSelectCatalog(cat)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#0ea5e9] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          disabled={deletingId === cat.id}
                          onClick={() => setCatalogToDelete({ id: cat.id, name: cat.name })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete Catalogue"
                        >
                          {deletingId === cat.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
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
              <span className="font-bold text-slate-900">&quot;{catalogToDelete.name}&quot;</span> and all associated products?
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
                onClick={confirmDeleteCatalog}
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
