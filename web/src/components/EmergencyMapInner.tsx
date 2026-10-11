'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationData } from '@/types/emergency';
import { Navigation, Clock, ShieldCheck } from 'lucide-react';

interface EmergencyMapInnerProps {
  location: LocationData;
}

// Controller to smoothly pan map when coordinates change
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
  }, [lat, lng, map]);
  return null;
}

// Custom animated pulsing beacon marker icon
const createPulsingIcon = () => {
  return L.divIcon({
    className: 'custom-pulsing-marker',
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 36px;
          height: 36px;
          background-color: rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          width: 18px;
          height: 18px;
          background-color: #2563eb;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

export default function EmergencyMapInner({ location }: EmergencyMapInnerProps) {
  const { latitude, longitude, accuracy, recorded_at, source } = location;
  const markerIcon = createPulsingIcon();

  const formattedDate = new Date(recorded_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden shadow-inner border border-slate-700">
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[420px]"
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        
        {/* Recenter controller */}
        <MapRecenter lat={latitude} lng={longitude} />

        {/* Accuracy radius circle */}
        {accuracy && accuracy > 0 && (
          <Circle
            center={[latitude, longitude]}
            radius={accuracy}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#60a5fa',
              fillOpacity: 0.15,
              weight: 1.5,
              dashArray: '4, 4',
            }}
          />
        )}

        {/* Phone GPS Marker */}
        <Marker position={[latitude, longitude]} icon={markerIcon}>
          <Popup className="custom-leaflet-popup">
            <div className="p-2 text-slate-900 text-xs space-y-1.5 font-sans">
              <div className="flex items-center space-x-1.5 font-semibold text-blue-700">
                <Navigation className="w-3.5 h-3.5" />
                <span>Protected Device Location</span>
              </div>
              <div className="text-[11px] text-slate-700">
                <div><strong>Coordinates:</strong> {latitude.toFixed(6)}, {longitude.toFixed(6)}</div>
                {accuracy && <div><strong>Accuracy:</strong> ±{accuracy.toFixed(1)} meters</div>}
                <div><strong>Provider:</strong> {source.toUpperCase()}</div>
              </div>
              <div className="flex items-center space-x-1 text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                <Clock className="w-3 h-3" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating coordinates badge */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 shadow-lg flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="font-mono">{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
        {accuracy && (
          <span className="text-slate-400 text-[11px]">(±{Math.round(accuracy)}m)</span>
        )}
      </div>
    </div>
  );
}
