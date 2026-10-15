import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { storage } from '@/services/storage';
import { BACKEND_URL } from '@/services/api';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Warm up Render backend from cold-sleep in the background
    console.log('[RoadMitra] Connecting to Render backend:', BACKEND_URL);
    fetch(BACKEND_URL).catch(() => {});

    async function init() {
      try {
        const done = await storage.isOnboardingDone();
        setReady(true);
        if (!done) {
          router.replace('/onboarding');
        }
      } catch (err) {
        console.warn('[RootLayout] init failed:', err);
        setReady(true);
        router.replace('/onboarding');
      } finally {
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    init();
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trip/active" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="trip/summary" />
      <Stack.Screen name="hazard/[id]" />
      <Stack.Screen name="upload-queue" />
      <Stack.Screen name="report-result" />
      <Stack.Screen name="calibration" />
      <Stack.Screen name="diagnostics" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="data-privacy" />
      <Stack.Screen name="help" />
    </Stack>
  );
}
