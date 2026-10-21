import React, { useState, useEffect, useCallback } from 'react';
import {
  Navigation,
  Sparkles,
  Compass,
  MapPin,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Copy,
  Check,
  Printer,
  AlertTriangle,
  Route,
  Car,
  Edit3,
  RotateCcw,
  UserMinus,
} from 'lucide-react';
import InteractiveRouteMap from './InteractiveRouteMap';
import { STATUS_CONFIG, SERVICE_TYPES, formatDateBR } from '../utils/constants';

export default function RoutePlannerView({
  selectedDate,
  onChangeDate,
  technicians = [],
  appointments = [],
  settings = {},
  onEditAppointment,
  onAssignTechToAppointment,
  onStatusChange,
  onRefreshData,
}) {
  // Default to ALL_DAY so even appointments created without a technician can be optimized immediately!
  const [selectedTechId, setSelectedTechId] = useState('ALL_DAY');
  const [originType, setOriginType] = useState('company_hq');
  const [returnToBase, setReturnToBase] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const unassignedForDate = appointments.filter(
    (a) => a.scheduled_date === selectedDate && !a.technician_id && a.status !== 'CANCELADO'
  );

  const allForDate = appointments.filter(
    (a) => a.scheduled_date === selectedDate && a.status !== 'CANCELADO'
  );

  const fetchRouteCalculation = useCallback(
    async (mode = 'time_window_proximity', customOrderIds = null) => {
      if (!selectedTechId || selectedTechId === 'ALL') {
        setRouteData(null);
        return;
      }
      setOptimizing(true);
      try {
        const res = await fetch('/api/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            technician_id: selectedTechId === 'ALL_DAY' ? 'ALL_DAY' : Number(selectedTechId),
            mode,
            origin_type: selectedTechId === 'ALL_DAY' ? 'company_hq' : originType,
            return_to_base: returnToBase,
            custom_order_ids: customOrderIds,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setRouteData(data);
          if (!customOrderIds) {
            onRefreshData?.();
          }
        }
      } catch (err) {
        console.error('Failed to calculate route:', err);
      } finally {
        setOptimizing(false);
      }
    },
    [selectedDate, selectedTechId, originType, returnToBase]
  );

  useEffect(() => {
    if (selectedTechId && selectedTechId !== 'ALL') {
      const currentStops = appointments
        .filter((a) => {
          if (a.scheduled_date !== selectedDate || a.status === 'CANCELADO') return false;
          if (selectedTechId === 'ALL_DAY') return true;
          return String(a.technician_id) === String(selectedTechId);
        })
        .sort((a, b) => (a.route_order || 99) - (b.route_order || 99));
      const ids = currentStops.map((s) => s.id);
      fetchRouteCalculation('time_window_proximity', ids.length > 0 ? ids : null);
    }
  }, [selectedDate, selectedTechId, originType, returnToBase, appointments.length]);

  const handleMoveStop = async (index, direction) => {
    if (!routeData || !routeData.stops) return;
    const newStops = [...routeData.stops];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newStops.length) return;

    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;

    const customIds = newStops.map((s) => s.id);
    await fetchRouteCalculation('custom', customIds);
    onRefreshData?.();
  };

  const handleAssignPendingStop = async (pendingApp) => {
    const targetTech =
      selectedTechId === 'ALL' || selectedTechId === 'ALL_DAY'
        ? technicians[0]?.id
        : Number(selectedTechId);
    if (!targetTech) return;
    await onAssignTechToAppointment(pendingApp.id, targetTech);
    await fetchRouteCalculation('time_window_proximity', null);
  };

  const handleCopyUrl = () => {
    if (!routeData?.google_maps_url) return;
    navigator.clipboard.writeText(routeData.google_maps_url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const activeTech = technicians.find((t) => String(t.id) === String(selectedTechId));

  const mapOrigin =
    selectedTechId === 'ALL' || selectedTechId === 'ALL_DAY'
      ? {
          lat: Number(settings.hq_lat || -19.87404),
          lng: Number(settings.hq_lng || -43.98780),
          label: settings.hq_name || 'Base Guardiar - Ouro Preto (BH)',
          address: settings.hq_address || 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
        }
      : routeData?.origin || {
          lat: activeTech?.base_lat || -19.87404,
          lng: activeTech?.base_lng || -43.98780,
          label: `Base: ${activeTech?.name || ''}`,
          address: activeTech?.base_address || 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
        };

  const mapStops =
    selectedTechId === 'ALL' ? allForDate : routeData?.stops || [];

  return (
    <div className="space-y-5">
      {/* Top Control Panel */}
      <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Data da Rota
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onChangeDate(e.target.value)}
                className="bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Roteiro / Técnico de Campo
              </label>
              <select
                value={selectedTechId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTechId(val === 'ALL' || val === 'ALL_DAY' ? val : Number(val));
                }}
                className="bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white font-medium min-w-[270px]"
              >
                <option value="ALL_DAY">🚀 Rota Unificada do Dia — Todas as OS ({allForDate.length} OS)</option>
                {technicians.map((t) => {
                  const count = appointments.filter(
                    (a) =>
                      a.scheduled_date === selectedDate &&
                      a.technician_id === t.id &&
                      a.status !== 'CANCELADO'
                  ).length;
                  return (
                    <option key={t.id} value={t.id}>
                      [{t.badge}] {t.name} — {t.region} ({count} OS)
                    </option>
                  );
                })}
                <option value="ALL">🗺️ Visão Multi-Equipes no Mapa</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b1d26] border border-[#24536a] text-xs text-slate-200 mt-5">
              <MapPin className="w-3.5 h-3.5 text-[#e31e24]" />
              <span>
                Início da Rota: <strong className="text-white">Sempre no 1º Serviço Agendado</strong>
              </span>
            </div>
          </div>

          {/* Right: Smart Optimization Actions */}
          {selectedTechId !== 'ALL' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={optimizing}
                onClick={() => fetchRouteCalculation('time_window_proximity', null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                title="Ordena respeitando os horários das janelas e a menor distância"
              >
                <Sparkles className="w-4 h-4" />
                {optimizing ? 'Calculando...' : 'Otimizar Rota (Janela + Proximidade)'}
              </button>

              <button
                type="button"
                disabled={optimizing}
                onClick={() => fetchRouteCalculation('proximity', null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-100 border border-[#24536a] text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                title="Ordena puramente pela menor distância geográfica"
              >
                <Compass className="w-4 h-4 text-[#ff6b6f]" />
                Menor Distância Pura
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Sequence Panel (Left) + Interactive Map (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Route Sequence & Metrics */}
        <div className="xl:col-span-5 space-y-4">
          {selectedTechId !== 'ALL' && routeData && (
            <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeTech?.color || '#e31e24' }}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {selectedTechId === 'ALL_DAY'
                        ? 'Roteiro Unificado do Dia (Guardiar)'
                        : activeTech?.name}
                    </h3>
                    <p className="text-xs text-slate-300">
                      {selectedTechId === 'ALL_DAY'
                        ? 'Início da Rota: 1º Serviço Agendado do Dia'
                        : `${activeTech?.fleet_vehicle} (${activeTech?.fleet_plate}) • Início no 1º Serviço`}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#0b1d26] border border-[#24536a] text-xs font-mono font-semibold text-slate-200">
                  {routeData.stops?.length || 0} Paradas
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-[#0b1d26]/90 border border-[#193d4f] rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">Distância Total</div>
                  <div className="text-base font-bold text-white font-mono">
                    {routeData.metrics?.total_distance_km || 0} km
                  </div>
                </div>
                <div className="bg-[#0b1d26]/90 border border-[#193d4f] rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">Tempo no Trânsito</div>
                  <div className="text-base font-bold text-sky-400 font-mono">
                    {routeData.metrics?.total_drive_min || 0} min
                  </div>
                </div>
                <div className="bg-[#0b1d26]/90 border border-[#193d4f] rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">Tempo de Serviço</div>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    {routeData.metrics?.total_service_min || 0} min
                  </div>
                </div>
              </div>

              {routeData.google_maps_url && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={routeData.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow-lg transition"
                  >
                    <Navigation className="w-4 h-4" />
                    Abrir Rota Completa no Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-100 border border-[#24536a] text-xs font-semibold transition cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Link
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-100 border border-[#24536a] text-xs font-semibold transition cursor-pointer"
                    title="Imprimir Folha de Rota"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Ordered Stops List */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {mapStops.length === 0 ? (
              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-8 text-center space-y-2">
                <Route className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-200">
                  Nenhuma Ordem de Serviço na rota selecionada
                </div>
                <p className="text-xs text-slate-400">
                  Selecione outra data ou cadastre uma nova OS para gerar o roteiro.
                </p>
              </div>
            ) : (
              mapStops.map((stop, idx) => {
                const statusInfo = STATUS_CONFIG[stop.status] || STATUS_CONFIG.AGENDADO;
                const serviceInfo = SERVICE_TYPES[stop.service_type] || SERVICE_TYPES.INSTALACAO;
                const stopNumber = stop.stop_number || stop.route_order || idx + 1;

                return (
                  <div
                    key={stop.id}
                    className="bg-[#0f2834] border border-[#1f495d] hover:border-[#2d6884] rounded-xl p-3.5 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded bg-[#0b1d26] border border-[#193d4f] text-slate-300">
                      {idx === 0 ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          🚩 PONTO DE PARTIDA DA ROTA (1º Serviço)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Navigation className="w-3 h-3 text-[#e31e24]" />
                          Serviço #{idx} → Serviço #{stopNumber}:{' '}
                          <strong className="text-white font-mono">+{stop.leg_distance_km || 0} km</strong> (~
                          {stop.leg_drive_min || 0} min)
                        </span>
                      )}
                      {stop.eta_arrival && (
                        <span className="font-mono text-emerald-400 font-semibold">
                          Horário: {stop.eta_arrival}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow"
                          style={{
                            backgroundColor:
                              stop.status === 'CONCLUIDO'
                                ? '#059669'
                                : stop.technician_color || activeTech?.color || '#e31e24',
                          }}
                        >
                          {stopNumber}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-[#ff8589]">{stop.os_number}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                            >
                              {statusInfo.shortLabel}
                            </span>
                            <span className="text-[11px] text-slate-300 font-mono font-semibold">
                              ⏰ {stop.time_window}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-0.5">{stop.contact_name || stop.client_name}</h4>
                        </div>
                      </div>

                      {selectedTechId !== 'ALL' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStop(idx, -1)}
                            className="p-1 rounded bg-[#163848] hover:bg-[#1e495d] text-slate-200 disabled:opacity-30"
                            title="Subir na rota"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === mapStops.length - 1}
                            onClick={() => handleMoveStop(idx, 1)}
                            className="p-1 rounded bg-[#163848] hover:bg-[#1e495d] text-slate-200 disabled:opacity-30"
                            title="Descer na rota"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {stop.is_late_warning && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ETA previsto ({stop.eta_arrival}) ultrapassa o horário agendado ({stop.time_window}).
                      </div>
                    )}

                    <div className="text-xs text-slate-200 space-y-1 pl-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {stop.address} — <strong className="text-white">{stop.neighborhood}</strong> ({stop.city})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-slate-300">
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-sky-400" />
                          <strong className="text-white font-mono">{stop.vehicle_plate}</strong> ({stop.vehicle_model})
                        </span>
                        <span className={`font-semibold ${serviceInfo.color}`}>{serviceInfo.label}</span>
                      </div>
                      {stop.contact_phone && (
                        <div className="text-[11px] text-slate-300">
                          📞 Contato: <strong>{stop.contact_phone}</strong>
                        </div>
                      )}
                      {stop.install_hidden_spot && (
                        <div className="text-[11px] text-slate-300 bg-[#0b1d26] px-2.5 py-1 rounded border border-[#193d4f]">
                          🔒 <strong className="text-white">Local Oculto:</strong> {stop.install_hidden_spot}
                        </div>
                      )}
                    </div>

                    {/* Technician assignment / removal & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#193d4f]">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={stop.status}
                          onChange={(e) => onStatusChange(stop.id, e.target.value)}
                          className="bg-[#0b1d26] border border-[#24536a] rounded px-2 py-1 text-[11px] text-slate-200"
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.shortLabel}
                            </option>
                          ))}
                        </select>

                        <select
                          value={stop.technician_id || ''}
                          onChange={(e) =>
                            onAssignTechToAppointment(
                              stop.id,
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className="bg-[#0b1d26] border border-[#24536a] rounded px-2 py-1 text-[11px] text-slate-200"
                          title="Vincular ou Retirar Técnico desta OS"
                        >
                          <option value="">Sem Técnico (Retirar)</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.badge} - {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditAppointment(stop)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#163848] hover:bg-[#1e495d] text-slate-100 text-[11px] font-medium cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                        <a
                          href={
                            stop.google_maps_nav_url ||
                            `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#e31e24]/20 hover:bg-[#e31e24]/30 text-[#ff8589] border border-[#e31e24]/40 text-[11px] font-semibold"
                        >
                          Google Maps ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Interactive Map */}
        <div className="xl:col-span-7">
          <InteractiveRouteMap
            origin={mapOrigin}
            stops={mapStops}
            unassignedStops={selectedTechId === 'ALL_DAY' ? [] : unassignedForDate}
            allTechniciansMode={selectedTechId === 'ALL'}
            technicians={technicians}
            activeTechColor={activeTech?.color || '#e31e24'}
            returnToBase={returnToBase}
            googleMapsApiKey={settings.google_maps_api_key}
            googleMapsRouteUrl={routeData?.google_maps_url}
            onSelectStop={(stop) => onEditAppointment(stop)}
            onAssignUnassignedStop={handleAssignPendingStop}
            heightClass="h-[680px]"
          />
        </div>
      </div>
    </div>
  );
}
