import React, { useState, useEffect } from 'react';
import { Lock, User, LogIn, ShieldCheck, AlertCircle, Wrench, Headset } from 'lucide-react';

const QUICK_OPERATORS = [
  { username: 'David', role: 'Coordenação & Rotas', badge: 'GD-01' },
  { username: 'Sarah', role: 'Agendamento Interno', badge: 'GD-02' },
  { username: 'Jennifer', role: 'Gestão Técnica & Controle', badge: 'GD-03' },
];

export default function LoginScreen({ technicians = [], onLoginSuccess }) {
  const [loginType, setLoginType] = useState('operator'); // 'operator' | 'technician'
  const [username, setUsername] = useState('David');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (technicians.length > 0 && !selectedTechId) {
      setSelectedTechId(technicians[0].id);
    }
  }, [technicians, selectedTechId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const selectedTechObj = technicians.find((t) => String(t.id) === String(selectedTechId));
      const payload =
        loginType === 'technician'
          ? {
              loginType: 'technician',
              technicianId: Number(selectedTechId),
              username: selectedTechObj?.badge || username,
              password,
            }
          : {
              loginType: 'operator',
              username,
              password,
            };

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Usuário ou senha inválidos.');
      } else {
        onLoginSuccess(data.user);
      }
    } catch (_err) {
      setError('Erro de conexão com o servidor interno.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08171e] via-[#12303e] to-[#0b1d26] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f2834] border border-[#1f495d] rounded-2xl shadow-2xl overflow-hidden">
        {/* Top White Logo Header */}
        <div className="bg-white px-8 py-6 flex flex-col items-center border-b-4 border-[#e31e24]">
          <img
            src="/logo-guardiar.png"
            alt="Guardiar Rastreamentos"
            className="h-24 w-auto object-contain"
          />
          <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#12303e] text-white text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-[#e31e24]" />
            Sistema Web de Uso Exclusivo Interno
          </span>
        </div>

        {/* Login Mode Switcher: Operador vs Técnico */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0b1d26] border border-[#1f495d]">
            <button
              type="button"
              onClick={() => {
                setLoginType('operator');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                loginType === 'operator'
                  ? 'bg-[#e31e24] text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Headset className="w-4 h-4" />
              Central / Operador
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginType('technician');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                loginType === 'technician'
                  ? 'bg-[#e31e24] text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Acesso do Técnico
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {loginType === 'operator' ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Operador Interno
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {QUICK_OPERATORS.map((u) => {
                  const selected = username.toLowerCase() === u.username.toLowerCase();
                  return (
                    <button
                      key={u.username}
                      type="button"
                      onClick={() => {
                        setUsername(u.username);
                        setError('');
                      }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        selected
                          ? 'bg-[#e31e24] border-[#ff4d52] text-white shadow-lg shadow-[#e31e24]/25'
                          : 'bg-[#0b1d26] border-[#1f495d] text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{u.username}</div>
                      <div className="text-[10px] opacity-80 truncate">{u.badge}</div>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0b1d26] border border-[#1f495d] focus:border-[#e31e24] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Selecione o Técnico de Campo
              </label>
              <select
                required
                value={selectedTechId}
                onChange={(e) => {
                  setSelectedTechId(e.target.value);
                  setError('');
                }}
                className="w-full bg-[#0b1d26] border border-[#1f495d] focus:border-[#e31e24] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.badge}] {t.name} — {t.region}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0b1d26] border border-[#1f495d] focus:border-[#e31e24] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#e31e24] hover:bg-[#c8191e] text-white font-bold text-sm shadow-lg shadow-[#e31e24]/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading
              ? 'Autenticando...'
              : loginType === 'technician'
              ? 'Entrar no Painel do Técnico'
              : `Entrar como ${username || 'Operador'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
