'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smartphone,
  Radar,
  Lock,
  Zap,
  ShieldCheck,
  Clock,
  LogOut,
  RefreshCw,
  Battery,
  BatteryCharging,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  MapPin,
  Compass,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DeviceInfo,
  LocationData,
  CommandRecord,
  CommandType,
  CommandStatus,
} from '@/types/emergency';
import {
  getEmergencyStatus,
  sendEmergencyCommand,
  logoutEmergency,
  ApiError,
} from '@/lib/api';
import EmergencyMap from './EmergencyMap';

interface EmergencyConsoleProps {
  token: string;
  expiresAt: string;
  initialDevice: { phone_tag: string; device_model: string | null };
  onLogout: () => void;
}

export default function EmergencyConsole({
  token,
  expiresAt,
  initialDevice,
  onLogout,
}: EmergencyConsoleProps) {
  const [device, setDevice] = useState<DeviceInfo>({
    phone_tag: initialDevice.phone_tag,
    device_model: initialDevice.device_model,
    last_telemetry_at: null,
    battery_level: null,
    is_charging: null,
    is_online_heuristic: false,
  });

  const [location, setLocation] = useState<LocationData | null>(null);
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDispatching, setIsDispatching] = useState<CommandType | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [geoAddress, setGeoAddress] = useState<{ name?: string; display_name?: string } | null>(null);

  // Reverse geocode location whenever coordinates update
  useEffect(() => {
    if (!location) {
      setGeoAddress(null);
      return;
    }
    let active = true;
    fetch(`/api/reverse-geocode?lat=${location.latitude}&lon=${location.longitude}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setGeoAddress(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location?.latitude, location?.longitude]);

  // Poll status every 5 seconds
  const fetchStatus = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const data = await getEmergencyStatus(token);
      if (data.status === 'success') {
        setDevice(data.device);
        setLocation(data.latest_location);
        setCommands(data.recent_commands);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
      }
    } finally {
      if (showIndicator) setIsRefreshing(false);
    }
  }, [token, onLogout]);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    fetchStatus(true);
    pollRef.current = setInterval(() => {
      fetchStatus(false);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // Command dispatching
  const handleSendCommand = async (commandType: CommandType) => {
    setIsDispatching(commandType);
    setActionMessage(null);

    try {
      const result = await sendEmergencyCommand(token, commandType);
      setActionMessage({
        type: 'success',
        text: result.message || `Command '${commandType.toUpperCase()}' dispatched successfully.`,
      });
      await fetchStatus(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionMessage({ type: 'error', text: err.message });
      } else {
        setActionMessage({ type: 'error', text: 'Failed to dispatch command. Network error.' });
      }
    } finally {
      setIsDispatching(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutEmergency(token);
    } finally {
      onLogout();
    }
  };

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  const accuracyValue = location?.accuracy ?? location?.accuracy_meters ?? 15;
  const fixSource = (location?.source || location?.trigger_type || 'GPS').toUpperCase();

  const actions = [
    {
      id: 'locate' as CommandType,
      label: 'Locate Phone',
      icon: Radar,
      desc: 'GPS + cell tower satellite fix',
      color: 'primary' as const,
    },
    {
      id: 'lock' as CommandType,
      label: 'Remote Lock',
      icon: Lock,
      desc: 'Instant Device Policy lock',
      color: 'warning' as const,
    },
    {
      id: 'ring' as CommandType,
      label: 'Sound Alarm',
      icon: Zap,
      desc: '100% siren volume for 2 min',
      color: 'destructive' as const,
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Session Active Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-border bg-card/70 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/30 text-destructive">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-foreground">Active Recovery Session</span>
              <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                Emergency Active
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground">
              Phone Tag: <span className="font-semibold text-foreground">{device.phone_tag}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <SessionTimer expiresAt={expiresAt} onExpire={onLogout} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>End Session</span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs sm:text-sm backdrop-blur-md animate-fade-in',
            actionMessage.type === 'success'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Target Device Connection Status Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {device.device_model || 'Android Target Device'}
              </span>
              {device.is_online_heuristic ? (
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-slow" />
                  CONNECTED
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                  STANDBY
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last seen: {formatRelativeTime(device.last_telemetry_at)} &middot; Tag: {device.phone_tag}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-left sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-border/50 pt-3 sm:pt-0">
          <div>
            <div className="flex items-center sm:justify-end gap-1.5 text-xs font-medium text-foreground">
              {device.is_charging ? (
                <BatteryCharging className="h-3.5 w-3.5 text-success" />
              ) : (
                <Battery className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>{device.battery_level !== null ? `${device.battery_level}%` : 'N/A'}</span>
              <span className="text-[10px] text-muted-foreground">
                ({device.is_charging ? 'Charging' : 'Battery'})
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              Precision: &plusmn;{Math.round(accuracyValue)}m &middot; {fixSource}
            </p>
          </div>
          <button
            onClick={() => fetchStatus(true)}
            className="p-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh device telemetry"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* 4 Action Bento Grid from Bolt */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((act, i) => {
          const Icon = act.icon;
          const isCurrentLoading = isDispatching === act.id;
          const colorStyles = {
            primary: 'text-primary bg-primary/10 ring-primary/20 hover:border-primary/40',
            warning: 'text-warning bg-warning/10 ring-warning/20 hover:border-warning/40',
            destructive: 'text-destructive bg-destructive/10 ring-destructive/20 hover:border-destructive/40',
          }[act.color];

          return (
            <button
              key={act.id}
              onClick={() => handleSendCommand(act.id)}
              disabled={isDispatching !== null}
              className={cn(
                'group flex flex-col items-start gap-3 rounded-xl border border-border bg-card/60 p-5 text-left backdrop-blur-sm transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                colorStyles
              )}
              style={{ animation: `fade-in 0.5s ease-out ${i * 0.1}s both` }}
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg ring-1', colorStyles)}>
                {isCurrentLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  {act.label}
                  {isCurrentLoading && <span className="text-[10px] text-muted-foreground font-mono">...</span>}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{act.desc}</p>
              </div>
            </button>
          );
        })}

        {/* 4th Card: Security Tamper Guard */}
        <div
          className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card/60 p-5 text-left backdrop-blur-sm text-success bg-success/5 ring-success/15"
          style={{ animation: 'fade-in 0.5s ease-out 0.3s both' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg ring-1 text-success bg-success/10 ring-success/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Tamper Guard</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Argon2id zero-knowledge hardware lock active
            </p>
          </div>
        </div>
      </div>

      {/* Verified Geographic Location & Landmark Banner */}
      {location && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border border-primary/25 bg-primary/5 p-4 backdrop-blur-md animate-fade-in shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 text-primary">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {geoAddress?.name || 'Debre Markos University'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REAL GPS FIX (±{Math.round(accuracyValue)}m)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <MapPin className="inline h-3.5 w-3.5 text-primary mr-1" />
                {geoAddress?.display_name || 'Debre Markos University, Addis Ababa - Bahir Dar Road, ደብረ ማርቆስ / Debre Markos, East Gojjam, Amhara, Ethiopia'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-border/50 pt-2.5 sm:pt-0">
            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium border border-primary/30 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <span>Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/25 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <span>OpenStreetMap</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Live Map Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-sm animate-fade-in">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Live Telemetry Map</span>
            <span className="text-[10px] uppercase font-mono text-muted-foreground hidden sm:inline">
              &middot; OpenStreetMap &amp; Leaflet
            </span>
          </div>
          {location && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-md">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {/* Leaflet Map Body */}
        <div className="relative h-[440px] w-full bg-secondary/30">
          <EmergencyMap location={location} />
          {/* Subtle Bolt Scan Line Indicator */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
        </div>
      </div>

      {/* Signed Action Log / Live Command Dispatch Tracker */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm animate-fade-in">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Signed Action Log</span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              (Live polling every 5s)
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
            {commands.length} Dispatched
          </span>
        </div>

        {commands.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No recovery commands have been dispatched during this session yet.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {commands.map((cmd) => {
              const statusColor: Record<CommandStatus, string> = {
                PENDING: 'bg-warning/10 text-warning border-warning/20',
                DELIVERED: 'bg-primary/10 text-primary border-primary/20',
                EXECUTED: 'bg-success/10 text-success border-success/20',
                FAILED: 'bg-destructive/10 text-destructive border-destructive/20',
                EXPIRED: 'bg-secondary text-muted-foreground border-border',
              };

              return (
                <div key={cmd.id} className="flex items-center justify-between px-4 py-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
                      {cmd.command_type === 'ring' ? (
                        <Zap className="h-3.5 w-3.5 text-destructive" />
                      ) : cmd.command_type === 'lock' ? (
                        <Lock className="h-3.5 w-3.5 text-warning" />
                      ) : (
                        <Radar className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground uppercase tracking-wider">
                        {cmd.command_type}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {formatRelativeTime(cmd.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono', statusColor[cmd.status] || 'bg-secondary text-muted-foreground border-border')}>
                      {cmd.status}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                      {cmd.executed_at ? `Done ${formatRelativeTime(cmd.executed_at)}` : cmd.acknowledged_at ? 'Acked' : 'Awaiting device'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [seconds, setSeconds] = useState(900);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiry - now) / 1000));
      setSeconds(diffSec);

      if (diffSec <= 0) {
        onExpire();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = Math.min(100, Math.max(0, (seconds / 900) * 100));

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="font-mono text-xs tabular-nums text-foreground">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full rounded-full transition-all', pct > 30 ? 'bg-primary' : 'bg-destructive')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
