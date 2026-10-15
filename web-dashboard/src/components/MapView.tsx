import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  AlertTriangle, 
  Flame, 
  CheckCircle2, 
  Navigation, 
  Eye, 
  X, 
  Compass, 
  Zap,
  Layers
} from 'lucide-react';
import type { RoadDefect } from '../types';
import { SeverityGradientBar } from './SeverityGradientBar';

interface MapViewProps {
  defects: RoadDefect[];
  selectedDefectId?: string | number | null;
  centerCoordinates?: [number, number] | null;
  onSelectDefect: (defect: RoadDefect) => void;
  onOpenInspector: (defect: RoadDefect) => void;
  onUpdateStatus?: (defectId: string | number, status: RoadDefect['status']) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  defects,
  selectedDefectId,
  centerCoordinates,
  onSelectDefect,
  onOpenInspector,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [activeCallout, setActiveCallout] = useState<RoadDefect | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy any existing instance safely to prevent "Map container is already initialized"
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    // Default center on Delhi-NCR / National Highway corridor
    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    // Standard OpenStreetMap tiles (100% free, reliable, no API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Force Leaflet to recalculate container dimensions after render
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Update Markers when defects change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (defects.length === 0) return;

    const bounds: L.LatLngTuple[] = [];

    defects.forEach((d) => {
      bounds.push([d.latitude, d.longitude]);

      const isCritical = d.severity === 'Critical';
      const isModerate = d.severity === 'Moderate';

      const pinBg = isCritical ? '#000000' : isModerate ? '#3f3f46' : '#ffffff';
      const pinBorder = isCritical ? '2px solid #ffffff' : isModerate ? '2px solid #ffffff' : '2px solid #000000';
      const pointerColor = isCritical ? '#000000' : isModerate ? '#3f3f46' : '#000000';
      const iconFill = isCritical ? '#ffffff' : isModerate ? '#ffffff' : '#000000';

      // Inline sharp SVG icons in stark monochrome
      const pinSvg = isCritical
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${iconFill}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
        : isModerate
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${iconFill}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="${iconFill}"><circle cx="12" cy="12" r="10"/></svg>`;

      // Custom Circular Pin matching high-contrast monochrome GIS standards
      const iconHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 16px;
            background-color: ${pinBg};
            border: ${pinBorder};
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${pinSvg}
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid ${pointerColor};
            margin-top: -1px;
          "></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [34, 40],
        iconAnchor: [17, 40],
      });

      const marker = L.marker([d.latitude, d.longitude], { icon: customIcon });

      marker.on('click', () => {
        onSelectDefect(d);
        setActiveCallout(d);
        map.setView([d.latitude, d.longitude], Math.max(map.getZoom(), 14), { animate: true });
      });

      group.addLayer(marker);

      // If selected externally (e.g. from table), pan to marker
      if (selectedDefectId && String(selectedDefectId) === String(d.id)) {
        if (mapInstanceRef.current && (mapContainerRef.current as any)?._leaflet_id) {
          try {
            map.setView([d.latitude, d.longitude], 15, { animate: true });
            setActiveCallout(d);
          } catch {
            // Safe fallback
          }
        }
      }
    });

    if (bounds.length > 0 && !selectedDefectId && !centerCoordinates) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch {
        // Safe fallback
      }
    }
  }, [defects, selectedDefectId, onSelectDefect, centerCoordinates]);

  // Handle external flyTo centerCoordinates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !centerCoordinates || !(mapContainerRef.current as any)?._leaflet_id) return;
    try {
      map.flyTo(centerCoordinates, 14, { animate: true, duration: 1.0 });
    } catch {
      // Safe fallback
    }
  }, [centerCoordinates]);

  // Recenter Handler
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || defects.length === 0) return;
    const bounds = defects.map((d) => [d.latitude, d.longitude] as L.LatLngTuple);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

    return (
    <div className="relative w-full h-full min-h-[560px] rounded-2xl overflow-hidden">
      {/* Real Interactive Leaflet Map Container */}
      <div 
        className="w-full h-full" 
        ref={mapContainerRef}
      />

      {/* Floating Recenter Button */}
      <button
        onClick={handleRecenter}
        className="absolute top-4 right-4 z-[500] bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md rounded-xl px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-slate-800 transition-all cursor-pointer active:scale-95"
        title="Recenter on all surveyed road defects"
      >
        <Compass size={17} className="text-black" />
        <span className="text-xs font-bold text-black">Recenter</span>
      </button>

      {/* Floating Road Severity Legend (Monochrome) */}
      <div className="absolute top-4 left-14 z-[500] bg-white/95 backdrop-blur-sm border border-neutral-200 shadow-md rounded-xl px-3.5 py-2.5 hidden sm:block">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-1.5">
          <Layers size={12} />
          <span>Road Distress Severity</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-black">
            <span className="w-2.5 h-2.5 rounded-full bg-black"></span>
            <span>Critical Crater</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-neutral-800">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600"></span>
            <span>Moderate Distress</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-neutral-700">
            <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-black"></span>
            <span>Mild / Low</span>
          </div>
        </div>
      </div>

      {/* Bottom Floating Callout Card (Monochrome High Contrast) */}
      {activeCallout && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 max-w-xl mx-auto z-[500] bg-white rounded-2xl border border-neutral-200 shadow-2xl p-4 transition-all animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className={`p-2 rounded-xl shrink-0 ${
                activeCallout.severity === 'Critical' 
                  ? 'bg-black text-white' 
                  : activeCallout.severity === 'Moderate' 
                  ? 'bg-neutral-800 text-white' 
                  : 'bg-neutral-200 text-black border border-neutral-300'
              }`}>
                {activeCallout.severity === 'Critical' ? (
                  <Flame size={20} />
                ) : activeCallout.severity === 'Moderate' ? (
                  <AlertTriangle size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-black truncate">{activeCallout.roadName}</h4>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    activeCallout.status === 'Reported' 
                      ? 'bg-black text-white' 
                      : activeCallout.status === 'In Progress' 
                      ? 'bg-neutral-200 text-black border border-neutral-300' 
                      : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}>
                    {activeCallout.status.toUpperCase()}
                  </span>
                  {activeCallout.isNewToday && (
                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-black text-white">
                      NEW TODAY
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate mt-0.5">{activeCallout.landmark} · {activeCallout.wardZone}</p>
              </div>
            </div>

            <button 
              onClick={() => setActiveCallout(null)}
              className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors"
              title="Close Callout"
            >
              <X size={16} />
            </button>
          </div>

          {/* Severity Stepped Bar */}
          <div className="mb-2.5">
            <SeverityGradientBar
              score={activeCallout.severity === 'Critical' ? 90 : activeCallout.severity === 'High' ? 74 : activeCallout.severity === 'Moderate' ? 48 : 22}
              label={activeCallout.severity}
              size="sm"
            />
          </div>

          {/* Distress AI Banner */}
          <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-200 mb-3 flex items-center gap-2 text-xs text-black">
            <Zap size={14} className="text-black shrink-0" />
            <span className="truncate">
              <strong>{activeCallout.severity} Distress</strong> · {(activeCallout.confidence * 100).toFixed(0)}% AI Confidence · {activeCallout.speedKmh ? Math.round(activeCallout.speedKmh) : 42} km/h Patrol Track
            </span>
          </div>

          {/* Action Row */}
          <div className="flex gap-3 items-center">
            <div 
              className="relative group cursor-pointer shrink-0"
              onClick={() => onOpenInspector(activeCallout)}
            >
              <img 
                src={activeCallout.annotatedImageUrl || activeCallout.frameImageUrl} 
                alt={activeCallout.roadName}
                className="w-16 h-16 rounded-xl object-cover border border-neutral-200"
              />
              <span className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Inspect
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div className="text-xs text-neutral-500 flex justify-between mb-2">
                <span>Asphalt: <strong className="text-black">{activeCallout.estimatedAsphaltKg} kg</strong></span>
                <span>SLA Window: <strong className="text-black font-mono font-bold">{activeCallout.slaDeadlineHours} Hours</strong></span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onOpenInspector(activeCallout)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Eye size={13} />
                  <span>Inspect AI Vision</span>
                </button>

                <a
                  href={`https://www.google.com/maps?q=${activeCallout.latitude},${activeCallout.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-white hover:bg-neutral-100 border border-neutral-300 text-black rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Open in Google Maps for Field Truck"
                >
                  <Navigation size={13} />
                  <span>Navigate</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
