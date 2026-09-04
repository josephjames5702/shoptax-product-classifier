import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Layers,
  Package,
  LogOut,
  ExternalLink,
  Bell,
  X,
  Sparkles,
  FolderPlus,
  Search,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { fetchProducts, fetchCatalogs } from '../api/client';
import { Product, Catalog } from '../types';
import { TaxonomyTreeIcon } from '../components/common/TaxonomyTreeIcon';

export type AdminNavTab =
  | 'dashboard'
  | 'uploads'
  | 'products'
  | 'analytics'
  | 'review'
  | 'settings';

interface AdminLayoutProps {
  activeTab: AdminNavTab;
  onTabChange: (tab: AdminNavTab) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      ownerUsername: string;
      type: 'product' | 'catalog';
      timestamp: Date;
    }>
  >([]);
  const knownProductIdsRef = useRef<Set<string>>(new Set());
  const knownCatalogIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Poll for newly added products and catalogues every 3 seconds
  useEffect(() => {
    let isMounted = true;

    const checkNewActivity = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetchProducts({ page_size: 50 }),
          fetchCatalogs(),
        ]);
        const prods: Product[] = prodRes?.results || [];
        const cats: Catalog[] = Array.isArray(catRes) ? catRes : [];

        if (initialLoadRef.current) {
          prods.forEach((p) => knownProductIdsRef.current.add(p.id));
          cats.forEach((c) => knownCatalogIdsRef.current.add(c.id));
          initialLoadRef.current = false;
          return;
        }

        const newItems: typeof notifications = [];

        // Check newly added catalogues (CSV uploads)
        cats.forEach((c) => {
          if (!knownCatalogIdsRef.current.has(c.id)) {
            knownCatalogIdsRef.current.add(c.id);
            newItems.push({
              id: `cat-${c.id}`,
              title: `New Catalogue Uploaded: ${c.name}`,
              subtitle: `${c.total_products || c.total_rows || 0} products imported`,
              meta: c.file_name,
              ownerUsername: c.owner_username || 'Seller',
              type: 'catalog',
              timestamp: new Date(),
            });
          }
        });

        // Check newly added products
        const addedProds = prods.filter((p) => !knownProductIdsRef.current.has(p.id));
        addedProds.forEach((p) => knownProductIdsRef.current.add(p.id));

        if (addedProds.length === 1) {
          const p = addedProds[0];
          newItems.push({
            id: `prod-${p.id}`,
            title: p.title,
            subtitle: `SKU: ${p.product_number || 'N/A'}`,
            meta: p.catalog_name || 'Catalogue',
            ownerUsername: p.catalog_owner_username || 'Seller',
            type: 'product',
            timestamp: new Date(),
          });
        } else if (addedProds.length > 1) {
          const first = addedProds[0];
          newItems.push({
            id: `prod-batch-${first.id}`,
            title: `${addedProds.length} New Products Added`,
            subtitle: `Latest: ${first.title}`,
            meta: first.catalog_name || 'Catalogue',
            ownerUsername: first.catalog_owner_username || 'Seller',
            type: 'product',
            timestamp: new Date(),
          });
        }

        if (newItems.length > 0 && isMounted) {
          setNotifications((prev) => [...newItems, ...prev].slice(0, 4));
        }
      } catch (err) {
        // Silently keep polling
      }
    };

    checkNewActivity();
    const interval = setInterval(checkNewActivity, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div
      className="h-screen w-full flex overflow-hidden font-sans text-[#334155]"
      style={{ backgroundColor: '#f4f7f6' }}
    >
      {/* ─── FIXED VERTICAL NAVIGATION SIDEBAR (260px) ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-[#1e293b] text-[#e2e8f0] flex flex-col justify-between p-6 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-8">
          {/* Brand Logo & Title */}
          <div
            onClick={() => onTabChange('dashboard')}
            className="flex items-center justify-center space-x-2.5 cursor-pointer group select-none pt-2"
          >
            <TaxonomyTreeIcon size={28} className="text-[#0ea5e9] group-hover:scale-105 transition-transform" />
            <div className="text-xl font-bold tracking-tight text-[#0ea5e9]">
              ShopTax <span className="text-white text-base font-normal">Admin</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav>
            <ul className="space-y-1.5 text-sm font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('dashboard');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">📊</span>
                  <span>Dashboard</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('uploads');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'uploads'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">👥</span>
                  <span>Catalogues & Users</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('products');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'products'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">📦</span>
                  <span>Products & Taxonomies</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('analytics');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">📈</span>
                  <span>Analytics</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('review');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'review'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">📋</span>
                  <span>Review Queue</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('settings');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">⚙️</span>
                  <span>Settings</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-slate-700/60 space-y-3">
          <a
            href="/app"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition"
          >
            <span>Launch Seller Portal</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#0ea5e9]" />
          </a>
          <p className="text-[11px] text-slate-400 text-center">
            &copy; 2024 ShopTax Core Portal
          </p>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Sticky Header Bar (70px height) */}
        <header
          className="h-[70px] bg-white border-b border-[#e2e8f0] flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0"
          style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}
        >
          {/* Mobile Menu Toggle + Search Bar */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 md:hidden rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search data..."
                className="bg-[#f1f5f9] border border-[#e2e8f0] pl-9 pr-4 py-2 rounded-full text-xs md:text-sm text-slate-800 w-[200px] sm:w-[300px] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Header Tools */}
          <div className="flex items-center space-x-5">
            {/* Notification Bell with Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (notifications.length === 0) {
                    alert('No new unread events. System is synced in real time.');
                  }
                }}
                className="text-slate-600 hover:text-slate-900 transition p-1.5 rounded-full hover:bg-slate-100 cursor-pointer relative"
                title="Notifications"
              >
                <span className="text-xl select-none">🔔</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>
            </div>

            {/* Profile Avatar Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center space-x-2.5 text-xs md:text-sm font-medium text-slate-700 hover:text-slate-900 transition cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <span className="hidden sm:inline font-semibold">Admin User</span>
                <div className="w-10 h-10 rounded-full bg-[#0ea5e9] text-white flex items-center justify-center font-bold text-sm shadow-xs select-none">
                  AU
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-[#e2e8f0] py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onMouseLeave={() => setIsProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user?.username || 'Administrator'}</p>
                    <p className="text-[11px] text-slate-500">{user?.email || 'admin@shoptax.io'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('dashboard');
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-[#0ea5e9]" />
                    <span>Overview Dashboard</span>
                  </button>
                  <a
                    href="/app"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Open Seller Portal</span>
                  </a>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="p-6 md:p-8 flex-1 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Floating Notification Pop-up Stack for Live Events */}
      <div className="fixed top-20 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-sky-200 rounded-2xl shadow-xl p-4 flex items-start space-x-3 animate-in slide-in-from-top-4 duration-300 transition-all hover:shadow-2xl"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                n.type === 'catalog'
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-600'
                  : 'bg-sky-50 border border-sky-200 text-[#0ea5e9]'
              }`}
            >
              {n.type === 'catalog' ? (
                <FolderPlus className="w-5 h-5 animate-pulse" />
              ) : (
                <Bell className="w-5 h-5 animate-bounce" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
                    n.type === 'catalog' ? 'text-indigo-600' : 'text-[#0ea5e9]'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{n.type === 'catalog' ? 'New Catalogue Upload' : 'New Product Added'}</span>
                </span>
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{n.title}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                {n.subtitle} • By <span className="font-semibold text-slate-700">{n.ownerUsername}</span>
              </p>

              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                  {n.meta}
                </span>
                <button
                  onClick={() => {
                    dismissNotification(n.id);
                    onTabChange(n.type === 'catalog' ? 'uploads' : 'products');
                  }}
                  className={`text-[11px] font-bold flex items-center space-x-1 cursor-pointer ${
                    n.type === 'catalog'
                      ? 'text-indigo-600 hover:text-indigo-700'
                      : 'text-[#0ea5e9] hover:text-[#0284c7]'
                  }`}
                >
                  <span>{n.type === 'catalog' ? 'View in Uploads' : 'Inspect in Products'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
