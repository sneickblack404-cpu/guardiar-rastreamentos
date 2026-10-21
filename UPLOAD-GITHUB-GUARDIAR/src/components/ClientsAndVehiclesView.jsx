import React, { useState } from 'react';
import { Building2, Car, Plus, MapPin, Phone, UserCheck, CalendarPlus, Search } from 'lucide-react';
import { getSinglePointGoogleMapsUrl } from '../utils/constants';

export default function ClientsAndVehiclesView({
  clients = [],
  vehicles = [],
  appointments = [],
  onCreateClient,
  onCreateVehicle,
  onNewOsForClientVehicle,
}) {
  const [search, setSearch] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const [clientForm, setClientForm] = useState({
    name: '',
    document: '',
    client_type: 'FROTA_CORPORATIVA',
    account_manager: 'Ricardo Almeida',
    internal_contact_name: '',
    internal_contact_phone: '',
    default_cep: '04551-060',
    default_address: '',
    default_neighborhood: '',
    default_city: 'São Paulo',
    default_state: 'SP',
    default_lat: -23.5952,
    default_lng: -46.6890,
    internal_notes: '',
  });

  const [vehicleForm, setVehicleForm] = useState({
    client_id: clients[0]?.id || '',
    plate: '',
    brand_model: '',
    year: 2025,
    color: 'Branca',
    vehicle_type: 'UTILITARIO',
    chassis: '',
    voltage: '12V',
  });

  const handleGeocodeClient = async () => {
    try {
      const params = new URLSearchParams({
        q: `${clientForm.default_address} ${clientForm.default_neighborhood} ${clientForm.default_city}`,
        cep: clientForm.default_cep,
      });
      const res = await fetch(`/api/geocode?${params.toString()}`);
      const data = await res.json();
      if (data) {
        setClientForm((prev) => ({
          ...prev,
          default_address: data.address || prev.default_address,
          default_neighborhood: data.neighborhood || prev.default_neighborhood,
          default_city: data.city || prev.default_city,
          default_state: data.state || prev.default_state,
          default_lat: Number(data.lat || prev.default_lat),
          default_lng: Number(data.lng || prev.default_lng),
        }));
      }
    } catch (_e) {
      // ignore
    }
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    await onCreateClient(clientForm);
    setShowClientModal(false);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    await onCreateVehicle(vehicleForm);
    setShowVehicleModal(false);
  };

  const filteredClients = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const clientVehs = vehicles.filter((v) => v.client_id === c.id);
    const matchesVeh = clientVehs.some(
      (v) => v.plate.toLowerCase().includes(q) || v.brand_model.toLowerCase().includes(q)
    );
    return (
      c.name.toLowerCase().includes(q) ||
      c.document.toLowerCase().includes(q) ||
      c.default_neighborhood.toLowerCase().includes(q) ||
      matchesVeh
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Cadastro Interno de Clientes, Frotas & Veículos
          </h2>
          <p className="text-xs text-slate-400">
            Base interna gerenciada exclusivamente pelos operadores (sem acesso externo ou portal do cliente).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar cliente, CNPJ, bairro ou placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowClientModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente / Frota
          </button>

          <button
            type="button"
            onClick={() => {
              setVehicleForm((prev) => ({ ...prev, client_id: clients[0]?.id || '' }));
              setShowVehicleModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
          >
            <Car className="w-4 h-4" />
            Cadastrar Veículo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredClients.map((client) => {
          const clientVehicles = vehicles.filter((v) => v.client_id === client.id);
          const clientOsCount = appointments.filter((a) => a.client_id === client.id).length;

          return (
            <div
              key={client.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {client.client_type.replace('_', ' ')}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{client.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">Doc: {client.document}</p>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    {clientOsCount} OS no histórico
                  </span>
                </div>

                <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Responsável Pátio: <strong>{client.internal_contact_name}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Phone className="w-3 h-3" />
                      {client.internal_contact_phone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      {client.default_address} — {client.default_neighborhood} ({client.default_city})
                    </span>
                    <a
                      href={getSinglePointGoogleMapsUrl(
                        client.default_lat,
                        client.default_lng,
                        client.default_address
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline shrink-0 font-semibold"
                    >
                      Mapa ↗
                    </a>
                  </div>
                  {client.internal_notes && (
                    <div className="text-[11px] text-amber-300/90 pt-1 border-t border-slate-800/80">
                      📌 Nota Operacional: {client.internal_notes}
                    </div>
                  )}
                </div>

                {/* Vehicles List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Veículos Cadastrados ({clientVehicles.length})
                  </div>
                  {clientVehicles.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">Nenhum veículo cadastrado para este cliente.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {clientVehicles.map((v) => (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-sky-400">{v.plate}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                {v.voltage}
                              </span>
                            </div>
                            <div className="text-xs text-slate-200 font-medium truncate max-w-[160px]">
                              {v.brand_model}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNewOsForClientVehicle?.(client, v)}
                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 shrink-0"
                            title="Agendar Ordem de Serviço para este veículo"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            Nova OS
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal New Client */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Cadastrar Cliente / Frota (Base Interna)</h3>
            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Razão Social / Nome *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">CNPJ / CPF *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.document}
                    onChange={(e) => setClientForm({ ...clientForm, document: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Responsável de Pátio / Local *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.internal_contact_name}
                    onChange={(e) => setClientForm({ ...clientForm, internal_contact_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Telefone Interno de Referência *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.internal_contact_phone}
                    onChange={(e) => setClientForm({ ...clientForm, internal_contact_phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">CEP Padrão</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={clientForm.default_cep}
                      onChange={(e) => setClientForm({ ...clientForm, default_cep: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleGeocodeClient}
                      className="px-2 rounded-lg bg-blue-600 text-white font-semibold"
                    >
                      CEP
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1">Endereço do Pátio / Base *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.default_address}
                    onChange={(e) => setClientForm({ ...clientForm, default_address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Bairro *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.default_neighborhood}
                    onChange={(e) => setClientForm({ ...clientForm, default_neighborhood: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Observações de Portaria / Acesso</label>
                  <input
                    type="text"
                    value={clientForm.internal_notes}
                    onChange={(e) => setClientForm({ ...clientForm, internal_notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal New Vehicle */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Cadastrar Veículo de Cliente</h3>
            <form onSubmit={handleSaveVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Cliente Proprietário *</label>
                <select
                  required
                  value={vehicleForm.client_id}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, client_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Placa *</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC-1D23"
                    value={vehicleForm.plate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tensão Elétrica</label>
                  <select
                    value={vehicleForm.voltage}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, voltage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="12V">12V (Leve / Utilitário)</option>
                    <option value="24V">24V (Caminhão / Pesado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Marca / Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mercedes-Benz Sprinter 416"
                  value={vehicleForm.brand_model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, brand_model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Cor</label>
                  <input
                    type="text"
                    value={vehicleForm.color}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ano</label>
                  <input
                    type="number"
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Salvar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
