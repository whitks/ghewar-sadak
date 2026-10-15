import React from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  Download, 
  PlusCircle, 
  MapPin,
  LayoutDashboard,
  Layers
} from 'lucide-react';
import type { RoadDefect } from '../types';
import { RoadDistressService } from '../services/api';

interface NavbarProps {
  isLive: boolean;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenNewModal: () => void;
  defects: RoadDefect[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  availableZones: string[];
  activeTab: 'dashboard' | 'map';
  onSelectTab: (tab: 'dashboard' | 'map') => void;
  newTodayCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isLive,
  onRefresh,
  isLoading,
  onOpenNewModal,
  defects,
  selectedZone,
  onSelectZone,
  availableZones,
  activeTab,
  onSelectTab,
  newTodayCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
      {/* Top Black Minimal Accent Rule */}
      <div className="h-[2px] w-full bg-black" />

      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        {/* Brand Group */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-black tracking-tight font-sans">
                ROADMITRA <span className="text-neutral-300 font-normal">|</span> PWD GIS COMMAND
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-900 border border-neutral-300 tracking-wide uppercase">
                MoRTH & Smart Cities
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-medium">
              National Road Distress Rectification & Pothole Priority Intelligence System
            </p>
          </div>
        </div>

        {/* Primary Desktop Navigation Segmented Switcher */}
        <nav className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <LayoutDashboard size={14} className="stroke-[2.2]" />
            <span>Dashboard</span>
            {newTodayCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                activeTab === 'dashboard' 
                  ? 'bg-white text-black' 
                  : 'bg-black text-white'
              }`}>
                +{newTodayCount} New
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('map')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'map'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <MapPin size={14} className="stroke-[2.2]" />
            <span>GIS Radar Map</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeTab === 'map' 
                ? 'bg-neutral-800 text-white' 
                : 'bg-neutral-200 text-neutral-800'
            }`}>
              {defects.length} Pins
            </span>
          </button>
        </nav>

        {/* Context Controls & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Jurisdiction Dropdown */}
          <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5">
            <Layers size={13} className="text-neutral-400" />
            <select
              value={selectedZone}
              onChange={(e) => onSelectZone(e.target.value)}
              className="bg-transparent text-xs font-semibold text-neutral-900 outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All National Corridors ({defects.length})</option>
              {availableZones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          {/* Telemetry Status Pill (Minimalist Accent) */}
          <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border bg-neutral-50 text-neutral-900 border-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isLive ? 'Field Cloud Stream' : 'Live Sensor Telemetry'}</span>
          </div>

          {/* Action: Export CSV */}
          <button
            onClick={() => RoadDistressService.exportWorkOrdersCSV(defects)}
            title="Download CSV Work Order for Contractors"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          {/* Action: Report Road Distress */}
          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-black hover:bg-neutral-800 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <PlusCircle size={13} />
            <span>Report Defect</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh Field Telemetry"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-black' : ''} />
          </button>
        </div>
      </div>
    </header>
  );
};
