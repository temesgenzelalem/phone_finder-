'use client';

import React, { useState } from 'react';
import { Shield, KeyRound, Smartphone, AlertCircle, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
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

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header Banner */}
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 mb-2 shadow-lg shadow-red-950/20">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Emergency Recovery Console
        </h1>
        <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          Access and secure your lost Android phone from any browser using your verified Phone Tag and Recovery Key.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glowing accent border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-blue-500"></div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs sm:text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Tag Field */}
          <div className="space-y-1.5">
            <label htmlFor="phone_tag" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Phone Tag
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Smartphone className="w-4 h-4" />
              </div>
              <input
                id="phone_tag"
                type="text"
                autoComplete="off"
                spellCheck="false"
                value={phoneTag}
                onChange={(e) => setPhoneTag(e.target.value.toUpperCase())}
                placeholder="e.g. PF-7K9A-B2M4-X8"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                disabled={isLoading}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Assigned during phone enrollment (e.g. PF-XXXX-XXXX-XX)
            </p>
          </div>

          {/* Recovery Key Field */}
          <div className="space-y-1.5">
            <label htmlFor="recovery_key" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Recovery Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="recovery_key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck="false"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                placeholder="e.g. PF-7K9A-B2M4-X8Q1"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              12-character high-entropy secret saved when enabling protection
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-red-600 hover:from-red-500 to-red-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-lg shadow-red-950/40 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Recovery Credentials...</span>
              </>
            ) : (
              <>
                <span>Enter Emergency Mode</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Disclaimers */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
          <div className="flex items-start space-x-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Zero-Knowledge Argon2id verification protects your secret key.</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Emergency sessions automatically expire after 15 minutes of inactivity.</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-amber-400 font-bold">!</span>
            <span>All emergency recovery actions are cryptographically signed & logged.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
