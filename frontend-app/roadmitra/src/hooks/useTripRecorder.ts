import { useState, useEffect, useCallback } from 'react';
import { Trip } from '../services/mockData';
import { tripRecorderService, TripTelemetry } from '../services/tripRecorder';

export function useTripRecorder() {
  const [telemetry, setTelemetry] = useState<TripTelemetry>(() =>
    tripRecorderService.getTelemetry(),
  );

  useEffect(() => {
    const unsubscribe = tripRecorderService.subscribe((updated) => {
      setTelemetry({ ...updated });
    });
    return unsubscribe;
  }, []);

  const startTrip = useCallback(async () => {
    await tripRecorderService.startRecording();
    return tripRecorderService.getTelemetry().currentTrip?.id;
  }, []);

  const stopTrip = useCallback(async (): Promise<Trip | null> => {
    return await tripRecorderService.stopRecording();
  }, []);

  return {
    isRecording: telemetry.isRecording,
    duration: telemetry.elapsedSeconds,
    speed: telemetry.currentSpeed,
    gForce: telemetry.currentGForce,
    dynamicGForce: telemetry.dynamicGForce,
    verticalGForce: telemetry.verticalGForce,
    horizontalGForce: telemetry.horizontalGForce,
    angularVelocity: telemetry.angularVelocity,
    vibrationRms: telemetry.vibrationRms,
    roadQuality: telemetry.roadQuality,
    roadQualityScore: telemetry.roadQualityScore,
    eventCount: telemetry.eventCount,
    shockCount: telemetry.shockCount,
    potholeCount: telemetry.potholeCount,
    speedBreakerCount: telemetry.speedBreakerCount,
    patchCount: telemetry.patchCount,
    gpsAccuracy: telemetry.gpsAccuracy,
    coords: telemetry.coords,
    lastJolt: telemetry.lastJolt,
    lastPatch: telemetry.lastPatch,
    currentTripId: telemetry.currentTrip?.id ?? null,
    currentTrip: telemetry.currentTrip,
    distanceKm: telemetry.currentTrip?.distanceKm ?? 0,
    startTrip,
    stopTrip,
  };
}
