import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  AlertTriangle, 
  Flame, 
  CheckCircle2, 
  Zap, 
  Building2, 
  ShieldCheck,
  ChevronRight,
  Layers,
  RotateCcw,
  Navigation,
  Radio,
  Cpu,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import type { AreaStat, CityStat, CountryStats } from '../types';
import { SeverityGradientBar } from './SeverityGradientBar';

interface DashboardViewProps {
  countryStats: CountryStats;
  cityStats: CityStat[];
  areaStats: AreaStat[];
  onNavigateToMap: (lat: number, lng: number, label: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  countryStats,
  cityStats,
  areaStats,
  onNavigateToMap,
}) => {
  // Corridor search, filters & view mode
  const [corridorSearchQuery, setCorridorSearchQuery] = useState('');
  const [activeFilterChip, setActiveFilterChip] = useState<'ALL' | 'CRITICAL' | 'NEW_TODAY' | 'DELHI' | 'MUMBAI' | 'BENGALURU'>('ALL');
  const [corridorSortBy, setCorridorSortBy] = useState<'potholes' | 'severity' | 'critical' | 'name'>('potholes');

  // Municipal Cities table search, filter & sorting
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySeverityFilter, setCitySeverityFilter] = useState<'ALL' | 'Critical' | 'High' | 'Moderate'>('ALL');
  const [citySortBy, setCitySortBy] = useState<'potholes' | 'severity' | 'resolution' | 'name'>('potholes');

  // Filtered & Sorted Municipal Cities for the professional data table
  const filteredCities = useMemo(() => {
    let list = [...cityStats];

    if (citySeverityFilter !== 'ALL') {
      list = list.filter((c) => c.severityLabel === citySeverityFilter);
    }

    if (citySearchQuery.trim()) {
      const q = citySearchQuery.toLowerCase().trim();
      list = list.filter(
        (c) => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (citySortBy === 'potholes') return b.totalPotholes - a.totalPotholes;
      if (citySortBy === 'severity') return b.severityScore - a.severityScore;
      if (citySortBy === 'resolution') return b.resolutionRate - a.resolutionRate;
      return a.city.localeCompare(b.city);
    });

    return list;
  }, [cityStats, citySearchQuery, citySeverityFilter, citySortBy]);

  // Filter and sort area stats based on corridor search query, quick filter chip, and sort mode
  const filteredAreas = useMemo(() => {
    let result = areaStats;

    if (activeFilterChip === 'CRITICAL') {
      result = result.filter((a) => a.severityLabel === 'Critical');
    } else if (activeFilterChip === 'NEW_TODAY') {
      result = result.filter((a) => a.newTodayCount > 0);
    } else if (activeFilterChip === 'DELHI') {
      result = result.filter((a) => a.city.toLowerCase().includes('delhi'));
    } else if (activeFilterChip === 'MUMBAI') {
      result = result.filter((a) => a.city.toLowerCase().includes('mumbai'));
    } else if (activeFilterChip === 'BENGALURU') {
      result = result.filter((a) => a.city.toLowerCase().includes('bengaluru'));
    }

    if (corridorSearchQuery.trim()) {
      const q = corridorSearchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.areaName.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.zone.toLowerCase().includes(q) ||
          a.topRoadCorridor.toLowerCase().includes(q)
      );
    }

    const list = [...result];
    list.sort((a, b) => {
      if (corridorSortBy === 'potholes') return b.potholesCount - a.potholesCount;
      if (corridorSortBy === 'severity') return b.severityScore - a.severityScore;
      if (corridorSortBy === 'critical') return b.criticalCount - a.criticalCount;
      return a.areaName.localeCompare(b.areaName);
    });

    return list;
  }, [areaStats, corridorSearchQuery, activeFilterChip, corridorSortBy]);

  return (
    <div className="w-full space-y-6">
      {/* ─── SECTION 1: EXECUTIVE COMMAND HEADER (Multi-Column Desktop Grid) ──────── */}
      <section className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left (7 cols): High-Velocity Distress Telemetry Deck */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                  National Highway Distress Telemetry
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-neutral-500">
                MoRTH Live Field Ingestion
              </span>
            </div>

            {/* 5-Metric Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Metric 1: Total Surveyed */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 border-l-[3.5px] border-l-black flex flex-col justify-between">
                <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-tight">
                  Potholes Found
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-black my-1">
                  {countryStats.totalPotholesFound.toLocaleString()}
                </div>
                <span className="text-[10px] font-medium text-neutral-500">
                  Total Surveyed
                </span>
              </div>

              {/* Metric 2: Critical */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 border-l-[3.5px] border-l-rose-500 flex flex-col justify-between">
                <span className="text-[11px] font-black text-rose-800 uppercase tracking-tight flex items-center gap-1">
                  <Flame size={12} className="shrink-0 text-rose-600" />
                  <span>Critical</span>
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-black my-1">
                  {countryStats.criticalCount.toLocaleString()}
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-1.5 py-0.2 rounded w-fit">
                  24h SLA Action
                </span>
              </div>

              {/* Metric 3: Moderate */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 border-l-[3.5px] border-l-amber-500 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-tight flex items-center gap-1">
                  <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                  <span>Moderate</span>
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-neutral-900 my-1">
                  {countryStats.moderateCount.toLocaleString()}
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded w-fit">
                  Patch Backlog
                </span>
              </div>

              {/* Metric 4: Mild */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 border-l-[3.5px] border-l-emerald-500 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-tight flex items-center gap-1">
                  <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                  <span>Mild Surface</span>
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-neutral-800 my-1">
                  {countryStats.mildCount.toLocaleString()}
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded w-fit">
                  Routine Sealing
                </span>
              </div>

              {/* Metric 5: New Today */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 border-l-[3.5px] border-l-indigo-500 col-span-2 sm:col-span-1 flex flex-col justify-between">
                <span className="text-[11px] font-black text-indigo-900 uppercase tracking-tight flex items-center gap-1">
                  <Zap size={12} className="shrink-0 text-indigo-600" />
                  <span>New Today</span>
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-black my-1">
                  +{countryStats.newTodayCount}
                </div>
                <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded w-fit">
                  Live Cameras
                </span>
              </div>
            </div>
          </div>

          {/* Right (5 cols): National Road Distress Index & Top Affected States */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-black" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                    National Distress Index
                  </h3>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-black text-white border border-black tracking-wide">
                  {countryStats.severityLabel} Priority
                </span>
              </div>

              {/* National Road Distress Index Precision Dial */}
              <div className="my-2">
                <SeverityGradientBar 
                  score={countryStats.nationalDistressScore} 
                  label={countryStats.severityLabel}
                  size="md"
                  variant="dial"
                />
              </div>
            </div>

            {/* Top Affected States Subgrid */}
            <div className="border-t border-neutral-100 pt-2.5 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1.5">
                Highest Distress States
              </span>
              <div className="grid grid-cols-4 gap-2">
                {countryStats.topAffectedStates.slice(0, 4).map((st) => (
                  <div key={st.state} className="bg-neutral-50 hover:bg-neutral-100 p-2 rounded-xl border border-neutral-200 text-center transition-colors">
                    <span className="text-[11px] font-bold text-neutral-800 block truncate" title={st.state}>
                      {st.state}
                    </span>
                    <span className="text-xs font-black font-mono text-black block mt-0.5">
                      {st.potholes.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: MUNICIPAL CITIES AUDIT & DISTRESS DIRECTORY (Enterprise Table) ─ */}
      <section className="w-full">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 sm:p-6">
          {/* Table Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-black tracking-tight flex items-center gap-2">
                <Building2 size={18} className="text-black" />
                <span>Municipal Urban Centers · Distress & Rectification Audit</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Comparative surface condition index, distress breakdown, and SLA resolution across surveyed metropolitan zones
              </p>
            </div>

            {/* Table Search, Filters, and Sorting Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  placeholder="Filter city or state..."
                  className="pl-8 pr-12 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white w-44 sm:w-52 transition-all"
                />
                {citySearchQuery && (
                  <button 
                    onClick={() => setCitySearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-600 hover:text-black bg-neutral-200 px-1 py-0.2 rounded"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Severity Filter */}
              <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5">
                <Filter size={13} className="text-neutral-500" />
                <select
                  value={citySeverityFilter}
                  onChange={(e) => setCitySeverityFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-black outline-none cursor-pointer"
                >
                  <option value="ALL">All Severities</option>
                  <option value="Critical">Critical Priority</option>
                  <option value="High">High Distress</option>
                  <option value="Moderate">Moderate Surface</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5">
                <ArrowUpDown size={13} className="text-neutral-500" />
                <select
                  value={citySortBy}
                  onChange={(e) => setCitySortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-black outline-none cursor-pointer"
                >
                  <option value="potholes">Sort: Total Potholes</option>
                  <option value="severity">Sort: Severity Score</option>
                  <option value="resolution">Sort: Resolution Rate</option>
                  <option value="name">Sort: City Name</option>
                </select>
              </div>

              {/* Count Tag */}
              <span className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-neutral-100 text-black border border-neutral-200 whitespace-nowrap">
                {filteredCities.length} Urban Hubs
              </span>
            </div>
          </div>

          {/* Enterprise Table Container */}
          <div className="w-full overflow-x-auto rounded-xl border border-neutral-200">
            {filteredCities.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <AlertTriangle size={28} className="text-black mb-2" />
                <h4 className="text-sm font-bold text-black">No cities match your criteria</h4>
                <p className="text-xs text-neutral-500 mt-1">Try adjusting your search query or severity filter.</p>
                <button
                  onClick={() => { setCitySearchQuery(''); setCitySeverityFilter('ALL'); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Reset City Filters</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100/90 text-neutral-600 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-200">
                    <th className="py-3 px-4" style={{ width: '22%' }}>City & Jurisdiction</th>
                    <th className="py-3 px-4" style={{ width: '18%' }}>Potholes Found</th>
                    <th className="py-3 px-4" style={{ width: '24%' }}>Distress Severity Spectrum</th>
                    <th className="py-3 px-4" style={{ width: '16%' }}>Resolution Efficiency</th>
                    <th className="py-3 px-4" style={{ width: '10%' }}>Active AI Fleet</th>
                    <th className="py-3 px-4 text-right" style={{ width: '10%' }}>GIS Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredCities.map((city, idx) => {
                    const isTop3 = idx < 3;
                    return (
                      <tr key={city.city} className="hover:bg-neutral-50 transition-colors">
                        {/* 1. City & State */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                              isTop3 ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-black leading-tight">
                                {city.city}
                              </div>
                              <span className="inline-block text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200 mt-0.5">
                                {city.state}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Potholes Found & Breakdown */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="text-sm font-black font-mono text-black">
                              {city.totalPotholes.toLocaleString()} <span className="text-[11px] font-normal text-neutral-500">potholes</span>
                            </div>
                            <div className="flex items-center gap-1 font-bold text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/60 font-mono" title="Critical Potholes">
                                {city.criticalPotholes} Crit
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-mono" title="Moderate Potholes">
                                {city.moderatePotholes} Mod
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono" title="Mild Potholes">
                                {city.mildPotholes} Low
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Severity Spectrum Bar */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="min-w-[170px]">
                            <SeverityGradientBar
                              score={city.severityScore}
                              label={city.severityLabel}
                              size="sm"
                              showLabels={true}
                            />
                          </div>
                        </td>

                        {/* 4. Resolution Efficiency */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="w-32 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-black text-black">{city.resolutionRate}%</span>
                              <span className="text-[10px] text-neutral-500">{city.repairedCount} fixed</span>
                            </div>
                            <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
                              <div 
                                className="h-full bg-black rounded-full transition-all duration-500" 
                                style={{ width: `${city.resolutionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 5. Active Patrol Fleet */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-black whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                            <span>{city.activeSurveillanceVehicles} Units</span>
                          </div>
                        </td>

                        {/* 6. Action Button */}
                        <td className="py-3.5 px-4 align-middle text-right">
                          <button
                            onClick={() => onNavigateToMap(city.latitude, city.longitude, city.city)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-800 bg-white hover:bg-black hover:text-white border border-neutral-300 transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                            title={`Inspect ${city.city} on GIS Map`}
                          >
                            <MapPin size={12} />
                            <span>View Map</span>
                            <ChevronRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: ROAD CORRIDOR INTELLIGENCE DIRECTORY ─────────────────────── */}
      <section className="w-full">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 sm:p-6">
          {/* Corridor Header & Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-black tracking-tight flex items-center gap-2">
                <Layers size={18} className="text-black" />
                <span>Road Corridor Intelligence Directory</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Continuous distress severity spectrum, pothole counts, and carriageway inventory across surveyed arterial expressways
              </p>
            </div>

            {/* Table Controls: Sort & Count */}
            <div className="flex items-center gap-2.5">
              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5">
                <ArrowUpDown size={13} className="text-neutral-500" />
                <select
                  value={corridorSortBy}
                  onChange={(e) => setCorridorSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-black outline-none cursor-pointer"
                >
                  <option value="potholes">Sort: Most Potholes</option>
                  <option value="severity">Sort: Severity Score</option>
                  <option value="critical">Sort: Critical Count</option>
                  <option value="name">Sort: Corridor Name</option>
                </select>
              </div>

              <div className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-neutral-100 text-black border border-neutral-200 whitespace-nowrap">
                {filteredAreas.length} Corridors Surveyed
              </div>
            </div>
          </div>

          {/* Search Input & Filter Chips Row */}
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={corridorSearchQuery}
                onChange={(e) => setCorridorSearchQuery(e.target.value)}
                placeholder="Filter corridor, NH-48, Rohtak Road, MG Road, Mumbai..."
                className="w-full pl-8 pr-12 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white transition-all"
              />
              {corridorSearchQuery && (
                <button 
                  onClick={() => setCorridorSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-600 hover:text-black bg-neutral-200 px-1 py-0.2 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Chips (Monochrome High Contrast) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveFilterChip('ALL')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeFilterChip === 'ALL'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                All ({areaStats.length})
              </button>
              <button
                onClick={() => setActiveFilterChip('CRITICAL')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  activeFilterChip === 'CRITICAL'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <Flame size={12} />
                <span>Critical</span>
              </button>
              <button
                onClick={() => setActiveFilterChip('NEW_TODAY')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  activeFilterChip === 'NEW_TODAY'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <Zap size={12} />
                <span>New</span>
              </button>
              <button
                onClick={() => setActiveFilterChip('DELHI')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  activeFilterChip === 'DELHI'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <MapPin size={12} />
                <span>Delhi</span>
              </button>
              <button
                onClick={() => setActiveFilterChip('MUMBAI')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  activeFilterChip === 'MUMBAI'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <MapPin size={12} />
                <span>Mumbai</span>
              </button>
              <button
                onClick={() => setActiveFilterChip('BENGALURU')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  activeFilterChip === 'BENGALURU'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <MapPin size={12} />
                <span>Bengaluru</span>
              </button>
            </div>
          </div>

          {/* Corridor Enterprise Data Table */}
          {filteredAreas.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <AlertTriangle size={28} className="text-black mb-2" />
              <h4 className="text-sm font-bold text-black">No corridors matched your query</h4>
              <p className="text-xs text-neutral-500 mt-1 mb-3">
                Try adjusting your search terms or reset the filters.
              </p>
              <button
                onClick={() => { setCorridorSearchQuery(''); setActiveFilterChip('ALL'); }}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100/90 text-neutral-600 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-200">
                    <th className="py-3 px-4" style={{ width: '26%' }}>Corridor & Highway</th>
                    <th className="py-3 px-4" style={{ width: '18%' }}>City & Jurisdiction</th>
                    <th className="py-3 px-4" style={{ width: '22%' }}>Carriageway & Landmark</th>
                    <th className="py-3 px-4" style={{ width: '16%' }}>Potholes Found</th>
                    <th className="py-3 px-4" style={{ width: '18%' }}>Distress Severity</th>
                    <th className="py-3 px-4 text-right" style={{ width: '10%' }}>GIS Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredAreas.map((area, idx) => {
                    const isTop3 = idx < 3;
                    return (
                      <tr key={area.areaName} className="hover:bg-neutral-50 transition-colors">
                        {/* 1. Corridor & Highway */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                              isTop3 ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-black leading-tight">{area.areaName}</div>
                              {area.newTodayCount > 0 && (
                                <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-1.5 py-0.2 rounded mt-0.5">
                                  +{area.newTodayCount} New Today
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. City & Zone */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-black border border-neutral-200">
                              {area.city}
                            </span>
                            <span className="text-neutral-500 text-xs truncate max-w-[140px]" title={area.zone}>
                              · {area.zone}
                            </span>
                          </div>
                        </td>

                        {/* 3. Landmark & Carriageway */}
                        <td className="py-3.5 px-4 align-middle text-neutral-700">
                          <div className="flex items-center gap-1.5">
                            <Navigation size={12} className="text-neutral-400 shrink-0" />
                            <span className="truncate max-w-[220px]" title={area.topRoadCorridor}>{area.topRoadCorridor}</span>
                          </div>
                        </td>

                        {/* 4. Potholes Found & Breakdown */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="font-mono font-black text-black text-sm">{area.potholesCount}</div>
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/60 font-mono" title="Critical Potholes">
                                {area.criticalCount} Crit
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-mono" title="Moderate Potholes">
                                {area.moderateCount} Mod
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono" title="Mild Potholes">
                                {area.lowCount} Low
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 5. Distress Severity */}
                        <td className="py-3.5 px-4 align-middle min-w-[160px]">
                          <SeverityGradientBar
                            score={area.severityScore}
                            label={area.severityLabel}
                            size="sm"
                            showLabels={true}
                          />
                        </td>

                        {/* 6. Action Button */}
                        <td className="py-3.5 px-4 align-middle text-right">
                          <button
                            onClick={() => onNavigateToMap(area.latitude, area.longitude, area.areaName)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-800 bg-white hover:bg-black hover:text-white border border-neutral-300 transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                            title={`Inspect ${area.areaName} on GIS Map`}
                          >
                            <MapPin size={11} />
                            <span>View Map</span>
                            <ChevronRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ─── SECTION 4: AI SURVEILLANCE FLEET & HIGHWAY TELEMETRY MODULE ─────────── */}
      <section className="w-full">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 sm:p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-black animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                Active AI Surveillance Fleet & Highway Radar
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-lg">
              <Cpu size={13} className="text-black" />
              <span>Multi-Class YOLO Inference + 20Hz IMU Telemetry</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-bold uppercase text-neutral-500 block">Active Patrol Fleet</span>
              <div className="text-xl font-black font-mono text-black mt-1">
                {countryStats.activeSurveillanceVehicles} <span className="text-xs font-normal text-neutral-500">Units</span>
              </div>
              <span className="text-[10px] text-neutral-400 mt-0.5 block">Mobile Dashcam Vehicles</span>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-bold uppercase text-neutral-500 block">Network Coverage</span>
              <div className="text-xl font-black font-mono text-black mt-1">
                {countryStats.inspectedHighwaysKm.toLocaleString()} <span className="text-xs font-normal text-neutral-500">km</span>
              </div>
              <span className="text-[10px] text-neutral-400 mt-0.5 block">National Corridors Surveyed</span>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-bold uppercase text-neutral-500 block">National Resolution Rate</span>
              <div className="text-xl font-black font-mono text-black mt-1">
                {Math.round((countryStats.repairedPotholes / countryStats.totalPotholesFound) * 100)}%
              </div>
              <span className="text-[10px] text-neutral-400 mt-0.5 block">{countryStats.repairedPotholes.toLocaleString()} Potholes Sealed</span>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-bold uppercase text-neutral-500 block">Critical SLA Mandate</span>
              <div className="text-xl font-black font-mono text-black mt-1">
                24 Hours
              </div>
              <span className="text-[10px] text-neutral-400 mt-0.5 block">Strict Remediation Window</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
