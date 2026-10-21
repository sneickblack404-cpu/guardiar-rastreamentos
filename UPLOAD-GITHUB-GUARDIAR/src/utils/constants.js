export const STATUS_CONFIG = {
  PENDENTE_ROTA: {
    label: 'Pendente de Rota/Técnico',
    shortLabel: 'Sem Rota',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  AGENDADO: {
    label: 'Agendado em Rota',
    shortLabel: 'Agendado',
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  EM_DESLOCAMENTO: {
    label: 'Técnico em Deslocamento',
    shortLabel: 'Em Deslocamento',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
    dot: 'bg-indigo-400',
  },
  EM_EXECUCAO: {
    label: 'Instalação em Execução',
    shortLabel: 'Em Execução',
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
  },
  CONCLUIDO: {
    label: 'Serviço Concluído',
    shortLabel: 'Concluído',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  REAGENDADO: {
    label: 'Reagendado Internamente',
    shortLabel: 'Reagendado',
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
  },
  CANCELADO: {
    label: 'Cancelado',
    shortLabel: 'Cancelado',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export const SERVICE_TYPES = {
  INSTALACAO: { label: 'Instalação de Rastreador', color: 'text-emerald-400', badgeBg: 'bg-emerald-500/10 border-emerald-500/30' },
  MANUTENCAO: { label: 'Manutenção / Reparo', color: 'text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/30' },
  TROCA_EQUIPAMENTO: { label: 'Upgrade / Troca de Módulo', color: 'text-blue-400', badgeBg: 'bg-blue-500/10 border-blue-500/30' },
  RETIRADA: { label: 'Desinstalação / Retirada', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  VISTORIA_TECNICA: { label: 'Vistoria Técnica / Teste RF', color: 'text-purple-400', badgeBg: 'bg-purple-500/10 border-purple-500/30' },
};

export const PRIORITY_CONFIG = {
  NORMAL: { label: 'Normal', bg: 'bg-slate-800 text-slate-300 border-slate-700' },
  ALTA: { label: 'Alta Prioridade', bg: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  URGENTE_FROTA: { label: 'Urgente (Frota Parada)', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
};

export const TIME_WINDOWS = [
  '08:00 - 10:00',
  '09:00 - 11:00',
  '10:00 - 12:00',
  '13:30 - 15:30',
  '14:00 - 16:00',
  '15:00 - 17:00',
  '16:00 - 18:00',
];

export const TRACKER_STATUS_CONFIG = {
  DISPONIVEL: { label: 'Disponível em Bancada', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  RESERVADO: { label: 'Reservado em OS', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  INSTALADO: { label: 'Instalado em Veículo', bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  MANUTENCAO: { label: 'Laboratório / Defeito', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export const TECH_STATUS_CONFIG = {
  DISPONIVEL: { label: 'Disponível na Base', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  EM_ROTA: { label: 'Em Rota de Campo', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  PAUSA: { label: 'Intervalo / Almoço', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  INDISPONIVEL: { label: 'Fora de Escala', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function getSinglePointGoogleMapsUrl(lat, lng, address = '') {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
