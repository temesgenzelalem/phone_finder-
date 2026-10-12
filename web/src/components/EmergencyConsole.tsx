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
  Send,
  Loader2,
  Radio,
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
        setTimeRemaining('Session Expired');
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
      // Immediately refresh command status
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

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Emergency Session Header */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">Active Emergency Session</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-md bg-red-950 text-red-300 border border-red-800">
                LIVE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Tag: <span className="text-slate-200 font-semibold">{device.phone_tag}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          {/* Expiration timer */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Expires in {timeRemaining}</span>
          </div>

          {/* End session button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white rounded-xl border border-red-600/30 text-xs font-semibold transition-all active:scale-95"
            title="Terminate emergency session immediately and wipe token"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Session</span>
          </button>
        </div>
      </header>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : 'bg-red-950/40 border-red-800/80 text-red-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-snug">{actionMessage.text}</div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Telemetry Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Device Info */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center space-x-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Device Model</span>
            </span>
            <div className="flex items-center space-x-1">
              {device.is_online_heuristic ? (
                <span className="inline-flex items-center text-[10px] text-emerald-400 font-medium">
                  <Wifi className="w-3 h-3 mr-1" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] text-slate-400 font-medium">
                  <WifiOff className="w-3 h-3 mr-1" /> Offline
                </span>
              )}
            </div>
          </div>
          <p className="text-base font-bold text-white truncate">
            {device.device_model || 'Android Device'}
          </p>
          <p className="text-[11px] text-slate-500">
            Last seen: {formatRelativeTime(device.last_telemetry_at)}
          </p>
        </div>

        {/* Battery Telemetry */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center space-x-1.5">
              {device.is_charging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Battery className="w-3.5 h-3.5" />
              )}
              <span>Battery Level</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {device.is_charging ? 'Charging' : 'On Battery'}
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl font-bold font-mono ${
                device.battery_level !== null && device.battery_level < 20
                  ? 'text-red-400'
                  : device.battery_level !== null && device.battery_level < 50
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {device.battery_level !== null ? `${device.battery_level}%` : 'N/A'}
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                device.battery_level !== null && device.battery_level < 20
                  ? 'bg-red-500'
                  : device.battery_level !== null && device.battery_level < 50
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${device.battery_level || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Location Fix Freshness */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>GPS Precision</span>
            </span>
            <button
              onClick={() => fetchStatus(true)}
              className="hover:text-white transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-base font-bold text-white">
            {location?.accuracy || location?.accuracy_meters
              ? `±${Math.round((location.accuracy ?? location.accuracy_meters)!)} meters`
              : 'Unknown'}
          </p>
          <p className="text-[11px] text-slate-500">
            Fix source: {location ? `${(location.source || location.trigger_type || 'GPS').toUpperCase()} (${formatRelativeTime(location.recorded_at)})` : 'None'}
          </p>
        </div>
      </div>

      {/* Main Interactive Map Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-400" />
              <span>Live Location Tracking</span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive OpenStreetMap tracking protected device coordinates and accuracy radius.
            </p>
          </div>
          {location && (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </span>
          )}
        </div>

        {/* Map View */}
        <div className="h-[440px] w-full">
          <EmergencyMap location={location} />
        </div>
      </div>

      {/* Emergency Remote Actions (Command Buttons) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Send className="w-4 h-4 text-red-400" />
            <span>Remote Recovery Commands</span>
          </h3>
          <p className="text-xs text-slate-400">
            Dispatches high-priority Firebase Cloud Messaging payload wakeups directly to the device.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Siren Button */}
          <button
            onClick={() => handleSendCommand('ring')}
            disabled={isDispatching !== null}
            className="flex flex-col items-center justify-center p-5 rounded-xl bg-amber-950/20 hover:bg-amber-950/40 border border-amber-600/30 hover:border-amber-500 text-left transition-all active:scale-[0.98] disabled:opacity-50 space-y-3 group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              {isDispatching === 'ring' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Bell className="w-6 h-6" />
              )}
            </div>
            <div className="text-center space-y-1">
              <div className="font-semibold text-white text-sm">Sound Siren</div>
              <div className="text-[11px] text-slate-400">
                Override volume and sound maximum-volume emergency siren for 2 minutes.
              </div>
            </div>
          </button>

          {/* Lock Device Button */}
          <button
            onClick={() => handleSendCommand('lock')}
            disabled={isDispatching !== null}
            className="flex flex-col items-center justify-center p-5 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-600/30 hover:border-red-500 text-left transition-all active:scale-[0.98] disabled:opacity-50 space-y-3 group"
          >
            <div className="w-12 h-12 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              {isDispatching === 'lock' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>
            <div className="text-center space-y-1">
              <div className="font-semibold text-white text-sm">Lock Screen</div>
              <div className="text-[11px] text-slate-400">
                Instantly invoke Android Device Policy Manager to lock phone display.
              </div>
            </div>
          </button>

          {/* Locate Phone Button */}
          <button
            onClick={() => handleSendCommand('locate')}
            disabled={isDispatching !== null}
            className="flex flex-col items-center justify-center p-5 rounded-xl bg-blue-950/20 hover:bg-blue-950/40 border border-blue-600/30 hover:border-blue-500 text-left transition-all active:scale-[0.98] disabled:opacity-50 space-y-3 group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              {isDispatching === 'locate' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Compass className="w-6 h-6" />
              )}
            </div>
            <div className="text-center space-y-1">
              <div className="font-semibold text-white text-sm">Locate Phone</div>
              <div className="text-[11px] text-slate-400">
                Trigger foreground GPS service to take a fresh GPS fix and upload location.
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Live Command Execution Tracker */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Live Command Dispatch Tracker</span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time lifecycle of issued recovery commands (polling every 5s).
            </p>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {commands.length} Commands
          </span>
        </div>

        {commands.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            No recovery commands issued during this session yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Command</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Issued</th>
                  <th className="py-2.5 px-3">Device Ack</th>
                  <th className="py-2.5 px-3">Execution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {commands.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white uppercase flex items-center space-x-1.5">
                      {cmd.command_type === 'ring' && <Bell className="w-3.5 h-3.5 text-amber-400 inline" />}
                      {cmd.command_type === 'lock' && <Lock className="w-3.5 h-3.5 text-red-400 inline" />}
                      {cmd.command_type === 'locate' && <Compass className="w-3.5 h-3.5 text-blue-400 inline" />}
                      <span>{cmd.command_type}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          cmd.status === 'EXECUTED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : cmd.status === 'DELIVERED'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : cmd.status === 'PENDING'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            : cmd.status === 'FAILED'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {cmd.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {formatRelativeTime(cmd.created_at)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {cmd.acknowledged_at ? formatRelativeTime(cmd.acknowledged_at) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {cmd.executed_at ? formatRelativeTime(cmd.executed_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Notice Footer */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 text-center text-xs text-slate-500">
        All recovery actions, IP addresses, and timestamps are recorded in the immutable Phone Finder audit log.
      </div>
    </div>
  );
}
