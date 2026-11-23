import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSessao } from '@/contexto/Sessao';
import { supabase } from './supabase';
import type { AparelhoAcompanhado, Dispositivo, Localizacao } from './tipos';

/** Item exibido no mapa: um aparelho meu ou um que alguém compartilhou comigo. */
export type AparelhoMapa = {
  id: string;
  nome: string;
  titular: string;
  meu: boolean;
  esteCelular: boolean;
  compartilhando: boolean;
  compartilhamentoId?: string;
  lat: number | null;
  lng: number | null;
  precisao: number | null;
  atualizado: string | null;
};

export function useAparelhos() {
  const { sessao, perfil, esteAparelho } = useSessao();
  const [itens, setItens] = useState<AparelhoMapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const montado = useRef(true);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    const [meus, deOutros] = await Promise.all([
      supabase.from('dispositivos').select('*').order('criado_em'),
      supabase.rpc('aparelhos_que_acompanho'),
    ]);
    if (!montado.current) return;
    if (meus.error || deOutros.error) {
      setErro((meus.error ?? deOutros.error)!.message);
      setCarregando(false);
      return;
    }
    setErro(null);
    const lista: AparelhoMapa[] = [
      ...(meus.data as Dispositivo[]).map((d) => ({
        id: d.id,
        nome: d.nome,
        titular: perfil?.nome ?? 'Você',
        meu: true,
        esteCelular: d.id === esteAparelho?.id,
        compartilhando: d.compartilhando,
        lat: d.ultima_lat,
        lng: d.ultima_lng,
        precisao: d.ultima_precisao,
        atualizado: d.ultima_atualizacao,
      })),
      ...((deOutros.data ?? []) as AparelhoAcompanhado[]).map((a) => ({
        id: a.dispositivo_id,
        nome: a.dispositivo_nome,
        titular: a.titular_nome,
        meu: false,
        esteCelular: false,
        compartilhando: a.compartilhando,
        compartilhamentoId: a.compartilhamento_id,
        lat: a.ultima_lat,
        lng: a.ultima_lng,
        precisao: a.ultima_precisao,
        atualizado: a.ultima_atualizacao,
      })),
    ];
    setItens(lista);
    setCarregando(false);
  }, [sessao, perfil?.nome, esteAparelho?.id]);

  // Recarrega ao focar a tela e a cada minuto (para atualizar "online/offline").
  useFocusEffect(
    useCallback(() => {
      void carregar();
      const t = setInterval(() => void carregar(), 60_000);
      return () => clearInterval(t);
    }, [carregar]),
  );

  // Novos pontos em tempo real (o Realtime respeita as políticas RLS).
  useEffect(() => {
    montado.current = true;
    if (!sessao) return;
    const canal = supabase
      .channel('mapa-localizacoes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'localizacoes' }, (payload) => {
        const p = payload.new as Localizacao;
        setItens((atual) =>
          atual.map((a) =>
            a.id === p.dispositivo_id && (!a.atualizado || p.registrado_em > a.atualizado)
              ? { ...a, lat: p.lat, lng: p.lng, precisao: p.precisao, atualizado: p.registrado_em, compartilhando: true }
              : a,
          ),
        );
      })
      .subscribe();
    return () => {
      montado.current = false;
      void supabase.removeChannel(canal);
    };
  }, [sessao]);

  return { itens, carregando, erro, recarregar: carregar };
}
