import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  X,
  MapPin,
  Search,
  Calendar,
  Wrench,
  Car,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { STATUS_CONFIG, SERVICE_TYPES, PRIORITY_CONFIG } from '../utils/constants';

export default function AppointmentModal({
  isOpen,
  onClose,
  initialData = null,
  defaultDate,
  currentOperatorName = 'David',
  onSave,
  onDelete,
}) {
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    vehicle_plate: '',
    vehicle_model: '',
    service_type: 'INSTALACAO',
    priority: 'NORMAL',
    status: 'AGENDADO',
    scheduled_date: defaultDate || new Date().toISOString().slice(0, 10),
    window_start: '08:00',
    window_end: '10:00',
    estimated_duration_min: 60,
    cep: '',
    address: '',
    neighborhood: '',
    city: 'São Paulo',
    state: 'SP',
    lat: -23.5505,
    lng: -46.6333,
    onsite_authorized_person: '',
    install_hidden_spot: 'Painel central superior',
    internal_notes: '',
  });

  const [geocoding, setGeocoding] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const miniMapContainerRef = useRef(null);
  const miniMapRef = useRef(null);
  const miniMarkerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      // Parse window_start / window_end from time_window if needed
      let wStart = initialData.window_start || '08:00';
      let wEnd = initialData.window_end || '10:00';
      if ((!initialData.window_start || !initialData.window_end) && initialData.time_window?.includes('-')) {
        const parts = initialData.time_window.split('-').map((s) => s.trim());
        if (parts[0]) wStart = parts[0];
        if (parts[1]) wEnd = parts[1];
      }

      setFormData({
        contact_name: initialData.contact_name || initialData.client_name || '',
        contact_phone: initialData.contact_phone || '',
        vehicle_plate: initialData.vehicle_plate || '',
        vehicle_model: initialData.vehicle_model || '',
        service_type: initialData.service_type || 'INSTALACAO',
        priority: initialData.priority || 'NORMAL',
        status: initialData.status || 'AGENDADO',
        scheduled_date: initialData.scheduled_date || defaultDate,
        window_start: wStart,
        window_end: wEnd,
        estimated_duration_min: initialData.estimated_duration_min || 60,
        cep: initialData.cep || '',
        address: initialData.address || '',
        neighborhood: initialData.neighborhood || '',
        city: initialData.city || 'São Paulo',
        state: initialData.state || 'SP',
        lat: Number(initialData.lat || -23.5505),
        lng: Number(initialData.lng || -46.6333),
        onsite_authorized_person: initialData.onsite_authorized_person || '',
        install_hidden_spot: initialData.install_hidden_spot || '',
        internal_notes: initialData.internal_notes || '',
      });
    } else {
      setFormData({
        contact_name: '',
        contact_phone: '',
        vehicle_plate: '',
        vehicle_model: '',
        service_type: 'INSTALACAO',
        priority: 'NORMAL',
        status: 'AGENDADO',
        scheduled_date: defaultDate || new Date().toISOString().slice(0, 10),
        window_start: '08:00',
        window_end: '10:00',
        estimated_duration_min: 60,
        cep: '',
        address: '',
        neighborhood: '',
        city: 'São Paulo',
        state: 'SP',
        lat: -23.5505,
        lng: -46.6333,
        onsite_authorized_person: '',
        install_hidden_spot: 'Painel central superior',
        internal_notes: '',
      });
    }
    setGeoFeedback('');
  }, [isOpen, initialData, defaultDate]);

  // Initialize Mini Map for Pin Adjustment
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (!miniMapContainerRef.current) return;
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }

      const lat = Number(formData.lat) || -23.5505;
      const lng = Number(formData.lng) || -46.6333;

      const map = L.map(miniMapContainerRef.current, {
        center: [lat, lng],
        zoom: 14,
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'custom-picker-pin',
        html: `<div style="width:28px;height:28px;border-radius:9999px;background:#e31e24;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:12px;">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setFormData((prev) => ({
          ...prev,
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        }));
        setGeoFeedback('Coordenadas ajustadas manualmente no mapa.');
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setFormData((prev) => ({
          ...prev,
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        }));
        setGeoFeedback('Coordenadas definidas por clique no mapa.');
      });

      miniMapRef.current = map;
      miniMarkerRef.current = marker;
    }, 80);

    return () => {
      clearTimeout(timer);
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (miniMapRef.current && miniMarkerRef.current && formData.lat && formData.lng) {
      const lat = Number(formData.lat);
      const lng = Number(formData.lng);
      miniMarkerRef.current.setLatLng([lat, lng]);
      miniMapRef.current.setView([lat, lng], 15);
    }
  }, [formData.lat, formData.lng]);

  if (!isOpen) return null;

  const handleGeocodeSearch = async () => {
    setGeocoding(true);
    setGeoFeedback('Consultando CEP e coordenadas geográficas...');
    try {
      const params = new URLSearchParams({
        q: `${formData.address} ${formData.neighborhood} ${formData.city}`,
        cep: formData.cep,
      });
      const res = await fetch(`/api/geocode?${params.toString()}`);
      const data = await res.json();
      if (data) {
        setFormData((prev) => ({
          ...prev,
          address: data.address || prev.address,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
          cep: data.cep || prev.cep,
          lat: Number(data.lat || prev.lat),
          lng: Number(data.lng || prev.lng),
        }));
        setGeoFeedback(`Localização sincronizada (${Number(data.lat).toFixed(4)}, ${Number(data.lng).toFixed(4)})`);
      }
    } catch (_e) {
      setGeoFeedback('Não foi possível consultar online; ajuste o pino no mapa abaixo.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_plate || !formData.vehicle_model || !formData.contact_name || !formData.address) return;
    setSaving(true);
    try {
      await onSave({
        ...formData,
        time_window: `${formData.window_start} - ${formData.window_end}`,
        scheduled_time: formData.window_start,
        created_by: currentOperatorName,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071319]/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#12303e] border-b border-[#1f495d]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff6b6f]">
              Guardiar Rastreamentos • Registro Interno de OS
            </span>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {initialData?.id ? `Editar Ordem de Serviço ${initialData.os_number}` : 'Nova Ordem de Serviço (Agendamento Interno)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#193d4f] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section 1: Free-Text Vehicle & Contact Info */}
          <div className="bg-[#0b1d26]/90 border border-[#1a3f50] rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Car className="w-4 h-4 text-[#e31e24]" />
              1. Dados do Veículo e Contato (Preenchimento Livre)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Placa do Veículo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ABC-1D23"
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e31e24] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-1 md:col-span-3">
                <label className="block text-xs font-medium text-slate-300 mb-1">Modelo do Veículo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Toyota Hilux SRX / VW Delivery / Fiat Fiorino"
                  value={formData.vehicle_model}
                  onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e31e24] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome / Contato *</label>
                <input
                  type="text"
                  required
                  placeholder="Digite o nome do contato ou responsável"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e31e24] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / Contato</label>
                <input
                  type="text"
                  placeholder="Ex: (11) 99999-0000"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e31e24] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Date & Custom Minute/Hour Time Window */}
          <div className="bg-[#0b1d26]/90 border border-[#1a3f50] rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#e31e24]" />
              2. Data, Janela de Atendimento Livre (Hora e Minuto) e Serviço
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data do Serviço *</label>
                <input
                  type="date"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#ff6b6f]" />
                  Início da Janela (HH:MM) *
                </label>
                <input
                  type="time"
                  step="60"
                  required
                  value={formData.window_start}
                  onChange={(e) => setFormData({ ...formData, window_start: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#ff6b6f]" />
                  Fim da Janela (HH:MM) *
                </label>
                <input
                  type="time"
                  step="60"
                  required
                  value={formData.window_end}
                  onChange={(e) => setFormData({ ...formData, window_end: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tempo Estimado (min)</label>
                <select
                  value={formData.estimated_duration_min}
                  onChange={(e) => setFormData({ ...formData, estimated_duration_min: Number(e.target.value) })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value={30}>30 min (Isca / Vistoria)</option>
                  <option value={45}>45 min (Básico)</option>
                  <option value={60}>60 min (Instalação)</option>
                  <option value={90}>90 min (Caminhão 24V / Telemetria)</option>
                  <option value={120}>120 min (Especial / Sensores)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tipo de Serviço</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                >
                  {Object.entries(SERVICE_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Prioridade Interna</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status Operacional</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Location & Google Maps Geocoding */}
          <div className="bg-[#0b1d26]/90 border border-[#1a3f50] rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#e31e24]" />
                3. Local de Atendimento & Coordenadas para Roteirização
              </h3>
              <button
                type="button"
                onClick={handleGeocodeSearch}
                disabled={geocoding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-semibold shadow transition disabled:opacity-50 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                {geocoding ? 'Localizando...' : 'Buscar CEP / Geolocalizar Endereço'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">CEP</label>
                <input
                  type="text"
                  placeholder="00000-000"
                  value={formData.cep}
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Endereço Completo (Rua, Número) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. das Nações Unidas, 12901"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bairro / Região *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Brooklin"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cidade</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">UF</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                />
              </div>
            </div>

            {geoFeedback && (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {geoFeedback}
              </div>
            )}

            <div className="rounded-lg overflow-hidden border border-[#24536a]">
              <div className="bg-[#12303e] px-3 py-1.5 text-[11px] text-slate-300 flex items-center justify-between">
                <span>Mapa de Precisão (Clique ou arraste o pino 📍 para o ponto exato do atendimento)</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${formData.lat},${formData.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#ff6b6f] hover:underline font-semibold"
                >
                  Conferir no Google Maps ↗
                </a>
              </div>
              <div ref={miniMapContainerRef} className="w-full h-44" />
            </div>
          </div>

          {/* Section 4: Technical Instructions */}
          <div className="bg-[#0b1d26]/90 border border-[#1a3f50] rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#e31e24]" />
              4. Observações Técnicas de Campo
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Responsável no Local (Recebimento do Técnico)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sr. Cláudio (Se vazio, usa o Nome de Contato)"
                  value={formData.onsite_authorized_person}
                  onChange={(e) => setFormData({ ...formData, onsite_authorized_person: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ponto Oculto de Instalação no Veículo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Painel central superior"
                  value={formData.install_hidden_spot}
                  onChange={(e) => setFormData({ ...formData, install_hidden_spot: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Instruções Técnicas Internas
              </label>
              <textarea
                rows={2}
                placeholder="Observações internas para o atendimento..."
                value={formData.internal_notes}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1f495d]">
            <div>
              {initialData?.id && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialData.id);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-semibold transition cursor-pointer"
                >
                  Excluir OS
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-200 text-sm font-medium transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-sm font-bold shadow-lg shadow-[#e31e24]/30 transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvando...' : initialData?.id ? 'Salvar Alterações da OS' : 'Registrar OS no Sistema'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
