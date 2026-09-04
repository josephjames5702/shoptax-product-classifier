import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Home,
  ChevronRight,
  Shirt,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { adminLogin } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { TaxonomyTreeIcon } from '../../components/common/TaxonomyTreeIcon';

interface AdminLoginPageProps {
  onSuccess?: () => void;
  onNavigateUserLogin?: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onSuccess,
  onNavigateUserLogin,
}) => {
  const { setSessionUser } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Login ID and password are required.');
      return;
    }

    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const res = await adminLogin({ username: username.trim(), password });
      setSessionUser(res.user);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Invalid administrator credentials. Please check your login ID and password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutofill = () => {
    setUsername('admin');
    setPassword('Admin123!');
    setInfoMessage('Default credentials loaded: admin / Admin123!');
    setTimeout(() => setInfoMessage(null), 3500);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between items-center relative overflow-x-hidden font-sans select-none p-4 sm:p-6 md:p-8"
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, #ffffff 0%, #faf8f5 40%, #f4efe7 75%, #ece3d6 100%)',
      }}
    >
      {/* Top Floating Actions Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-30 pt-2 pb-4">
        {/* Minimalist Header Branding */}
        <div className="flex items-center space-x-2.5">
          <TaxonomyTreeIcon size={24} className="text-[#0ea5e9]" />
          <div className="flex items-center">
            <span className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight">ShopTax</span>
            <span className="text-slate-300 mx-2 text-base font-light">|</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-600">Admin Portal</span>
          </div>
        </div>

        {/* Quick Demo Helper & Seller Portal Nav */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleAutofill}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/90 hover:bg-white text-slate-700 hover:text-[#0ea5e9] text-xs font-semibold rounded-full shadow-xs border border-slate-200/80 transition cursor-pointer"
            title="Autofill default admin credentials"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0ea5e9]" />
            <span className="hidden sm:inline">Demo Admin</span>
          </button>

          {onNavigateUserLogin && (
            <button
              type="button"
              onClick={onNavigateUserLogin}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-full shadow-xs transition cursor-pointer"
              title="Open Seller Portal"
            >
              <span>Seller Portal</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#0ea5e9]" />
            </button>
          )}
        </div>
      </header>

      {/* Floating Error Toast Notification */}
      {error && (
        <div className="fixed top-5 z-50 bg-white/95 backdrop-blur-md border border-rose-200 text-rose-800 px-5 py-2.5 rounded-2xl shadow-xl flex items-center space-x-2.5 text-xs animate-in fade-in slide-in-from-top-4 duration-200 max-w-md">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-semibold flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Floating Info Notification */}
      {infoMessage && (
        <div className="fixed top-5 z-50 bg-slate-900/95 text-white backdrop-blur-md border border-slate-800 px-4 py-2 rounded-2xl shadow-xl flex items-center space-x-2 text-xs animate-in fade-in slide-in-from-top-3 duration-200">
          <Info className="w-3.5 h-3.5 text-[#0ea5e9]" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* ─── CENTERED LOGIN CARD (SPLIT LAYOUT) ─── */}
      <div className="w-full max-w-4xl my-auto py-4">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
          
          {/* ─── LEFT COLUMN: PRODUCT & TAXONOMY PREVIEW ─── */}
          <div className="p-8 sm:p-10 bg-slate-50/60 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100">
            <div className="space-y-5">
              {/* Subtle Category Breadcrumb Row */}
              <nav className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400 overflow-x-auto whitespace-nowrap">
                <Home className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="hover:text-slate-600 cursor-pointer">Home</span>
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span className="hover:text-slate-600 cursor-pointer">Fashion</span>
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span className="hover:text-slate-600 cursor-pointer">Apparel</span>
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span className="text-slate-700 font-semibold">Men&apos;s Shirts</span>
              </nav>

              {/* Bold Headline & Subtitle */}
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Categorize, Manage &amp; Sync Products
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Efficiently manage your product taxonomy with our intuitive platform.
                </p>
              </div>

              {/* Embedded Preview Card: Menswear Category Grid */}
              <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold text-slate-800">Menswear</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    4 items
                  </span>
                </div>

                {/* 4 Soft Rounded Pastel Tiles */}
                <div className="grid grid-cols-4 gap-2.5 text-center">
                  {/* Tile 1: T-Shirt */}
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-[#e0f2fe] border border-[#bae6fd]/50 transition-transform hover:scale-105">
                    <span className="text-2xl select-none" role="img" aria-label="T-Shirt">
                      👕
                    </span>
                    <span className="text-[10px] font-bold text-[#0369a1] mt-1 truncate w-full">
                      T-Shirt
                    </span>
                  </div>

                  {/* Tile 2: Denim Jeans */}
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-[#f1f5f9] border border-[#e2e8f0] transition-transform hover:scale-105">
                    <span className="text-2xl select-none" role="img" aria-label="Denim Jeans">
                      👖
                    </span>
                    <span className="text-[10px] font-bold text-[#334155] mt-1 truncate w-full">
                      Denim Jeans
                    </span>
                  </div>

                  {/* Tile 3: Shorts */}
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-[#dcfce7] border border-[#bbf7d0]/60 transition-transform hover:scale-105">
                    <span className="text-2xl select-none" role="img" aria-label="Shorts">
                      🩳
                    </span>
                    <span className="text-[10px] font-bold text-[#15803d] mt-1 truncate w-full">
                      Shorts
                    </span>
                  </div>

                  {/* Tile 4: Sneakers */}
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-[#ffedd5] border border-[#fed7aa]/60 transition-transform hover:scale-105">
                    <span className="text-2xl select-none" role="img" aria-label="Sneakers">
                      👟
                    </span>
                    <span className="text-[10px] font-bold text-[#c2410c] mt-1 truncate w-full">
                      Sneakers
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enterprise Tag */}
            <div className="pt-6 hidden md:flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Shopify Polaris &amp; Apple Design Standard</span>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: AUTHENTICATION CARD ─── */}
          <div className="p-8 sm:p-10 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Sign in to your account
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Access your enterprise taxonomy administration suite.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Input 1: LOGIN ID */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-id"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-600"
                  >
                    LOGIN ID
                  </label>
                  <input
                    type="text"
                    id="login-id"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your email or login ID"
                    required
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] placeholder-slate-400 transition"
                  />
                </div>

                {/* Input 2: PASSWORD */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-[10px] font-bold uppercase tracking-wider text-slate-600"
                    >
                      PASSWORD
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setInfoMessage('Default credentials: admin / Admin123!');
                        setTimeout(() => setInfoMessage(null), 3500);
                      }}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] placeholder-slate-400 transition tracking-normal"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary CTA: Vibrant sky-blue rounded button with bold uppercase text "SIGN IN" */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    id="admin-submit-btn"
                    className="w-full py-3 px-4 bg-[#0ea5e9] hover:bg-[#0284c7] active:bg-[#0369a1] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md hover:shadow-sky-500/25 flex items-center justify-center cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <span>SIGN IN</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Helper Footer Text */}
            <div className="pt-6 text-center">
              <p className="text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setInfoMessage('Contact platform administrator: admin@shoptax.io');
                    setTimeout(() => setInfoMessage(null), 3500);
                  }}
                  className="font-semibold text-slate-800 hover:text-[#0ea5e9] transition cursor-pointer"
                >
                  Contact Admin.
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="w-full max-w-4xl text-center text-xs text-slate-400 space-y-1.5 pb-2 pt-4">
        <div className="flex items-center justify-center space-x-3 text-slate-500 font-medium">
          <button
            type="button"
            onClick={() => {
              setInfoMessage('Support: support@shoptax.io');
              setTimeout(() => setInfoMessage(null), 3500);
            }}
            className="hover:text-slate-800 transition cursor-pointer"
          >
            Support
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => {
              setInfoMessage('Enterprise Privacy: Session encrypted with 256-bit SSL');
              setTimeout(() => setInfoMessage(null), 3500);
            }}
            className="hover:text-slate-800 transition cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => {
              setInfoMessage('Terms: ShopTax Commercial License');
              setTimeout(() => setInfoMessage(null), 3500);
            }}
            className="hover:text-slate-800 transition cursor-pointer"
          >
            Terms of Service
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          &copy; 2026 ShopTax Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
