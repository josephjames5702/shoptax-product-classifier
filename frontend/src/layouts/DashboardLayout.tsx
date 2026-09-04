import React from 'react';
import { Header } from '../components/common/Header';
import { Sidebar, NavTab } from '../components/common/Sidebar';
import { Catalog } from '../types';

interface DashboardLayoutProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  catalogs: Catalog[];
  currentCatalog: Catalog | null;
  onSelectCatalog: (c: Catalog) => void;
  onCatalogUploaded?: (c: Catalog) => void;
  onDeleteCatalog?: (catalogId: string) => void;
  reviewCount: number;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab,
  onTabChange,
  catalogs,
  currentCatalog,
  onSelectCatalog,
  onCatalogUploaded,
  onDeleteCatalog,
  reviewCount,
  children,
}) => {
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Persistent Collapsible Hover Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        reviewCount={reviewCount}
        hasCatalog={!!currentCatalog}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentCatalog={currentCatalog}
          catalogs={catalogs}
          onSelectCatalog={onSelectCatalog}
          onCatalogUploaded={onCatalogUploaded}
          onDeleteCatalog={onDeleteCatalog}
        />
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
