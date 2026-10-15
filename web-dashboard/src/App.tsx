import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Search,
  Eye
} from 'lucide-react';

import type { RoadDefect, DashboardStats, RepairStatus } from './types';
import { RoadDistressService } from './services/api';
import { 
  computeStats, 
  computeAreaStats, 
  INDIAN_COUNTRY_STATS, 
  INDIAN_CITIES_STATS 
} from './data/mockIndianRoads';

import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { MapView } from './components/MapView';
import { SeverityGradientBar } from './components/SeverityGradientBar';
import { ImageInspectorModal } from './components/ImageInspectorModal';
import { NewDefectModal } from './components/NewDefectModal';

export const App: React.FC = () => {
  const [defects, setDefects] = useState<RoadDefect[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalDefects: 0,
    criticalCount: 0,
    highCount: 0,
    moderateCount: 0,
    lowCount: 0,
    newTodayCount: 0,
    repairedCount: 0,
    avgDepthCm: 0,
    maxDepthCm: 0,
    totalAsphaltNeededTonnes: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLive, setIsLive] = useState<boolean>(false);
  
  // Strict View Scope: 'dashboard' | 'map'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map'>('dashboard');
  
  // Selected zone filter (from Navbar)
  const [selectedZone, setSelectedZone] = useState<string>('ALL');

  // GIS Map Sidebar Search & Filters
  const [mapEvidenceFilter, setMapEvidenceFilter] = useState<'all' | 'critical' | 'moderate' | 'low'>('all');
  const [mapSearchQuery, setMapSearchQuery] = useState<string>('');
  const [mapTargetCoords, setMapTargetCoords] = useState<[number, number] | null>(null);

  const [selectedDefect, setSelectedDefect] = useState<RoadDefect | null>(null);
  const [inspectingDefect, setInspectingDefect] = useState<RoadDefect | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);

  // Load Defects & Telemetry Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await RoadDistressService.fetchAllDefects();
      setDefects(result.defects);
      setStats(result.stats);
      setIsLive(result.isLive);
    } catch {
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Poll live field ingestion periodically
    const interval = setInterval(async () => {
      try {
        const fresh = await RoadDistressService.fetchAllDefects();
        setDefects(fresh.defects);
        setStats(fresh.stats);
      } catch {
        // Safe fallback
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Compute available administrative zones for the navbar filter
  const availableZones = useMemo(() => {
    const set = new Set<string>();
    defects.forEach((d) => {
      if (d.wardZone) set.add(d.wardZone);
    });
    return Array.from(set).sort();
  }, [defects]);

  // Compute area-wise distress aggregates
  const areaStats = useMemo(() => {
    return computeAreaStats(defects);
  }, [defects]);

  // Filtered defects based on Navbar administrative zone selection
  const zoneFilteredDefects = useMemo(() => {
    if (selectedZone === 'ALL') return defects;
    return defects.filter((d) => d.wardZone === selectedZone);
  }, [defects, selectedZone]);

  // Secondary filtering inside the GIS Map Sidebar
  const mapFilteredDefects = useMemo(() => {
    return zoneFilteredDefects.filter((d) => {
      if (mapEvidenceFilter === 'critical') {
        if (d.severity !== 'Critical') return false;
      } else if (mapEvidenceFilter === 'moderate') {
        if (d.severity !== 'Moderate' && d.severity !== 'High') return false;
      } else if (mapEvidenceFilter === 'low') {
        if (d.severity !== 'Low') return false;
      }

      if (mapSearchQuery.trim()) {
        const q = mapSearchQuery.toLowerCase().trim();
        const matchesRoad = d.roadName.toLowerCase().includes(q);
        const matchesLandmark = d.landmark.toLowerCase().includes(q);
        const matchesZone = d.wardZone.toLowerCase().includes(q);
        const matchesCity = d.city.toLowerCase().includes(q);
        if (!matchesRoad && !matchesLandmark && !matchesZone && !matchesCity) {
          return false;
        }
      }

      return true;
    });
  }, [zoneFilteredDefects, mapEvidenceFilter, mapSearchQuery]);

  // Jump from Dashboard to GIS Map
  const handleNavigateToMap = (lat: number, lng: number, _label?: string) => {
    setMapTargetCoords([lat, lng]);
    setActiveTab('map');
    
    // Select defect closest to target coordinates if available
    const closest = defects.find(
      (d) => Math.abs(d.latitude - lat) < 0.05 && Math.abs(d.longitude - lng) < 0.05
    );
    if (closest) {
      setSelectedDefect(closest);
    }
  };

  // Update Defect Municipal Status
  const handleUpdateStatus = (
    defectId: string | number,
    newStatus: RepairStatus,
    contractor?: string
  ) => {
    setDefects((prev) => {
      const updated = prev.map((d) => {
        if (d.id === defectId) {
          return {
            ...d,
            status: newStatus,
            assignedContractor: contractor || d.assignedContractor,
          };
        }
        return d;
      });
      setStats(computeStats(updated));
      return updated;
    });

    if (inspectingDefect && inspectingDefect.id === defectId) {
      setInspectingDefect((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    if (selectedDefect && selectedDefect.id === defectId) {
      setSelectedDefect((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  // Add Manual Defect handler
  const handleAddManualDefect = (newDefectData: Omit<RoadDefect, 'id'>) => {
    const created = RoadDistressService.addManualDefect(newDefectData);
    setDefects((prev) => {
      const updated = [created, ...prev];
      setStats(computeStats(updated));
      return updated;
    });
    setSelectedDefect(created);
    setIsNewModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans antialiased selection:bg-black selection:text-white">
      {/* Top MoRTH / RoadMitra Desktop Navigation Bar */}
      <Navbar
        isLive={isLive}
        onRefresh={loadData}
        isLoading={isLoading}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        defects={defects}
        selectedZone={selectedZone}
        onSelectZone={setSelectedZone}
        availableZones={availableZones}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        newTodayCount={stats.newTodayCount}
      />

      {/* Main Desktop Command Workspace */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto px-4 sm:px-6 py-4">
        {/* =========================================================================
            VIEW 1: EXECUTIVE DASHBOARD
            ========================================================================= */}
        {activeTab === 'dashboard' && (
          <DashboardView
            countryStats={INDIAN_COUNTRY_STATS}
            cityStats={INDIAN_CITIES_STATS}
            areaStats={areaStats}
            onNavigateToMap={handleNavigateToMap}
          />
        )}

        {/* =========================================================================
            VIEW 2: DESKTOP GIS WORKSPACE (Split-Screen High-Productivity Layout)
            ========================================================================= */}
        {activeTab === 'map' && (
          <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-105px)] min-h-[640px] w-full">
            {/* Left Sidebar (400px Desktop Directory Panel) */}
            <aside className="w-full lg:w-[400px] shrink-0 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-neutral-100 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-black text-sm">
                    <Layers size={16} className="text-black" />
                    <span>Corridor Distress Directory</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-black border border-neutral-200">
                    {mapFilteredDefects.length} Surveyed
                  </span>
                </div>

                {/* Search in map */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  <input 
                    type="text"
                    value={mapSearchQuery}
                    onChange={(e) => setMapSearchQuery(e.target.value)}
                    placeholder="Search road, landmark, or city..."
                    className="w-full pl-8 pr-12 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white transition-all"
                  />
                  {mapSearchQuery && (
                    <button 
                      onClick={() => setMapSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600 hover:text-black font-bold bg-neutral-200 px-1 py-0.2 rounded"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Severity Filter Chips (Monochrome) */}
                <div className="flex flex-wrap gap-1">
                  <button 
                    onClick={() => setMapEvidenceFilter('all')} 
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      mapEvidenceFilter === 'all'
                        ? 'bg-black text-white border-black'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setMapEvidenceFilter('critical')} 
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                      mapEvidenceFilter === 'critical'
                        ? 'bg-black text-white border-black'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <Flame size={11} /> Critical
                  </button>
                  <button 
                    onClick={() => setMapEvidenceFilter('moderate')} 
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                      mapEvidenceFilter === 'moderate'
                        ? 'bg-black text-white border-black'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <AlertTriangle size={11} /> Moderate
                  </button>
                  <button 
                    onClick={() => setMapEvidenceFilter('low')} 
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                      mapEvidenceFilter === 'low'
                        ? 'bg-black text-white border-black'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <CheckCircle2 size={11} /> Mild
                  </button>
                </div>
              </div>

              {/* Scrollable Distress Cards List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {mapFilteredDefects.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    No distress points matched your filters.
                  </div>
                ) : (
                  mapFilteredDefects.map((defect) => (
                    <div 
                      key={defect.id}
                      onClick={() => {
                        setSelectedDefect(defect);
                        setMapTargetCoords([defect.latitude, defect.longitude]);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedDefect?.id === defect.id
                          ? 'border-black bg-neutral-50 shadow-sm'
                          : 'border-neutral-200 bg-white hover:border-black hover:shadow-xs'
                      }`}
                    >
                      <div className="flex gap-3">
                        <img 
                          src={defect.annotatedImageUrl || defect.frameImageUrl} 
                          alt={defect.roadName} 
                          className="w-16 h-16 rounded-lg object-cover shrink-0 border border-neutral-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-black truncate" title={defect.roadName}>
                              {defect.roadName}
                            </span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              defect.status === 'Reported' 
                                ? 'bg-black text-white' 
                                : defect.status === 'In Progress' 
                                ? 'bg-neutral-200 text-black border border-neutral-300' 
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}>
                              {defect.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-neutral-500 truncate">{defect.landmark}</p>
                          
                          {/* Continuous Severity Gradient Bar */}
                          <div className="mt-1.5">
                            <SeverityGradientBar
                              score={defect.severity === 'Critical' ? 90 : defect.severity === 'High' ? 74 : defect.severity === 'Moderate' ? 48 : 22}
                              label={defect.severity}
                              size="sm"
                              showLabels={false}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1.5">
                            <span className="font-semibold text-black">{defect.city}</span>
                            <div className="flex items-center gap-2">
                              <span>{(defect.confidence * 100).toFixed(0)}% AI Conf</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectingDefect(defect);
                                }}
                                className="text-neutral-800 hover:text-black font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                title="Inspect Camera Frame"
                              >
                                <Eye size={11} />
                                <span>Inspect</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Right Canvas: Full Bleed Interactive Leaflet GIS Map */}
            <div className="flex-1 h-full rounded-2xl overflow-hidden border border-neutral-200 shadow-xs relative bg-neutral-100">
              <MapView
                defects={mapFilteredDefects}
                selectedDefectId={selectedDefect?.id}
                centerCoordinates={mapTargetCoords}
                onSelectDefect={(d) => setSelectedDefect(d)}
                onOpenInspector={(d) => setInspectingDefect(d)}
                onUpdateStatus={handleUpdateStatus}
              />
            </div>
          </div>
        )}
      </main>

      {/* Deep Image & Telemetry Inspector Modal */}
      <ImageInspectorModal
        defect={inspectingDefect}
        onClose={() => setInspectingDefect(null)}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* Manual Defect Entry Modal */}
      <NewDefectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleAddManualDefect}
      />
    </div>
  );
};

export default App;
