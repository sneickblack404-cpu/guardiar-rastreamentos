import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  CalendarPlus,
  Route,
  Users,
  Settings,
  Plus,
  Search,
  MapPin,
  LogOut,
  Menu,
  Eye,
  ExternalLink,
  Trash2,
  UserCheck,
  Copy,
  Check,
  CheckCircle2,
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import InteractiveRouteMap from './components/InteractiveRouteMap';
import AppointmentModal from './components/AppointmentModal';
import RoutePlannerView from './components/RoutePlannerView';
import TechniciansAndStockView from './components/TechniciansAndStockView';
import TechnicianPortalView from './components/TechnicianPortalView';
import SettingsModal from './components/SettingsModal';
import {
  STATUS_CONFIG,
  formatDateBR,
  getSinglePointGoogleMapsUrl,
  formatOsCopyText,
} from './utils/constants';

export default function App() {
  const [authenticatedUser, setAuthenticatedUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('guardiar_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_e) {
      return null;
    }
  });

  // Main navigation: 'agendamentos' | 'agendar' | 'routes' | 'technicians'
  const [activeTab, setActiveTab] = useState('agendamentos');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [todayDate, setTodayDate] = useState('');

  // Filters on Agendamentos table (matching reference screenshot)
  const [dateFilter, setDateFilter] = useState(''); // empty = show all dates by default like reference table
  const [ufFilter, setUfFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data state from SQLite Backend
  const [settings, setSettings] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [appointments, setAppointments] = useState([]);

  // Modals state
  const [isOsModalOpen, setIsOsModalOpen] = useState(false);
  const [editingOs, setEditingOs] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Ready-to-copy Ordem de Serviço text (shown after completing/saving an agendamento)
  const [lastGeneratedOsText, setLastGeneratedOsText] = useState('');
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState(null);

  const fetchBootstrapData = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      const data = await res.json();
      setSettings(data.settings || {});
      setTechnicians(data.technicians || []);
      setTrackers(data.trackers || []);
      setAppointments(data.appointments || []);
      if (!selectedDate && data.today) {
        setSelectedDate(data.today);
        setTodayDate(data.today);
      }
    } catch (err) {
      console.error('Error loading bootstrap data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchBootstrapData();
  }, []);

  const handleLoginSuccess = (userObj) => {
    setAuthenticatedUser(userObj);
    try {
      sessionStorage.setItem('guardiar_auth_user', JSON.stringify(userObj));
    } catch (_e) {
      // ignore
    }
  };

  const handleLogout = () => {
    setAuthenticatedUser(null);
    try {
      sessionStorage.removeItem('guardiar_auth_user');
    } catch (_e) {
      // ignore
    }
  };

  // Handlers for Appointments (OS)
  const handleSaveAppointment = async (payload, options = {}) => {
    if (editingOs?.id) {
      await fetch(`/api/appointments/${editingOs.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    const osText = options.formattedCopy || formatOsCopyText(payload);
    setLastGeneratedOsText(osText);
    setCopiedBanner(false);

    await fetchBootstrapData();
    if (payload.scheduled_date) {
      setSelectedDate(payload.scheduled_date);
    }
    if (!options.stayOnPage) {
      setActiveTab('agendamentos');
    }
  };

  const handleDeleteAppointment = async (id) => {
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    await fetchBootstrapData();
  };

  const handleStatusChange = async (id, newStatus) => {
    await fetch(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const targetItem = appointments.find((a) => a.id === id);
    if (targetItem) {
      setLastGeneratedOsText(formatOsCopyText(targetItem));
      setCopiedBanner(false);
    }
    await fetchBootstrapData();
  };

  const handleCopyRowOs = (item) => {
    const text = formatOsCopyText(item);
    setLastGeneratedOsText(text);
    navigator.clipboard.writeText(text);
    setCopiedRowId(item.id);
    setCopiedBanner(true);
    setTimeout(() => {
      setCopiedRowId(null);
      setCopiedBanner(false);
    }, 2500);
  };

  const handleCopyBannerOs = () => {
    if (!lastGeneratedOsText) return;
    navigator.clipboard.writeText(lastGeneratedOsText);
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2500);
  };

  const handleAssignTechToAppointment = async (id, technicianId) => {
    await fetch(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technician_id: technicianId }),
    });
    await fetchBootstrapData();
  };

  // Handlers for Tech / Stock / Settings
  const handleSaveTechnician = async (techPayload, id = null) => {
    const url = id ? `/api/technicians/${id}` : '/api/technicians';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(techPayload),
    });
    await fetchBootstrapData();
  };

  const handleDeleteTechnician = async (id) => {
    await fetch(`/api/technicians/${id}`, {
      method: 'DELETE',
    });
    await fetchBootstrapData();
  };

  const handleSaveTracker = async (trackerPayload, id = null) => {
    const url = id ? `/api/trackers/${id}` : '/api/trackers';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackerPayload),
    });
    await fetchBootstrapData();
  };

  const handleSaveSettings = async (newSettings) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    await fetchBootstrapData();
  };

  const openEditOsModal = (osItem) => {
    setEditingOs(osItem);
    setIsOsModalOpen(true);
  };

  // Require login
  if (!authenticatedUser) {
    return <LoginScreen technicians={technicians} onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1d26] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#e31e24] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">
            Carregando Guardiar Rastreamentos...
          </p>
        </div>
      </div>
    );
  }

  // Dedicated Technician Portal View when logged in as a Technician
  if (authenticatedUser.accountType === 'TECHNICIAN') {
    return (
      <div className="min-h-screen bg-[#0b1d26] text-slate-100 flex flex-col">
        <header className="bg-[#12303e] border-b border-[#1f495d] px-6 py-3 sticky top-0 z-50 no-print shadow-lg">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white px-2.5 py-1 rounded-lg shadow border border-[#e31e24] flex items-center justify-center">
                <img
                  src="/logo-guardiar.png"
                  alt="Guardiar Rastreamentos"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-white">
                  GUARDIAR <span className="text-[#ff6b6f]">RASTREAMENTOS</span>
                </h1>
                <p className="text-[11px] text-slate-300">
                  Portal do Técnico • {authenticatedUser.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#163848] hover:bg-[#e31e24] text-slate-100 text-xs font-bold border border-[#24536a] transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-5">
          <TechnicianPortalView
            authenticatedUser={authenticatedUser}
            technicians={technicians}
            appointments={appointments}
            settings={settings}
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            todayDate={todayDate}
            onStatusChange={handleStatusChange}
            onRefreshData={fetchBootstrapData}
          />
        </main>
      </div>
    );
  }

  // Filter appointments for the clean Agendamentos table
  const filteredAppointments = appointments.filter((a) => {
    if (dateFilter && a.scheduled_date !== dateFilter) return false;
    if (ufFilter && String(a.state || 'MG').toUpperCase() !== ufFilter.toUpperCase().trim()) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (a.contact_name || a.client_name || '').toLowerCase().includes(q) ||
        (a.vehicle_plate || '').toLowerCase().includes(q) ||
        (a.vehicle_model || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q) ||
        (a.neighborhood || '').toLowerCase().includes(q) ||
        (a.address || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Appointments to show on the operational map (either filtered by dateFilter or all active)
  const mapAppointments = filteredAppointments.filter((a) => a.status !== 'CANCELADO');

  const navItems = [
    { id: 'agendamentos', label: 'Agendamentos', icon: Calendar },
    { id: 'agendar', label: 'Agendar serviço', icon: CalendarPlus },
    { id: 'routes', label: 'Mapa & Rotas', icon: Route },
    { id: 'technicians', label: 'Técnicos', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#0b1d26] text-slate-100 flex">
      {/* Left Sidebar (Clean & Simple like reference screenshot, with Guardiar colors) */}
      <aside
        className={`${
          sidebarOpen ? 'w-60' : 'w-0 -ml-60 lg:ml-0 lg:w-20'
        } bg-[#0f2834] border-r border-[#1f495d] flex flex-col transition-all duration-200 shrink-0 z-40 no-print`}
      >
        {/* Brand Logo Header */}
        <div className="h-16 px-4 border-b border-[#1f495d] flex items-center gap-3">
          <div className="bg-white px-2.5 py-1 rounded-lg shadow border border-[#e31e24] flex items-center justify-center shrink-0">
            <img
              src="/logo-guardiar.png"
              alt="Guardiar"
              className="h-7 w-auto object-contain"
            />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="text-sm font-extrabold tracking-tight text-white truncate">
                GUARDIAR
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#ff6b6f] truncate">
                Rastreamentos
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div className="p-3 flex-1 space-y-1">
          {sidebarOpen && (
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Menu
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'agendar') {
                    setEditingOs(null);
                  }
                  setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-[#e31e24] text-white shadow-md shadow-[#e31e24]/25'
                    : 'text-slate-300 hover:text-white hover:bg-[#163848]'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Base Fixed Info Footer in Sidebar */}
        {sidebarOpen && (
          <div className="p-3.5 m-3 rounded-xl bg-[#0b1d26]/90 border border-[#193d4f] text-[11px] space-y-1">
            <div className="font-bold text-[#ff8589] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#e31e24]" />
              Base Guardiar (BH - MG)
            </div>
            <div className="text-slate-300 leading-snug">
              {settings.hq_address || 'Rua Sena Madureira, 253 - Ouro Preto, BH - MG'}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Top Header Bar */}
        <header className="h-16 bg-[#12303e] border-b border-[#1f495d] px-6 flex items-center justify-between sticky top-0 z-30 no-print shadow-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#163848] transition cursor-pointer"
              title="Alternar Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-white">
              {activeTab === 'agendamentos' && 'Agendamentos'}
              {activeTab === 'agendar' && 'Agendar serviço'}
              {activeTab === 'routes' && 'Mapa & Rotas Google Maps'}
              {activeTab === 'technicians' && 'Técnicos de Campo'}
            </h1>
          </div>

          {/* Right User Profile & Settings */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-200 border border-[#24536a] transition cursor-pointer"
              title="Configurações da Base Fixa e Google Maps"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pl-2 border-l border-[#1f495d]">
              <div className="text-right">
                <div className="text-xs font-bold text-white leading-tight">
                  {authenticatedUser.name}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">operador</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#e31e24] text-white font-bold text-xs flex items-center justify-center shadow">
                {authenticatedUser.name?.slice(0, 1).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#e31e24] transition cursor-pointer"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto space-y-6">
          {/* VIEW 1: AGENDAMENTOS (Clean Table like Screenshot 4 + Guardiar Map below) */}
          {activeTab === 'agendamentos' && (
            <div className="space-y-6">
              {/* Top Action & Filters Bar */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOs(null);
                      setActiveTab('agendar');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Agendamento
                  </button>
                </div>

                {/* Filters: Data, UF, Busca */}
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Data
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      {dateFilter && (
                        <button
                          type="button"
                          onClick={() => setDateFilter('')}
                          className="px-2 py-1.5 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-[11px] text-slate-200 cursor-pointer"
                          title="Mostrar todas as datas"
                        >
                          Todas
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      UF
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: MG"
                      maxLength={2}
                      value={ufFilter}
                      onChange={(e) => setUfFilter(e.target.value.toUpperCase())}
                      className="w-20 bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-1.5 text-xs text-white uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Busca
                    </label>
                    <div className="relative min-w-[230px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cliente, placa, veículo, cidade..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-[#e31e24] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Agendamentos Table (matching Screenshot 4 columns) */}
              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl overflow-hidden shadow-xl">
                <div className="px-4 py-3 border-b border-[#1f495d] flex items-center justify-between text-xs text-slate-300">
                  <span>
                    Exibindo <strong className="text-white">{filteredAppointments.length}</strong>{' '}
                    agendamento(s)
                  </span>
                  {dateFilter && (
                    <span className="text-[#ff8589] font-semibold">
                      Filtrado por data: {formatDateBR(dateFilter)}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1f495d] bg-[#0b1d26]/90 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        <th className="py-3.5 px-4">Cliente</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Veículo</th>
                        <th className="py-3.5 px-4">Placa</th>
                        <th className="py-3.5 px-4">Cidade / Endereço</th>
                        <th className="py-3.5 px-4">Data do serviço</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#193d4f] text-xs">
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            Nenhum agendamento encontrado. Clique em &quot;Novo Agendamento&quot; para cadastrar.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map((item) => {
                          const isDone = item.status === 'CONCLUIDO';
                          const isCanceled = item.status === 'CANCELADO';

                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-[#163848]/45 transition"
                            >
                              {/* Cliente */}
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => openEditOsModal(item)}
                                  className="font-bold text-sky-400 hover:text-sky-300 uppercase text-left cursor-pointer"
                                >
                                  {item.contact_name || item.client_name}
                                </button>
                                {item.contact_phone && (
                                  <div className="text-[11px] text-slate-400">
                                    {item.contact_phone}
                                  </div>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4">
                                <select
                                  value={item.status}
                                  onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                  className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                                    isDone
                                      ? 'bg-emerald-600 text-white border-emerald-500'
                                      : isCanceled
                                      ? 'bg-rose-600/30 text-rose-200 border-rose-500/40'
                                      : 'bg-emerald-600/90 text-white border-emerald-500'
                                  }`}
                                >
                                  <option value="AGENDADO" className="bg-[#0f2834] text-white">
                                    Confirmado
                                  </option>
                                  <option value="EM_DESLOCAMENTO" className="bg-[#0f2834] text-white">
                                    Em Deslocamento
                                  </option>
                                  <option value="EM_EXECUCAO" className="bg-[#0f2834] text-white">
                                    Em Execução
                                  </option>
                                  <option value="CONCLUIDO" className="bg-[#0f2834] text-white">
                                    Concluído
                                  </option>
                                  <option value="CANCELADO" className="bg-[#0f2834] text-white">
                                    Cancelado
                                  </option>
                                </select>
                              </td>

                              {/* Veículo */}
                              <td className="py-3 px-4 font-semibold text-white uppercase">
                                {item.vehicle_model}
                              </td>

                              {/* Placa */}
                              <td className="py-3 px-4 font-mono font-bold text-slate-200 uppercase">
                                {item.vehicle_plate}
                              </td>

                              {/* Cidade / Endereço */}
                              <td className="py-3 px-4">
                                <div className="text-white font-medium">
                                  {item.city || 'Belo Horizonte'} / {item.state || 'MG'}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[260px]">
                                  {item.address}
                                  {item.neighborhood ? ` — ${item.neighborhood}` : ''}
                                </div>
                              </td>

                              {/* Data do serviço */}
                              <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                                {formatDateBR(item.scheduled_date)}{' '}
                                {item.window_start || item.scheduled_time || '08:00'}
                              </td>

                              {/* Ações */}
                              <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyRowOs(item)}
                                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded bg-[#163848] hover:bg-[#1e495d] text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition cursor-pointer"
                                  title="Gerar e Copiar Ordem de Serviço"
                                >
                                  {copiedRowId === item.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      Copiar OS
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditOsModal(item)}
                                  className="inline-flex items-center justify-center w-8 h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow transition cursor-pointer"
                                  title="Ver / Editar Agendamento"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <a
                                  href={getSinglePointGoogleMapsUrl(
                                    item.lat,
                                    item.lng,
                                    `${item.address}, ${item.neighborhood || ''}, ${item.city || 'Belo Horizonte'} - ${item.state || 'MG'}`
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-7 rounded bg-[#163848] hover:bg-[#1e495d] text-slate-200 border border-[#24536a] transition"
                                  title="Abrir no Google Maps"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAppointment(item.id)}
                                  className="inline-flex items-center justify-center w-8 h-7 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                                  title="Excluir Agendamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Campo embaixo dos Agendamentos para Copiar a Ordem de Serviço */}
              {lastGeneratedOsText && (
                <div className="bg-[#0f2834] border-2 border-emerald-500 rounded-xl p-4 shadow-xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-white">
                        Ordem de Serviço Pronta para Copiar:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyBannerOs}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer"
                    >
                      {copiedBanner ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Ordem de Serviço Copiada!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Ordem de Serviço
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                     value={lastGeneratedOsText}
                    onChange={(e) => setLastGeneratedOsText(e.target.value)}
                    onClick={(e) => e.target.select()}
                    className="w-full bg-[#0b1d26] border border-emerald-500/40 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              )}

              {/* Integrated Guardiar Map below the table */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#e31e24]" />
                      Mapa dos Serviços Agendados (Início no 1º Serviço)
                    </h2>
                    <p className="text-xs text-slate-400">
                      A rota começa sempre a partir do 1º serviço agendado. Clique em qualquer ponto no mapa para ver ou editar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('routes')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow transition cursor-pointer"
                  >
                    <Route className="w-4 h-4" />
                    Otimizar Rota no Google Maps
                  </button>
                </div>

                <InteractiveRouteMap
                  origin={{
                    lat: Number(settings.hq_lat || -19.87404),
                    lng: Number(settings.hq_lng || -43.98780),
                    label: settings.hq_name || 'Base Guardiar - Ouro Preto (BH)',
                    address:
                      settings.hq_address ||
                      'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
                  }}
                  stops={mapAppointments}
                  unassignedStops={[]}
                  allTechniciansMode={true}
                  technicians={technicians}
                  googleMapsApiKey={settings.google_maps_api_key}
                  onSelectStop={(stop) => openEditOsModal(stop)}
                  heightClass="h-[460px]"
                />
              </div>
            </div>
          )}

          {/* VIEW 2: AGENDAR SERVIÇO (Direct Inline Clean Page like Screenshot 3) */}
          {activeTab === 'agendar' && (
            <div className="max-w-5xl mx-auto">
              <AppointmentModal
                isOpen={true}
                inlineMode={true}
                initialData={null}
                defaultDate={selectedDate}
                currentOperatorName={authenticatedUser?.name || 'David'}
                appointments={appointments}
                onSave={handleSaveAppointment}
                onGoToList={() => setActiveTab('agendamentos')}
              />
            </div>
          )}

          {/* VIEW 3: MAPA & ROTAS GOOGLE MAPS */}
          {activeTab === 'routes' && (
            <RoutePlannerView
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
              technicians={technicians}
              appointments={appointments}
              settings={settings}
              onEditAppointment={openEditOsModal}
              onAssignTechToAppointment={handleAssignTechToAppointment}
              onStatusChange={handleStatusChange}
              onRefreshData={fetchBootstrapData}
            />
          )}

          {/* VIEW 4: TÉCNICOS DE CAMPO */}
          {activeTab === 'technicians' && (
            <TechniciansAndStockView
              mode="technicians"
              technicians={technicians}
              trackers={trackers}
              appointments={appointments}
              selectedDate={selectedDate}
              onSaveTechnician={handleSaveTechnician}
              onDeleteTechnician={handleDeleteTechnician}
              onSaveTracker={handleSaveTracker}
              onOpenRouteForTech={() => setActiveTab('routes')}
            />
          )}
        </main>
      </div>

      {/* Edit Appointment Modal */}
      <AppointmentModal
        isOpen={isOsModalOpen}
        onClose={() => {
          setIsOsModalOpen(false);
          setEditingOs(null);
        }}
        initialData={editingOs}
        defaultDate={selectedDate}
        currentOperatorName={authenticatedUser?.name || 'David'}
        appointments={appointments}
        onSave={handleSaveAppointment}
        onDelete={editingOs?.id ? handleDeleteAppointment : null}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
