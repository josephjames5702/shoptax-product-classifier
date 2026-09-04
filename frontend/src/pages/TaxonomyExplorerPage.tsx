import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Search,
  ChevronRight,
  ChevronDown,
  Tag,
  Folder,
  Copy,
  Check,
  RotateCcw,
  Info,
  Loader2,
} from 'lucide-react';
import { TaxonomyCategory, TaxonomyAttribute, TaxonomyVersion } from '../types';
import {
  fetchTaxonomyRoots,
  fetchTaxonomyCategories,
  fetchTaxonomyCategory,
  fetchTaxonomyCategoryAttributes,
  fetchActiveTaxonomyVersion,
} from '../api/client';

export const TaxonomyExplorerPage: React.FC = () => {
  const [version, setVersion] = useState<TaxonomyVersion | null>(null);
  const [roots, setRoots] = useState<TaxonomyCategory[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, TaxonomyCategory[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TaxonomyCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TaxonomyCategory | null>(null);
  const [categoryAttributes, setCategoryAttributes] = useState<TaxonomyAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttrLoading, setIsAttrLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadActiveVersion();
    loadRoots();
  }, []);

  const loadActiveVersion = async () => {
    try {
      const v = await fetchActiveTaxonomyVersion();
      setVersion(v);
    } catch (err) {
      console.warn('Could not fetch active taxonomy version:', err);
    }
  };

  const loadRoots = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTaxonomyRoots();
      setRoots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetchTaxonomyCategories({ search: val.trim() });
      setSearchResults(res.results);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = async (cat: TaxonomyCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    const catIdStr = String(cat.id);
    if (expandedNodes[catIdStr]) {
      const updated = { ...expandedNodes };
      delete updated[catIdStr];
      setExpandedNodes(updated);
      return;
    }

    setLoadingNodes((prev) => ({ ...prev, [catIdStr]: true }));
    try {
      const childrenRes = await fetchTaxonomyCategories({ parent_id: cat.id });
      setExpandedNodes((prev) => ({ ...prev, [catIdStr]: childrenRes.results }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNodes((prev) => ({ ...prev, [catIdStr]: false }));
    }
  };

  const handleSelectCategory = async (cat: TaxonomyCategory) => {
    setSelectedCategory(cat);
    setIsAttrLoading(true);
    try {
      const [fullCat, attrs] = await Promise.all([
        fetchTaxonomyCategory(cat.id),
        fetchTaxonomyCategoryAttributes(cat.id),
      ]);
      setSelectedCategory(fullCat);
      setCategoryAttributes(attrs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAttrLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Card */}
      <div className="card-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FolderTree className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Shopify Taxonomy Explorer</h1>
            {version && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                v{version.version_code}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official Shopify Standard Product Taxonomy machine-readable hierarchy and attributes.
          </p>
        </div>

        {version?.stats && (
          <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-700">
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 mr-1.5">Categories:</span>
              <span className="font-bold text-slate-900">
                {version.stats.categories_count?.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 mr-1.5">Attributes:</span>
              <span className="font-bold text-slate-900">
                {version.stats.attributes_count?.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Tree Navigation */}
        <div className="lg:col-span-5 card-panel p-4 flex flex-col space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search category name, path, or ID…"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[560px]">
            {isLoading ? (
              <div className="text-center py-16 text-xs text-slate-400 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Loading taxonomy…</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                  Matches ({searchResults.length})
                </div>
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCategory(c)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition flex items-center justify-between ${
                      selectedCategory?.id === c.id
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate pr-2">{c.full_path || c.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">
                      {c.external_id}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              roots.map((root) => {
                const isExpanded = !!expandedNodes[String(root.id)];
                const isNodeLoading = !!loadingNodes[String(root.id)];
                const children = expandedNodes[String(root.id)] || [];

                return (
                  <div key={root.id} className="space-y-0.5">
                    <div
                      onClick={() => handleSelectCategory(root)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                        selectedCategory?.id === root.id
                          ? 'bg-blue-50 text-blue-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <button
                          onClick={(e) => toggleExpand(root, e)}
                          className="p-0.5 hover:bg-slate-200 rounded text-slate-500"
                        >
                          {isNodeLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <Folder className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">{root.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{root.external_id}</span>
                    </div>

                    {isExpanded && (
                      <div className="pl-6 border-l border-slate-200 ml-3 space-y-0.5">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            onClick={() => handleSelectCategory(child)}
                            className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer ${
                              selectedCategory?.id === child.id
                                ? 'bg-blue-50 text-blue-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{child.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {child.external_id}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-7 card-panel p-5">
          {selectedCategory ? (
            <div className="space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">{selectedCategory.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedCategory.full_path}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Shopify Category GID:</span>
                  <button
                    onClick={() => copyToClipboard(selectedCategory.external_id, 'gid')}
                    className="flex items-center space-x-1 font-mono text-blue-600 hover:text-blue-700"
                  >
                    <span>{selectedCategory.external_id}</span>
                    {copiedField === 'gid' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hierarchy Depth:</span>
                  <span className="font-semibold text-slate-800">Level {selectedCategory.level}</span>
                </div>
              </div>

              {/* Attributes */}
              <div>
                <h3 className="font-bold text-slate-800 mb-2">Category Attributes ({categoryAttributes.length})</h3>
                {isAttrLoading ? (
                  <div className="py-6 text-center text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Loading attributes…</span>
                  </div>
                ) : categoryAttributes.length === 0 ? (
                  <p className="text-slate-400 italic">No specific attributes linked to this category.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {categoryAttributes.map((attr) => (
                      <div key={attr.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{attr.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{attr.handle}</span>
                        </div>
                        {attr.description && (
                          <p className="text-slate-600 text-[11px]">{attr.description}</p>
                        )}
                        {attr.values && attr.values.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1">
                            {attr.values.slice(0, 8).map((val) => (
                              <span key={val.id} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700">
                                {val.name}
                              </span>
                            ))}
                            {attr.values.length > 8 && (
                              <span className="text-[10px] text-slate-400">+{attr.values.length - 8} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-xs">
              Select a category on the left to inspect its Shopify taxonomy metadata and controlled attributes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
