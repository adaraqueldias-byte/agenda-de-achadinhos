/** Considera o aparelho "online" se a última atualização tiver até 15 min. */
export const LIMITE_ONLINE_MS = 15 * 60 * 1000;
/** Acima disso a localização é exibida como desatualizada. */
export const LIMITE_DESATUALIZADO_MS = 30 * 60 * 1000;

export type Situacao = 'online' | 'desatualizado' | 'offline' | 'pausado' | 'sem-dados';

export function situacao(compartilhando: boolean, ultima: string | null): Situacao {
  if (!compartilhando) return 'pausado';
  if (!ultima) return 'sem-dados';
  const idade = Date.now() - new Date(ultima).getTime();
  if (idade <= LIMITE_ONLINE_MS) return 'online';
  if (idade <= LIMITE_DESATUALIZADO_MS) return 'desatualizado';
  return 'offline';
}

export const rotuloSituacao: Record<Situacao, string> = {
  online: 'Online',
  desatualizado: 'Desatualizado',
  offline: 'Offline',
  pausado: 'Compartilhamento pausado',
  'sem-dados': 'Aguardando primeira localização',
};

export function tempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca';
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return 'agora mesmo';
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dataLonga(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export function coordenadas(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Formata enquanto digita: (11) 91234-5678 */
export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Converte para E.164 (+55...) — formato exigido pelo Supabase Auth. */
export function telefoneE164(valor: string): string | null {
  const d = valor.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if (d.length >= 12 && d.length <= 15) return `+${d}`;
  return null;
}
