'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  LogOut,
  Smartphone,
  Battery,
  BatteryCharging,
  Wifi,
  WifiOff,
  Bell,
  Lock,
  Compass,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Radio,
  Zap,
  Activity,
  Satellite,
  Volume2,
  Shield,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import {
  DeviceInfo,
  LocationData,
  CommandRecord,
  CommandType,
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
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Countdown timer for emergency session expiration
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, expiry - now);

      if (diff <= 0) {
        setTimeRemaining('Expired');
        onLogout();
        return;
      }

      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onLogout]);

  // Fetch status callback
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

  // Polling loop every 5 seconds for live status updates
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

  // Handle Command Dispatch
  const handleSendCommand = async (commandType: CommandType) => {
    setIsDispatching(commandType);
    setActionMessage(null);

    try {
      const result = await sendEmergencyCommand(token, commandType);
      setActionMessage({
        type: 'success',
        text: result.message || `Command '${commandType}' successfully dispatched to push queue.`,
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

  // Handle Session Logout
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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header Card */}
      <header className="bg-[#0b101d]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500 via-amber-500 to-sky-500 opacity-60" />

        <div className="flex items-center space-x-3.5 w-full sm:w-auto">
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/20">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">Active Emergency Session</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Assigned Tag: <span className="text-sky-300 font-semibold">{device.phone_tag}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          {/* Expiration timer */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#070b14] rounded-xl border border-white/[0.08] text-xs font-mono text-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Expires in {timeRemaining}</span>
          </div>

          {/* End session button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl border border-rose-500/25 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="Terminate emergency session immediately and wipe token"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Wipe Session</span>
          </button>
        </div>
      </header>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs sm:text-sm animate-in fade-in duration-200 backdrop-blur-md shadow-lg ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium leading-snug">{actionMessage.text}</div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded-lg hover:bg-white/[0.05]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Telemetry Status Cards (3 Bento Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Device Connectivity */}
        <div className="bg-[#0b101d]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-white/[0.15] transition-all shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center space-x-2 font-medium text-slate-300">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>Target Device</span>
            </span>
            <div>
              {device.is_online_heuristic ? (
                <span className="inline-flex items-center text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Wifi className="w-3 h-3 mr-1" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] text-slate-400 font-semibold bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.08]">
                  <WifiOff className="w-3 h-3 mr-1" /> Standby
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-white tracking-tight truncate">
              {device.device_model || 'Android Device'}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1.5">
              <Activity className="w-3 h-3 text-sky-400" />
              <span>Last heartbeat: {formatRelativeTime(device.last_telemetry_at)}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Battery Intelligence */}
        <div className="bg-[#0b101d]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-white/[0.15] transition-all shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center space-x-2 font-medium text-slate-300">
              {device.is_charging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              ) : (
                <Battery className="w-4 h-4 text-amber-400" />
              )}
              <span>Battery Status</span>
            </span>
            <span className="text-[10px] text-slate-300 font-medium bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.08] flex items-center gap-1">
              {device.is_charging && <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />}
              {device.is_charging ? 'Charging' : 'On Battery'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span
                className={`text-2xl font-black font-mono tracking-tight ${
                  device.battery_level !== null && device.battery_level < 20
                    ? 'text-rose-400'
                    : device.battery_level !== null && device.battery_level < 50
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {device.battery_level !== null ? `${device.battery_level}%` : 'N/A'}
              </span>
              <span className="text-[11px] text-slate-500">
                {device.battery_level !== null && device.battery_level < 20
                  ? 'Urgent: Low Battery'
                  : 'Normal Consumption'}
              </span>
            </div>

            <div className="w-full bg-[#070b14] rounded-full h-2 overflow-hidden p-0.5 border border-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  device.battery_level !== null && device.battery_level < 20
                    ? 'bg-rose-500 shadow-sm shadow-rose-500'
                    : device.battery_level !== null && device.battery_level < 50
                    ? 'bg-amber-500 shadow-sm shadow-amber-500'
                    : 'bg-emerald-500 shadow-sm shadow-emerald-500'
                }`}
                style={{ width: `${device.battery_level || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: GPS Satellite Precision */}
        <div className="bg-[#0b101d]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-white/[0.15] transition-all shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center space-x-2 font-medium text-slate-300">
              <Satellite className="w-4 h-4 text-blue-400" />
              <span>Satellite Precision</span>
            </span>
            <button
              onClick={() => fetchStatus(true)}
              className="p-1 hover:bg-white/[0.08] rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">
                ±{Math.round(accuracyValue)}m
              </span>
              <span className="text-xs text-emerald-400 font-medium">Optimal Fix</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1.5">
              <Compass className="w-3 h-3 text-sky-400" />
              <span>
                Trigger: <strong className="text-slate-200">{fixSource}</strong> ({formatRelativeTime(location?.recorded_at || null)})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Hero Interactive Map Section */}
      <div className="bg-[#0b101d]/85 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
              <span>Tactical Satellite Tracking Grid</span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time OpenStreetMap telemetry powered by high-precision GPS satellite chip.
            </p>
          </div>
          {location && (
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-xs font-mono text-sky-300 bg-sky-500/10 px-3 py-1 rounded-xl border border-sky-500/20">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </span>
            </div>
          )}
        </div>

        {/* Map View */}
        <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-white/[0.06]">
          <EmergencyMap location={location} />
        </div>
      </div>

      {/* Emergency Remote Commands (Command Center Cards) */}
      <div className="bg-[#0b101d]/85 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        <div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">Emergency Remote Security Dispatch</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Issues instant high-priority hardware directives directly to your device via Google Firebase Cloud Messaging.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Siren Alarm */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-orange-500/5 to-transparent border border-rose-500/20 hover:border-rose-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 group-hover:scale-105 transition-transform shadow-lg shadow-rose-950/20">
                <Volume2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Emergency Siren</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Sounds a piercing 100% maximum volume siren alarm for 2 minutes. Overrides Silent and Do Not Disturb.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleSendCommand('ring')}
              disabled={isDispatching !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 border border-rose-400/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {isDispatching === 'ring' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Sound Siren Alarm</span>
                </>
              )}
            </button>
          </div>

          {/* Action 2: Lock Device */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 group-hover:scale-105 transition-transform shadow-lg shadow-purple-950/20">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Hardware Screen Lock</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Instantly locks the screen via Android Device Policy Manager to prevent thieves from accessing banking and private data.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleSendCommand('lock')}
              disabled={isDispatching !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/20 border border-purple-400/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {isDispatching === 'lock' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Lock Device Screen</span>
                </>
              )}
            </button>
          </div>

          {/* Action 3: Locate Device */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-transparent border border-sky-500/20 hover:border-sky-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 group-hover:scale-105 transition-transform shadow-lg shadow-sky-950/20">
                <Satellite className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Force GPS Ping</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Wakes up the Android LocationForegroundService to capture an immediate high-precision satellite coordinate reading.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleSendCommand('locate')}
              disabled={isDispatching !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-sky-600/20 border border-sky-400/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {isDispatching === 'locate' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transmitting...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  <span>Request Fresh GPS Fix</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Command Execution Timeline Tracker */}
      <div className="bg-[#0b101d]/85 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Incident Command Stream</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live lifecycle state transitions: PENDING &rarr; DISPATCHED &rarr; EXECUTED (auto-refreshing every 5s).
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.08]">
            {commands.length} Commands Dispatched
          </span>
        </div>

        {commands.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-white/[0.08] rounded-2xl">
            No recovery directives have been dispatched during this session yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-3.5 rounded-2xl bg-[#070b14]/70 border border-white/[0.06] hover:border-white/[0.12] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      cmd.command_type === 'ring'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                        : cmd.command_type === 'lock'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/25'
                    }`}
                  >
                    {cmd.command_type === 'ring' && <Bell className="w-4 h-4" />}
                    {cmd.command_type === 'lock' && <Lock className="w-4 h-4" />}
                    {cmd.command_type === 'locate' && <Compass className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white uppercase tracking-wider text-xs font-mono">
                        {cmd.command_type}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">#{cmd.id.slice(0, 8)}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Issued {formatRelativeTime(cmd.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider font-mono ${
                      cmd.status === 'EXECUTED'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : cmd.status === 'DELIVERED'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        : cmd.status === 'PENDING'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                        : cmd.status === 'FAILED'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-white/[0.05] text-slate-400 border border-white/[0.08]'
                    }`}
                  >
                    {cmd.status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-ping" />}
                    {cmd.status === 'EXECUTED' && <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />}
                    {cmd.status}
                  </span>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {cmd.executed_at ? `Done ${formatRelativeTime(cmd.executed_at)}` : 'Waiting for device ACK'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Notice Footer */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>All recovery actions, IP addresses, and cryptographic signatures are immutably logged to the audit ledger.</span>
      </div>
    </div>
  );
}
