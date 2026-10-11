'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
        Initializing Phone Finder Emergency Web Console...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-red-500/20 selection:text-red-300">
      {/* Top Navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-bold tracking-tight text-white text-base">Phone Finder</span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-900">
                Emergency Mode
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            Consent-Based Android Recovery Platform
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        Phone Finder &copy; 2026. Zero Paid APIs. Powered by OpenStreetMap &amp; Leaflet.
      </footer>
    </div>
  );
}
