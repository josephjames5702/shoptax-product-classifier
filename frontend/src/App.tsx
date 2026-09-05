import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Catalog, Product } from './types';
import { fetchCatalogs, fetchProducts } from './api/client';

// Layouts
import { UserLayout, UserNavTab } from './layouts/UserLayout';
import { AdminLayout, AdminNavTab } from './layouts/AdminLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// User Pages
import { UserDashboardPage } from './pages/user/UserDashboardPage';
import { UserCataloguesPage } from './pages/user/UserCataloguesPage';
import { UserProductsPage } from './pages/user/UserProductsPage';
import { UserProfilePage } from './pages/user/UserProfilePage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUploadsPage } from './pages/admin/AdminUploadsPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

// Common Modals
import { UploadCatalogModal } from './components/common/UploadCatalogModal';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

export const AppContent: React.FC = () => {
  const { user, isLoading, isAdmin, logout } = useAuth();

  // Detect route based on URL path
  const [pathname, setPathname] = useState(window.location.pathname);
  const [isAdminPath, setIsAdminPath] = useState(window.location.pathname.startsWith('/admin'));

  // Auth flow views: 'login' | 'register' | 'admin-login'
  const [authView, setAuthView] = useState<'login' | 'register' | 'admin-login'>(
    window.location.pathname.startsWith('/admin') ? 'admin-login' : 'login'
  );

  // Tabs for user and admin
  const [userTab, setUserTab] = useState<UserNavTab>('dashboard');
  const [adminTab, setAdminTab] = useState<AdminNavTab>('dashboard');

  // Shared state
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [currentCatalog, setCurrentCatalog] = useState<Catalog | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Synchronize browser history / path
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      setPathname(currentPath);
      setIsAdminPath(currentPath.startsWith('/admin'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
    setIsAdminPath(path.startsWith('/admin'));
  };

  // Data loading function
  const loadData = async (preferredCatalogId?: string) => {
    try {
      const [cats, prods] = await Promise.all([
        fetchCatalogs(),
        fetchProducts({ page_size: 100 }),
      ]);
      setCatalogs(cats || []);
      setRecentProducts(prods.results || []);

      if (cats && cats.length > 0) {
        setCurrentCatalog((prev) => {
          const targetId = preferredCatalogId || prev?.id;
          if (targetId === 'ALL') {
            const combinedTotal = cats.reduce((sum, c) => sum + (c.total_products || 0), 0);
            return {
              id: 'ALL',
              name: 'All Catalogues',
              total_products: combinedTotal,
            } as any;
          }
          if (targetId) {
            const matched = cats.find((c) => c.id === targetId);
            if (matched) return matched;
          }
          return cats[0];
        });
      } else {
        setCurrentCatalog(null);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
      const hasProcessing = catalogs.some((c) => c.status === 'PROCESSING');
      const pollDelay = hasProcessing ? 1200 : 4000;
      const interval = setInterval(loadData, pollDelay);
      return () => clearInterval(interval);
    }
  }, [user, catalogs.map((c) => c.status).join(',')]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center space-x-2 text-slate-500 text-xs">
        <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
        <span>Loading TaxonomyManager session...</span>
      </div>
    );
  }

  // ─── ADMIN SIDE (/admin) ──────────────────────────────────────────────────
  if (isAdminPath) {
    // If not logged in as Admin, show Admin Login
    if (!user || !isAdmin) {
      return (
        <AdminLoginPage
          onSuccess={() => {
            loadData();
          }}
          onNavigateUserLogin={() => {
            navigateTo('/app');
            setAuthView('login');
          }}
        />
      );
    }

    return (
      <AdminLayout activeTab={adminTab} onTabChange={setAdminTab}>
        {adminTab === 'dashboard' && (
          <AdminDashboardPage
            onViewUploads={() => setAdminTab('uploads')}
            onViewProducts={(status) => {
              setStatusFilter(status || '');
              setAdminTab(status === 'manual review' ? 'review' : 'products');
            }}
          />
        )}

        {adminTab === 'uploads' && (
          <AdminUploadsPage
            onSelectCatalog={(cat) => {
              setCurrentCatalog(cat);
              setAdminTab('products');
            }}
            onRefreshData={loadData}
          />
        )}

        {adminTab === 'products' && (
          <AdminProductsPage initialStatusFilter={statusFilter} />
        )}

        {adminTab === 'review' && (
          <AdminProductsPage initialStatusFilter="manual review" />
        )}

        {adminTab === 'analytics' && (
          <AdminAnalyticsPage />
        )}

        {adminTab === 'settings' && (
          <AdminSettingsPage onResetData={loadData} />
        )}
      </AdminLayout>
    );
  }

  // ─── USER SIDE (/app or root) ─────────────────────────────────────────────
  if (!user) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onSuccess={() => {
            loadData();
          }}
          onNavigateLogin={() => setAuthView('login')}
        />
      );
    }

    return (
      <LoginPage
        onSuccess={() => {
          loadData();
        }}
        onNavigateRegister={() => setAuthView('register')}
        onNavigateAdminLogin={() => {
          navigateTo('/admin');
          setAuthView('admin-login');
        }}
      />
    );
  }

  return (
    <UserLayout
      activeTab={userTab}
      onTabChange={setUserTab}
      onUploadClick={() => setIsUploadModalOpen(true)}
    >
      {userTab === 'dashboard' && (
        <UserDashboardPage
          catalogs={catalogs}
          recentProducts={recentProducts}
          onUploadClick={() => setIsUploadModalOpen(true)}
          onViewCatalogues={() => setUserTab('catalogues')}
          onViewProducts={(filter) => {
            setStatusFilter(filter || '');
            setUserTab('products');
          }}
          onRefreshData={loadData}
        />
      )}

      {userTab === 'catalogues' && (
        <UserCataloguesPage
          catalogs={catalogs}
          onUploadClick={() => setIsUploadModalOpen(true)}
          onSelectCatalog={(c) => {
            setCurrentCatalog(c);
            setUserTab('products');
          }}
          onRefreshData={loadData}
        />
      )}

      {userTab === 'products' && (
        <UserProductsPage
          currentCatalog={currentCatalog}
          catalogs={catalogs}
          initialStatusFilter={statusFilter}
          onSelectCatalog={setCurrentCatalog}
        />
      )}

      {userTab === 'profile' && (
        <UserProfilePage onLogout={logout} />
      )}

      {/* Upload Modal (100 sample prototype limit, sets PENDING without auto-running classification) */}
      <UploadCatalogModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={async (newCat) => {
          await loadData(newCat.id);
          setCurrentCatalog(newCat);
          setUserTab('products');
        }}
      />
    </UserLayout>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
