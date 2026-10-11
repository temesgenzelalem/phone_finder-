'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { LocationData } from '@/types/emergency';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

const DynamicMap = dynamic(() => import('./EmergencyMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-slate-800 space-y-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <span className="text-sm font-medium">Initializing OpenStreetMap Tiles...</span>
    </div>
  ),
});

interface EmergencyMapProps {
  location: LocationData | null;
}

export default function EmergencyMap({ location }: EmergencyMapProps) {
  if (!location) {
    return (
      <div className="w-full h-96 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-slate-800 p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-200">No Location Recorded Yet</p>
          <p className="text-xs text-slate-400 max-w-sm">
            The device has enrolled but hasn&apos;t uploaded its first GPS fix. Use the <strong>&quot;Locate Phone&quot;</strong> command below to request an immediate live location broadcast.
          </p>
        </div>
      </div>
    );
  }

  return <DynamicMap location={location} />;
}
