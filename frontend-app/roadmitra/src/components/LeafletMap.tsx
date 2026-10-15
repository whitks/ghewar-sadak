import React, { useRef, useMemo, useEffect } from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { Hazard } from "../services/mockData";
import { RoadSegment } from "../services/roadSegmentation";
import { RoadMemorySegment } from "../services/roadMemoryService";
import { HAZARD_LABELS } from "../constants/hazardTypes";
import { AppColors } from "../constants/theme";

const DEFAULT_MAP_CENTER = { latitude: 28.6139, longitude: 77.209 };

export interface LeafletMapProps {
  hazards: Hazard[];
  roadSegments?: (RoadSegment | RoadMemorySegment)[];
  center?: { latitude: number; longitude: number } | null;
  zoom?: number;
  onSelectHazard?: (hazard: Hazard) => void;
  onSelectSegment?: (segment: RoadSegment | RoadMemorySegment) => void;
}

export function LeafletMap({
  hazards,
  roadSegments = [],
  center,
  zoom = 15,
  onSelectHazard,
  onSelectSegment,
}: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);
  const safeCenter =
    center && typeof center.latitude === "number" && typeof center.longitude === "number"
      ? center
      : DEFAULT_MAP_CENTER;
  const initialCenterRef = useRef(safeCenter);

  if (
    center &&
    typeof center.latitude === "number" &&
    typeof center.longitude === "number" &&
    initialCenterRef.current === DEFAULT_MAP_CENTER
  ) {
    initialCenterRef.current = center;
  }

  useEffect(() => {
    if (!center || typeof center.latitude !== "number" || typeof center.longitude !== "number") return;
    const js = [
      "if(window.mapInstance){",
      "  window.mapInstance.setView([" + center.latitude + "," + center.longitude + "]," + zoom + ");",
      "  if(window.userMarker) window.userMarker.setLatLng([" + center.latitude + "," + center.longitude + "]);",
      "}",
      "true;",
    ].join("\n");
    if (Platform.OS !== "web" && webViewRef.current) {
      webViewRef.current.injectJavaScript(js);
    }
  }, [center?.latitude, center?.longitude, zoom]);

  const htmlContent = useMemo(() => {
    const hazardsJson = JSON.stringify(
      hazards.map((h) => ({
        id: h.id,
        lat: h.lat,
        lon: h.lon,
        type: h.type,
        label: HAZARD_LABELS[h.type] || "Hazard",
        confidence: Math.round(h.confidence * 100),
        status: h.status,
        color: h.confidence >= 0.75 ? AppColors.success : h.confidence >= 0.5 ? AppColors.warning : AppColors.danger,
        source: h.source,
        devices: h.deviceCount,
        photoUri: h.photoUri || null,
        magnitude: h.magnitude || null,
        speedKmh: h.speedKmh || null,
      }))
    );

    const roadSegmentsJson = JSON.stringify(
      roadSegments.map((s: any) => ({
        id: s.id,
        coordinates: s.coordinates,
        distanceMeters: s.distanceMeters,
        quality: s.quality,
        color: s.color,
        hazardCount: s.potholeCount ?? s.hazardCount ?? 0,
        crackCount: s.crackCount ?? 0,
        maxGForce: s.maxGForce || null,
        summary: s.summary || s.damagePattern || (s.roadName || "Road") + " PCI " + (s.pciScore ?? 75),
        pciScore: s.pciScore ?? null,
        roadName: s.roadName ?? null,
        roadType: s.roadType ?? null,
        recurrenceCount: s.recurrenceCount ?? 0,
        lastRepairedDate: s.lastRepairedDate ?? null,
        isRecurringHotspot: Boolean(s.isRecurringHotspot),
      }))
    );

    const iLat = safeCenter.latitude;
    const iLon = safeCenter.longitude;

    const html =
      "<!DOCTYPE html><html><head>" +
      "<meta charset=\"utf-8\" />" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no\" />" +
      "<link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\" integrity=\"sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=\" crossorigin=\"\" />" +
      "<style>" +
      "* {box-sizing:border-box;margin:0;padding:0;}" +
      "html,body,#map{width:100%;height:100%;background:#f4f2eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}" +
      ".leaflet-control-attribution{font-size:9px!important;background:rgba(255,255,255,0.7)!important;}" +
      ".hazard-marker{display:flex;flex-direction:column;align-items:center;cursor:pointer;}" +
      ".marker-pin{width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.28);transition:transform 0.15s;}" +
      ".marker-pin:active{transform:scale(1.15);}" +
      ".marker-tail{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid;margin-top:-1px;}" +
      ".user-pulse{width:18px;height:18px;border-radius:9px;background:#18352b;border:3px solid #fff;box-shadow:0 0 12px rgba(24,53,43,0.7);animation:pulse 2s infinite;}" +
      "@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(24,53,43,0.7);}70%{box-shadow:0 0 0 14px rgba(24,53,43,0);}100%{box-shadow:0 0 0 0 rgba(24,53,43,0);}}" +
      ".leaflet-popup-content-wrapper{border-radius:14px!important;padding:4px!important;box-shadow:0 4px 14px rgba(0,0,0,0.18)!important;border:1px solid #e2e7dc!important;}" +
      ".leaflet-popup-content{margin:10px 12px!important;font-size:13px!important;color:#18352b!important;line-height:18px!important;}" +
      ".popup-title{font-weight:800;font-size:14px;margin-bottom:3px;}" +
      ".popup-conf{font-weight:700;color:#18352b;}" +
      ".popup-sub{color:#607067;font-size:11px;margin-top:2px;}" +
      "</style></head><body><div id=\"map\"></div>" +
      "<script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\" integrity=\"sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=\" crossorigin=\"\"></script>" +
      "<script>(function(){" +
      "window.mapInstance=L.map('map',{zoomControl:false,attributionControl:true}).setView([" + iLat + "," + iLon + "]," + zoom + ");" +
      "L.control.zoom({position:'topright'}).addTo(window.mapInstance);" +
      "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'}).addTo(window.mapInstance);" +
      "var ui=L.divIcon({className:'',html:'<div class=\"user-pulse\"></div>',iconSize:[18,18],iconAnchor:[9,9]});" +
      "window.userMarker=L.marker([" + iLat + "," + iLon + "],{icon:ui,zIndexOffset:2000}).addTo(window.mapInstance);" +
      "" +
      "var OSRM='https://router.project-osrm.org/route/v1/driving/';" +
      "var cache={};" +
      "function fetchRoad(wpts){" +
      "  return new Promise(function(res){" +
      "    if(!wpts||wpts.length<2){res(null);return;}" +
      "    var cs=wpts.map(function(p){return p[1].toFixed(6)+','+p[0].toFixed(6);}).join(';');" +
      "    if(cache[cs]){res(cache[cs]);return;}" +
      "    var url=OSRM+cs+'?overview=full&geometries=geojson&steps=false&annotations=false';" +
      "    fetch(url,{headers:{Accept:'application/json'}})" +
      "      .then(function(r){return r.ok?r.json():null;})" +
      "      .then(function(d){" +
      "        if(!d||d.code!=='Ok'||!d.routes||!d.routes[0]||!d.routes[0].geometry){res(null);return;}" +
      "        var ll=d.routes[0].geometry.coordinates.map(function(c){return[c[1],c[0]];});" +
      "        cache[cs]=ll;res(ll);" +
      "      }).catch(function(){res(null);});" +
      "  });" +
      "}" +
      "" +
      "function buildPopup(seg){" +
      "  if(seg.pciScore!==null&&seg.pciScore!==undefined){" +
      "    var qn=seg.quality==='very_poor'?'Very Poor':seg.quality==='poor'?'Poor':seg.quality==='fair'?'Fair':'Good';" +
      "    var rh=seg.recurrenceCount>=2?'<div style=\"background:#FEF2F2;border:1px solid #FCA5A5;border-radius:6px;padding:4px 8px;margin:5px 0;font-size:11px;color:#991B1B;font-weight:700;\">&#9888; RECURRING DAMAGE: Failed '+seg.recurrenceCount+'x after repairs</div>':'';" +
      "    var lrh=seg.lastRepairedDate?'&middot; Last Repaired: <b>'+seg.lastRepairedDate+'</b>':'';" +
      "    return '<div style=\"font-size:14px;font-weight:800;color:#18352b;margin-bottom:2px;\">'+(seg.roadName||'Road Section')+'</div>'" +
      "      +'<div style=\"display:flex;align-items:center;gap:6px;margin:4px 0;\">'" +
      "      +'<span style=\"background:'+seg.color+';color:#fff;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:800;\">PCI '+seg.pciScore+' &middot; '+qn.toUpperCase()+'</span>'" +
      "      +'<span style=\"background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase;\">'+(seg.roadType||'road')+'</span></div>'" +
      "      +rh" +
      "      +'<div style=\"font-size:11px;color:#4b5563;line-height:15px;margin:4px 0;\">'+seg.summary+'</div>'" +
      "      +'<div style=\"font-size:10px;color:#6b7280;margin:4px 0 6px 0;\">Cracks: <b>'+seg.crackCount+'</b> &middot; Potholes: <b>'+seg.hazardCount+'</b> '+lrh+'</div>'" +
      "      +'<button onclick=\"window.iS(\\'' + seg.id + '\\')\" style=\"width:100%;background:#18352b;color:#fff;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;\">Inspect Road Memory History &#10145;</button>';" +
      "  }" +
      "  var badge=seg.quality==='critical'?'<span style=\"color:#DC2626;font-weight:800;font-size:12px;\">CRITICAL DEFECTS (RED)</span>':" +
      "    seg.quality==='moderate'?'<span style=\"color:#D97706;font-weight:800;font-size:12px;\">MODERATE WEAR (YELLOW)</span>':" +
      "    '<span style=\"color:#16A34A;font-weight:800;font-size:12px;\">HEALTHY ROAD (GREEN)</span>';" +
      "  return '<div style=\"margin-bottom:3px;\">'+badge+'</div>'" +
      "    +'<div style=\"font-size:13px;color:#18352b;font-weight:700;\">~'+seg.distanceMeters+'m Surveyed Section</div>'" +
      "    +'<div style=\"font-size:11px;color:#607067;margin-top:2px;\">'+seg.summary+'</div>'" +
      "    +'<button onclick=\"window.iS(\\'' + seg.id + '\\')\" style=\"margin-top:6px;width:100%;background:#18352b;color:#fff;border:none;border-radius:6px;padding:5px;font-size:11px;font-weight:700;cursor:pointer;\">Inspect Section &#10145;</button>';" +
      "}" +
      "" +
      "function drawSeg(seg,ll){" +
      "  L.polyline(ll,{color:'#fff',weight:9,opacity:0.85,lineCap:'round',lineJoin:'round'}).addTo(window.mapInstance);" +
      "  var poly=L.polyline(ll,{color:seg.color,weight:6,opacity:0.95,lineCap:'round',lineJoin:'round'}).addTo(window.mapInstance);" +
      "  poly.bindPopup(buildPopup(seg));" +
      "  poly.on('click',function(){var p=JSON.stringify({type:'segment_select',id:seg.id});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(p);}else if(window.parent){window.parent.postMessage(p,'*');}});" +
      "}" +
      "" +
      "function renderBatch(segs,idx){" +
      "  var C=4,batch=segs.slice(idx,idx+C);" +
      "  if(!batch.length)return;" +
      "  Promise.all(batch.map(function(seg){" +
      "    if(!seg.coordinates||seg.coordinates.length<2)return Promise.resolve();" +
      "    return fetchRoad(seg.coordinates).then(function(snapped){drawSeg(seg,snapped||seg.coordinates);});" +
      "  })).then(function(){renderBatch(segs,idx+C);});" +
      "}" +
      "" +
      "window.iS=function(id){var p=JSON.stringify({type:'segment_select',id:id});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(p);}else if(window.parent){window.parent.postMessage(p,'*');}};" +
      "" +
      "var hazards=" + hazardsJson + ";" +
      "hazards.forEach(function(h){" +
      "  var ic=L.divIcon({className:'hazard-marker',html:'<div class=\"marker-pin\" style=\"background-color:'+h.color+';\">'+h.confidence+'%</div><div class=\"marker-tail\" style=\"border-top-color:'+h.color+';\"></div>',iconSize:[34,40],iconAnchor:[17,40]});" +
      "  var m=L.marker([h.lat,h.lon],{icon:ic,zIndexOffset:1000}).addTo(window.mapInstance);" +
      "  var ex='';" +
      "  if(h.magnitude)ex+='<div style=\"color:#FF4E3A;font-weight:700;font-size:11px;margin-top:4px;\">&#9889; '+h.magnitude+'G Road Shock'+(h.speedKmh?' at '+Math.round(h.speedKmh)+' km/h':'')+'</div>';" +
      "  if(h.photoUri)ex+='<img src=\"'+h.photoUri+'\" style=\"width:100%;height:80px;object-fit:cover;border-radius:8px;margin-top:6px;\" />';" +
      "  m.bindPopup('<div class=\"popup-title\">'+h.label+'</div><div class=\"popup-conf\">'+h.confidence+'% Fused Confidence</div><div class=\"popup-sub\">'+h.devices+' device report'+(h.devices!==1?'s':'')+' &middot; '+h.source+'</div>'+ex,{offset:[0,-32]});" +
      "  m.on('click',function(){var p=JSON.stringify({type:'hazard_select',id:h.id});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(p);}else if(window.parent){window.parent.postMessage(p,'*');}});" +
      "});" +
      "" +
      "var segs=" + roadSegmentsJson + ";" +
      "renderBatch(segs,0);" +
      "})();</script></body></html>";

    return html;
  }, [hazards, roadSegments, zoom]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "hazard_select" && onSelectHazard) {
        const found = hazards.find((h) => h.id === data.id);
        if (found) onSelectHazard(found);
      } else if (data.type === "segment_select" && onSelectSegment) {
        const found = roadSegments.find((s) => s.id === data.id);
        if (found) onSelectSegment(found);
      }
    } catch (err) {
      console.warn("Error parsing map message:", err);
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleWebMsg = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "hazard_select" && onSelectHazard) {
          const found = hazards.find((h) => h.id === data.id);
          if (found) onSelectHazard(found);
        } else if (data?.type === "segment_select" && onSelectSegment) {
          const found = roadSegments.find((s) => s.id === data.id);
          if (found) onSelectSegment(found);
        }
      } catch {}
    };
    window.addEventListener("message", handleWebMsg);
    return () => window.removeEventListener("message", handleWebMsg);
  }, [hazards, roadSegments, onSelectHazard, onSelectSegment]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: "100%", height: "100%", border: "none" } as any}
          title="RoadPulse Hazard Radar"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: htmlContent, baseUrl: "https://unpkg.com" }}
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
  container: { flex: 1, backgroundColor: AppColors.bg },
  webview: { flex: 1, backgroundColor: AppColors.bg },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.bg,
  },
});
