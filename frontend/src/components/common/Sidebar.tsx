import React, { useState } from 'react';
import {
  FolderKanban,
  Package,
  Tags,
  FolderTree,
  Cpu,
  ClipboardCheck,
  BarChart3,
  Activity,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { TaxonomyTreeIcon } from './TaxonomyTreeIcon';

export type NavTab =
  | 'catalogs'
  | 'products'
  | 'taxonomy'
  | 'classification'
  | 'reviews'
  | 'analytics'
  | 'stats'
  | 'volume';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  reviewCount?: number;
  hasCatalog: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  reviewCount = 0,
  hasCatalog,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const navItems = [
    { id: 'catalogs' as NavTab, label: 'Catalog', icon: FolderKanban, enabled: hasCatalog },
    { id: 'products' as NavTab, label: 'Products', icon: Package, enabled: hasCatalog },
    { id: 'taxonomy' as NavTab, label: 'Taxonomy', icon: FolderTree, enabled: true },
    { id: 'classification' as NavTab, label: 'Classification', icon: Cpu, enabled: hasCatalog },
    {
      id: 'reviews' as NavTab,
      label: 'Review Queue',
      icon: ClipboardCheck,
      enabled: hasCatalog,
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart3, enabled: hasCatalog },
    { id: 'stats' as NavTab, label: 'Stats', icon: Activity, enabled: hasCatalog },
    { id: 'volume' as NavTab, label: 'Volume Explorer', icon: Layers, enabled: hasCatalog },
  ];

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0 h-screen sticky top-0 transition-all duration-200 ease-in-out z-40 ${
        isHovered ? 'w-64 shadow-xl' : 'w-16'
      }`}
    >
      <div className="p-3 space-y-6">
        {/* Brand */}
        <div className="flex items-center space-x-3 px-1 py-1 overflow-hidden">
          <TaxonomyTreeIcon size={32} className="w-8 h-8 flex-shrink-0" />
          {isHovered && (
            <div className="min-w-0 transition-opacity duration-200">
              <div className="text-base font-bold tracking-tight text-slate-900 leading-tight truncate">
                <span className="text-[#0ea5e9]">Taxonomy</span>
                <span className="text-[#475569]">Manager</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                Product Taxonomy Classifier
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="space-y-1">
          {isHovered && (
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
              Workspace
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = !item.enabled;

            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={() => onTabChange(item.id)}
                title={!isHovered ? item.label : undefined}
                className={`w-full flex items-center ${
                  isHovered ? 'justify-between px-3' : 'justify-center px-0'
                } py-2.5 rounded-lg text-xs font-medium transition-colors relative ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      isActive ? 'text-blue-600' : isDisabled ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  />
                  {isHovered && <span className="truncate">{item.label}</span>}
                </div>

                {/* Badge */}
                {item.badge !== undefined && (
                  isHovered ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                      {item.badge}
                    </span>
                  ) : (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60 overflow-hidden">
        {isHovered ? (
          <div>
            <div className="text-xs font-medium text-slate-700 flex items-center space-x-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">Shopify Taxonomy 2026-08</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              14,606 Standard Categories
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Shopify Taxonomy 2026-08 (14,606 Categories)">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        )}
      </div>
    </aside>
  );
};
