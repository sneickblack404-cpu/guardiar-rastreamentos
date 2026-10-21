import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  X,
  MapPin,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';
import { STATUS_CONFIG, SERVICE_TYPES } from '../utils/constants';

const UF_OPTIONS = [
  'MG', 'SP', 'RJ', 'ES', 'PR', 'SC', 'RS', 'BA', 'GO', 'DF',
  'MT', 'MS', 'PE', 'CE', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL',
  'SE', 'PI', 'TO', 'RO', 'AC', 'AP', 'RR',
];

export default function AppointmentModal({
  isOpen,
  onClose,
  initialData = null,
  defaultDate,
  currentOperatorName = 'David',
  onSave,
  onDelete,
  inlineMode = false, // when true, renders directly inside the "Agendar serviço" page
}) {
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    vehicle_model: '',
    vehicle_plate: '',
    service_type: 'INSTALACAO',
    status: 'AGENDADO',
    scheduled_date: defaultDate || new Date().toISOString().slice(0, 10),
    window_start: '08:00',
    window_end: '10:00',
    estimated_duration_min: 60,
    search_address: '',
    cep: '',
    street: '',
    street_number: '',
    complement: '',
    neighborhood: '',
    city: 'Belo Horizonte',
    state: 'MG',
    lat: -19.87404,
    lng: -43.98780,
    internal_notes: '',
  });

  const [geocoding, setGeocoding] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [pinMovedManually, setPinMovedManually] = useState(false);

  const miniMapContainerRef = useRef(null);
  const miniMapRef = useRef(null);
  const miniMarkerRef = useRef(null);

  const active = inlineMode || isOpen;

  useEffect(() => {
    if (!active) return;

    if (initialData) {
      let wStart = initialData.window_start || '08:00';
      let wEnd = initialData.window_end || '10:00';
      if ((!initialData.window_start || !initialData.window_end) && initialData.time_window?.includes('-')) {
        const parts = initialData.time_window.split('-').map((s) => s.trim());
        if (parts[0]) wStart = parts[0];
        if (parts[1]) wEnd = parts[1];
      }

      // Parse street and number from address if possible
      const rawAddr = initialData.address || '';
      let parsedStreet = rawAddr;
      let parsedNumber = '';
      let parsedComp = '';
      const commaMatch = rawAddr.match(/^([^,]+),\s*(\d+[A-Za-z]?)(?:\s*-\s*(.*))?$/);
      const spaceMatch = rawAddr.match(/^(.*?)\s+(\d+)$/);
      if (commaMatch) {
        parsedStreet = commaMatch[1].trim();
        parsedNumber = commaMatch[2].trim();
        parsedComp = (commaMatch[3] || '').trim();
      } else if (spaceMatch) {
        parsedStreet = spaceMatch[1].trim();
        parsedNumber = spaceMatch[2].trim();
      }

      setFormData({
        contact_name: initialData.contact_name || initialData.client_name || '',
        contact_phone: initialData.contact_phone || '',
        vehicle_model: initialData.vehicle_model || '',
        vehicle_plate: initialData.vehicle_plate || '',
        service_type: initialData.service_type || 'INSTALACAO',
        status: initialData.status || 'AGENDADO',
        scheduled_date: initialData.scheduled_date || defaultDate || new Date().toISOString().slice(0, 10),
        window_start: wStart,
        window_end: wEnd,
        estimated_duration_min: initialData.estimated_duration_min || 60,
        search_address: '',
        cep: initialData.cep || '',
        street: parsedStreet,
        street_number: parsedNumber,
        complement: parsedComp,
        neighborhood: initialData.neighborhood || '',
        city:
          !initialData.city || initialData.city === 'São Paulo'
            ? 'Belo Horizonte'
            : initialData.city,
        state: !initialData.state || initialData.state === 'SP' ? 'MG' : initialData.state,
        lat:
          initialData.lat && Number(initialData.lat) > -21.5
            ? Number(initialData.lat)
            : -19.87404,
        lng:
          initialData.lng && Number(initialData.lat) > -21.5
            ? Number(initialData.lng)
            : -43.98780,
        internal_notes: initialData.internal_notes || '',
      });
      setPinMovedManually(false);
    } else {
      setFormData({
        contact_name: '',
        contact_phone: '',
        vehicle_model: '',
        vehicle_plate: '',
        service_type: 'INSTALACAO',
        status: 'AGENDADO',
        scheduled_date: defaultDate || new Date().toISOString().slice(0, 10),
        window_start: '08:00',
        window_end: '10:00',
        estimated_duration_min: 60,
        search_address: '',
        cep: '',
        street: '',
        street_number: '',
        complement: '',
        neighborhood: '',
        city: 'Belo Horizonte',
        state: 'MG',
        lat: -19.87404,
        lng: -43.98780,
        internal_notes: '',
      });
      setPinMovedManually(false);
    }
    setGeoFeedback('');
  }, [active, initialData, defaultDate]);

  // Initialize Mini Map for Pin Adjustment
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      if (!miniMapContainerRef.current) return;
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }

      const lat = Number(formData.lat) || -19.87404;
      const lng = Number(formData.lng) || -43.98780;

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
        setPinMovedManually(true);
        setFormData((prev) => ({
          ...prev,
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        }));
        setGeoFeedback('Pino ajustado manualmente no mapa.');
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setPinMovedManually(true);
        setFormData((prev) => ({
          ...prev,
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        }));
        setGeoFeedback('Pino posicionado por clique no mapa.');
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
  }, [active]);

  useEffect(() => {
    if (miniMapRef.current && miniMarkerRef.current && formData.lat && formData.lng) {
      const lat = Number(formData.lat);
      const lng = Number(formData.lng);
      miniMarkerRef.current.setLatLng([lat, lng]);
      miniMapRef.current.setView([lat, lng], 15);
    }
  }, [formData.lat, formData.lng]);

  if (!active) return null;

  const buildComposedAddress = (dataObj = formData) => {
    const baseStreet = (dataObj.street || dataObj.search_address || '').trim();
    const num = (dataObj.street_number || '').trim();
    const comp = (dataObj.complement || '').trim();
    let full = baseStreet;
    if (num && !baseStreet.includes(num)) {
      full = `${baseStreet}, ${num}`;
    }
    if (comp) {
      full = `${full} - ${comp}`;
    }
    return full;
  };

  const runGeocodeLookup = async (customData = null) => {
    const target = customData || formData;
    const composedAddress = buildComposedAddress(target);
    const queryText = target.search_address || composedAddress;

    setGeocoding(true);
    setGeoFeedback('Localizando endereço em Minas Gerais...');
    try {
      const params = new URLSearchParams({
        address: queryText,
        neighborhood: target.neighborhood || '',
        city: target.city || 'Belo Horizonte',
        state: target.state || 'MG',
        cep: target.cep || '',
      });
      const res = await fetch(`/api/geocode?${params.toString()}`);
      const data = await res.json();
      if (data && data.lat && data.lng) {
        setFormData((prev) => ({
          ...prev,
          street: prev.street || data.address || prev.search_address,
          neighborhood: prev.neighborhood || data.neighborhood || prev.neighborhood,
          city: data.city || prev.city || 'Belo Horizonte',
          state: data.state || prev.state || 'MG',
          cep: data.cep || prev.cep,
          lat: Number(data.lat),
          lng: Number(data.lng),
        }));
        setGeoFeedback(
          `Endereço localizado no mapa (${data.city || 'Belo Horizonte'} / ${data.state || 'MG'})`
        );
        return {
          lat: Number(data.lat),
          lng: Number(data.lng),
          city: data.city || target.city || 'Belo Horizonte',
          state: data.state || target.state || 'MG',
          neighborhood: target.neighborhood || data.neighborhood || '',
        };
      }
    } catch (_e) {
      setGeoFeedback('Não foi possível consultar online; verifique o pino no mapa.');
    } finally {
      setGeocoding(false);
    }
    return null;
  };

  // Auto-parse when pasting or typing in "Buscar endereço"
  const handleQuickSearchApply = async () => {
    const raw = formData.search_address.trim();
    if (!raw) {
      await runGeocodeLookup();
      return;
    }

    // If user typed something like "Rua João Gomide Leite, 81 - Pindorama, Belo Horizonte"
    const updated = { ...formData };
    if (!updated.street) {
      const parts = raw.split('-').map((s) => s.trim());
      const firstPart = parts[0] || raw;
      const numMatch = firstPart.match(/^([^,]+?)[,\s]+(\d+)$/);
      if (numMatch) {
        updated.street = numMatch[1].trim();
        updated.street_number = updated.street_number || numMatch[2].trim();
      } else {
        updated.street = firstPart;
      }
      if (parts[1] && !updated.neighborhood) {
        updated.neighborhood = parts[1].split(',')[0].trim();
      }
    }
    setFormData(updated);
    await runGeocodeLookup(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const composedAddress = buildComposedAddress(formData);
    if (!formData.vehicle_plate || !formData.vehicle_model || !formData.contact_name || !composedAddress) {
      return;
    }

    setSaving(true);
    try {
      let finalLat = Number(formData.lat);
      let finalLng = Number(formData.lng);
      let finalCity = formData.city || 'Belo Horizonte';
      let finalState = formData.state || 'MG';
      let finalNeighborhood = formData.neighborhood || '';

      // Always geocode automatically on save unless the user explicitly dragged the pin!
      if (!pinMovedManually) {
        const geo = await runGeocodeLookup(formData);
        if (geo && geo.lat && geo.lng) {
          finalLat = geo.lat;
          finalLng = geo.lng;
          finalCity = geo.city || finalCity;
          finalState = geo.state || finalState;
          finalNeighborhood = finalNeighborhood || geo.neighborhood;
        }
      }

      await onSave({
        contact_name: formData.contact_name.trim(),
        contact_phone: formData.contact_phone.trim(),
        vehicle_plate: formData.vehicle_plate.toUpperCase().trim(),
        vehicle_model: formData.vehicle_model.trim(),
        service_type: formData.service_type,
        priority: 'NORMAL',
        status: formData.status || 'AGENDADO',
        scheduled_date: formData.scheduled_date,
        window_start: formData.window_start,
        window_end: formData.window_start,
        time_window: formData.window_start,
        scheduled_time: formData.window_start,
        estimated_duration_min: 60,
        cep: formData.cep.trim(),
        address: composedAddress,
        neighborhood: finalNeighborhood || 'Centro',
        city: finalCity,
        state: finalState,
        lat: finalLat,
        lng: finalLng,
        onsite_authorized_person: formData.contact_name.trim(),
        install_hidden_spot: '',
        internal_notes: formData.internal_notes.trim(),
        created_by: currentOperatorName,
      });

      if (!inlineMode) {
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const formCardContent = (
    <div
      className={
        inlineMode
          ? 'bg-[#0f2834] border border-[#1f495d] rounded-2xl w-full shadow-xl overflow-hidden'
          : 'bg-[#0f2834] border border-[#1f495d] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl'
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#12303e] border-b border-[#1f495d]">
        <div>
          <h2 className="text-lg font-bold text-white">
            {initialData?.id ? `Editar agendamento (${initialData.os_number})` : 'Agendar serviço'}
          </h2>
          <p className="text-xs text-slate-300">
            Preencha os dados do cliente, veículo e localização do atendimento.
          </p>
        </div>
        {!inlineMode && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#193d4f] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* 1. Informações do cliente */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white border-b border-[#1f495d] pb-1.5">
            Informações do cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Responsável pelo veículo <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nome completo do cliente ou responsável"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-[#e31e24] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Whatsapp / Telefone <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: (31) 99999-0000"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-[#e31e24] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Informações do veículo & horário */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white border-b border-[#1f495d] pb-1.5">
            Informações do veículo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Modelo do veículo <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: TOYOTA SW4 / HONDA XRE 300"
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-[#e31e24] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Placa ou chassi <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: ERM1234"
                value={formData.vehicle_plate}
                onChange={(e) =>
                  setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })
                }
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white font-mono focus:border-[#e31e24] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Serviço <span className="text-[#ff6b6f]">*</span>
              </label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-[#e31e24] focus:outline-none"
              >
                {Object.entries(SERVICE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data e Horário do Serviço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Data do serviço <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#ff6b6f]" />
                Horário do serviço <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="time"
                step="60"
                required
                value={formData.window_start}
                onChange={(e) => setFormData({ ...formData, window_start: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. Localização do serviço */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white border-b border-[#1f495d] pb-1.5">
            Localização do serviço
          </h3>

          {/* Buscar endereço bar (just like Screenshot 3) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Buscar endereço
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Digite o endereço para buscar ou cole diretamente do Google Maps..."
                  value={formData.search_address}
                  onChange={(e) => setFormData({ ...formData, search_address: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickSearchApply();
                    }
                  }}
                  className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-[#e31e24] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickSearchApply}
                disabled={geocoding}
                className="px-4 py-2.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] border border-[#24536a] text-white text-xs font-bold whitespace-nowrap transition cursor-pointer"
              >
                {geocoding ? 'Buscando...' : 'Localizar no Mapa'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Ao salvar, o sistema localiza automaticamente o endereço em Minas Gerais no mapa.
            </p>
          </div>

          {/* CEP, Rua, Número */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">CEP</label>
              <input
                type="text"
                placeholder="30000-000"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                onBlur={() => {
                  if (formData.cep.replace(/\D/g, '').length === 8) {
                    runGeocodeLookup();
                  }
                }}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white font-mono"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Rua / Logradouro <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Rua João Gomide Leite"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Número <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 81"
                value={formData.street_number}
                onChange={(e) => setFormData({ ...formData, street_number: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          {/* Bairro, Cidade, UF, Complemento */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Bairro <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Pindorama"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cidade <span className="text-[#ff6b6f]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Belo Horizonte"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                UF <span className="text-[#ff6b6f]">*</span>
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2.5 text-sm text-white"
              >
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Complemento
              </label>
              <input
                type="text"
                placeholder="Apto, Galpão..."
                value={formData.complement}
                onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          {geoFeedback && (
            <div className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {geoFeedback}
            </div>
          )}

          {/* Mini Mapa de Conferência */}
          <div className="rounded-xl overflow-hidden border border-[#24536a] isolate z-0 relative">
            <div className="bg-[#12303e] px-3.5 py-2 text-xs text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#e31e24]" />
                Localização no Mapa (Clique em &quot;Localizar no Mapa&quot; ou arraste o pino 📍 se desejar)
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${formData.lat},${formData.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#ff6b6f] hover:underline font-semibold"
              >
                Abrir no Google Maps ↗
              </a>
            </div>
            <div ref={miniMapContainerRef} className="w-full h-44" />
          </div>

          {/* Observações */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-slate-300 mb-1">Observações</label>
            <textarea
              rows={3}
              placeholder="Informações adicionais sobre o agendamento..."
              value={formData.internal_notes}
              onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
              className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3.5 py-2.5 text-sm text-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1f495d]">
          <div>
            {initialData?.id && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialData.id);
                  onClose?.();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Agendamento
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!inlineMode && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-200 text-sm font-medium transition cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-sm font-bold shadow-lg shadow-[#e31e24]/30 transition disabled:opacity-50 cursor-pointer"
            >
              {saving
                ? 'Salvando e Geolocalizando...'
                : initialData?.id
                ? 'Salvar Alterações'
                : 'Salvar Agendamento'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (inlineMode) {
    return formCardContent;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#071319]/85 backdrop-blur-sm p-4 overflow-y-auto">
      {formCardContent}
    </div>
  );
}
