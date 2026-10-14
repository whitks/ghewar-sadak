"""Interactive Map Generator for Potholes using Leaflet.js.

Generates a standalone, dependency-free interactive HTML map
with color-coded markers, popups, severity badges, and statistics.
"""

import json
from pathlib import Path
from typing import List, Dict, Any


SEVERITY_COLORS = {
    "Low": "#10b981",       # Emerald green
    "Moderate": "#f59e0b",  # Amber/Orange
    "High": "#ef4444",      # Red
    "Critical": "#8b5cf6"   # Purple
}


def generate_map_html(detections: List[Dict[str, Any]], output_path: Path = Path("outputs/potholes_map.html")) -> Path:
    """Generate an interactive HTML map from detection records."""
    output_path.parent.mkdir(exist_ok=True)

    if not detections:
        # Default placeholder if DB is empty
        center_lat, center_lon = 28.6139, 77.2090
        zoom = 12
    else:
        valid_coords = [(d["latitude"], d["longitude"]) for d in detections if d.get("latitude") and d.get("longitude")]
        if valid_coords:
            center_lat = sum(c[0] for c in valid_coords) / len(valid_coords)
            center_lon = sum(c[1] for c in valid_coords) / len(valid_coords)
            zoom = 15
        else:
            center_lat, center_lon = 28.6139, 77.2090
            zoom = 13

    # Format JSON payload for frontend
    markers_data = []
    for d in detections:
        sev = d.get("severity", "Low")
        color = SEVERITY_COLORS.get(sev, "#3b82f6")
        markers_data.append({
            "id": d.get("id"),
            "lat": d.get("latitude"),
            "lon": d.get("longitude"),
            "class_name": d.get("class_name"),
            "confidence": round(d.get("confidence", 0) * 100, 1),
            "depth_class": d.get("depth_class"),
            "estimated_depth_cm": d.get("estimated_depth_cm"),
            "severity": sev,
            "repair_urgency": d.get("repair_urgency"),
            "timestamp": d.get("timestamp"),
            "image_name": d.get("image_name"),
            "color": color
        })

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pothole & Road Distress GIS Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
        body {{ height: 100vh; display: flex; flex-direction: column; background: #0f172a; color: #f8fafc; }}
        header {{ background: #1e293b; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }}
        h1 {{ font-size: 1.25rem; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }}
        .stats-bar {{ display: flex; gap: 16px; font-size: 0.85rem; }}
        .badge {{ padding: 4px 10px; border-radius: 9999px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }}
        .badge-low {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }}
        .badge-mod {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #d97706; }}
        .badge-high {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #dc2626; }}
        .badge-crit {{ background: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid #7c3aed; }}
        #map {{ flex: 1; width: 100%; }}
        .leaflet-popup-content-wrapper {{ background: #1e293b !important; color: #f8fafc !important; border-radius: 12px; border: 1px solid #475569; }}
        .leaflet-popup-tip {{ background: #1e293b !important; }}
        .popup-title {{ font-size: 1.05rem; font-weight: 700; margin-bottom: 6px; color: #38bdf8; }}
        .popup-row {{ display: flex; justify-content: space-between; font-size: 0.82rem; margin: 4px 0; color: #94a3b8; }}
        .popup-row span.val {{ color: #f1f5f9; font-weight: 600; }}
        .legend {{ background: rgba(15, 23, 42, 0.9); padding: 12px 16px; border-radius: 8px; border: 1px solid #334155; color: #e2e8f0; font-size: 0.8rem; line-height: 1.6; }}
        .legend-item {{ display: flex; align-items: center; gap: 8px; }}
        .dot {{ width: 12px; height: 12px; border-radius: 50%; display: inline-block; }}
    </style>
</head>
<body>
    <header>
        <h1>🕳️ InfraSight Pothole & Road Distress GIS Map</h1>
        <div class="stats-bar">
            <span>Total Mapped: <strong id="total-count">{len(markers_data)}</strong></span>
            <span class="badge badge-low">🟢 Shallow: {sum(1 for m in markers_data if m['severity'] == 'Low')}</span>
            <span class="badge badge-mod">🟡 Moderate: {sum(1 for m in markers_data if m['severity'] == 'Moderate')}</span>
            <span class="badge badge-high">🔴 Deep: {sum(1 for m in markers_data if m['severity'] == 'High')}</span>
            <span class="badge badge-crit">🟣 Critical: {sum(1 for m in markers_data if m['severity'] == 'Critical')}</span>
        </div>
    </header>
    <div id="map"></div>

    <script>
        const markers = {json.dumps(markers_data)};
        const map = L.map('map').setView([{center_lat}, {center_lon}], {zoom});

        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }}).addTo(map);

        // Add Legend
        const legend = L.control({{ position: 'bottomright' }});
        legend.onAdd = function() {{
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <strong>Depth & Severity Levels</strong><br>
                <div class="legend-item"><span class="dot" style="background:#10b981"></span> Shallow (< 2.5 cm)</div>
                <div class="legend-item"><span class="dot" style="background:#f59e0b"></span> Moderate (2.5 - 5.0 cm)</div>
                <div class="legend-item"><span class="dot" style="background:#ef4444"></span> Deep (5.0 - 9.0 cm)</div>
                <div class="legend-item"><span class="dot" style="background:#8b5cf6"></span> Critical (> 9.0 cm)</div>
            `;
            return div;
        }};
        legend.addTo(map);

        // Plot Markers
        const group = [];
        markers.forEach(m => {{
            const circle = L.circleMarker([m.lat, m.lon], {{
                radius: 9,
                fillColor: m.color,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85
            }}).addTo(map);

            const popupContent = `
                <div class="popup-title">#${{m.id}} ${{m.class_name}}</div>
                <div class="popup-row"><span>Severity:</span><span class="val" style="color:${{m.color}}">${{m.severity}}</span></div>
                <div class="popup-row"><span>Estimated Depth:</span><span class="val">${{m.estimated_depth_cm}} cm</span></div>
                <div class="popup-row"><span>Depth Grade:</span><span class="val">${{m.depth_class}}</span></div>
                <div class="popup-row"><span>Urgency:</span><span class="val">${{m.repair_urgency}}</span></div>
                <div class="popup-row"><span>Confidence:</span><span class="val">${{m.confidence}}%</span></div>
                <div class="popup-row"><span>GPS:</span><span class="val">${{m.lat.toFixed(5)}}, ${{m.lon.toFixed(5)}}</span></div>
                <div class="popup-row"><span>Image:</span><span class="val">${{m.image_name}}</span></div>
                <div class="popup-row"><span>Logged At:</span><span class="val">${{m.timestamp}}</span></div>
            `;
            circle.bindPopup(popupContent);
            group.push([m.lat, m.lon]);
        }});

        if (group.length > 1) {{
            map.fitBounds(L.latLngBounds(group).pad(0.2));
        }}
    </script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    return output_path
