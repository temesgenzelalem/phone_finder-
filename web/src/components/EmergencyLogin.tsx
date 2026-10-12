'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  KeyRound,
  Smartphone,
  AlertCircle,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  ClipboardPaste,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { loginEmergency, ApiError } from '@/lib/api';

interface EmergencyLoginProps {
  onLoginSuccess: (
    token: string,
    expiresAt: string,
    device: { phone_tag: string; device_model: string | null }
  ) => void;
}

export default function EmergencyLogin({ onLoginSuccess }: EmergencyLoginProps) {
  const [phoneTag, setPhoneTag] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const tag = phoneTag.trim().toUpperCase();
    const key = recoveryKey.trim().toUpperCase();

    if (!tag) {
      setErrorMessage('Please enter your Phone Tag.');
      return;
    }
    if (!key) {
      setErrorMessage('Please enter your 12-character Recovery Key.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginEmergency(tag, key);
      if (response.status === 'success' && response.emergency_token && response.expires_at) {
        onLoginSuccess(
          response.emergency_token,
          response.expires_at,
          response.device || { phone_tag: tag, device_model: null }
        );
      } else {
        setErrorMessage(response.message || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Could not connect to the recovery backend. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRecoveryKey(text.trim().toUpperCase());
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Top Header Card */}
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20 text-rose-400 mb-2 shadow-xl shadow-rose-950/20 relative">
          <ShieldAlert className="w-8 h-8" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Emergency Recovery Console
        </h1>
        <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          Access and secure your lost or stolen Android device from any borrowed browser without SMS or Google 2FA loops.
        </p>
      </div>

      {/* Main Glass Card */}
      <div className="bg-[#0b101d]/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-9 shadow-2xl relative overflow-hidden group">
        {/* Subtle decorative top border glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-70"></div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start space-x-3 text-rose-300 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Tag Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="phoneTag" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Assigned Phone Tag
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Format: PF-XXXX-XXXX</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Smartphone className="w-4 h-4" />
              </div>
              <input
                id="phoneTag"
                type="text"
                value={phoneTag}
                onChange={(e) => setPhoneTag(e.target.value.toUpperCase())}
                placeholder="e.g. PF-P4YF-YRCX"
                autoComplete="off"
                spellCheck="false"
                className="w-full pl-10 pr-4 py-3 bg-[#070b14] border border-white/[0.08] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-white placeholder-slate-600 text-sm font-mono tracking-wider transition-all outline-none"
              />
            </div>
          </div>

          {/* Recovery Key Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="recoveryKey" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Offline Recovery Key
              </label>
              <button
                type="button"
                onClick={handlePasteKey}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center space-x-1 transition-colors"
                title="Paste key from clipboard"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>Paste Key</span>
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="recoveryKey"
                type={showKey ? 'text' : 'password'}
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                placeholder="PF-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck="false"
                className="w-full pl-10 pr-11 py-3 bg-[#070b14] border border-white/[0.08] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-white placeholder-slate-600 text-sm font-mono tracking-wider transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              128-bit high-entropy secret generated during initial phone enrollment.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 border border-blue-400/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Cryptographic Proof...</span>
              </>
            ) : (
              <>
                <span>Enter Emergency Recovery Mode</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security badges */}
        <div className="mt-7 pt-6 border-t border-white/[0.06] grid grid-cols-2 gap-3 text-slate-400 text-[11px]">
          <div className="flex items-center space-x-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Zero-Knowledge Argon2id Proof</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <span>15-Min Auto Session Wipe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
