import React, { useState } from 'react';
import {
  Users,
  Cpu,
  Plus,
  MapPin,
  Phone,
  Truck,
  Search,
  Edit3,
  Navigation,
  Trash2,
} from 'lucide-react';
import { TRACKER_STATUS_CONFIG, TECH_STATUS_CONFIG } from '../utils/constants';

export default function TechniciansAndStockView({
  mode = 'technicians', // 'technicians' | 'stock'
  technicians = [],
  trackers = [],
  appointments = [],
  selectedDate,
  onSaveTechnician,
  onDeleteTechnician,
  onSaveTracker,
  onOpenRouteForTech,
}) {
  const [showTechModal, setShowTechModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [techForm, setTechForm] = useState({
    name: '',
    badge: '',
    internal_phone: '',
    fleet_vehicle: '',
    fleet_plate: '',
    region: '',
    base_address: 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
    base_lat: -19.87404,
    base_lng: -43.98780,
    color: '#e31e24',
    skills: '12V, 24V Caminhão, Telemetria, Isca RF',
    status: 'DISPONIVEL',
    max_daily_os: 6,
  });

  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [editingTracker, setEditingTracker] = useState(null);
  const [trackerFilter, setTrackerFilter] = useState('ALL');
  const [trackerSearch, setTrackerSearch] = useState('');
  const [trackerForm, setTrackerForm] = useState({
    internal_code: '',
    brand_model: 'Suntech ST4310U 4G',
    imei: '',
    sim_iccid: '',
    sim_carrier: 'Vivo M2M Multi',
    technology: '4G Rastreamento',
    status: 'DISPONIVEL',
    notes: '',
  });

  const openNewTech = () => {
    setEditingTech(null);
    setTechForm({
      name: '',
      badge: `TEC-0${technicians.length + 1}`,
      internal_phone: '(31) 99105-0000',
      fleet_vehicle: 'Fiat Fiorino Endurance',
      fleet_plate: 'GRD-5E05',
      region: 'Belo Horizonte & Região',
      base_address: 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
      base_lat: -19.87404,
      base_lng: -43.98780,
      color: '#e31e24',
      skills: '12V, Instalação, Isca RF',
      status: 'DISPONIVEL',
      max_daily_os: 6,
    });
    setShowTechModal(true);
  };

  const openEditTech = (t) => {
    setEditingTech(t);
    setTechForm({
      name: t.name,
      badge: t.badge,
      internal_phone: t.internal_phone,
      fleet_vehicle: t.fleet_vehicle,
      fleet_plate: t.fleet_plate,
      region: t.region,
      base_address: t.base_address,
      base_lat: t.base_lat,
      base_lng: t.base_lng,
      color: t.color,
      skills: Array.isArray(t.skills) ? t.skills.join(', ') : t.skills,
      status: t.status,
      max_daily_os: t.max_daily_os || 6,
    });
    setShowTechModal(true);
  };

  const handleTechSubmit = async (e) => {
    e.preventDefault();
    const skillsArr = String(techForm.skills)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await onSaveTechnician(
      {
        ...techForm,
        skills: skillsArr,
      },
      editingTech?.id
    );
    setShowTechModal(false);
  };

  const openNewTracker = () => {
    setEditingTracker(null);
    setTrackerForm({
      internal_code: `EQ-${9001 + trackers.length}`,
      brand_model: 'Suntech ST4310U 4G',
      imei: `359881092340${String(100 + trackers.length)}`,
      sim_iccid: `895506123000192${String(850 + trackers.length)}`,
      sim_carrier: 'Vivo M2M Multi',
      technology: '4G Rastreamento',
      status: 'DISPONIVEL',
      notes: 'Testado em bancada pelo laboratório interno',
    });
    setShowTrackerModal(true);
  };

  const openEditTracker = (tr) => {
    setEditingTracker(tr);
    setTrackerForm({
      internal_code: tr.internal_code,
      brand_model: tr.brand_model,
      imei: tr.imei,
      sim_iccid: tr.sim_iccid,
      sim_carrier: tr.sim_carrier,
      technology: tr.technology,
      status: tr.status,
      notes: tr.notes || '',
    });
    setShowTrackerModal(true);
  };

  const handleTrackerSubmit = async (e) => {
    e.preventDefault();
    await onSaveTracker(trackerForm, editingTracker?.id);
    setShowTrackerModal(false);
  };

  if (mode === 'technicians') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f2834] border border-[#1f495d] rounded-xl p-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#e31e24]" />
              Equipe Interna de Técnicos Instaladores de Campo
            </h2>
            <p className="text-xs text-slate-300">
              Cadastre novos instaladores, edite bases de partida ou retire técnicos da operação.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewTech}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Técnico Instalador
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {technicians.map((t) => {
            const techAppsToday = appointments.filter(
              (a) =>
                a.technician_id === t.id &&
                a.scheduled_date === selectedDate &&
                a.status !== 'CANCELADO'
            );
            const completedToday = techAppsToday.filter((a) => a.status === 'CONCLUIDO').length;
            const stInfo = TECH_STATUS_CONFIG[t.status] || TECH_STATUS_CONFIG.DISPONIVEL;

            return (
              <div
                key={t.id}
                className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg border border-white/20"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.badge}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{t.name}</h3>
                        <p className="text-xs text-slate-300">{t.region}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${stInfo.bg}`}>
                      {stInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200 bg-[#0b1d26]/90 p-3 rounded-lg border border-[#193d4f]">
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        {t.fleet_vehicle} (<strong className="font-mono">{t.fleet_plate}</strong>)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t.internal_phone}</span>
                    </div>
                    <div className="sm:col-span-2 flex items-start gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-[#ff6b6f] shrink-0 mt-0.5" />
                      <span>Base de Partida: {t.base_address}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(t.skills || []).map((sk, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#143342] border border-[#24536a] text-[11px] text-slate-200"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#193d4f] flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-300">
                    Carga na data:{' '}
                    <strong className="text-white">
                      {techAppsToday.length} / {t.max_daily_os} OS
                    </strong>{' '}
                    ({completedToday} concluídas)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDeleteTechnician?.(t.id, t.name)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      title="Retirar este técnico do sistema"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Retirar Técnico
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditTech(t)}
                      className="px-3 py-1.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-100 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenRouteForTech?.(t.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#e31e24]/20 hover:bg-[#e31e24]/30 text-[#ff8589] border border-[#e31e24]/40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Ver Rota
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Technician */}
        {showTechModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#071319]/85 backdrop-blur-sm p-4">
            <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white">
                {editingTech ? `Editar Técnico ${editingTech.name}` : 'Cadastrar Técnico Instalador Interno'}
              </h3>
              <form onSubmit={handleTechSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={techForm.name}
                      onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Matrícula / Código *</label>
                    <input
                      type="text"
                      required
                      value={techForm.badge}
                      onChange={(e) => setTechForm({ ...techForm, badge: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Viatura da Frota</label>
                    <input
                      type="text"
                      value={techForm.fleet_vehicle}
                      onChange={(e) => setTechForm({ ...techForm, fleet_vehicle: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Placa da Viatura</label>
                    <input
                      type="text"
                      value={techForm.fleet_plate}
                      onChange={(e) => setTechForm({ ...techForm, fleet_plate: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Telefone Corporativo</label>
                    <input
                      type="text"
                      value={techForm.internal_phone}
                      onChange={(e) => setTechForm({ ...techForm, internal_phone: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Região Principal</label>
                    <input
                      type="text"
                      value={techForm.region}
                      onChange={(e) => setTechForm({ ...techForm, region: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Endereço Base de Partida</label>
                  <input
                    type="text"
                    value={techForm.base_address}
                    onChange={(e) => setTechForm({ ...techForm, base_address: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Latitude Base</label>
                    <input
                      type="number"
                      step="any"
                      value={techForm.base_lat}
                      onChange={(e) => setTechForm({ ...techForm, base_lat: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Longitude Base</label>
                    <input
                      type="number"
                      step="any"
                      value={techForm.base_lng}
                      onChange={(e) => setTechForm({ ...techForm, base_lng: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Cor no Mapa</label>
                    <input
                      type="color"
                      value={techForm.color}
                      onChange={(e) => setTechForm({ ...techForm, color: e.target.value })}
                      className="w-full h-9 bg-[#0b1d26] border border-[#24536a] rounded-lg px-2 py-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Especialidades (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={techForm.skills}
                      onChange={(e) => setTechForm({ ...techForm, skills: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Status de Escala</label>
                    <select
                      value={techForm.status}
                      onChange={(e) => setTechForm({ ...techForm, status: e.target.value })}
                      className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                    >
                      {Object.entries(TECH_STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#1f495d]">
                  <div>
                    {editingTech && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteTechnician?.(editingTech.id, editingTech.name);
                          setShowTechModal(false);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-semibold inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Retirar Técnico
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTechModal(false)}
                      className="px-4 py-2 rounded-lg bg-[#163848] text-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white font-bold"
                    >
                      Salvar Técnico
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Stock / Trackers View
  const filteredTrackers = trackers.filter((tr) => {
    if (trackerFilter !== 'ALL' && tr.status !== trackerFilter) return false;
    if (trackerSearch) {
      const q = trackerSearch.toLowerCase();
      return (
        tr.internal_code.toLowerCase().includes(q) ||
        tr.imei.toLowerCase().includes(q) ||
        tr.brand_model.toLowerCase().includes(q) ||
        (tr.assigned_vehicle_plate || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f2834] border border-[#1f495d] rounded-xl p-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#e31e24]" />
            Estoque Interno de Rastreadores / Chips M2M
          </h2>
          <p className="text-xs text-slate-300">
            Controle de módulos 4G, Telemetria CAN, Iscas LoRa RF e chips M2M multi-operadora.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewTracker}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Dar Entrada em Equipamento (IMEI)
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f2834]/90 border border-[#1f495d] rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'DISPONIVEL', 'RESERVADO', 'INSTALADO', 'MANUTENCAO'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setTrackerFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trackerFilter === st
                  ? 'bg-[#e31e24] text-white'
                  : 'bg-[#163848] text-slate-200 hover:bg-[#1e495d]'
              }`}
            >
              {st === 'ALL'
                ? `Todos (${trackers.length})`
                : `${TRACKER_STATUS_CONFIG[st]?.label} (${trackers.filter((t) => t.status === st).length})`}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar IMEI, código EQ, modelo ou placa..."
            value={trackerSearch}
            onChange={(e) => setTrackerSearch(e.target.value)}
            className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f495d] bg-[#0b1d26]/80 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Fabricante / Modelo</th>
                <th className="py-3 px-4">IMEI do Rastreador</th>
                <th className="py-3 px-4">Chip M2M / ICCID</th>
                <th className="py-3 px-4">Tecnologia</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Placa Vinculada</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#193d4f] text-xs">
              {filteredTrackers.map((tr) => {
                const stBadge = TRACKER_STATUS_CONFIG[tr.status] || TRACKER_STATUS_CONFIG.DISPONIVEL;
                return (
                  <tr key={tr.id} className="hover:bg-[#163848]/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#ff8589]">{tr.internal_code}</td>
                    <td className="py-3 px-4 font-semibold text-white">{tr.brand_model}</td>
                    <td className="py-3 px-4 font-mono text-slate-200">{tr.imei}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-medium">{tr.sim_carrier}</div>
                      <div className="text-[11px] font-mono text-slate-400">{tr.sim_iccid}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{tr.technology}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${stBadge.bg}`}>
                        {stBadge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {tr.assigned_vehicle_plate || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditTracker(tr)}
                        className="px-2.5 py-1 rounded bg-[#163848] hover:bg-[#1e495d] text-slate-200 text-xs"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tracker Modal */}
      {showTrackerModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#071319]/85 backdrop-blur-sm p-4">
          <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {editingTracker
                ? `Editar Equipamento ${editingTracker.internal_code}`
                : 'Cadastrar Novo Rastreador no Estoque Interno'}
            </h3>
            <form onSubmit={handleTrackerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Patrimônio / Código Interno *</label>
                  <input
                    type="text"
                    required
                    value={trackerForm.internal_code}
                    onChange={(e) => setTrackerForm({ ...trackerForm, internal_code: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Modelo do Rastreador *</label>
                  <input
                    type="text"
                    required
                    value={trackerForm.brand_model}
                    onChange={(e) => setTrackerForm({ ...trackerForm, brand_model: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">IMEI (15 dígitos) *</label>
                  <input
                    type="text"
                    required
                    value={trackerForm.imei}
                    onChange={(e) => setTrackerForm({ ...trackerForm, imei: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">ICCID do Chip M2M *</label>
                  <input
                    type="text"
                    required
                    value={trackerForm.sim_iccid}
                    onChange={(e) => setTrackerForm({ ...trackerForm, sim_iccid: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Operadora M2M</label>
                  <select
                    value={trackerForm.sim_carrier}
                    onChange={(e) => setTrackerForm({ ...trackerForm, sim_carrier: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Vivo M2M Multi">Vivo M2M Multi</option>
                    <option value="Claro IoT Corp">Claro IoT Corp</option>
                    <option value="Arqia Dual-Chip">Arqia Dual-Chip</option>
                    <option value="Tim M2M + RF">Tim M2M + RF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Status no Laboratório</label>
                  <select
                    value={trackerForm.status}
                    onChange={(e) => setTrackerForm({ ...trackerForm, status: e.target.value })}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                  >
                    {Object.entries(TRACKER_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Observações de Bancada</label>
                <input
                  type="text"
                  value={trackerForm.notes}
                  onChange={(e) => setTrackerForm({ ...trackerForm, notes: e.target.value })}
                  className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1f495d]">
                <button
                  type="button"
                  onClick={() => setShowTrackerModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#163848] text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white font-bold"
                >
                  Salvar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
