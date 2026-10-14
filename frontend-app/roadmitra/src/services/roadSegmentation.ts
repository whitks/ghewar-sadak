import { Hazard, Trip } from './mockData';

export type RoadQuality = 'critical' | 'moderate' | 'good' | 'unknown';

export interface RoadSegment {
  id: string;
  tripId: string;
  coordinates: Array<[number, number]>; // [lat, lon] for Leaflet polyline
  distanceMeters: number;
  quality: RoadQuality;
  color: string;
  hazardCount: number;
  maxGForce?: number;
  summary: string;
  hazards: Hazard[];
}

export const ROAD_QUALITY_COLORS: Record<RoadQuality, string> = {
  critical: '#EF4444', // Red — Critical road damage / severe potholes
  moderate: '#F59E0B', // Yellow / Amber — Visible cracks / rough patch
  good: '#22C55E',     // Green — Healthy / smooth verified road
  unknown: '#9CA3AF',  // Gray — Insufficient telemetry evidence
};

/**
 * Calculates Haversine distance in meters between two lat/lon pairs
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Returns minimum distance in meters between a point and a line segment [P1, P2]
 */
function distancePointToSegmentMeters(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const dAB = haversineMeters(aLat, aLon, bLat, bLon);
  if (dAB === 0) return haversineMeters(pLat, pLon, aLat, aLon);

  const dAP = haversineMeters(aLat, aLon, pLat, pLon);
  const dBP = haversineMeters(bLat, bLon, pLat, pLon);

  // Check if projection falls outside the segment
  if (dAP * dAP > dBP * dBP + dAB * dAB) return dBP;
  if (dBP * dBP > dAP * dAP + dAB * dAB) return dAP;

  // Approximate perpendicular distance via triangle area
  const s = (dAB + dAP + dBP) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - dAB) * (s - dAP) * (s - dBP)));
  return (2 * area) / dAB;
}

/**
 * Checks if a hazard is within proximity (default 45m) of any point in the segment
 */
function isHazardNearSegment(hazard: Hazard, coords: Array<[number, number]>, maxDistMeters = 45): boolean {
  for (let i = 0; i < coords.length - 1; i++) {
    const dist = distancePointToSegmentMeters(
      hazard.lat,
      hazard.lon,
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1]
    );
    if (dist <= maxDistMeters) return true;
  }
  return false;
}

/**
 * Partitions raw GPS route points into ~100-meter segments and classifies
 * each segment according to real road safety severity:
 * - Red (Critical): Severe potholes / heavy shocks (≥1.7G) / repeated defect reports
 * - Yellow (Moderate): Visible cracks / minor potholes / moderate shocks (1.3G - 1.7G)
 * - Green (Healthy): Smooth verified road with no significant damage
 */
export function buildRoadSegmentsFromRoute(
  tripId: string,
  routePoints: Array<{ lat: number; lon: number }>,
  hazards: Hazard[],
  targetSegmentLengthMeters = 100
): RoadSegment[] {
  if (!routePoints || routePoints.length < 2) return [];

  // 1. Stationary Trip Check:
  // If the total displacement across all points from the start is < 60 meters,
  // the phone never actually travelled on a road (it was stationary in a room/desk).
  // Return empty segments so no fake lines or spiderwebs are drawn.
  let maxDisplacementFromStart = 0;
  const startPt = routePoints[0];
  for (const pt of routePoints) {
    const d = haversineMeters(startPt.lat, startPt.lon, pt.lat, pt.lon);
    if (d > maxDisplacementFromStart) {
      maxDisplacementFromStart = d;
    }
  }
  if (maxDisplacementFromStart < 60) {
    return [];
  }

  // 2. Route Point Sanitization:
  // Discard micro-jitter (< 4m) and impossible teleport leaps (> 350m) between points.
  const cleanPoints: Array<{ lat: number; lon: number }> = [routePoints[0]];
  for (let i = 1; i < routePoints.length; i++) {
    const prev = cleanPoints[cleanPoints.length - 1];
    const curr = routePoints[i];
    const d = haversineMeters(prev.lat, prev.lon, curr.lat, curr.lon);
    if (d < 4) continue;
    if (d > 350) continue;
    cleanPoints.push(curr);
  }

  if (cleanPoints.length < 2) return [];

  const segments: RoadSegment[] = [];
  let currentSegmentCoords: Array<[number, number]> = [[cleanPoints[0].lat, cleanPoints[0].lon]];
  let currentDist = 0;
  let segmentIndex = 1;

  for (let i = 1; i < cleanPoints.length; i++) {
    const prev = cleanPoints[i - 1];
    const curr = cleanPoints[i];
    const stepDist = haversineMeters(prev.lat, prev.lon, curr.lat, curr.lon);

    currentSegmentCoords.push([curr.lat, curr.lon]);
    currentDist += stepDist;

    // When the accumulated distance reaches ~100m, seal this segment
    if (currentDist >= targetSegmentLengthMeters || i === cleanPoints.length - 1) {
      if (currentSegmentCoords.length >= 2) {
        // Find all hazards along this 100m segment
        const matchingHazards = hazards.filter((h) =>
          isHazardNearSegment(h, currentSegmentCoords, 45)
        );

        let quality: RoadQuality = 'good';
        let maxGForce = 1.0;

        for (const h of matchingHazards) {
          if (h.magnitude && h.magnitude > maxGForce) {
            maxGForce = h.magnitude;
          }
        }

        // Determine severity
        const hasCriticalHazard = matchingHazards.some(
          (h) => h.confidence >= 0.70 || h.severity >= 65 || (h.magnitude && h.magnitude >= 1.7)
        );
        const hasModerateHazard = matchingHazards.some(
          (h) => h.confidence >= 0.40 || h.severity >= 40 || (h.magnitude && h.magnitude >= 1.35)
        );

        if (hasCriticalHazard || matchingHazards.length >= 2) {
          quality = 'critical';
        } else if (hasModerateHazard || matchingHazards.length === 1) {
          quality = 'moderate';
        } else {
          quality = 'good';
        }

        const summary =
          quality === 'critical'
            ? `Critical Damage · ${matchingHazards.length} defect(s)${maxGForce > 1 ? ` · ${maxGForce.toFixed(1)}G Shock` : ''}`
            : quality === 'moderate'
            ? `Moderate Wear · Minor defects/cracks logged`
            : `Healthy Road · Smooth verified traversal`;

        segments.push({
          id: `seg-${tripId}-${segmentIndex++}`,
          tripId,
          coordinates: currentSegmentCoords,
          distanceMeters: Math.round(currentDist),
          quality,
          color: ROAD_QUALITY_COLORS[quality],
          hazardCount: matchingHazards.length,
          maxGForce: maxGForce > 1 ? maxGForce : undefined,
          summary,
          hazards: matchingHazards,
        });
      }

      // Start next segment from current point
      currentSegmentCoords = [[curr.lat, curr.lon]];
      currentDist = 0;
    }
  }

  return segments;
}

/**
 * Gathers all driven routes across all stored trips, segmenting every road into ~100m segments
 */
export function generateAllRoadSegments(trips: Trip[], hazards: Hazard[]): RoadSegment[] {
  const allSegments: RoadSegment[] = [];

  for (const trip of trips) {
    if (!trip) continue;
    if (trip.distanceKm !== undefined && trip.distanceKm < 0.08) continue;
    const rawPoints = trip.route || trip.points;
    if (rawPoints && rawPoints.length >= 2) {
      const segs = buildRoadSegmentsFromRoute(trip.id, rawPoints, hazards, 100);
      allSegments.push(...segs);
    }
  }

  return allSegments;
}
