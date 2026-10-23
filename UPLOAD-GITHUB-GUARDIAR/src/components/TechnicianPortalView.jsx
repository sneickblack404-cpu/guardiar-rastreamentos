import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  Car,
  Navigation,
  Sparkles,
  ExternalLink,
  Wrench,
  AlertCircle,
  Play,
  Check,
  Truck,
} from 'lucide-react';
import InteractiveRouteMap from './InteractiveRouteMap';
import WhatsAppIcon from './WhatsAppIcon';
import {
  STATUS_CONFIG,
  SERVICE_TYPES,
  formatDateBR,
  getSinglePointGoogleMapsUrl,
  getWhatsAppConfirmationUrl,
} from '../utils/constants';

export default function TechnicianPortalView({
  authenticatedUser,
  technicians = [],
  appointments = [],
  settings = {},
  selectedDate,
  onChangeDate,
  todayDate,
  onStatusChange,
  onRefreshData,
}) {
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'PENDING' | 'COMPLETED'
  const [includeUnassigned, setIncludeUnassigned] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [optimizing, setOptimizing] = useState(false);

  const techProfile =
    technicians.find((t) => Number(t.id) === Number(authenticatedUser?.technician_id)) ||
    technicians[0];

  // Appointments for this technician on selectedDate (plus unassigned if toggled)
  const myDayAppointments = appointments
    .filter((a) => {
      if (a.scheduled_date !== selectedDate || a.status === 'CANCELADO') return false;
      if (techProfile && Number(a.technician_id) === Number(techProfile.id)) return true;
      if (includeUnassigned && !a.technician_id) return true;
      return false;
    })
    .sort((a, b) => {
      const orderA = a.route_order > 0 ? a.route_order : 999;
      const orderB = b.route_order > 0 ? b.route_order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.window_start || a.scheduled_time).localeCompare(
        String(b.window_start || b.scheduled_time)
      );
    });

  const pendingServices = myDayAppointments.filter((a) => a.status !== 'CONCLUIDO');
  const completedServices = myDayAppointments.filter((a) => a.status === 'CONCLUIDO');

  const visibleAppointments =
    filterMode === 'PENDING'
      ? pendingServices
      : filterMode === 'COMPLETED'
      ? completedServices
      : myDayAppointments;

  // Fetch route calculation from backend
  const calculateTechRoute = useCallback(
    async (mode = 'time_window_proximity') => {
      if (!techProfile) return;
      setOptimizing(true);
      try {
        const customIds = myDayAppointments.map((a) => a.id);
        const res = await fetch('/api/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            technician_id: includeUnassigned ? 'ALL_DAY' : techProfile.id,
            mode,
            origin_type: 'tech_base',
            return_to_base: true,
            custom_order_ids: mode === 'preserve' ? customIds : null,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          // Filter routeData stops to only myDayAppointments
          const myIds = new Set(myDayAppointments.map((x) => x.id));
          const filteredStops = (data.stops || []).filter((s) => myIds.has(s.id));
          setRouteData({
            ...data,
            stops: filteredStops,
          });
          if (mode !== 'preserve') {
            onRefreshData?.();
          }
        }
      } catch (err) {
        console.error('Error calculating technician route:', err);
      } finally {
        setOptimizing(false);
      }
    },
    [selectedDate, techProfile, includeUnassigned, myDayAppointments.length]
  );

  useEffect(() => {
    calculateTechRoute('preserve');
  }, [selectedDate, techProfile?.id, includeUnassigned, myDayAppointments.length]);

  const originPoint = {
    lat: techProfile?.base_lat || Number(settings.hq_lat || -19.87404),
    lng: techProfile?.base_lng || Number(settings.hq_lng || -43.98780),
    label: `Ponto de Partida: ${techProfile?.name || 'Base Guardiar'}`,
    address: techProfile?.base_address || settings.hq_address || 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
  };

  // Enrich visible appointments with ETA/distance from routeData if available
  const routeStopMap = new Map((routeData?.stops || []).map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      {/* Technician Welcome & Date Selector Header */}
      <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-lg border-2 border-white/20"
            style={{ backgroundColor: techProfile?.color || '#e31e24' }}
          >
            {techProfile?.badge || 'TEC'}
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff8589]">
              Painel Exclusivo do Técnico de Campo
            </span>
            <h2 className="text-lg font-extrabold text-white">{techProfile?.name}</h2>
            <p className="text-xs text-slate-300">
              Viatura: <strong>{techProfile?.fleet_vehicle}</strong> ({techProfile?.fleet_plate}) • Região:{' '}
              {techProfile?.region}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#0b1d26] border border-[#24536a] rounded-xl p-1">
            <button
              type="button"
              onClick={() => onChangeDate(todayDate)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedDate === todayDate
                  ? 'bg-[#e31e24] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Agenda de Hoje
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="bg-transparent px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-200 bg-[#0b1d26] border border-[#24536a] px-3 py-2 rounded-xl cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeUnassigned}
              onChange={(e) => setIncludeUnassigned(e.target.checked)}
              className="rounded border-[#24536a] bg-[#0f2834] text-[#e31e24]"
            />
            Mostrar também OS gerais do dia
          </label>
        </div>
      </div>

      {/* 3 Clickable Status Filter Cards: Total, Faltam, Concluídos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setFilterMode('ALL')}
          className={`text-left p-4 rounded-xl border transition cursor-pointer ${
            filterMode === 'ALL'
              ? 'bg-[#143545] border-[#e31e24] shadow-lg'
              : 'bg-[#0f2834] border-[#1f495d] hover:border-slate-500'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Agenda Total do Dia ({formatDateBR(selectedDate)})</span>
            <Calendar className="w-4 h-4 text-[#ff6b6f]" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono mt-1">
            {myDayAppointments.length}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            Clique para ver todos os agendamentos
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('PENDING')}
          className={`text-left p-4 rounded-xl border transition cursor-pointer ${
            filterMode === 'PENDING'
              ? 'bg-amber-500/20 border-amber-400 shadow-lg'
              : 'bg-[#0f2834] border-[#1f495d] hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>Serviços que Faltam (Pendentes / Em Execução)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono mt-1">
            {pendingServices.length}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            {pendingServices.length === 0
              ? 'Todos os serviços do dia foram concluídos!'
              : 'Clique para filtrar apenas os que faltam'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('COMPLETED')}
          className={`text-left p-4 rounded-xl border transition cursor-pointer ${
            filterMode === 'COMPLETED'
              ? 'bg-emerald-500/20 border-emerald-400 shadow-lg'
              : 'bg-[#0f2834] border-[#1f495d] hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <span>Serviços Concluídos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
            {completedServices.length}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            Clique para ver os serviços já finalizados
          </div>
        </button>
      </div>

      {/* Main Split Grid: Agenda do Dia & Dados dos Clientes (Left 6 cols) + Mapa com Rotas (Right 6 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Agenda do Dia e Dados do Cliente */}
        <div className="xl:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f2834] border border-[#1f495d] rounded-xl px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Agenda do Dia & Dados dos Clientes ({visibleAppointments.length})
              </h3>
              <p className="text-xs text-slate-300">
                Ordem de atendimento com contato, endereço completo, veículo e atualização de status.
              </p>
            </div>
            <button
              type="button"
              disabled={optimizing}
              onClick={() => calculateTechRoute('time_window_proximity')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {optimizing ? 'Calculando...' : 'Otimizar Minha Rota'}
            </button>
          </div>

          <div className="space-y-3.5 max-h-[680px] overflow-y-auto pr-1">
            {visibleAppointments.length === 0 ? (
              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-white">
                  Nenhum serviço encontrado neste filtro para {formatDateBR(selectedDate)}
                </div>
                <p className="text-xs text-slate-300">
                  Altere o filtro acima (Total / Faltam / Concluídos) ou selecione outra data.
                </p>
              </div>
            ) : (
              visibleAppointments.map((item, idx) => {
                const enriched = routeStopMap.get(item.id) || item;
                const isDone = item.status === 'CONCLUIDO';
                const stInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.AGENDADO;
                const srvInfo = SERVICE_TYPES[item.service_type] || SERVICE_TYPES.INSTALACAO;
                const stopSeq = enriched.stop_number || item.route_order || idx + 1;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition space-y-3 shadow-lg ${
                      isDone
                        ? 'bg-[#0c232d]/90 border-emerald-500/40'
                        : 'bg-[#0f2834] border-[#24536a]'
                    }`}
                  >
                    {/* Header: Sequence, OS, Window & Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#193d4f]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-8 h-8 rounded-full font-extrabold text-xs flex items-center justify-center text-white shadow ${
                            isDone ? 'bg-emerald-600' : 'bg-[#e31e24]'
                          }`}
                        >
                          #{stopSeq}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#ff8589]">
                              {item.os_number}
                            </span>
                            <span className="text-xs font-mono font-bold text-white bg-[#0b1d26] px-2 py-0.5 rounded border border-[#24536a]">
                              ⏰ Janela: {item.time_window}
                            </span>
                          </div>
                          {enriched.leg_distance_km !== undefined && (
                            <div className="text-[11px] text-emerald-300 font-mono mt-0.5">
                              Deslocamento: +{enriched.leg_distance_km} km (~{enriched.leg_drive_min} min) • Chegada prevista: {enriched.eta_arrival}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isDone ? '✅ CONCLUÍDO' : `⏳ FALTA (${stInfo.shortLabel.toUpperCase()})`}
                      </span>
                    </div>

                    {/* Client & Address Box (Dados do Cliente da Agenda) */}
                    <div className="bg-[#0b1d26] border border-[#193d4f] rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#ff8589]">
                        Dados do Cliente & Endereço de Atendimento
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                          <User className="w-4 h-4 text-[#e31e24] shrink-0" />
                          <span>{item.contact_name || item.client_name}</span>
                        </div>

                        <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                          <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                          {item.contact_phone ? (
                            <div className="flex items-center gap-2">
                              <a href={`tel:${item.contact_phone}`} className="hover:underline">
                                {item.contact_phone}
                              </a>
                              <a
                                href={getWhatsAppConfirmationUrl(item)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-[10px] font-semibold transition"
                                title="Enviar mensagem no WhatsApp"
                              >
                                <WhatsAppIcon className="w-3 h-3" />
                                WhatsApp
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">Telefone não informado</span>
                          )}
                        </div>
                      </div>

                      {item.onsite_authorized_person && (
                        <div className="text-slate-300">
                          👤 <strong>Procurar no local por:</strong> {item.onsite_authorized_person}
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-slate-100 pt-1 border-t border-[#193d4f]">
                        <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-white">{item.address}</div>
                          <div className="text-slate-300">
                            Bairro: <strong>{item.neighborhood}</strong> • {item.city}/{item.state}
                            {item.cep ? ` • CEP: ${item.cep}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle & Technical Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#133241]/60 p-3 rounded-xl border border-[#1f495d]">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <span className="text-slate-300">Veículo: </span>
                          <strong className="font-mono text-white">{item.vehicle_plate}</strong> —{' '}
                          <span className="text-white font-semibold">{item.vehicle_model}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#ff6b6f] shrink-0" />
                        <span className={`font-bold ${srvInfo.color}`}>
                          {srvInfo.label} ({item.estimated_duration_min} min)
                        </span>
                      </div>
                      {item.install_hidden_spot && (
                        <div className="sm:col-span-2 text-slate-200">
                          🔒 <strong>Local de Instalação:</strong> {item.install_hidden_spot}
                        </div>
                      )}
                      {item.internal_notes && (
                        <div className="sm:col-span-2 text-amber-200">
                          📌 <strong>Instruções:</strong> {item.internal_notes}
                        </div>
                      )}
                    </div>

                    {/* Technician Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.status !== 'CONCLUIDO' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onStatusChange(item.id, 'EM_DESLOCAMENTO')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                item.status === 'EM_DESLOCAMENTO'
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-[#163848] hover:bg-[#1e495d] text-slate-200'
                              }`}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Em Deslocamento
                            </button>

                            <button
                              type="button"
                              onClick={() => onStatusChange(item.id, 'EM_EXECUCAO')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                item.status === 'EM_EXECUCAO'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-[#163848] hover:bg-[#1e495d] text-slate-200'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5" />
                              Em Execução
                            </button>

                            <button
                              type="button"
                              onClick={() => onStatusChange(item.id, 'CONCLUIDO')}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 shadow transition cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Concluir Serviço
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStatusChange(item.id, 'AGENDADO')}
                            className="px-3 py-1.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-200 text-xs font-semibold cursor-pointer"
                          >
                            Reabrir Serviço (Voltar para Pendente)
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={getWhatsAppConfirmationUrl(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold shadow transition cursor-pointer"
                          title="Enviar Confirmação por WhatsApp"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow transition"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Ir com Google Maps ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Mapa com Rotas Integrado ao Google Maps */}
        <div className="xl:col-span-6 space-y-4">
          <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#e31e24]" />
                Mapa da Rota do Dia
              </h3>
              <p className="text-xs text-slate-300">
                Distância total estimada:{' '}
                <strong className="text-white font-mono">
                  {routeData?.metrics?.total_distance_km || 0} km
                </strong>{' '}
                • Tempo em trânsito:{' '}
                <strong className="text-sky-400 font-mono">
                  {routeData?.metrics?.total_drive_min || 0} min
                </strong>
              </p>
            </div>

            {routeData?.google_maps_url && (
              <a
                href={routeData.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow-lg transition"
              >
                <Navigation className="w-4 h-4" />
                Abrir Rota Completa no Google Maps
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <InteractiveRouteMap
            origin={originPoint}
            stops={routeData?.stops?.length ? routeData.stops : myDayAppointments}
            unassignedStops={[]}
            allTechniciansMode={false}
            technicians={technicians}
            activeTechColor={techProfile?.color || '#e31e24'}
            returnToBase={true}
            googleMapsApiKey={settings.google_maps_api_key}
            googleMapsRouteUrl={routeData?.google_maps_url}
            heightClass="h-[640px]"
          />
        </div>
      </div>
    </div>
  );
}
