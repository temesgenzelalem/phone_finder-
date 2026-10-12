'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Radio, Lock } from 'lucide-react';
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
      <div className="min-h-screen bg-[#06080f] flex flex-col items-center justify-center text-slate-400 text-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 animate-pulse">
          <Radio className="w-6 h-6 animate-spin" />
        </div>
        <p className="font-mono text-xs tracking-wider uppercase text-slate-500">
          Initializing Secure Phone Finder Portal...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-100 flex flex-col relative overflow-x-hidden bg-grid-pattern selection:bg-blue-600/30 selection:text-blue-200">
      {/* Top Ambient Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[340px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      
      {/* Secondary accent glow */}
      <div className="absolute top-[20%] right-[-10%] w-[450px] h-[450px] bg-gradient-to-b from-purple-600/5 to-transparent blur-[140px] pointer-events-none rounded-full" />

      {/* Top Navbar */}
      <nav className="border-b border-white/[0.08] bg-[#06080f]/75 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-[1px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-[#090d18] rounded-[11px] flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-white text-base">Phone Finder</span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  Tactical Recovery
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Zero-Knowledge Android Telemetry &amp; Security Console
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cloud API: Online</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300">Argon2id Encrypted</span>
            </div>
            
            {session && (
              <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-mono text-blue-300">
                <Lock className="w-3 h-3 text-blue-400" />
                <span>{session.device.phone_tag}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-8 relative z-10 max-w-7xl mx-auto w-full">
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
      <footer className="border-t border-white/[0.06] bg-[#06080f]/80 backdrop-blur-sm py-5 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Phone Finder Production Grid &copy; 2026</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Zero Paid APIs &bull; OpenStreetMap CartoDB Tiles &bull; Render Cloud &bull; Neon PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
}
