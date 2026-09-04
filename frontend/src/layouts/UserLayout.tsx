import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Tag, LayoutDashboard, Layers, Package, User, LogOut, UploadCloud } from 'lucide-react';
import { TaxonomyTreeIcon } from '../components/common/TaxonomyTreeIcon';

export type UserNavTab = 'dashboard' | 'catalogues' | 'products' | 'profile';

interface UserLayoutProps {
  activeTab: UserNavTab;
  onTabChange: (tab: UserNavTab) => void;
  onUploadClick: () => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<UserLayoutProps> = ({
  activeTab,
  onTabChange,
  onUploadClick,
  children,
}) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Floating Glass Navbar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* Logo with gradient glow */}
            <div
              onClick={() => onTabChange('dashboard')}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <TaxonomyTreeIcon size={30} className="w-7 h-7 flex-shrink-0 group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-lg tracking-tight leading-none">
                  <span className="text-[#0ea5e9]">Shop</span>
                  <span className="text-[#475569]">Tax</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mt-0.5">
                  Seller Portal
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-150 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => onTabChange('catalogues')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-150 cursor-pointer ${
                  activeTab === 'catalogues'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>My Catalogues</span>
              </button>

              <button
                onClick={() => onTabChange('products')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-150 cursor-pointer ${
                  activeTab === 'products'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>Products</span>
              </button>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onUploadClick}
              className="hidden sm:flex items-center space-x-2 px-3.5 py-2 btn-primary-gradient rounded-xl text-xs font-semibold"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Catalogue</span>
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-200/80">
              <button
                onClick={() => onTabChange('profile')}
                className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-blue-50 border border-blue-200/80 shadow-sm'
                    : 'hover:bg-slate-100/80 border border-transparent'
                }`}
                title="Profile & Settings"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {(user?.username || 'U')[0].toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {user?.username}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium leading-none">
                    Seller Account
                  </span>
                </div>
              </button>

              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
