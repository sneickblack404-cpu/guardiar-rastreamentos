import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Route,
  Users,
  Cpu,
  Settings,
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Columns,
  Table,
  Lock,
  LogOut,
  Trash2,
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
  SERVICE_TYPES,
  formatDateBR,
  getSinglePointGoogleMapsUrl,
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

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'agenda' | 'routes' | 'technicians' | 'stock'
  const [agendaViewMode, setAgendaViewMode] = useState('list'); // 'list' | 'timeline' | 'kanban'

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [todayDate, setTodayDate] = useState('');

  // Data state from SQLite Backend
  const [settings, setSettings] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [appointments, setAppointments] = useState([]);

  // Filters for Agenda view
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [techFilter, setTechFilter] = useState('ALL');
  const [showAllDatesInList, setShowAllDatesInList] = useState(false);

  // Modals state
  const [isOsModalOpen, setIsOsModalOpen] = useState(false);
  const [editingOs, setEditingOs] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  const handleSaveAppointment = async (payload) => {
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
    await fetchBootstrapData();
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
    await fetchBootstrapData();
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

  const openNewOsModal = (prefill = null) => {
    setEditingOs(prefill);
    setIsOsModalOpen(true);
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
            Iniciando Guardiar Rastreamentos (Agendamento & Roteirização)...
          </p>
        </div>
      </div>
    );
  }

  // Dedicated Technician Portal View when logged in as a Technician
  if (authenticatedUser.accountType === 'TECHNICIAN') {
    return (
      <div className="min-h-screen bg-[#0b1d26] text-slate-100 flex flex-col">
        <div className="bg-[#08151c] border-b border-[#193d4f] px-6 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#e31e24]/20 text-[#ff8589] border border-[#e31e24]/40 font-bold uppercase tracking-wider">
              <Lock className="w-3 h-3" />
              Acesso Exclusivo do Técnico
            </span>
            <span className="hidden md:inline text-slate-400">
              Guardiar Rastreamentos • Portal Interno de Campo
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Técnico Logado: <strong className="text-white">{authenticatedUser.name}</strong>{' '}
              <span className="text-slate-400">({authenticatedUser.badge})</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#163848] hover:bg-[#e31e24] text-slate-200 hover:text-white font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Sair
            </button>
          </div>
        </div>

        <header className="bg-[#12303e]/95 backdrop-blur border-b border-[#1f495d] px-6 py-3.5 sticky top-0 z-30 no-print shadow-xl">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="bg-white px-3 py-1.5 rounded-xl shadow-md border-2 border-[#e31e24] flex items-center justify-center">
                <img
                  src="/logo-guardiar.png"
                  alt="Guardiar Rastreamentos"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  GUARDIAR <span className="text-[#ff6b6f]">RASTREAMENTOS</span>
                </h1>
                <p className="text-xs text-slate-300">
                  Agenda Diária do Técnico, Dados dos Clientes, Controle de Conclusão e Rota Google Maps
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#163848] hover:bg-[#e31e24] text-slate-100 text-xs font-bold border border-[#24536a] transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Trocar Usuário / Sair
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

  const dateAppointments = appointments.filter(
    (a) => a.scheduled_date === selectedDate && a.status !== 'CANCELADO'
  );
  const completedCount = dateAppointments.filter((a) => a.status === 'CONCLUIDO').length;
  const inProgressCount = dateAppointments.filter(
    (a) => a.status === 'EM_EXECUCAO' || a.status === 'EM_DESLOCAMENTO'
  ).length;
  const unassignedCount = dateAppointments.filter((a) => !a.technician_id).length;
  const availableTrackersCount = trackers.filter((t) => t.status === 'DISPONIVEL').length;

  const filteredAgendaAppointments = appointments.filter((a) => {
    if (!showAllDatesInList && a.scheduled_date !== selectedDate) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (techFilter !== 'ALL') {
      if (techFilter === 'UNASSIGNED' && a.technician_id) return false;
      if (techFilter !== 'UNASSIGNED' && String(a.technician_id) !== String(techFilter)) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.os_number.toLowerCase().includes(q) ||
        (a.contact_name || a.client_name || '').toLowerCase().includes(q) ||
        a.vehicle_plate.toLowerCase().includes(q) ||
        a.vehicle_model.toLowerCase().includes(q) ||
        a.neighborhood.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0b1d26] text-slate-100 flex flex-col">
      {/* Restricted Internal System Security Banner */}
      <div className="bg-[#08151c] border-b border-[#193d4f] px-6 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#e31e24]/20 text-[#ff8589] border border-[#e31e24]/40 font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3" />
            Acesso Exclusivo Interno
          </span>
          <span className="hidden md:inline text-slate-400">
            Guardiar Rastreamentos • Sistema exclusivo para colaboradores internos.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-300">
            Operador Logado: <strong className="text-white">{authenticatedUser.name}</strong>{' '}
            <span className="text-slate-400">({authenticatedUser.role})</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#163848] hover:bg-[#e31e24] text-slate-200 hover:text-white font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </button>
        </div>
      </div>

      {/* Main Header Bar */}
      <header className="bg-[#12303e]/95 backdrop-blur border-b border-[#1f495d] px-6 py-3.5 sticky top-0 z-30 no-print shadow-xl">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Guardiar Brand Logo */}
          <div className="flex items-center gap-3.5">
            <div className="bg-white px-3 py-1.5 rounded-xl shadow-md border-2 border-[#e31e24] flex items-center justify-center">
              <img
                src="/logo-guardiar.png"
                alt="Guardiar Rastreamentos"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  GUARDIAR <span className="text-[#ff6b6f]">RASTREAMENTOS</span>
                </h1>
              </div>
              <p className="text-xs text-slate-300">
                Central Interna de Agendamento de Serviços e Planejamento de Rotas Google Maps
              </p>
            </div>
          </div>

          {/* Global Date Selector & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-[#0b1d26] border border-[#24536a] rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSelectedDate(todayDate)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  selectedDate === todayDate
                    ? 'bg-[#e31e24] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Hoje
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => openNewOsModal(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow-lg shadow-[#e31e24]/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Ordem de Serviço (OS)
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-[#163848] hover:bg-[#1e495d] text-slate-200 border border-[#24536a] transition cursor-pointer"
              title="Configurações da Base Operacional e Chave Google Maps"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Bar (Removed Clientes & Veículos tab as requested) */}
        <div className="max-w-[1600px] mx-auto mt-3 pt-2 border-t border-[#1f495d] flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Torre de Operações', icon: LayoutDashboard },
            {
              id: 'agenda',
              label: `Agenda & OS (${dateAppointments.length})`,
              icon: Calendar,
            },
            {
              id: 'routes',
              label: 'Planejamento de Rotas & Google Maps',
              icon: Route,
              highlight: true,
            },
            {
              id: 'technicians',
              label: `Técnicos de Campo (${technicians.length})`,
              icon: Users,
            },
            {
              id: 'stock',
              label: `Estoque Rastreadores (${availableTrackersCount} disp.)`,
              icon: Cpu,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-[#e31e24] text-white shadow'
                    : tab.highlight
                    ? 'bg-[#e31e24]/15 text-[#ff8589] border border-[#e31e24]/30 hover:bg-[#e31e24]/25'
                    : 'text-slate-300 hover:text-white hover:bg-[#163848]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-5 space-y-6">
        {/* TAB 1: DASHBOARD / TORRE DE OPERAÇÕES */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>OS Agendadas ({formatDateBR(selectedDate)})</span>
                  <Calendar className="w-4 h-4 text-[#ff6b6f]" />
                </div>
                <div className="text-2xl font-extrabold text-white font-mono">{dateAppointments.length}</div>
                <div className="text-[11px] text-slate-400">Atendimentos programados para a data</div>
              </div>

              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>Em Execução / Deslocamento</span>
                  <Navigation className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-extrabold text-sky-400 font-mono">{inProgressCount}</div>
                <div className="text-[11px] text-slate-400">Atendimentos em andamento</div>
              </div>

              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>Instalações Concluídas</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">{completedCount}</div>
                <div className="text-[11px] text-slate-400">Serviços finalizados no dia</div>
              </div>

              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>Rastreadores Disponíveis</span>
                  <Cpu className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono">{availableTrackersCount}</div>
                <div className="text-[11px] text-slate-400">Módulos prontos no estoque</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#e31e24]" />
                      Mapa Operacional do Dia ({formatDateBR(selectedDate)})
                    </h2>
                    <p className="text-xs text-slate-300">
                      Localização de todas as Ordens de Serviço agendadas para a data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('routes')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Route className="w-3.5 h-3.5" />
                    Abrir Otimizador de Rotas
                  </button>
                </div>

                <InteractiveRouteMap
                  origin={{
                    lat: Number(settings.hq_lat || -23.5218),
                    lng: Number(settings.hq_lng || -46.6692),
                    label: settings.hq_name || 'Matriz Guardiar Rastreamentos',
                    address: settings.hq_address || '',
                  }}
                  stops={dateAppointments}
                  unassignedStops={[]}
                  allTechniciansMode={true}
                  technicians={technicians}
                  googleMapsApiKey={settings.google_maps_api_key}
                  onSelectStop={(stop) => openEditOsModal(stop)}
                  heightClass="h-[470px]"
                />
              </div>

              <div className="xl:col-span-5 space-y-4">
                <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#e31e24]" />
                      Ordens de Serviço do Dia ({dateAppointments.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => openNewOsModal(null)}
                      className="text-xs text-[#ff8589] hover:underline font-bold cursor-pointer"
                    >
                      + Nova OS
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
                    {dateAppointments.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-8">
                        Nenhuma OS agendada para esta data.
                      </div>
                    ) : (
                      dateAppointments.map((osItem, idx) => {
                        const st = STATUS_CONFIG[osItem.status] || STATUS_CONFIG.AGENDADO;
                        return (
                          <div
                            key={osItem.id}
                            onClick={() => openEditOsModal(osItem)}
                            className="p-3 rounded-xl bg-[#0b1d26]/90 hover:bg-[#143342] border border-[#193d4f] cursor-pointer transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-[#e31e24] text-white font-bold text-[11px] flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-mono text-xs font-bold text-[#ff8589]">
                                  {osItem.os_number}
                                </span>
                                <span className="text-xs font-mono text-slate-200 font-semibold">
                                  ⏰ {osItem.time_window}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.bg} ${st.text} ${st.border}`}
                              >
                                {st.shortLabel}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">
                                {osItem.contact_name || osItem.client_name}
                              </span>
                              <span className="font-mono font-bold text-sky-400">
                                {osItem.vehicle_plate} ({osItem.vehicle_model})
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-300 flex items-center justify-between">
                              <span>
                                📍 {osItem.address} — <strong>{osItem.neighborhood}</strong>
                              </span>
                              {osItem.technician_name && (
                                <span className="text-emerald-300 font-semibold">
                                  👷 {osItem.technician_badge}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AGENDA & ORDENS DE SERVIÇO */}
        {activeTab === 'agenda' && (
          <div className="space-y-5">
            <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-[#0b1d26] border border-[#24536a] rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setAgendaViewMode('list')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                      agendaViewMode === 'list'
                        ? 'bg-[#e31e24] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    Lista Operacional
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgendaViewMode('kanban')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                      agendaViewMode === 'kanban'
                        ? 'bg-[#e31e24] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    Quadro Kanban
                  </button>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar OS, contato, placa, modelo, bairro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0b1d26] border border-[#24536a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0b1d26] border border-[#24536a] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="ALL">Todos os Status</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllDatesInList}
                    onChange={(e) => setShowAllDatesInList(e.target.checked)}
                    className="rounded border-[#24536a] bg-[#0b1d26] text-[#e31e24]"
                  />
                  Exibir todas as datas
                </label>
              </div>

              <button
                type="button"
                onClick={() => openNewOsModal(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white text-xs font-bold shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Agendar Nova OS
              </button>
            </div>

            {agendaViewMode === 'list' && (
              <div className="bg-[#0f2834] border border-[#1f495d] rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1f495d] bg-[#0b1d26]/80 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        <th className="py-3 px-4">OS / Data & Janela Livre</th>
                        <th className="py-3 px-4">Contato & Telefone</th>
                        <th className="py-3 px-4">Placa & Modelo do Veículo</th>
                        <th className="py-3 px-4">Endereço & Bairro</th>
                        <th className="py-3 px-4">Técnico (Vincular / Retirar)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#193d4f] text-xs">
                      {filteredAgendaAppointments.map((appItem) => {
                        const st = STATUS_CONFIG[appItem.status] || STATUS_CONFIG.AGENDADO;
                        const srv = SERVICE_TYPES[appItem.service_type] || SERVICE_TYPES.INSTALACAO;
                        return (
                          <tr key={appItem.id} className="hover:bg-[#163848]/40 transition">
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-[#ff8589]">{appItem.os_number}</div>
                              <div className="text-[11px] text-slate-300 font-mono">
                                {formatDateBR(appItem.scheduled_date)} • ⏰ {appItem.time_window}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-white">
                                {appItem.contact_name || appItem.client_name}
                              </div>
                              <div className="text-[11px] text-slate-300">
                                {appItem.contact_phone || appItem.onsite_authorized_person}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-sky-400">
                                {appItem.vehicle_plate}{' '}
                                <span className="font-sans font-normal text-slate-200">
                                  — {appItem.vehicle_model}
                                </span>
                              </div>
                              <div className={`text-[11px] font-semibold ${srv.color}`}>
                                {srv.label} ({appItem.estimated_duration_min} min)
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-white font-medium">{appItem.neighborhood}</div>
                              <div className="text-[11px] text-slate-300 truncate max-w-[240px]">
                                {appItem.address}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={appItem.technician_id || ''}
                                onChange={(e) =>
                                  handleAssignTechToAppointment(
                                    appItem.id,
                                    e.target.value ? Number(e.target.value) : null
                                  )
                                }
                                className="bg-[#0b1d26] border border-[#24536a] rounded-lg px-2.5 py-1 text-[11px] text-slate-200"
                              >
                                <option value="">-- Sem Técnico / Retirar --</option>
                                {technicians.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    [{t.badge}] {t.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={appItem.status}
                                onChange={(e) => handleStatusChange(appItem.id, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-[#0b1d26] ${st.text} ${st.border}`}
                              >
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                  <option key={k} value={k} className="bg-[#0f2834] text-white">
                                    {v.shortLabel}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <a
                                href={getSinglePointGoogleMapsUrl(appItem.lat, appItem.lng, appItem.address)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center px-2.5 py-1 rounded bg-[#e31e24]/20 text-[#ff8589] border border-[#e31e24]/40 text-[11px] font-semibold"
                              >
                                Mapa ↗
                              </a>
                              <button
                                type="button"
                                onClick={() => openEditOsModal(appItem)}
                                className="px-2.5 py-1 rounded bg-[#163848] hover:bg-[#1e495d] text-slate-100 text-[11px] font-medium cursor-pointer"
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
            )}

            {agendaViewMode === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['AGENDADO', 'EM_DESLOCAMENTO', 'EM_EXECUCAO', 'CONCLUIDO'].map((colStatus) => {
                  const stConfig = STATUS_CONFIG[colStatus];
                  const colItems = filteredAgendaAppointments.filter((a) => a.status === colStatus);

                  return (
                    <div
                      key={colStatus}
                      className="bg-[#0f2834] border border-[#1f495d] rounded-xl p-3 flex flex-col gap-3 min-h-[460px]"
                    >
                      <div className="flex items-center justify-between px-1 pb-2 border-b border-[#193d4f]">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${stConfig.dot}`} />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                            {stConfig.shortLabel}
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#0b1d26] text-xs font-mono font-bold text-slate-200">
                          {colItems.length}
                        </span>
                      </div>

                      <div className="space-y-2.5 flex-1">
                        {colItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => openEditOsModal(item)}
                            className="p-3 rounded-xl bg-[#0b1d26] hover:bg-[#143342] border border-[#193d4f] cursor-pointer transition space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-bold text-[#ff8589]">{item.os_number}</span>
                              <span className="text-slate-300 font-mono">⏰ {item.time_window}</span>
                            </div>
                            <div className="text-xs font-bold text-white">
                              {item.contact_name || item.client_name}
                            </div>
                            <div className="text-[11px] text-sky-300 font-mono">
                              🚗 {item.vehicle_plate} ({item.vehicle_model})
                            </div>
                            <div className="text-[11px] text-slate-300">📍 {item.neighborhood}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLANEJAMENTO DE ROTAS & GOOGLE MAPS */}
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

        {/* TAB 4: TÉCNICOS DE CAMPO */}
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

        {/* TAB 5: ESTOQUE DE RASTREADORES */}
        {activeTab === 'stock' && (
          <TechniciansAndStockView
            mode="stock"
            technicians={technicians}
            trackers={trackers}
            appointments={appointments}
            selectedDate={selectedDate}
            onSaveTechnician={handleSaveTechnician}
            onDeleteTechnician={handleDeleteTechnician}
            onSaveTracker={handleSaveTracker}
          />
        )}
      </main>

      {/* Modals */}
      <AppointmentModal
        isOpen={isOsModalOpen}
        onClose={() => {
          setIsOsModalOpen(false);
          setEditingOs(null);
        }}
        initialData={editingOs}
        defaultDate={selectedDate}
        currentOperatorName={authenticatedUser?.name || 'David'}
        onSave={handleSaveAppointment}
        onDelete={editingOs?.id ? handleDeleteAppointment : null}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
