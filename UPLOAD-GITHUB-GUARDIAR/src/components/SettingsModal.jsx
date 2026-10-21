import React, { useState, useEffect } from 'react';
import { X, Settings, MapPin, Key, Gauge, CheckCircle2 } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, settings = {}, onSaveSettings }) {
  const [form, setForm] = useState({
    company_name: '',
    hq_name: '',
    hq_address: '',
    hq_lat: '-23.5218',
    hq_lng: '-46.6692',
    google_maps_api_key: '',
    default_urban_speed_kmh: '28',
    buffer_between_os_min: '15',
    workday_start: '08:00',
    workday_end: '18:00',
  });

  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (isOpen && settings) {
      setForm({
        company_name: settings.company_name || 'Guardiar Rastreamentos',
        hq_name: settings.hq_name || 'Matriz Operacional Guardiar',
        hq_address: settings.hq_address || '',
        hq_lat: settings.hq_lat || '-23.5218',
        hq_lng: settings.hq_lng || '-46.6692',
        google_maps_api_key: settings.google_maps_api_key || '',
        default_urban_speed_kmh: settings.default_urban_speed_kmh || '28',
        buffer_between_os_min: settings.buffer_between_os_min || '15',
        workday_start: settings.workday_start || '08:00',
        workday_end: settings.workday_end || '18:00',
      });
      setSavedMsg(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSaveSettings(form);
    setSavedMsg(true);
    setTimeout(() => {
      setSavedMsg(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071319]/85 backdrop-blur-sm p-4">
      <div className="bg-[#0f2834] border border-[#1f495d] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f495d] pb-3">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#e31e24]" />
            <div>
              <h2 className="text-base font-bold text-white">
                Configurações Guardiar Rastreamentos & Google Maps
              </h2>
              <p className="text-xs text-slate-300">
                Parâmetros da Matriz Operacional, velocidade média de roteirização e chave de API Google Cloud.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#163848]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="bg-[#0b1d26]/90 border border-[#193d4f] rounded-xl p-4 space-y-3">
            <div className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#e31e24]" />
              Matriz / Base Central da Empresa
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Identificação da Base Central</label>
                <input
                  type="text"
                  value={form.hq_name}
                  onChange={(e) => setForm({ ...form, hq_name: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Endereço Completo da Matriz</label>
              <input
                type="text"
                value={form.hq_address}
                onChange={(e) => setForm({ ...form, hq_address: e.target.value })}
                className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Latitude da Matriz</label>
                <input
                  type="text"
                  value={form.hq_lat}
                  onChange={(e) => setForm({ ...form, hq_lat: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Longitude da Matriz</label>
                <input
                  type="text"
                  value={form.hq_lng}
                  onChange={(e) => setForm({ ...form, hq_lng: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#0b1d26]/90 border border-[#193d4f] rounded-xl p-4 space-y-3">
            <div className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-400" />
              Parâmetros do Algoritmo de Roteirização e ETA
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Velocidade Urbana (km/h)</label>
                <input
                  type="number"
                  value={form.default_urban_speed_kmh}
                  onChange={(e) => setForm({ ...form, default_urban_speed_kmh: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Margem entre OS (min)</label>
                <input
                  type="number"
                  value={form.buffer_between_os_min}
                  onChange={(e) => setForm({ ...form, buffer_between_os_min: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Início do Turno</label>
                <input
                  type="time"
                  value={form.workday_start}
                  onChange={(e) => setForm({ ...form, workday_start: e.target.value })}
                  className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#0b1d26]/90 border border-[#193d4f] rounded-xl p-4 space-y-2">
            <div className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-400" />
              Google Maps Platform API Key (Opcional)
            </div>
            <input
              type="password"
              placeholder="AIzaSy... (Opcional)"
              value={form.google_maps_api_key}
              onChange={(e) => setForm({ ...form, google_maps_api_key: e.target.value })}
              className="w-full bg-[#0f2834] border border-[#24536a] rounded-lg px-3 py-2 text-white font-mono"
            />
          </div>

          {savedMsg && (
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Configurações salvas com sucesso!
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#1f495d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#163848] text-slate-200 font-medium cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#e31e24] hover:bg-[#c8191e] text-white font-bold shadow-lg cursor-pointer"
            >
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
