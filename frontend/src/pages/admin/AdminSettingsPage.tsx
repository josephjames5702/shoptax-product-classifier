import React, { useState } from 'react';
import {
  Sliders,
  Cpu,
  Database,
  Shield,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Server,
  Zap,
} from 'lucide-react';
import { resetCatalogs } from '../../api/client';

export const AdminSettingsPage: React.FC<{ onResetData?: () => void }> = ({ onResetData }) => {
  const [modelProvider, setModelProvider] = useState('ollama');
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [batchSize, setBatchSize] = useState(50);
  const [autoApprove, setAutoApprove] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setMessage('Settings successfully updated.');
    setTimeout(() => {
      setIsSaved(false);
      setMessage(null);
    }, 3000);
  };

  const handleResetDatabase = async () => {
    if (
      !window.confirm(
        'DANGER: This will delete ALL uploaded catalogues, products, and jobs across all accounts, resetting the store database to a clean slate. Taxonomy categories will be preserved. Proceed?'
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      await resetCatalogs();
      setMessage('All catalogues and products have been completely reset.');
      if (onResetData) onResetData();
    } catch (err) {
      console.error('Reset error:', err);
      alert('Failed to reset database. Please check backend connection.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1e293b] tracking-tight">System Settings</h1>
        <p className="text-sm text-[#64748b] mt-1">
          Configure platform parameters, AI classification engines, and database maintenance tools.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. AI Taxonomy Engine Configuration */}
        <div className="bg-white p-6 rounded-xl border border-black/5 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-[#0ea5e9]" />
            <h2 className="text-base font-bold text-[#1e293b]">AI Classification Engine</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Classification Model Provider
              </label>
              <select
                value={modelProvider}
                onChange={(e) => setModelProvider(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9]"
              >
                <option value="ollama">Ollama (Offline Local Llama 3.2 3B) [Active]</option>
                <option value="gemini">Google Gemini 1.5 Flash (Online)</option>
                <option value="rule-based">Rule-Based Vector Similarity Fallback</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Local model runs completely on-device without leaking data or requiring API keys.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Ollama Endpoint Host
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  defaultValue="http://localhost:11434"
                  readOnly
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono"
                />
                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md uppercase">
                  Connected
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Auto-Approval Threshold ({confidenceThreshold}%)
              </label>
              <input
                type="range"
                min="50"
                max="95"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full accent-[#0ea5e9] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>50% (Lenient)</span>
                <span className="font-bold text-slate-700">{confidenceThreshold}%</span>
                <span>95% (Strict)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Batch Processing Size
              </label>
              <input
                type="number"
                min="10"
                max="500"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Number of catalog items chunked per classification worker queue.
              </p>
            </div>
          </div>

          <div className="pt-3 flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-approve-toggle"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="rounded text-[#0ea5e9] focus:ring-[#0ea5e9] w-4 h-4 cursor-pointer"
            />
            <label htmlFor="auto-approve-toggle" className="text-xs font-medium text-slate-700 cursor-pointer">
              Automatically promote high-confidence predictions (&gt;{confidenceThreshold}%) to Auto-Approved
            </label>
          </div>
        </div>

        {/* 2. Platform & Enterprise Policy */}
        <div className="bg-white p-6 rounded-xl border border-black/5 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-[#1e293b]">Admin Security & Authentication</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[11px]">Primary Admin Identity</span>
              <span className="font-bold text-slate-800 text-sm">admin</span>
              <span className="text-slate-500 block mt-0.5 font-mono">admin@shoptax.io</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[11px]">Concurrent Multiple Sessions</span>
              <span className="font-bold text-emerald-700 text-sm">Enabled</span>
              <span className="text-slate-500 block mt-0.5">Dual-tab User & Admin workflow active</span>
            </div>
          </div>
        </div>

        {/* 3. Maintenance & Database Utilities */}
        <div className="bg-white p-6 rounded-xl border border-rose-100 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-rose-100 pb-3">
            <Database className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-rose-900">Database & Maintenance Tools</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-rose-50/50 rounded-xl border border-rose-200/60">
            <div>
              <h3 className="text-xs font-bold text-rose-900">Reset All Uploaded Catalogues</h3>
              <p className="text-[11px] text-rose-700 mt-0.5 max-w-lg">
                Removes all uploaded files, user imported products, and classification queues while strictly preserving the official Shopify taxonomy categories.
              </p>
            </div>

            <button
              type="button"
              disabled={isResetting}
              onClick={handleResetDatabase}
              className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex-shrink-0 disabled:opacity-50"
            >
              {isResetting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{isResetting ? 'Resetting...' : 'Reset Catalogues'}</span>
            </button>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
