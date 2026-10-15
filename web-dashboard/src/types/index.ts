export type SeverityLevel = 'Critical' | 'High' | 'Moderate' | 'Low';

export type DefectType = 
  | 'Pothole'
  | 'Alligator Crack'
  | 'Longitudinal Crack'
  | 'Transverse Crack'
  | 'Road Distress (Other)';

export type RepairStatus = 'Reported' | 'Work Order Issued' | 'In Progress' | 'Repaired';

export interface RoadDefect {
  id: string | number;
  timestamp: string;
  roadName: string;
  landmark: string;
  wardZone: string;
  city: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speedKmh?: number;
  className: DefectType;
  confidence: number;
  estimatedDepthCm: number;
  depthClass: string;
  severity: SeverityLevel;
  repairUrgency: string;
  status: RepairStatus;
  assignedContractor?: string;
  slaDeadlineHours: number;
  estimatedAsphaltKg: number;
  frameImageUrl: string;
  annotatedImageUrl: string;
  notes?: string;
  isNewToday?: boolean;
}

export interface DashboardStats {
  totalDefects: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  newTodayCount: number;
  avgDepthCm: number;
  maxDepthCm: number;
  totalAsphaltNeededTonnes: number;
  repairedCount: number;
}

export interface AreaStat {
  areaName: string;
  city: string;
  zone: string;
  potholesCount: number;
  criticalCount: number;
  moderateCount: number;
  lowCount: number;
  newTodayCount: number;
  severityScore: number; // 0 to 100 on gradient scale
  severityLabel: 'Low' | 'Moderate' | 'High' | 'Critical';
  topRoadCorridor: string;
  latitude: number;
  longitude: number;
}

export interface CityStat {
  city: string;
  state: string;
  totalPotholes: number;
  criticalPotholes: number;
  moderatePotholes: number;
  mildPotholes: number;
  severityScore: number; // 0 to 100 on gradient scale
  severityLabel: 'Low' | 'Moderate' | 'High' | 'Critical';
  repairedCount: number;
  resolutionRate: number; // e.g. 74%
  activeSurveillanceVehicles: number;
  latitude: number;
  longitude: number;
}

export interface CountryStats {
  countryName: string;
  totalPotholesFound: number;
  nationalDistressScore: number; // 0 to 100 gradient scale
  severityLabel: 'Low' | 'Moderate' | 'High' | 'Critical';
  criticalCount: number;
  moderateCount: number;
  mildCount: number;
  newTodayCount: number;
  repairedPotholes: number;
  inspectedHighwaysKm: number;
  activeSurveillanceVehicles: number;
  topAffectedStates: {
    state: string;
    potholes: number;
    severityScore: number;
  }[];
}
