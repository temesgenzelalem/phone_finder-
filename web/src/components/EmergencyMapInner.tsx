'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationData } from '@/types/emergency';
import {
  Navigation,
  Clock,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  LocateFixed,
  Crosshair,
} from 'lucide-react';

interface EmergencyMapInnerProps {
  location: LocationData;
}

// Controller to smoothly pan map when coordinates change
function MapRecenter({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
  }, [lat, lng, trigger, map]);
  return null;
}

// Custom animated pulsing tactical beacon marker
const createTacticalBeaconIcon = () => {
  return L.divIcon({
    className: 'custom-pulsing-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; items-center; justify-content: center;">
        <!-- Outer radar ring -->
        <div class="radar-beacon-ring" style="
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.35);
          border: 1px solid rgba(56, 189, 248, 0.7);
        "></div>
        <!-- Inner pulsing core -->
        <div style="
          position: absolute;
          top: 11px;
          left: 11px;
          width: 22px;
          height: 22px;
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(14, 165, 233, 0.9), 0 4px 6px -1px rgba(0, 0, 0, 0.5);
        "></div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

export default function EmergencyMapInner({ location }: EmergencyMapInnerProps) {
  const { latitude, longitude, recorded_at } = location;
  const accuracy = location.accuracy ?? location.accuracy_meters ?? 15;
  const source = (location.source || location.trigger_type || 'GPS').toUpperCase();
  const markerIcon = createTacticalBeaconIcon();

  const [copiedCoords, setCopiedCoords] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  const formattedDate = new Date(recorded_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#090d16]">
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[480px]"
        attributionControl={true}
      >
        {/* CartoDB Dark Matter Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Recenter controller */}
        <MapRecenter lat={latitude} lng={longitude} trigger={recenterCount} />

        {/* Accuracy radius circle */}
        {accuracy > 0 && (
          <Circle
            center={[latitude, longitude]}
            radius={accuracy}
            pathOptions={{
              color: '#38bdf8',
              fillColor: '#0ea5e9',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* Phone GPS Marker */}
        <Marker position={[latitude, longitude]} icon={markerIcon}>
          <Popup className="custom-leaflet-popup">
            <div className="p-3.5 text-slate-100 text-xs space-y-2 font-sans min-w-[220px]">
              <div className="flex items-center space-x-2 font-semibold text-sky-400 border-b border-white/[0.08] pb-2">
                <Navigation className="w-4 h-4 text-sky-400" />
                <span className="text-sm">Protected Device</span>
              </div>
              <div className="text-[12px] space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Latitude:</span>
                  <span className="font-mono font-medium">{latitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Longitude:</span>
                  <span className="font-mono font-medium">{longitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Precision:</span>
                  <span className="font-medium text-emerald-400">±{Math.round(accuracy)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trigger:</span>
                  <span className="font-medium text-sky-300">{source}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 pt-2 border-t border-white/[0.08]">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{formattedDate}</span>
              </div>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-[11px] font-medium flex items-center justify-center space-x-1.5 transition-colors no-underline"
              >
                <span>Navigate in Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating Tactical Top-Right HUD Badge */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center space-x-2">
        <div className="bg-[#0b101d]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/[0.1] text-xs text-slate-200 shadow-xl flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-mono tracking-wider font-semibold text-sky-300">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
          <span className="text-slate-500 font-mono text-[11px]">(±{Math.round(accuracy)}m)</span>
          <button
            onClick={handleCopyCoords}
            className="p-1 hover:bg-white/[0.1] rounded-md transition-colors text-slate-400 hover:text-white"
            title="Copy coordinates"
          >
            {copiedCoords ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          onClick={() => setRecenterCount((c) => c + 1)}
          className="bg-[#0b101d]/90 backdrop-blur-md p-2 rounded-xl border border-white/[0.1] text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all shadow-xl"
          title="Recenter map on device"
        >
          <LocateFixed className="w-4 h-4 text-sky-400" />
        </button>
      </div>

      {/* Floating Bottom Navigation Badge */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#0b101d]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/[0.1] text-[11px] text-slate-300 hover:text-white flex items-center space-x-1.5 shadow-lg transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          <span>Open Full Navigation View</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
}
