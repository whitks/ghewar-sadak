import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Navigation,
  Calendar,
  Building,
  UserCheck
} from 'lucide-react';
import type { RoadDefect, RepairStatus } from '../types';

interface ImageInspectorModalProps {
  defect: RoadDefect | null;
  onClose: () => void;
  onUpdateStatus: (defectId: string | number, status: RepairStatus) => void;
}

export const ImageInspectorModal: React.FC<ImageInspectorModalProps> = ({
  defect,
  onClose,
  onUpdateStatus,
}) => {
  const [viewMode, setViewMode] = useState<'annotated' | 'raw'>('annotated');

  if (!defect) return null;

  const currentImg = viewMode === 'annotated' ? defect.annotatedImageUrl : defect.frameImageUrl;

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-black px-2.5 py-1 rounded-lg tracking-wide uppercase ${
              defect.severity === 'Critical' 
                ? 'bg-black text-white' 
                : defect.severity === 'Moderate' 
                ? 'bg-neutral-800 text-white' 
                : 'bg-neutral-200 text-black border border-neutral-300'
            }`}>
              {defect.severity.toUpperCase()}
            </span>
            <div>
              <h2 className="text-base font-extrabold text-black tracking-tight">{defect.roadName}</h2>
              <p className="text-xs text-neutral-500">{defect.landmark}</p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: 2-Column Split */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Image Viewer with HUD & Toggle (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200 w-fit">
              <button
                onClick={() => setViewMode('annotated')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'annotated'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                <Layers size={13} />
                <span>AI Vision Annotated Frame</span>
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                <span>Raw Inspection Camera</span>
              </button>
            </div>

            {/* Image Canvas Container */}
            <div className="relative rounded-xl overflow-hidden bg-neutral-950 aspect-[16/10] border border-neutral-800 shadow-inner flex items-center justify-center">
              <img
                src={currentImg || defect.frameImageUrl}
                alt={defect.roadName}
                className="w-full h-full object-cover"
              />

              {/* Synthetic AI Bounding Box HUD Overlay in stark monochrome */}
              {viewMode === 'annotated' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative border-2 border-white bg-black/40 rounded-lg p-2 w-3/5 h-1/2 flex flex-col justify-start shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                    <span className="self-start text-[10px] font-black font-mono bg-black text-white border border-white/40 px-1.5 py-0.5 rounded tracking-wide uppercase">
                      {defect.className} ({(defect.confidence * 100).toFixed(0)}%) · {defect.estimatedDepthCm}cm
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-neutral-100 rounded-xl p-2.5 flex items-center justify-between text-[11px] text-neutral-700 font-mono border border-neutral-200">
              <span>Sensor: Mobile Dashcam QRT</span>
              <span>GPS: {defect.latitude.toFixed(5)}, {defect.longitude.toFixed(5)}</span>
              <span>Speed: {defect.speedKmh ? Math.round(defect.speedKmh) : 40} km/h</span>
            </div>
          </div>

          {/* Right Column: Engineering Diagnosis & Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 space-y-3.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-black">
                AI Engineering Diagnosis & Metrics
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Measured Depth</span>
                  <div className="text-xl font-black font-mono text-black mt-0.5">
                    {defect.estimatedDepthCm} <span className="text-xs font-normal text-neutral-500">cm</span>
                  </div>
                  <span className="text-[10px] text-neutral-600 block truncate">{defect.depthClass}</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">AI Confidence</span>
                  <div className="text-xl font-black font-mono text-black mt-0.5">
                    {(defect.confidence * 100).toFixed(1)}<span className="text-xs font-normal text-neutral-500">%</span>
                  </div>
                  <span className="text-[10px] text-neutral-600 block">YOLO Multi-Class</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Asphalt Required</span>
                  <div className="text-xl font-black font-mono text-black mt-0.5">
                    {defect.estimatedAsphaltKg} <span className="text-xs font-normal text-neutral-500">kg</span>
                  </div>
                  <span className="text-[10px] text-neutral-600 block">Bitumen Hot-Mix</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Contractor SLA</span>
                  <div className="text-xl font-black font-mono text-black mt-0.5">
                    {defect.slaDeadlineHours} <span className="text-xs font-normal text-neutral-500">Hours</span>
                  </div>
                  <span className="text-[10px] text-neutral-600 block truncate">{defect.repairUrgency}</span>
                </div>
              </div>

              {defect.notes && (
                <div className="bg-white p-3 rounded-lg border border-neutral-200 text-xs">
                  <strong className="text-black block mb-1">Municipal Safety Notes:</strong>
                  <p className="text-neutral-700 leading-relaxed">{defect.notes}</p>
                </div>
              )}

              {/* Administrative Meta */}
              <div className="space-y-1.5 text-xs text-neutral-700 border-t border-neutral-200 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-neutral-500 font-medium">
                    <Building size={12} /> Zone:
                  </span>
                  <span className="font-semibold text-black">{defect.wardZone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-neutral-500 font-medium">
                    <UserCheck size={12} /> Contractor:
                  </span>
                  <span className="font-semibold text-black">{defect.assignedContractor || 'PWD Rapid Response Unit'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-neutral-500 font-medium">
                    <Calendar size={12} /> Logged:
                  </span>
                  <span className="font-mono text-black">{defect.timestamp}</span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="space-y-2 pt-2 border-t border-neutral-200">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500 block">
                  Update Municipal Workflow Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onUpdateStatus(defect.id, 'Work Order Issued')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      defect.status === 'Work Order Issued'
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    Issue Order
                  </button>
                  <button
                    onClick={() => onUpdateStatus(defect.id, 'In Progress')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      defect.status === 'In Progress'
                        ? 'bg-neutral-800 text-white border-neutral-800 shadow-xs'
                        : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    Crew Active
                  </button>
                  <button
                    onClick={() => onUpdateStatus(defect.id, 'Repaired')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      defect.status === 'Repaired'
                        ? 'bg-neutral-600 text-white border-neutral-600 shadow-xs'
                        : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    Repaired
                  </button>
                </div>
              </div>

              {/* External Navigation Link */}
              <a
                href={`https://www.google.com/maps?q=${defect.latitude},${defect.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <Navigation size={13} />
                <span>Open in Google Maps for Field Truck</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
