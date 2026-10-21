import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ExternalLink, Layers, Navigation, CheckCircle2 } from 'lucide-react';
import { STATUS_CONFIG, SERVICE_TYPES, getSinglePointGoogleMapsUrl } from '../utils/constants';

export default function InteractiveRouteMap({
  origin,
  stops = [],
  unassignedStops = [],
  allTechniciansMode = false,
  technicians = [],
  activeTechColor = '#e31e24',
  returnToBase = false,
  googleMapsApiKey = '',
  googleMapsRouteUrl = null,
  onSelectStop,
  onAssignUnassignedStop,
  heightClass = 'h-[560px]',
}) {
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [mapStyle, setMapStyle] = useState('google_streets'); // 'dark' | 'google_streets' | 'google_hybrid'
  const [streetGeometryStatus, setStreetGeometryStatus] = useState('idle');

  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const initialLat = origin?.lat || -19.87404;
    const initialLng = origin?.lng || -43.98780;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: true,
    });

    const layerGroup = L.layerGroup().addTo(map);
    leafletMapRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (mapStyle === 'dark') {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO | Guardiar Rastreamentos',
        maxZoom: 20,
      }).addTo(map);
    } else if (mapStyle === 'google_streets') {
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);
    } else if (mapStyle === 'google_hybrid') {
      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps Satellite Hybrid',
        maxZoom: 20,
      }).addTo(map);
    }
  }, [mapStyle]);

  useEffect(() => {
    const map = leafletMapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    let isCancelled = false;
    group.clearLayers();

    const boundsPoints = [];

    // 2. Unassigned Pending Stops
    unassignedStops.forEach((uStop) => {
      if (!uStop.lat || !uStop.lng) return;
      boundsPoints.push([uStop.lat, uStop.lng]);

      const pendingIcon = L.divIcon({
        className: 'custom-pending-icon',
        html: `
          <div style="
            display:flex;align-items:center;justify-content:center;
            width:32px;height:32px;border-radius:9999px;
            background:#451a03;border:2px dashed #fbbf24;
            color:#fde68a;font-weight:800;font-size:13px;
            box-shadow:0 6px 16px rgba(0,0,0,0.6);
          " title="OS Sem Técnico: ${uStop.os_number}">
            ?
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([uStop.lat, uStop.lng], { icon: pendingIcon });
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '230px';
      popupDiv.innerHTML = `
        <div style="font-size:10px;text-transform:uppercase;color:#fbbf24;font-weight:700;margin-bottom:2px;">
          OS SEM TÉCNICO • ${uStop.os_number}
        </div>
        <div style="font-weight:700;font-size:13px;color:#f8fafc;">
          ${uStop.contact_name || uStop.client_name}
        </div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">
          Veículo: <strong>${uStop.vehicle_plate}</strong> (${uStop.vehicle_model})
        </div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">
          📍 ${uStop.address} - ${uStop.neighborhood}
        </div>
        <div style="font-size:11px;color:#fcd34d;margin-top:4px;margin-bottom:8px;">
          ⏰ Janela: ${uStop.time_window}
        </div>
      `;

      if (onAssignUnassignedStop && !allTechniciansMode) {
        const assignBtn = document.createElement('button');
        assignBtn.textContent = '+ Incluir na Rota deste Técnico';
        assignBtn.style.cssText =
          'width:100%;padding:6px 10px;background:#e31e24;color:#ffffff;font-weight:700;font-size:11px;border-radius:6px;border:none;cursor:pointer;margin-bottom:6px;';
        assignBtn.onclick = () => {
          marker.closePopup();
          onAssignUnassignedStop(uStop);
        };
        popupDiv.appendChild(assignBtn);
      }

      if (onSelectStop) {
        const detailBtn = document.createElement('button');
        detailBtn.textContent = 'Abrir Detalhes da OS';
        detailBtn.style.cssText =
          'width:100%;padding:5px 10px;background:#12303e;color:#e2e8f0;font-weight:600;font-size:11px;border-radius:6px;border:1px solid #24536a;cursor:pointer;';
        detailBtn.onclick = () => {
          marker.closePopup();
          onSelectStop(uStop);
        };
        popupDiv.appendChild(detailBtn);
      }

      marker.bindPopup(popupDiv);
      marker.addTo(group);
    });

    // 3. Ordered Stops
    stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng) return;
      boundsPoints.push([stop.lat, stop.lng]);

      const seqNum = stop.stop_number || stop.route_order || index + 1;
      const pinColor = stop.technician_color || activeTechColor || '#e31e24';
      const isDone = stop.status === 'CONCLUIDO';

      const stopIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: `
          <div style="
            position:relative;
            display:flex;align-items:center;justify-content:center;
            width:34px;height:34px;border-radius:9999px;
            background:${isDone ? '#059669' : pinColor};
            border:3px solid #ffffff;
            color:#ffffff;font-weight:800;font-size:13px;
            box-shadow:0 6px 16px rgba(0,0,0,0.65);
          ">
            ${seqNum}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon });
      const statusInfo = STATUS_CONFIG[stop.status] || STATUS_CONFIG.AGENDADO;
      const serviceInfo = SERVICE_TYPES[stop.service_type] || SERVICE_TYPES.INSTALACAO;
      const gmapsPointUrl =
        stop.google_maps_nav_url || getSinglePointGoogleMapsUrl(stop.lat, stop.lng, stop.address);

      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '245px';
      popupDiv.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
          <span style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;background:#e31e24;color:#ffffff;">
            #${seqNum} • ${stop.os_number}
          </span>
          <span style="font-size:10px;color:#cbd5e1;font-weight:600;">
            ${statusInfo.shortLabel}
          </span>
        </div>
        <div style="font-weight:700;font-size:13px;color:#f8fafc;">
          ${stop.contact_name || stop.client_name}
        </div>
        <div style="font-size:11px;color:#ff8589;font-weight:600;margin-top:2px;">
          ${serviceInfo.label}
        </div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">
          🚗 <strong>${stop.vehicle_plate}</strong> — ${stop.vehicle_model}
        </div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">
          📍 ${stop.address} (${stop.neighborhood})
        </div>
        <div style="font-size:11px;color:#e2e8f0;margin-top:4px;padding:4px 6px;background:#0b1d26;border-radius:6px;">
          ⏰ Janela: <strong>${stop.time_window}</strong>
          ${stop.eta_arrival ? `<br/>🏁 ETA Chegada: <strong style="color:#34d399">${stop.eta_arrival}</strong> (+${stop.leg_distance_km} km / ${stop.leg_drive_min} min)` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <a href="${gmapsPointUrl}" target="_blank" rel="noreferrer"
             style="flex:1;text-align:center;padding:6px 8px;background:#e31e24;color:#ffffff;font-weight:700;font-size:11px;border-radius:6px;text-decoration:none;">
            Google Maps ↗
          </a>
        </div>
      `;

      if (onSelectStop) {
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar / Detalhes da OS';
        editBtn.style.cssText =
          'width:100%;margin-top:6px;padding:5px 8px;background:#12303e;color:#e2e8f0;font-weight:600;font-size:11px;border-radius:6px;border:1px solid #24536a;cursor:pointer;';
        editBtn.onclick = () => {
          marker.closePopup();
          onSelectStop(stop);
        };
        popupDiv.appendChild(editBtn);
      }

      marker.bindPopup(popupDiv);
      marker.addTo(group);
    });

    if (boundsPoints.length > 0) {
      try {
        map.fitBounds(boundsPoints, { padding: [42, 42], maxZoom: 14 });
      } catch (_e) {
        // Ignore
      }
    }

    async function drawRoutes() {
      if (stops.length < 2) {
        setStreetGeometryStatus('idle');
        return;
      }

      if (allTechniciansMode) {
        const pts = stops.filter((s) => s.lat && s.lng).map((s) => [s.lat, s.lng]);
        if (pts.length >= 2) {
          L.polyline(pts, {
            color: '#e31e24',
            weight: 4,
            opacity: 0.85,
            dashArray: '8, 6',
          }).addTo(group);
        }
        setStreetGeometryStatus('osrm_ok');
        return;
      }

      // Route ALWAYS starts at the first service (stops[0]) and connects to subsequent services
      const coordList = [];
      stops.forEach((s) => {
        if (s.lat && s.lng) coordList.push([s.lat, s.lng]);
      });

      if (coordList.length < 2) return;

      setStreetGeometryStatus('loading');
      const osrmCoordString = coordList.map(([lat, lng]) => `${lng},${lat}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmCoordString}?overview=full&geometries=geojson`;

      try {
        const res = await fetch(osrmUrl);
        if (!res.ok) throw new Error('OSRM status not ok');
        const data = await res.json();
        if (isCancelled) return;

        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          const latLngs = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          L.polyline(latLngs, {
            color: '#0b1d26',
            weight: 8,
            opacity: 0.75,
          }).addTo(group);
          L.polyline(latLngs, {
            color: activeTechColor || '#e31e24',
            weight: 5,
            opacity: 0.95,
          }).addTo(group);
          setStreetGeometryStatus('osrm_ok');
          return;
        }
        throw new Error('No geometry');
      } catch (_err) {
        if (isCancelled) return;
        L.polyline(coordList, {
          color: activeTechColor || '#e31e24',
          weight: 4,
          opacity: 0.9,
          dashArray: '10, 6',
        }).addTo(group);
        setStreetGeometryStatus('direct_fallback');
      }
    }

    drawRoutes();

    return () => {
      isCancelled = true;
    };
  }, [origin, stops, unassignedStops, allTechniciansMode, technicians, activeTechColor, returnToBase]);

  return (
    <div className="relative isolate z-0 rounded-xl overflow-hidden border border-[#1f495d] bg-[#0f2834] shadow-xl">
      {/* Top Overlay Toolbar */}
      <div className="absolute top-3 left-12 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 bg-[#0b1d26]/95 backdrop-blur-md border border-[#1f495d] rounded-lg p-1 shadow-lg">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-300 px-2">
            <Layers className="w-3.5 h-3.5 text-[#e31e24]" />
            Mapa:
          </span>
          <button
            type="button"
            onClick={() => setMapStyle('google_streets')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
              mapStyle === 'google_streets'
                ? 'bg-[#e31e24] text-white shadow'
                : 'text-slate-300 hover:bg-[#163848]'
            }`}
          >
            Google Maps Ruas
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('google_hybrid')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
              mapStyle === 'google_hybrid'
                ? 'bg-[#e31e24] text-white shadow'
                : 'text-slate-300 hover:bg-[#163848]'
            }`}
          >
            Google Satélite
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('dark')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
              mapStyle === 'dark'
                ? 'bg-[#e31e24] text-white shadow'
                : 'text-slate-300 hover:bg-[#163848]'
            }`}
          >
            Noturno Guardiar
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {streetGeometryStatus === 'osrm_ok' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b1d26]/95 backdrop-blur-md border border-emerald-500/30 text-[11px] font-medium text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Traçado Viário Real Ativo
            </span>
          )}
          {googleMapsRouteUrl && (
            <a
              href={googleMapsRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow-lg transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              Abrir Rota no Google Maps
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          )}
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className={`w-full ${heightClass}`} />

      {/* Bottom Legend Bar */}
      <div className="bg-[#0b1d26] border-t border-[#1f495d] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block border border-white"
              style={{ backgroundColor: activeTechColor }}
            />
            <strong className="text-white">Parada #1:</strong> Início da Rota (1º Serviço)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <strong className="text-white">1, 2, 3...</strong> Sequência dos Serviços
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 inline-block" />
            <strong className="text-white">Verde:</strong> OS Concluída
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          Guardiar Rastreamentos • Roteirização Integrada Google Maps
        </div>
      </div>
    </div>
  );
}
