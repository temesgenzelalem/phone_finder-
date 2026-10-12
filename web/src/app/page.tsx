'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Lock } from 'lucide-react';
import EmergencyLogin from '@/components/EmergencyLogin';
import EmergencyConsole from '@/components/EmergencyConsole';

interface SessionState {
  token: string;
  expiresAt: string;
  device: {
    phone_tag: string;
    device_model: string | null;
  };
}

const SESSION_STORAGE_KEY = 'pf_emergency_session';

export default function Home() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore session from temporary sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed: SessionState = JSON.parse(stored);
        const expiry = new Date(parsed.expiresAt).getTime();
        if (expiry > Date.now()) {
          setSession(parsed);
        } else {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      // Ignore sessionStorage read errors
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const handleLoginSuccess = (
    token: string,
    expiresAt: string,
    device: { phone_tag: string; device_model: string | null }
  ) => {
    const newSession: SessionState = { token, expiresAt, device };
    setSession(newSession);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch {
      // Ignore sessionStorage write errors
    }
  };

  const handleLogout = () => {
    setSession(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore sessionStorage remove errors
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground text-sm space-y-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary animate-pulse">
          <Smartphone className="h-5 w-5" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/70">
          Loading Security Grid...
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background visual layers from Bolt */}
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none fixed inset-0 radial-fade" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/50 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">Phone Finder</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Recovery Platform</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-[10px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-slow" />
            SYSTEM ONLINE
          </span>
          {session ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" />
              <span>{session.device.phone_tag}</span>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground">v2.4.0</span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex min-h-[calc(100vh-65px)] flex-col justify-center px-4 sm:px-6 py-8">
        {!session ? (
          <EmergencyLogin onLoginSuccess={handleLoginSuccess} />
        ) : (
          <EmergencyConsole
            token={session.token}
            expiresAt={session.expiresAt}
            initialDevice={session.device}
            onLogout={handleLogout}
          />
        )}

        {/* Global Footer */}
        <footer className="mt-8 flex flex-col items-center gap-1 text-center animate-fade-in">
          <p className="text-[11px] text-muted-foreground">
            Phone Finder &copy; 2026 &middot; Zero Paid APIs
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Powered by OpenStreetMap &amp; Leaflet &middot; Argon2id Proof of Possession
          </p>
        </footer>
      </main>
    </div>
  );
}
