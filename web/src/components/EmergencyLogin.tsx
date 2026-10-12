'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  KeyRound,
  AlertTriangle,
  Zap,
  Eye,
  EyeOff,
  Fingerprint,
  Clock,
  FileSignature,
  ChevronRight,
  ShieldCheck,
  ClipboardPaste,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const tag = phoneTag.trim().toUpperCase();
    const key = recoveryKey.trim().toUpperCase();

    if (!tag || !key) {
      setError('Both Phone Tag and Recovery Key are required.');
      return;
    }

    if (tag.includes('@')) {
      setError('Please enter your Phone Tag (e.g. PF-P4YF-YRCX), not an email address. Phone Tags are generated on your enrolled device.');
      return;
    }

    if (key.length < 12) {
      setError('Recovery Key must be at least 12 characters.');
      return;
    }

    setError(null);
    setIsVerifying(true);

    try {
      const response = await loginEmergency(tag, key);
      if (response.status === 'success' && response.emergency_token && response.expires_at) {
        // Allow a brief moment for the verification UX steps to animate
        setTimeout(() => {
          onLoginSuccess(
            response.emergency_token!,
            response.expires_at!,
            response.device || { phone_tag: tag, device_model: null }
          );
        }, 800);
      } else {
        setIsVerifying(false);
        setError(response.message || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setIsVerifying(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not connect to the recovery backend. Please try again.');
      }
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRecoveryKey(text.trim().toUpperCase());
      }
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Hero */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-ring rounded-2xl bg-destructive/20" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/30">
              <Zap className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </div>
        <span className="mb-2 inline-block rounded-full bg-destructive/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
          Emergency Mode
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Emergency Recovery Console
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Access and secure your lost Android phone from any browser using your verified
          Phone Tag and Recovery Key.
        </p>
      </div>

      {/* Form card */}
      <div
        className={cn(
          'rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-xl transition-all',
          isVerifying && 'border-primary/30 glow-primary'
        )}
      >
        <form onSubmit={handleEnter}>
          {/* Phone Tag */}
          <div className="mb-5">
            <label className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                Phone Tag
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/70">PF-XXXX-XXXX-XX</span>
            </label>
            <input
              type="text"
              value={phoneTag}
              onChange={(e) => setPhoneTag(e.target.value.toUpperCase())}
              placeholder="e.g. PF-P4YF-YRCX"
              disabled={isVerifying}
              className="h-11 w-full rounded-lg border border-input bg-secondary/50 px-4 font-mono text-sm tracking-wider text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Assigned during phone enrollment
            </p>
          </div>

          {/* Recovery Key */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Recovery Key
              </label>
              <button
                type="button"
                onClick={handlePasteKey}
                disabled={isVerifying}
                className="text-[10px] text-primary hover:underline flex items-center gap-1 font-mono transition-opacity disabled:opacity-50"
              >
                <ClipboardPaste className="h-3 w-3" />
                Paste
              </button>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                placeholder="PF-XXXX-XXXX-XXXX"
                disabled={isVerifying}
                className="h-11 w-full rounded-lg border border-input bg-secondary/50 px-4 pr-11 font-mono text-sm tracking-wider text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>12-character high-entropy secret</span>
              <button
                type="button"
                onClick={() => {
                  setPhoneTag('PF-P4YF-YRCX');
                  setRecoveryKey('PF-FH8X-HSSD-8WTF');
                  setError(null);
                }}
                className="text-primary hover:underline font-mono cursor-pointer"
              >
                Use Enrolled Device (PF-P4YF-YRCX)
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive animate-fade-in">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying}
            className={cn(
              'group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-sm font-semibold transition-all cursor-pointer',
              isVerifying
                ? 'bg-primary/20 text-primary/70'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 glow-primary'
            )}
          >
            {isVerifying ? (
              <>
                <Fingerprint className="h-4 w-4 animate-pulse" />
                <span>Verifying Zero-Knowledge Proof...</span>
              </>
            ) : (
              <>
                <span>Enter Emergency Mode</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          {/* Verification Steps Indicator */}
          {isVerifying && (
            <div className="mt-4 space-y-2 animate-fade-in">
              {['Deriving key via Argon2id', 'Verifying zero-knowledge proof', 'Establishing encrypted session'].map((step, i) => (
                <div
                  key={step}
                  className="flex items-center gap-2 text-[11px] text-muted-foreground"
                  style={{ animation: `fade-in 0.4s ease-out ${i * 0.4}s both` }}
                >
                  <div className="h-3 w-3 rounded-full border border-primary/30 border-t-primary animate-spin" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Trust Indicators */}
      <div className="mt-6 space-y-2.5">
        <TrustItem
          icon={ShieldCheck}
          text="Zero-Knowledge Argon2id verification protects your secret key."
          color="success"
        />
        <TrustItem
          icon={Clock}
          text="Emergency sessions automatically expire after 15 minutes of inactivity."
          color="primary"
        />
        <TrustItem
          icon={FileSignature}
          text="All emergency recovery actions are cryptographically signed & logged."
          color="warning"
          warning
        />
      </div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  text,
  color,
  warning,
}: {
  icon: typeof ShieldCheck;
  text: string;
  color: 'success' | 'primary' | 'warning';
  warning?: boolean;
}) {
  const colorMap = {
    success: 'text-success bg-success/10 ring-success/20',
    primary: 'text-primary bg-primary/10 ring-primary/20',
    warning: 'text-warning bg-warning/10 ring-warning/20',
  };
  const prefix = warning ? '!' : '\u2713';

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card/40 px-3.5 py-2.5 backdrop-blur-sm transition-colors hover:border-border">
      <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ring-1', colorMap[color])}>
        {prefix}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
