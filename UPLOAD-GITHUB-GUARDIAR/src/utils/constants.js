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
  INSTALACAO: { label: 'Instalação', color: 'text-emerald-400', badgeBg: 'bg-emerald-500/10 border-emerald-500/30' },
  MANUTENCAO: { label: 'Manutenção', color: 'text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/30' },
  RETIRADA: { label: 'Retirada', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
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

export const DAILY_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

export function formatOsCopyText(item) {
  if (!item) return '';
  const horario = (item.window_start || item.scheduled_time || item.time_window || '08:00')
    .split('-')[0]
    .trim();
  const servicoObj = SERVICE_TYPES[item.service_type] || SERVICE_TYPES.INSTALACAO;
  const servico = servicoObj?.label || item.service_type || 'Instalação';

  const addrBase = (item.address || '').trim();
  const neigh = (item.neighborhood || '').trim();
  const city = (item.city || 'Belo Horizonte').trim();
  const state = (item.state || 'MG').trim();

  let fullAddress = addrBase;
  if (neigh && !fullAddress.toLowerCase().includes(neigh.toLowerCase())) {
    fullAddress = fullAddress ? `${fullAddress} - ${neigh}` : neigh;
  }
  if (city && !fullAddress.toLowerCase().includes(city.toLowerCase())) {
    fullAddress = fullAddress ? `${fullAddress}, ${city}/${state}` : `${city}/${state}`;
  }

  const cliente = (item.contact_name || item.client_name || '').trim();
  const contato = (item.contact_phone || '').trim();
  const placa = (item.vehicle_plate || '').toUpperCase().trim();
  const modelo = (item.vehicle_model || '').trim();

  return `${horario} - ${servico} - Endereço: ${fullAddress}  Cliente: ${cliente}  Contato: ${contato}  Placa: ${placa}  Modelo: ${modelo}`;
}

export function getWhatsAppConfirmationUrl(item) {
  if (!item) return '';
  const osText = formatOsCopyText(item);
  const message = `Olá! Tudo bem? Passando para confirmar o agendamento do senhor(a), confirma?\n\n${osText}`;

  // Clean phone number: remove non-digits
  const rawPhone = (item.contact_phone || '').replace(/\D/g, '');
  let phone = rawPhone;
  if (phone) {
    // If Brazilian number without country code (10 or 11 digits: e.g. 31999990000)
    if (phone.length === 10 || phone.length === 11) {
      phone = '55' + phone;
    }
  }

  const encodedText = encodeURIComponent(message);
  if (phone) {
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLng = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  return Number((straightKm * 1.3).toFixed(1));
}

