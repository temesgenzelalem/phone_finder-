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
  Map as MapIcon,
  Layers,
  MapPin,
  Building2,
} from 'lucide-react';

interface EmergencyMapInnerProps {
  location: LocationData;
}

interface GeocodedAddress {
  name?: string;
  display_name?: string;
  address?: {
    amenity?: string;
    road?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// Controller to smoothly pan map when coordinates change
function MapRecenter({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
  }, [lat, lng, trigger, map]);
  return null;
}

// Custom animated pulsing tactical beacon marker
const createTacticalBeaconIcon = () => {
  return L.divIcon({
    className: 'custom-pulsing-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <!-- Outer radar ring -->
        <div class="radar-beacon-ring" style="
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.4);
          border: 2px solid rgba(56, 189, 248, 0.85);
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
        <!-- Inner pulsing core -->
        <div style="
          position: absolute;
          top: 10px;
          left: 10px;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(14, 165, 233, 0.95), 0 4px 8px -1px rgba(0, 0, 0, 0.6);
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
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite' | 'dark'>('osm');
  const [geocoded, setGeocoded] = useState<GeocodedAddress | null>(null);

  // Fetch reverse geocoded real address from OpenStreetMap Nominatim
  useEffect(() => {
    let isCancelled = false;
    async function loadAddress() {
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setGeocoded(data);
          }
        }
      } catch {
        // Silently retain coordinates if geocoding is unavailable
      }
    }
    loadAddress();
    return () => {
      isCancelled = true;
    };
  }, [latitude, longitude]);

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
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

  const landmarkTitle = geocoded?.name || geocoded?.address?.amenity || 'Debre Markos University Area';
  const displayAddress = geocoded?.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#090d16]">
      <MapContainer
        center={[latitude, longitude]}
        zoom={17}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[480px]"
        attributionControl={true}
      >
        {/* Layer 1: OpenStreetMap Standard with street & campus labels */}
        {mapLayer === 'osm' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        {/* Layer 2: Real High-Resolution Satellite Imagery */}
        {mapLayer === 'satellite' && (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        )}

        {/* Layer 3: Tactical Dark Matter */}
        {mapLayer === 'dark' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
        )}

        {/* Recenter controller */}
        <MapRecenter lat={latitude} lng={longitude} trigger={recenterCount} />

        {/* Accuracy radius circle */}
        {accuracy > 0 && (
          <Circle
            center={[latitude, longitude]}
            radius={accuracy}
            pathOptions={{
              color: '#0284c7',
              fillColor: '#38bdf8',
              fillOpacity: 0.18,
              weight: 2,
              dashArray: '6, 6',
            }}
          />
        )}

        {/* Phone GPS Marker */}
        <Marker position={[latitude, longitude]} icon={markerIcon}>
          <Popup className="custom-leaflet-popup">
            <div className="p-3.5 text-slate-900 text-xs space-y-2.5 font-sans min-w-[260px] max-w-[320px]">
              <div className="flex items-center space-x-2 font-semibold text-blue-700 border-b border-slate-200 pb-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-sm font-bold text-slate-900">{landmarkTitle}</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-[11px] text-blue-900 leading-snug">
                <div className="flex items-start space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{displayAddress}</span>
                </div>
              </div>

              <div className="text-[12px] space-y-1 text-slate-600 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Latitude:</span>
                  <span className="font-mono font-medium text-slate-800">{latitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Longitude:</span>
                  <span className="font-mono font-medium text-slate-800">{longitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GPS Precision:</span>
                  <span className="font-bold text-emerald-600">±{Math.round(accuracy)} meters</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telemetry Trigger:</span>
                  <span className="font-medium text-sky-700">{source}</span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 pt-2 border-t border-slate-200">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{formattedDate}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium flex items-center justify-center space-x-1 shadow-sm transition-colors no-underline"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium flex items-center justify-center space-x-1 shadow-sm transition-colors no-underline"
                >
                  <span>OpenStreetMap</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating Top-Left: Map Layer Switcher */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center bg-[#0b101d]/90 backdrop-blur-md p-1 rounded-xl border border-white/[0.1] shadow-xl text-xs">
        <button
          onClick={() => setMapLayer('osm')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            mapLayer === 'osm'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Street Map
        </button>
        <button
          onClick={() => setMapLayer('satellite')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            mapLayer === 'satellite'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapLayer('dark')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            mapLayer === 'dark'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Dark
        </button>
      </div>

      {/* Floating Tactical Top-Right HUD Badge */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center space-x-2">
        <div className="bg-[#0b101d]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/[0.1] text-xs text-slate-200 shadow-xl flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-mono tracking-wider font-semibold text-sky-300">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">(±{Math.round(accuracy)}m)</span>
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

      {/* Floating Bottom: Verified Landmark & Navigation Bar */}
      <div className="absolute bottom-3 inset-x-3 z-[1000] flex flex-col sm:flex-row items-center justify-between gap-2 pointer-events-none">
        <div className="bg-[#0b101d]/95 backdrop-blur-md px-4 py-2 rounded-xl border border-white/[0.12] shadow-2xl pointer-events-auto flex items-center space-x-2.5 max-w-full sm:max-w-[70%]">
          <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="truncate text-xs">
            <span className="font-semibold text-white mr-1.5">{landmarkTitle}:</span>
            <span className="text-slate-300 truncate">{displayAddress}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 pointer-events-auto">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0b101d]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/[0.12] text-xs text-sky-300 hover:text-white hover:bg-blue-600/30 flex items-center space-x-1.5 shadow-xl transition-all"
          >
            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
