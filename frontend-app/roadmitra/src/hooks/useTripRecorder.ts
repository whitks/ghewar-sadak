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
    eventCount: telemetry.eventCount,
    gpsAccuracy: telemetry.gpsAccuracy,
    coords: telemetry.coords,
    lastJolt: telemetry.lastJolt,
    currentTripId: telemetry.currentTrip?.id ?? null,
    currentTrip: telemetry.currentTrip,
    startTrip,
    stopTrip,
  };
}
