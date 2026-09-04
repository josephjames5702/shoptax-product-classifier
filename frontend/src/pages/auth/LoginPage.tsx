import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Shield,
  Armchair,
  Sparkles,
  Layers,
  BarChart3,
  Lamp,
} from 'lucide-react';
import { loginUser } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { ShopTaxIcon } from '../../components/common/ShopTaxIcon';

interface LoginPageProps {
  onSuccess?: () => void;
  onNavigateRegister?: () => void;
  onNavigateAdminLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateRegister,
  onNavigateAdminLogin,
}) => {
  const { setSessionUser } = useAuth();
  const [email, setEmail] = useState('user_a@test.com');
  const [password, setPassword] = useState('UserPass123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email/Username and password are required.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await loginUser({ email: email.trim(), password });
      setSessionUser(res.user);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Invalid seller credentials. Please verify your email and password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-hidden font-sans bg-slate-900">
      
      {/* ─── 1. CINEMATIC OFFICE BACKGROUND ─────────────────────────────────── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 scale-105"
        style={{
          backgroundImage: `url('/images/cinematic-office-bg.jpg')`,
        }}
      />
      
      {/* Soft atmospheric gradient & light leaks */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/40 via-transparent to-slate-900/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-slate-950/50 pointer-events-none" />

      {/* Floating 4-point diamond star sparkles */}
      <div className="absolute bottom-24 right-16 text-white/50 animate-pulse hidden xl:block pointer-events-none text-2xl">
        ✦
      </div>
      <div className="absolute top-20 left-24 text-white/40 animate-pulse hidden xl:block pointer-events-none text-xl">
        ✦
      </div>

      {/* ─── 2. FLOATING DECORATIVE MID-AIR ELEMENTS (AROUND PANEL) ──────────── */}
      
      {/* Floating Left: Architectural Sketch 1 (Top Left) */}
      <div
        className="absolute left-6 top-16 w-32 h-44 rounded-2xl bg-white/20 backdrop-blur-md border border-amber-200/50 shadow-xl shadow-amber-500/10 p-2 hidden xl:flex flex-col justify-between pointer-events-none transition-transform duration-1000"
        style={{
          transform: 'rotate(-4deg) translateY(-8px)',
          boxShadow: '0 0 25px rgba(251, 191, 36, 0.25)',
        }}
      >
        <div className="w-full h-full bg-stone-50/80 rounded-xl p-2 flex items-center justify-center border border-white/60">
          <svg viewBox="0 0 100 120" className="w-full h-full text-stone-700 stroke-current fill-none stroke-1">
            <path d="M25 80 L75 80 L70 45 L30 45 Z" strokeWidth="1.5" />
            <path d="M30 45 L30 20 C30 15 70 15 70 20 L70 45" strokeWidth="1.5" />
            <path d="M20 55 L30 55 M70 55 L80 55" strokeWidth="1.5" />
            <path d="M20 55 L22 95 M80 55 L78 95" strokeWidth="1.5" />
            <path d="M28 80 L22 110 M72 80 L78 110" strokeWidth="1.5" />
            <line x1="15" y1="110" x2="85" y2="110" strokeDasharray="2,2" strokeWidth="0.8" />
          </svg>
        </div>
      </div>

      {/* Floating Left: Vertical Category Pill */}
      <div
        className="absolute left-32 top-1/3 -translate-y-1/2 bg-[#1e3940]/90 backdrop-blur-xl border border-cyan-400/40 rounded-2xl p-2 flex-col space-y-3 shadow-2xl shadow-cyan-950/40 hidden xl:flex pointer-events-none z-20"
        style={{
          boxShadow: '0 0 20px rgba(6, 182, 212, 0.25)',
        }}
      >
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-cyan-300">
          <Armchair className="w-4 h-4" />
        </div>
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
            <path d="M4 8h16M4 8v10M20 8v10M8 8v4M16 8v4" />
          </svg>
        </div>
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
          <Lamp className="w-4 h-4" />
        </div>
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
            <circle cx="12" cy="7" r="4" />
            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          </svg>
        </div>
      </div>

      {/* Floating Left: Architectural Sketch 2 (Bottom Left) */}
      <div
        className="absolute left-10 bottom-12 w-32 h-44 rounded-2xl bg-white/25 backdrop-blur-md border border-amber-300/50 shadow-xl p-2 hidden xl:flex flex-col justify-between pointer-events-none"
        style={{
          transform: 'rotate(3deg) translateY(6px)',
          boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)',
        }}
      >
        <div className="w-full h-full bg-stone-50/85 rounded-xl p-2 flex items-center justify-center border border-white/60">
          <svg viewBox="0 0 100 120" className="w-full h-full text-stone-800 stroke-current fill-none stroke-1">
            <rect x="25" y="30" width="50" height="40" rx="3" strokeWidth="1.2" />
            <path d="M20 45 L25 45 M75 45 L80 45" strokeWidth="1.5" />
            <path d="M22 45 L22 95 M78 45 L78 95" strokeWidth="1.5" />
            <path d="M25 70 L20 105 M75 70 L80 105" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="8" strokeDasharray="2,2" />
          </svg>
        </div>
      </div>

      {/* Floating Top: Cabinet Blueprint Exploded Wireframe */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-4 w-40 h-28 rounded-2xl bg-white/30 backdrop-blur-md border border-cyan-400/60 p-2 hidden 2xl:flex items-center justify-center pointer-events-none"
        style={{
          boxShadow: '0 0 25px rgba(6, 182, 212, 0.3)',
          transform: 'translate(-80px, -6px)',
        }}
      >
        <div className="w-full h-full bg-cyan-950/40 rounded-xl p-2 border border-cyan-300/30 flex items-center justify-center">
          <svg viewBox="0 0 100 70" className="w-full h-full text-cyan-300 stroke-current fill-none stroke-1">
            <polygon points="20,20 50,8 80,20 50,32" strokeWidth="1.2" />
            <polygon points="20,40 50,28 80,40 50,52" strokeWidth="1.2" strokeDasharray="2,2" />
            <line x1="20" y1="20" x2="20" y2="40" strokeWidth="1.2" />
            <line x1="50" y1="32" x2="50" y2="52" strokeWidth="1.2" />
            <line x1="80" y1="20" x2="80" y2="40" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* Floating Top: Joinery Blueprint Wireframe */}
      <div
        className="absolute left-1/2 top-4 w-44 h-24 rounded-2xl bg-white/25 backdrop-blur-md border border-cyan-400/50 p-2 hidden 2xl:flex items-center justify-center pointer-events-none"
        style={{
          boxShadow: '0 0 25px rgba(6, 182, 212, 0.25)',
          transform: 'translate(100px, -12px)',
        }}
      >
        <div className="w-full h-full bg-cyan-950/35 rounded-xl p-2 border border-cyan-300/30 flex items-center justify-center">
          <svg viewBox="0 0 120 60" className="w-full h-full text-cyan-300 stroke-current fill-none stroke-1">
            <rect x="10" y="10" width="40" height="40" strokeWidth="1.2" />
            <rect x="60" y="15" width="45" height="30" strokeWidth="1.2" strokeDasharray="3,3" />
            <path d="M50 30 L60 30" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Floating Right: Woven Fabric Textile Swatch */}
      <div
        className="absolute right-12 top-14 w-32 h-40 rounded-2xl bg-white/20 backdrop-blur-md border border-cyan-300/60 shadow-xl overflow-hidden hidden xl:block pointer-events-none"
        style={{
          boxShadow: '0 0 25px rgba(6, 182, 212, 0.3)',
          transform: 'rotate(2deg) translateY(-6px)',
        }}
      >
        <div className="w-full h-full bg-stone-300 relative overflow-hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
            <defs>
              <pattern id="weave" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M0 10h20M10 0v20" stroke="#78716c" strokeWidth="4" />
                <path d="M0 0l20 20M20 0L0 20" stroke="#a8a29e" strokeWidth="2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#weave)" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-800/20 to-transparent" />
        </div>
      </div>

      {/* Floating Right: Ceramic Cylinder Table Lamp */}
      <div
        className="absolute right-12 top-1/2 -translate-y-1/2 w-36 h-48 rounded-2xl bg-white/25 backdrop-blur-md border border-cyan-300/60 shadow-xl overflow-hidden hidden xl:flex flex-col items-center justify-center p-3 pointer-events-none"
        style={{
          boxShadow: '0 0 28px rgba(6, 182, 212, 0.35)',
        }}
      >
        <div className="w-full h-full bg-stone-100/90 rounded-xl flex items-center justify-center relative p-2">
          {/* Ceramic table lamp illustration */}
          <div className="flex flex-col items-center">
            {/* Lamp shade */}
            <div className="w-14 h-12 rounded-t-sm bg-[#d6cec2] border border-stone-400/40 shadow-xs" />
            {/* Lamp base */}
            <div className="w-7 h-14 rounded-b-xl bg-[#c5b8a5] border border-stone-400/40 -mt-0.5 shadow-sm" />
          </div>
        </div>
      </div>

      {/* Floating Right: 3D Holographic Analytics Bar Chart */}
      <div
        className="absolute right-10 bottom-14 w-40 h-28 rounded-2xl bg-white/30 backdrop-blur-xl border border-cyan-400/50 shadow-2xl p-2.5 hidden xl:flex flex-col justify-between pointer-events-none"
        style={{
          boxShadow: '0 0 30px rgba(6, 182, 212, 0.35)',
          transform: 'rotate(-2deg)',
        }}
      >
        <div className="w-full h-full bg-slate-900/60 backdrop-blur-md rounded-xl p-2 flex flex-col justify-between border border-cyan-300/30">
          <div className="flex items-end justify-between h-14 px-2 pt-2">
            <div className="w-3 rounded-full bg-gradient-to-t from-cyan-500 to-sky-400 h-6 animate-pulse" />
            <div className="w-3 rounded-full bg-gradient-to-t from-cyan-400 to-teal-300 h-11" />
            <div className="w-3 rounded-full bg-gradient-to-t from-teal-400 to-emerald-300 h-8" />
            <div className="w-3 rounded-full bg-gradient-to-t from-indigo-400 to-purple-400 h-14" />
            <div className="w-3 rounded-full bg-gradient-to-t from-sky-400 to-cyan-300 h-10" />
          </div>
          <div className="flex justify-between px-1 text-[8px] text-cyan-200/70 font-mono">
            <span>MOD</span>
            <span>ORD</span>
            <span>CAT</span>
            <span>SYN</span>
            <span>REV</span>
          </div>
        </div>
      </div>

      {/* ─── 3. CENTRAL TRANSLUCENT GLASSMORPHIC FLOATING PANEL ──────────────── */}
      <div className="w-full max-w-5xl mx-auto my-auto relative z-10">
        
        {/* The Translucent Frosted Glass Card */}
        <div
          className="rounded-[36px] border border-white/70 shadow-2xl p-6 sm:p-8 lg:p-10 transition-all duration-300"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
          }}
        >
          
          {/* Top Brand Header */}
          <div className="flex items-center space-x-2.5 mb-6">
            <ShopTaxIcon size={34} className="w-8 h-8 flex-shrink-0" />
            <div className="flex items-center">
              <span className="font-bold text-2xl tracking-tight text-slate-900">Shop</span>
              <span className="font-bold text-2xl tracking-tight text-[#28505a]">Tax</span>
            </div>
          </div>

          {/* Main 2-Column Split: Furniture Visual Showcase & Sign-in Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            
            {/* Left Section: Furniture Imagery Showcase (100% Local Images) */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              
              {/* Furniture Grid (Clean, balanced layout with no classification box) */}
              <div className="grid grid-cols-12 gap-2.5 sm:gap-3">
                
                {/* 1. Large Main Sofa Image */}
                <div className="col-span-5 row-span-2 relative rounded-2xl overflow-hidden bg-stone-200 aspect-[4/5] shadow-xs group">
                  <img
                    src="/images/sofa-main.jpg"
                    alt="Comfortable modern cream sofa"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="eager"
                  />
                  {/* HOME GOODS Pill Badge */}
                  <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider text-slate-800 uppercase shadow-xs">
                    HOME GOODS
                  </div>
                  {/* Caption on bottom */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-black/45 backdrop-blur-xs text-white text-[10px] px-2.5 py-1.5 rounded-md font-medium">
                    Crafted for Comfort, Designed for Life.
                  </div>
                </div>

                {/* 2. Top-Middle: Solid Wood Dining Table */}
                <div className="col-span-4 rounded-2xl overflow-hidden bg-stone-200 aspect-[4/3] shadow-xs group">
                  <img
                    src="/images/dining-table.jpg"
                    alt="Solid wood dining table"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="eager"
                  />
                </div>

                {/* 3. Top-Right: Modern Dining Armchairs */}
                <div className="col-span-3 rounded-2xl overflow-hidden bg-stone-200 aspect-[4/3] shadow-xs group">
                  <img
                    src="/images/dining-chairs.jpg"
                    alt="Modern fabric armchairs"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="eager"
                  />
                </div>

                {/* 4. Center-Right: Modern Living Room Sectional Sofa */}
                <div className="col-span-7 rounded-2xl overflow-hidden bg-stone-200 aspect-[16/9] shadow-xs group">
                  <img
                    src="/images/sectional-sofa.jpg"
                    alt="Modern living room sectional sofa"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="eager"
                  />
                </div>

                {/* 5. Bottom-Left: Round Accent Table */}
                <div className="col-span-6 rounded-2xl overflow-hidden bg-stone-200 aspect-[16/10] shadow-xs group">
                  <img
                    src="/images/side-table.jpg"
                    alt="Round accent table"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="eager"
                  />
                </div>

                {/* 6. Bottom-Right: Table Craftsmanship Detail */}
                <div className="col-span-6 rounded-2xl overflow-hidden bg-stone-200 aspect-[16/10] shadow-xs group">
                  <img
                    src="/images/table-detail.jpg"
                    alt="Table leg craftsmanship detail"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="eager"
                  />
                </div>

              </div>

              {/* Editorial Headline */}
              <div className="mt-5 pt-1">
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight leading-snug">
                  Organize, Discover, Sell.
                  <br />
                  <span className="text-slate-800 font-normal">
                    Your key to a smarter product catalog.
                  </span>
                </h2>
              </div>

            </div>

            {/* Right Section: Elevated Floating White Sign-in Card */}
            <div
              className="lg:col-span-5 rounded-3xl p-6 sm:p-8 lg:p-9 shadow-xl border border-white/80 flex flex-col justify-between"
              style={{
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-6">
                  Sign in to your account.
                </h3>

                {/* Error Banner */}
                {error && (
                  <div className="mb-4 p-3 bg-rose-50/90 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Login ID */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Login ID
                    </label>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your seller ID or email"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-[#34626d] focus:ring-2 focus:ring-[#34626d]/20 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white/95 transition outline-none"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 focus:border-[#34626d] focus:ring-2 focus:ring-[#34626d]/20 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white/95 transition outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="mt-2 text-left">
                      <button
                        type="button"
                        onClick={() => alert('Please contact store administrator to reset your seller password.')}
                        className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </div>

                  {/* SIGN IN Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-[#34626d] hover:bg-[#284c55] active:bg-[#1f3b43] text-white text-xs sm:text-sm font-bold tracking-wider uppercase rounded-full shadow-md shadow-[#34626d]/25 transition duration-150 flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>SIGN IN</span>
                      )}
                    </button>
                  </div>
                </form>

                {/* Subtext under button */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-600">
                    New furniture seller? Join our network.{' '}
                    <button
                      type="button"
                      onClick={onNavigateRegister}
                      className="text-slate-900 font-semibold underline hover:text-[#34626d] transition cursor-pointer"
                    >
                      Learn More
                    </button>
                  </p>
                </div>
              </div>

              {/* Bottom Quick Controls & Admin Switch */}
              <div className="mt-6 pt-4 border-t border-slate-200/60 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  {/* Quick autofill for pair programming evaluation */}
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('user_a@test.com');
                      setPassword('UserPass123!');
                    }}
                    className="text-[11px] font-semibold text-[#34626d] hover:text-[#284c55] bg-[#34626d]/10 hover:bg-[#34626d]/20 px-3 py-1 rounded-full transition cursor-pointer"
                  >
                    Autofill Demo Seller
                  </button>

                  {/* Switch to Admin Login */}
                  {onNavigateAdminLogin && (
                    <button
                      type="button"
                      onClick={onNavigateAdminLogin}
                      className="text-xs font-medium text-slate-700 hover:text-slate-950 flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#34626d]" />
                      <span>Admin Portal →</span>
                    </button>
                  )}
                </div>

                {/* Powered by Shopify Taxonomy */}
                <div className="pt-2 text-center">
                  <p className="text-[11px] text-slate-400 font-serif italic">
                    Powered by Shopify Taxonomy
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
