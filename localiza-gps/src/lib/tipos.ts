export type Perfil = {
  id: string;
  nome: string;
  retencao_dias: number;
  termos_aceitos_em: string | null;
};

export type Dispositivo = {
  id: string;
  dono_id: string;
  nome: string;
  plataforma: 'android' | 'ios';
  compartilhando: boolean;
  ultima_lat: number | null;
  ultima_lng: number | null;
  ultima_precisao: number | null;
  ultima_atualizacao: string | null;
  criado_em: string;
};

export type AparelhoAcompanhado = {
  compartilhamento_id: string;
  dispositivo_id: string;
  dispositivo_nome: string;
  titular_nome: string;
  compartilhando: boolean;
  ultima_lat: number | null;
  ultima_lng: number | null;
  ultima_precisao: number | null;
  ultima_atualizacao: string | null;
};

export type QuemMeVe = {
  compartilhamento_id: string;
  dispositivo_id: string;
  dispositivo_nome: string;
  observador_nome: string;
  consentido_em: string;
};

export type Convite = {
  id: string;
  remetente_id: string;
  telefone_destino: string | null;
  codigo: string;
  mensagem: string | null;
  status: 'pendente' | 'aceito' | 'recusado' | 'cancelado';
  criado_em: string;
  expira_em: string;
};

export type ConviteRecebido = {
  id: string;
  remetente_nome: string;
  mensagem: string | null;
  criado_em: string;
  expira_em: string;
};

export type Localizacao = {
  id: number;
  dispositivo_id: string;
  lat: number;
  lng: number;
  precisao: number | null;
  velocidade: number | null;
  registrado_em: string;
};

export type Cerca = {
  id: string;
  criador_id: string;
  dispositivo_id: string;
  nome: string;
  lat: number;
  lng: number;
  raio_m: number;
  alerta_entrada: boolean;
  alerta_saida: boolean;
  ativa: boolean;
  dentro: boolean | null;
};

export type Alerta = {
  id: number;
  destinatario_id: string;
  dispositivo_id: string | null;
  tipo:
    | 'entrada_cerca'
    | 'saida_cerca'
    | 'compartilhamento_parado'
    | 'localizacao_desatualizada'
    | 'convite_recebido'
    | 'convite_aceito'
    | 'acesso_revogado';
  titulo: string;
  mensagem: string;
  lido: boolean;
  criado_em: string;
};
