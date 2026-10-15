import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import type { RoadDefect, DefectType, SeverityLevel } from '../types';

interface NewDefectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (defect: Omit<RoadDefect, 'id'>) => void;
}

export const NewDefectModal: React.FC<NewDefectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [roadName, setRoadName] = useState('Outer Ring Road');
  const [landmark, setLandmark] = useState('Near Chirag Delhi Flyover Descent');
  const [wardZone, setWardZone] = useState('Ward 44 - South Delhi PWD Division');
  const [className, setClassName] = useState<DefectType>('Pothole');
  const [severity, setSeverity] = useState<SeverityLevel>('Critical');
  const [estimatedDepthCm, setEstimatedDepthCm] = useState(6.8);
  const [latitude, setLatitude] = useState(28.5385);
  const [longitude, setLongitude] = useState(77.2275);
  const [imageUrl, setImageUrl] = useState(
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000&auto=format&fit=crop&q=80'
  );
  const [notes, setNotes] = useState(
    'Newly formed crater following heavy morning rainfall. Urgent patching required.'
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isCritical = severity === 'Critical';
    const isHigh = severity === 'High';

    onSubmit({
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      roadName,
      landmark,
      wardZone,
      city: 'New Delhi',
      latitude: Number(latitude),
      longitude: Number(longitude),
      speedKmh: 40.0,
      className,
      confidence: 0.92,
      estimatedDepthCm: Number(estimatedDepthCm),
      depthClass: Number(estimatedDepthCm) > 6 ? 'Severe Crater (>6cm)' : 'Moderate (3-5cm)',
      severity,
      repairUrgency: isCritical
        ? 'Fix ASAP (Within 24 Hours)'
        : isHigh
        ? 'Priority Repair (24-48 Hours)'
        : 'Scheduled Maintenance',
      status: 'Reported',
      assignedContractor: 'Delhi PWD Emergency Asphalt Unit',
      slaDeadlineHours: isCritical ? 24 : isHigh ? 48 : 120,
      estimatedAsphaltKg: Math.round(Number(estimatedDepthCm) * 25),
      frameImageUrl: imageUrl,
      annotatedImageUrl: imageUrl,
      notes,
      isNewToday: true,
    });

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <PlusCircle className="text-black" size={18} />
            <h2 className="text-sm font-extrabold text-black uppercase tracking-tight">
              Report Road Distress · PWD Ingestion
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Road Corridor Name
            </label>
            <input
              type="text"
              required
              value={roadName}
              onChange={(e) => setRoadName(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white transition-all"
              placeholder="e.g. Ring Road, Rohtak Road, MG Road"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Specific Landmark & Position
            </label>
            <input
              type="text"
              required
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white transition-all"
              placeholder="e.g. 50m before Flyover, Opposite Metro Pillar #210"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
                Defect Classification
              </label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value as DefectType)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-black outline-none cursor-pointer"
              >
                <option value="Pothole">Pothole (Crater)</option>
                <option value="Alligator Crack">Alligator Crack (Fatigue)</option>
                <option value="Longitudinal Crack">Longitudinal Joint Crack</option>
                <option value="Transverse Crack">Transverse Thermal Crack</option>
                <option value="Road Distress (Other)">Road Distress (Other)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
                Severity / Urgency SLA
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-black outline-none cursor-pointer"
              >
                <option value="Critical">Critical Priority (Fix ASAP · 24h SLA)</option>
                <option value="High">High Priority (48h SLA)</option>
                <option value="Moderate">Moderate Surface (Scheduled 1-2 Weeks)</option>
                <option value="Low">Low / Mild (Routine Maintenance)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
                Est. Depth (cm)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={estimatedDepthCm}
                onChange={(e) => setEstimatedDepthCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-black focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                required
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value) || 28.6139)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-black focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                required
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value) || 77.2090)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-black focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Administrative Ward / Division
            </label>
            <input
              type="text"
              required
              value={wardZone}
              onChange={(e) => setWardZone(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white"
              placeholder="e.g. Ward 44 - South Delhi PWD Division"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Image Photo URL
            </label>
            <input
              type="url"
              required
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono text-black focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Field Observations / Safety Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-black focus:outline-none focus:ring-1.5 focus:ring-black focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs active:scale-98"
            >
              Submit & Add to GIS Map
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
