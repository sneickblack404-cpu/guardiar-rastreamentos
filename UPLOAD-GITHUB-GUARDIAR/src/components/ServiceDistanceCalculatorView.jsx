import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import {
  Route,
  Navigation,
  Clock,
  MapPin,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Search,
  PlusCircle,
  Building2,
  Car,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  STATUS_CONFIG,
  SERVICE_TYPES,
  DAILY_TIME_SLOTS,
  formatDateBR,
  calculateDistanceKm,
} from '../utils/constants';

function calculateDriveMinutes(distKm) {
  if (!distKm || isNaN(distKm) || distKm <= 0) return 0;
  // Average urban speed in BH/MG: ~25 km/h + 2 min buffer
  return Math.max(5, Math.round((distKm / 26) * 60) + 2);
}

function parseTimeToMinutes(timeStr = '08:00') {
  if (!timeStr) return 480;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
}

function formatMinutesToTime(totalMin) {
  const norm = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin)));
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function ServiceDistanceCalculatorView({
  selectedDate,
  onChangeDate,
  appointments = [],
  settings = {},
  onScheduleAtSlot, // callback to switch to "Agendar serviço" with pre-filled date/time/address
}) {
  const hqPoint = useMemo(
    () => ({
      id: 'HQ_BASE',
      type: 'BASE',
      title: settings.hq_name || 'Base Central Guardiar (Ouro Preto - BH)',
      address: settings.hq_address || 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
      neighborhood: 'Ouro Preto',
      city: 'Belo Horizonte',
      state: 'MG',
      lat: Number(settings.hq_lat || -19.87404),
      lng: Number(settings.hq_lng || -43.98780),
      time: '08:00',
    }),
    [settings]
  );

  // Appointments on selected date (sorted by time)
  const dayAppointments = useMemo(() => {
    return (appointments || [])
      .filter((a) => a.scheduled_date === selectedDate && a.status !== 'CANCELADO')
      .map((a) => {
        const time = (a.window_start || a.scheduled_time || a.time_window || '08:00')
          .split('-')[0]
          .trim();
        return {
          ...a,
          cleanTime: time,
          timeMinutes: parseTimeToMinutes(time),
        };
      })
      .sort((a, b) => a.timeMinutes - b.timeMinutes);
  }, [appointments, selectedDate]);

  // Points A and B selection state
  // Can be 'APP_<id>', 'HQ_BASE', or 'CUSTOM'
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');

  // Custom address inputs for Origin and Destination
  const [customOrigin, setCustomOrigin] = useState({
    query: '',
    address: '',
    lat: null,
    lng: null,
    geocoding: false,
  });

  const [customDest, setCustomDest] = useState({
    query: '',
    address: '',
    lat: null,
    lng: null,
    geocoding: false,
  });

  const [copiedInfo, setCopiedInfo] = useState(false);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const layerGroupRef = useRef(null);

  // Set intelligent defaults when date or appointments change
  useEffect(() => {
    if (dayAppointments.length >= 2) {
      setOriginId(`APP_${dayAppointments[0].id}`);
      setDestId(`APP_${dayAppointments[1].id}`);
    } else if (dayAppointments.length === 1) {
      setOriginId(`APP_${dayAppointments[0].id}`);
      setDestId('HQ_BASE');
    } else {
      setOriginId('HQ_BASE');
      setDestId('CUSTOM');
    }
  }, [selectedDate, dayAppointments.length]);

  // Resolve Origin Point Object
  const originPoint = useMemo(() => {
    if (originId === 'HQ_BASE') return hqPoint;
    if (originId === 'CUSTOM') {
      return {
        id: 'CUSTOM_ORIGIN',
        type: 'CUSTOM',
        title: customOrigin.address || customOrigin.query || 'Endereço Personalizado de Origem',
        address: customOrigin.address || customOrigin.query,
        lat: customOrigin.lat,
        lng: customOrigin.lng,
        time: '08:00',
      };
    }
    if (originId.startsWith('APP_')) {
      const appId = Number(originId.replace('APP_', ''));
      const found = dayAppointments.find((a) => a.id === appId);
      if (found) {
        return {
          id: `APP_${found.id}`,
          type: 'APPOINTMENT',
          appointment: found,
          title: `[${found.cleanTime}] ${found.contact_name || found.client_name}`,
          client: found.contact_name || found.client_name,
          address: `${found.address} - ${found.neighborhood || ''}, ${found.city || 'Belo Horizonte'}`,
          lat: Number(found.lat),
          lng: Number(found.lng),
          time: found.cleanTime,
          timeMinutes: found.timeMinutes,
          serviceType: found.service_type,
          plate: found.vehicle_plate,
          model: found.vehicle_model,
        };
      }
    }
    return null;
  }, [originId, customOrigin, hqPoint, dayAppointments]);

  // Resolve Destination Point Object
  const destPoint = useMemo(() => {
    if (destId === 'HQ_BASE') return hqPoint;
    if (destId === 'CUSTOM') {
      return {
        id: 'CUSTOM_DEST',
        type: 'CUSTOM',
        title: customDest.address || customDest.query || 'Endereço Personalizado de Destino',
        address: customDest.address || customDest.query,
        lat: customDest.lat,
        lng: customDest.lng,
        time: null,
      };
    }
    if (destId.startsWith('APP_')) {
      const appId = Number(destId.replace('APP_', ''));
      const found = dayAppointments.find((a) => a.id === appId);
      if (found) {
        return {
          id: `APP_${found.id}`,
          type: 'APPOINTMENT',
          appointment: found,
          title: `[${found.cleanTime}] ${found.contact_name || found.client_name}`,
          client: found.contact_name || found.client_name,
          address: `${found.address} - ${found.neighborhood || ''}, ${found.city || 'Belo Horizonte'}`,
          lat: Number(found.lat),
          lng: Number(found.lng),
          time: found.cleanTime,
          timeMinutes: found.timeMinutes,
          serviceType: found.service_type,
          plate: found.vehicle_plate,
          model: found.vehicle_model,
        };
      }
    }
    return null;
  }, [destId, customDest, hqPoint, dayAppointments]);

  // Calculate Distance & Drive Time between Origin and Destination
  const routeCalculation = useMemo(() => {
    if (!originPoint?.lat || !originPoint?.lng || !destPoint?.lat || !destPoint?.lng) {
      return null;
    }

    const distKm = calculateDistanceKm(
      originPoint.lat,
      originPoint.lng,
      destPoint.lat,
      destPoint.lng
    );
    const driveMin = calculateDriveMinutes(distKm);

    // If Origin has a scheduled time, calculate estimated arrival at Destination
    let departureTime = null;
    let arrivalTime = null;
    if (originPoint.timeMinutes !== undefined) {
      // Estimated service duration at Origin (defaults to 50 min)
      const serviceDuration = originPoint.appointment?.estimated_duration_min || 50;
      const departureMinutes = originPoint.timeMinutes + serviceDuration;
      const arrivalMinutes = departureMinutes + driveMin;
      departureTime = formatMinutesToTime(departureMinutes);
      arrivalTime = formatMinutesToTime(arrivalMinutes);
    }

    // Direct Google Maps Route URL
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originPoint.lat},${originPoint.lng}&destination=${destPoint.lat},${destPoint.lng}&travelmode=driving`;

    return {
      distKm,
      driveMin,
      departureTime,
      arrivalTime,
      gmapsUrl,
    };
  }, [originPoint, destPoint]);

  // Analyze Available Time Slots for Destination on the Selected Day
  const timeSlotOptions = useMemo(() => {
    // Map occupied slots by hour prefix
    const occupiedBySlot = {};
    dayAppointments.forEach((a) => {
      const slot = a.cleanTime.slice(0, 2) + ':00';
      occupiedBySlot[slot] = a;
      occupiedBySlot[a.cleanTime] = a;
    });

    const driveMin = routeCalculation?.driveMin || 15;
    const originArrivalMin = routeCalculation?.arrivalTime
      ? parseTimeToMinutes(routeCalculation.arrivalTime)
      : null;

    return DAILY_TIME_SLOTS.map((slot) => {
      const slotMin = parseTimeToMinutes(slot);
      const occupiedApp = occupiedBySlot[slot] || null;
      const isAvailable = !occupiedApp;

      // Recommended if it's available and allows enough transit time after Origin finishes
      let isRecommended = false;
      let reason = '';

      if (isAvailable && originArrivalMin !== null) {
        // Ideal slot is the first available slot >= estimated arrival time
        if (slotMin >= originArrivalMin && slotMin <= originArrivalMin + 90) {
          isRecommended = true;
          reason = `Ideal após saída do Serviço A (Chegada prevista: ${routeCalculation.arrivalTime})`;
        } else if (slotMin < originArrivalMin) {
          reason = `Horário anterior à chegada prevista (${routeCalculation.arrivalTime})`;
        }
      }

      return {
        slot,
        isAvailable,
        occupiedApp,
        isRecommended,
        reason,
      };
    });
  }, [dayAppointments, routeCalculation]);

  // Handle Geocoding for Custom Addresses
  const handleGeocodeCustom = async (type = 'DEST') => {
    const isDest = type === 'DEST';
    const query = isDest ? customDest.query : customOrigin.query;
    if (!query.trim()) return;

    if (isDest) setCustomDest((prev) => ({ ...prev, geocoding: true }));
    else setCustomOrigin((prev) => ({ ...prev, geocoding: true }));

    try {
      const params = new URLSearchParams({
        address: query,
        city: 'Belo Horizonte',
        state: 'MG',
      });
      const res = await fetch(`/api/geocode?${params.toString()}`);
      const data = await res.json();
      if (data && data.lat && data.lng) {
        const fullAddr = `${data.address || query} - ${data.neighborhood || ''}, ${data.city || 'Belo Horizonte'}/${data.state || 'MG'}`;
        if (isDest) {
          setCustomDest({
            query,
            address: fullAddr,
            lat: Number(data.lat),
            lng: Number(data.lng),
            geocoding: false,
          });
        } else {
          setCustomOrigin({
            query,
            address: fullAddr,
            lat: Number(data.lat),
            lng: Number(data.lng),
            geocoding: false,
          });
        }
      }
    } catch (err) {
      console.error('Erro ao geolocalizar:', err);
    } finally {
      if (isDest) setCustomDest((prev) => ({ ...prev, geocoding: false }));
      else setCustomOrigin((prev) => ({ ...prev, geocoding: false }));
    }
  };

  // Flip Origin and Destination
  const handleSwap = () => {
    const tempId = originId;
    setOriginId(destId);
    setDestId(tempId);
  };

  // Copy Route Summary
  const handleCopySummary = () => {
    if (!routeCalculation || !originPoint || !destPoint) return;
    const text = `ROTA DE DISTÂNCIA - GUARDIAR RASTREAMENTOS (${formatDateBR(selectedDate)})
Origem: ${originPoint.title}
Endereço: ${originPoint.address}
Destino: ${destPoint.title}
Endereço: ${destPoint.address}
Distância estimada: ${routeCalculation.distKm} km
Tempo no trânsito: ~${routeCalculation.driveMin} min
Link no Google Maps: ${routeCalculation.gmapsUrl}`;

    navigator.clipboard.writeText(text);
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
  };

  // Initialize and Update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-19.87404, -43.9878],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
      layerGroupRef.current = layerGroup;
    }

    const map = leafletMapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const boundsPoints = [];

    // Marker A (Origin)
    if (originPoint?.lat && originPoint?.lng) {
      const iconA = L.divIcon({
        className: 'custom-calc-icon-a',
        html: `<div style="background:#0284c7;color:#fff;font-weight:900;font-size:12px;width:32px;height:32px;border-radius:9999px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">A</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const markerA = L.marker([originPoint.lat, originPoint.lng], { icon: iconA }).addTo(layerGroup);
      markerA.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;">
          <strong style="color:#0284c7;">PONTO A (ORIGEM)</strong><br/>
          <strong>${originPoint.title}</strong><br/>
          <span style="color:#555;">${originPoint.address}</span>
        </div>
      `);
      boundsPoints.push([originPoint.lat, originPoint.lng]);
    }

    // Marker B (Destination)
    if (destPoint?.lat && destPoint?.lng) {
      const iconB = L.divIcon({
        className: 'custom-calc-icon-b',
        html: `<div style="background:#e31e24;color:#fff;font-weight:900;font-size:12px;width:32px;height:32px;border-radius:9999px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">B</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const markerB = L.marker([destPoint.lat, destPoint.lng], { icon: iconB }).addTo(layerGroup);
      markerB.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;">
          <strong style="color:#e31e24;">PONTO B (DESTINO)</strong><br/>
          <strong>${destPoint.title}</strong><br/>
          <span style="color:#555;">${destPoint.address}</span>
        </div>
      `);
      boundsPoints.push([destPoint.lat, destPoint.lng]);
    }

    // Polyline connecting A and B
    if (
      originPoint?.lat &&
      originPoint?.lng &&
      destPoint?.lat &&
      destPoint?.lng &&
      (originPoint.lat !== destPoint.lat || originPoint.lng !== destPoint.lng)
    ) {
      L.polyline(
        [
          [originPoint.lat, originPoint.lng],
          [destPoint.lat, destPoint.lng],
        ],
        {
          color: '#e31e24',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
        }
      ).addTo(layerGroup);
    }

    // Other scheduled services on that day in faint markers
    dayAppointments.forEach((a) => {
      if (
        (originPoint?.lat === Number(a.lat) && originPoint?.lng === Number(a.lng)) ||
        (destPoint?.lat === Number(a.lat) && destPoint?.lng === Number(a.lng))
      ) {
        return;
      }
      if (a.lat && a.lng) {
        const otherIcon = L.divIcon({
          className: 'other-day-app',
          html: `<div style="background:#1e495d;color:#fff;font-size:10px;font-weight:bold;width:24px;height:24px;border-radius:9999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${a.cleanTime}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([Number(a.lat), Number(a.lng)], { icon: otherIcon }).addTo(
          layerGroup
        );
        marker.bindPopup(`
          <div style="font-family:sans-serif;font-size:11px;">
            <strong>[${a.cleanTime}] ${a.contact_name || a.client_name}</strong><br/>
            ${a.vehicle_model} (${a.vehicle_plate})<br/>
            ${a.address}
          </div>
        `);
        boundsPoints.push([Number(a.lat), Number(a.lng)]);
      }
    });

    if (boundsPoints.length > 0) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 15 });
    }
  }, [originPoint, destPoint, dayAppointments]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Route className="w-5 h-5 text-[#e31e24]" />
              Calculadora de Rota & Horários Disponíveis
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Calcule a distância e tempo no trânsito de um serviço a outro e consulte os melhores
              horários livres na agenda.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#0b1d26] border border-[#24536a] px-3.5 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-[#ff6b6f] shrink-0" />
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Data dos Serviços
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onChangeDate(e.target.value)}
                className="bg-transparent text-xs text-white font-bold font-mono focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#163848] text-slate-200 font-semibold border border-[#1f495d]">
              {dayAppointments.length} OS no dia
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Selectors & Results (Left) + Interactive Map (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Origin/Dest Selectors & Route Analysis */}
        <div className="xl:col-span-6 space-y-5">
          {/* Points Selection Card */}
          <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-[#1f495d] pb-2 flex items-center justify-between">
              <span>Selecione os Dois Pontos para Calcular</span>
              <button
                type="button"
                onClick={handleSwap}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-sky-300 text-xs font-semibold border border-[#24536a] transition cursor-pointer"
                title="Inverter Ponto A e Ponto B"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Inverter (A ⇄ B)
              </button>
            </div>

            {/* PONTO A: ORIGEM */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-black">
                  A
                </span>
                Origem (Primeiro Serviço ou Ponto de Saída)
              </label>
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:border-sky-400 focus:outline-none"
              >
                <optgroup label="Base Operacional">
                  <option value="HQ_BASE">🏢 Base Guardiar (Rua Sena Madureira, 253 - Ouro Preto, BH)</option>
                </optgroup>
                <optgroup label={`Serviços Agendados no Dia (${formatDateBR(selectedDate)})`}>
                  {dayAppointments.length === 0 ? (
                    <option disabled value="">
                      Nenhum serviço agendado nesta data
                    </option>
                  ) : (
                    dayAppointments.map((a) => (
                      <option key={a.id} value={`APP_${a.id}`}>
                        [{a.cleanTime}] {a.contact_name || a.client_name} — {a.neighborhood || a.city} ({a.vehicle_model})
                      </option>
                    ))
                  )}
                </optgroup>
                <optgroup label="Outro">
                  <option value="CUSTOM">📍 Digitar Endereço Avulso...</option>
                </optgroup>
              </select>

              {originId === 'CUSTOM' && (
                <div className="flex gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Ex: Rua João Gomide Leite, 81 - Pindorama..."
                      value={customOrigin.query}
                      onChange={(e) => setCustomOrigin({ ...customOrigin, query: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGeocodeCustom('ORIGIN');
                        }
                      }}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg pl-9 pr-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGeocodeCustom('ORIGIN')}
                    disabled={customOrigin.geocoding}
                    className="px-3 py-2 bg-[#163848] hover:bg-[#1e495d] text-white text-xs font-bold rounded-lg border border-[#24536a] cursor-pointer"
                  >
                    {customOrigin.geocoding ? 'Buscando...' : 'Localizar'}
                  </button>
                </div>
              )}

              {originPoint && (
                <div className="text-[11px] text-slate-300 bg-[#0b1d26]/80 p-2.5 rounded-lg border border-[#193d4f]">
                  <strong className="text-white">{originPoint.title}</strong>
                  <div className="text-slate-400 truncate">{originPoint.address}</div>
                </div>
              )}
            </div>

            {/* PONTO B: DESTINO */}
            <div className="space-y-2 pt-2 border-t border-[#193d4f]">
              <label className="block text-xs font-bold text-[#ff6b6f] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#e31e24] text-white flex items-center justify-center text-[10px] font-black">
                  B
                </span>
                Destino (Segundo Serviço ou Novo Cliente a Atender)
              </label>
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:border-[#e31e24] focus:outline-none"
              >
                <optgroup label="Base Operacional">
                  <option value="HQ_BASE">🏢 Base Guardiar (Rua Sena Madureira, 253 - Ouro Preto, BH)</option>
                </optgroup>
                <optgroup label={`Serviços Agendados no Dia (${formatDateBR(selectedDate)})`}>
                  {dayAppointments.length === 0 ? (
                    <option disabled value="">
                      Nenhum serviço agendado nesta data
                    </option>
                  ) : (
                    dayAppointments.map((a) => (
                      <option key={a.id} value={`APP_${a.id}`}>
                        [{a.cleanTime}] {a.contact_name || a.client_name} — {a.neighborhood || a.city} ({a.vehicle_model})
                      </option>
                    ))
                  )}
                </optgroup>
                <optgroup label="Outro">
                  <option value="CUSTOM">📍 Digitar Endereço de Novo Cliente...</option>
                </optgroup>
              </select>

              {destId === 'CUSTOM' && (
                <div className="flex gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Ex: Av. Amazonas, 1200 - Centro, BH..."
                      value={customDest.query}
                      onChange={(e) => setCustomDest({ ...customDest, query: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGeocodeCustom('DEST');
                        }
                      }}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg pl-9 pr-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGeocodeCustom('DEST')}
                    disabled={customDest.geocoding}
                    className="px-3 py-2 bg-[#163848] hover:bg-[#1e495d] text-white text-xs font-bold rounded-lg border border-[#24536a] cursor-pointer"
                  >
                    {customDest.geocoding ? 'Buscando...' : 'Localizar'}
                  </button>
                </div>
              )}

              {destPoint && (
                <div className="text-[11px] text-slate-300 bg-[#0b1d26]/80 p-2.5 rounded-lg border border-[#193d4f]">
                  <strong className="text-white">{destPoint.title}</strong>
                  <div className="text-slate-400 truncate">{destPoint.address}</div>
                </div>
              )}
            </div>
          </div>

          {/* Results Metric Card */}
          {routeCalculation && (
            <div className="bg-[#0f2834] border-2 border-sky-500/60 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f495d] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">
                    Resultado do Trajeto: Ponto A ➔ Ponto B
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] border border-[#24536a] text-xs font-semibold text-slate-200 transition cursor-pointer"
                  >
                    {copiedInfo ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedInfo ? 'Copiado!' : 'Copiar Resumo'}
                  </button>
                  <a
                    href={routeCalculation.gmapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow transition cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Abrir no Google Maps ↗
                  </a>
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#0b1d26] border border-[#24536a] rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-slate-400">Distância Real</div>
                  <div className="text-xl font-black text-white font-mono mt-0.5">
                    {routeCalculation.distKm} km
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">rota viária estimada</div>
                </div>

                <div className="bg-[#0b1d26] border border-[#24536a] rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-slate-400">Tempo no Trânsito</div>
                  <div className="text-xl font-black text-sky-400 font-mono mt-0.5">
                    ~{routeCalculation.driveMin} min
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">trânsito urbano BH</div>
                </div>

                <div className="bg-[#0b1d26] border border-[#24536a] rounded-xl p-3 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-semibold text-slate-400">Chegada Prevista</div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                    {routeCalculation.arrivalTime ? routeCalculation.arrivalTime : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {routeCalculation.departureTime ? `saída às ${routeCalculation.departureTime}` : 'após serviço A'}
                  </div>
                </div>
              </div>

              {/* Transit Tip */}
              <div className="text-xs bg-[#0b1d26] border border-[#193d4f] rounded-xl p-3 text-slate-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  Deslocamento de <strong className="text-white">{routeCalculation.distKm} km</strong> entre{' '}
                  <span className="text-sky-300 font-semibold">{originPoint?.title}</span> e{' '}
                  <span className="text-[#ff8589] font-semibold">{destPoint?.title}</span>. Tempo de trajeto{' '}
                  <strong className="text-white">~{routeCalculation.driveMin} minutos</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Opções de Horários Disponíveis no Dia */}
          <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f495d] pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Opções de Horários Disponíveis ({formatDateBR(selectedDate)})
                </h3>
                <p className="text-xs text-slate-300">
                  Horários livres recomendados para agendar o Ponto B considerando o tempo de deslocamento.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {timeSlotOptions.map((item) => {
                if (item.isAvailable) {
                  return (
                    <div
                      key={item.slot}
                      className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                        item.isRecommended
                          ? 'bg-emerald-500/15 border-emerald-400 shadow-lg'
                          : 'bg-[#0b1d26] border-[#24536a] hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                          {item.isRecommended ? '⭐' : '🟢'} {item.slot}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            item.isRecommended
                              ? 'bg-emerald-500 text-white'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {item.isRecommended ? 'Recomendado' : 'Disponível'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300">
                        {item.isRecommended
                          ? item.reason
                          : 'Horário livre para agendamento'}
                      </div>

                      {onScheduleAtSlot && (
                        <button
                          type="button"
                          onClick={() =>
                            onScheduleAtSlot({
                              date: selectedDate,
                              time: item.slot,
                              destAddress: destPoint?.address || '',
                            })
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Agendar às {item.slot}
                        </button>
                      )}
                    </div>
                  );
                }

                // Occupied Slot
                const occ = item.occupiedApp;
                return (
                  <div
                    key={item.slot}
                    className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-rose-300 flex items-center gap-1.5">
                        🔒 {item.slot}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                        Ocupado
                      </span>
                    </div>
                    <div className="text-xs text-white font-semibold truncate">
                      {occ.contact_name || occ.client_name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {occ.neighborhood || occ.city} • {occ.vehicle_model} ({occ.vehicle_plate})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Map & All Legs of the Day */}
        <div className="xl:col-span-6 space-y-5">
          {/* Map Card */}
          <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-[#12303e] px-4 py-3 border-b border-[#1f495d] flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#e31e24]" />
                Visualização do Trajeto no Mapa
              </span>
              <span className="text-[11px] text-slate-300">
                Ponto <strong className="text-sky-400">A (Azul)</strong> ➔ Ponto{' '}
                <strong className="text-[#ff6b6f]">B (Vermelho)</strong>
              </span>
            </div>
            <div ref={mapContainerRef} className="w-full h-[420px] bg-[#0b1d26]" />
          </div>

          {/* Sequence of All Legs of the Selected Day */}
          <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#1f495d] pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Car className="w-4 h-4 text-sky-400" />
                Distâncias entre Todos os Serviços Agendados do Dia
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {dayAppointments.length} Serviços em sequência
              </span>
            </div>

            {dayAppointments.length < 2 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                Cadastre pelo menos 2 serviços em {formatDateBR(selectedDate)} para ver os trechos
                consecutivos calculados.
              </div>
            ) : (
              <div className="space-y-2.5">
                {dayAppointments.map((app, idx) => {
                  if (idx === dayAppointments.length - 1) return null;
                  const nextApp = dayAppointments[idx + 1];
                  const dist = calculateDistanceKm(app.lat, app.lng, nextApp.lat, nextApp.lng);
                  const drive = calculateDriveMinutes(dist);

                  return (
                    <div
                      key={`${app.id}-${nextApp.id}`}
                      className="bg-[#0b1d26] border border-[#1f495d] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-white font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-sky-600/30 text-sky-300 font-mono text-[11px]">
                            {app.cleanTime}
                          </span>
                          <span>{app.contact_name || app.client_name}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="px-1.5 py-0.5 rounded bg-[#e31e24]/30 text-[#ff8589] font-mono text-[11px]">
                            {nextApp.cleanTime}
                          </span>
                          <span>{nextApp.contact_name || nextApp.client_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[420px]">
                          {app.neighborhood || app.city} ➔ {nextApp.neighborhood || nextApp.city}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-[#163848] text-white font-mono font-bold">
                          {dist} km
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-mono font-semibold">
                          ~{drive} min
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOriginId(`APP_${app.id}`);
                            setDestId(`APP_${nextApp.id}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#1f495d] hover:bg-[#28607a] text-slate-200 text-[11px] font-semibold transition cursor-pointer"
                          title="Focar este trecho na calculadora"
                        >
                          Simular
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
