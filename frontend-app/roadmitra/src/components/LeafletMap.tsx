import React, { useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Hazard } from '../services/mockData';
import { HAZARD_LABELS } from '../constants/hazardTypes';
import { AppColors } from '../constants/theme';

export interface LeafletMapProps {
  hazards: Hazard[];
  center: { latitude: number; longitude: number };
  zoom?: number;
  onSelectHazard?: (hazard: Hazard) => void;
}

export function LeafletMap({
  hazards,
  center,
  zoom = 15,
  onSelectHazard,
}: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);

  // Recenter map programmatically when center prop changes
  useEffect(() => {
    const js = `
      if (window.mapInstance) {
        window.mapInstance.setView([${center.latitude}, ${center.longitude}], ${zoom});
        if (window.userMarker) {
          window.userMarker.setLatLng([${center.latitude}, ${center.longitude}]);
        }
      }
      true;
    `;
    if (Platform.OS !== 'web' && webViewRef.current) {
      webViewRef.current.injectJavaScript(js);
    }
  }, [center.latitude, center.longitude, zoom]);

  const htmlContent = useMemo(() => {
    const hazardsJson = JSON.stringify(
      hazards.map((h) => ({
        id: h.id,
        lat: h.lat,
        lon: h.lon,
        type: h.type,
        label: HAZARD_LABELS[h.type] || 'Hazard',
        confidence: Math.round(h.confidence * 100),
        status: h.status,
        color:
          h.confidence >= 0.75
            ? AppColors.success
            : h.confidence >= 0.5
            ? AppColors.warning
            : AppColors.danger,
        source: h.source,
        devices: h.deviceCount,
        photoUri: h.photoUri || null,
        magnitude: h.magnitude || null,
        speedKmh: h.speedKmh || null,
      })),
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #f4f2eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.7) !important; }
    
    .hazard-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .marker-pin {
      width: 34px;
      height: 34px;
      border-radius: 17px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      border: 2px solid #ffffff;
      box-shadow: 0 3px 8px rgba(0,0,0,0.28);
      transition: transform 0.15s ease;
    }
    .marker-pin:active {
      transform: scale(1.15);
    }
    .marker-tail {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid;
      margin-top: -1px;
    }
    .user-pulse {
      width: 18px;
      height: 18px;
      border-radius: 9px;
      background: #18352b;
      border: 3px solid #ffffff;
      box-shadow: 0 0 12px rgba(24, 53, 43, 0.7);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(24, 53, 43, 0.7); }
      70% { box-shadow: 0 0 0 14px rgba(24, 53, 43, 0); }
      100% { box-shadow: 0 0 0 0 rgba(24, 53, 43, 0); }
    }
    .leaflet-popup-content-wrapper {
      border-radius: 14px !important;
      padding: 4px !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18) !important;
      border: 1px solid #e2e7dc !important;
    }
    .leaflet-popup-content {
      margin: 10px 12px !important;
      font-size: 13px !important;
      color: #18352b !important;
      line-height: 18px !important;
    }
    .popup-title { font-weight: 800; font-size: 14px; margin-bottom: 3px; }
    .popup-conf { font-weight: 700; color: #18352b; }
    .popup-sub { color: #607067; font-size: 11px; margin-top: 2px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    window.mapInstance = L.map('map', {
      zoomControl: false,
      attributionControl: true
    }).setView([${center.latitude}, ${center.longitude}], ${zoom});

    L.control.zoom({ position: 'topright' }).addTo(window.mapInstance);

    // OpenStreetMap tiles — completely free, no API key, no account ever needed
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(window.mapInstance);

    // Current Vehicle / User Location
    const userIcon = L.divIcon({
      className: '',
      html: '<div class="user-pulse"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    window.userMarker = L.marker([${center.latitude}, ${center.longitude}], {
      icon: userIcon,
      zIndexOffset: 1000
    }).addTo(window.mapInstance);

    // Render Hazard Clusters
    const hazards = ${hazardsJson};
    hazards.forEach(h => {
      const icon = L.divIcon({
        className: 'hazard-marker',
        html: \`
          <div class="marker-pin" style="background-color: \${h.color};">
            \${h.confidence}%
          </div>
          <div class="marker-tail" style="border-top-color: \${h.color};"></div>
        \`,
        iconSize: [34, 40],
        iconAnchor: [17, 40]
      });

      const m = L.marker([h.lat, h.lon], { icon: icon }).addTo(window.mapInstance);
      
      let extraHtml = '';
      if (h.magnitude) {
        extraHtml += \`<div style="color: #FF4E3A; font-weight: 700; font-size: 11px; margin-top: 4px;">⚡ \${h.magnitude}G Road Shock \${h.speedKmh ? 'at ' + Math.round(h.speedKmh) + ' km/h' : ''}</div>\`;
      }
      if (h.photoUri) {
        extraHtml += \`<img src="\${h.photoUri}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; margin-top: 6px;" />\`;
      }

      const popupHtml = \`
        <div class="popup-title">\${h.label}</div>
        <div class="popup-conf">\${h.confidence}% Fused Confidence</div>
        <div class="popup-sub">\${h.devices} device report\${h.devices !== 1 ? 's' : ''} · \${h.source}</div>
        \${extraHtml}
      \`;
      m.bindPopup(popupHtml, { offset: [0, -32] });

      m.on('click', () => {
        const payload = JSON.stringify({ type: 'hazard_select', id: h.id });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(payload);
        } else if (window.parent) {
          window.parent.postMessage(payload, '*');
        }
      });
    });
  </script>
</body>
</html>`;
  }, [hazards, center.latitude, center.longitude, zoom]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'hazard_select' && onSelectHazard) {
        const found = hazards.find((h) => h.id === data.id);
        if (found) onSelectHazard(found);
      }
    } catch (err) {
      console.warn('Error parsing map message:', err);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          title="RoadPulse Hazard Radar"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://unpkg.com' }}
        onMessage={handleMessage}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        mixedContentMode="always"
        androidLayerType="hardware"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={AppColors.primary} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: AppColors.bg,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.bg,
  },
});
