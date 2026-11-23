import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { lerDispositivoLocal, pararCompartilhamento, salvarDispositivoLocal, sincronizarComServidor } from '@/lib/localizacao';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import type { Dispositivo, Perfil } from '@/lib/tipos';

type ValorSessao = {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  /** Registro de "dispositivos" que corresponde a ESTE celular. */
  esteAparelho: Dispositivo | null;
  recarregarPerfil: () => Promise<void>;
  recarregarAparelho: () => Promise<void>;
  definirEsteAparelho: (d: Dispositivo | null) => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<ValorSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilPronto, setPerfilPronto] = useState(false);
  const [esteAparelho, setEsteAparelho] = useState<Dispositivo | null>(null);

  const usuarioId = sessao?.user.id;

  const recarregarPerfil = useCallback(async () => {
    if (!usuarioId) {
      setPerfil(null);
      setPerfilPronto(true);
      return;
    }
    const { data } = await supabase
      .from('perfis')
      .select('id, nome, retencao_dias, termos_aceitos_em')
      .eq('id', usuarioId)
      .maybeSingle();
    setPerfil(data);
    setPerfilPronto(true);
  }, [usuarioId]);

  const recarregarAparelho = useCallback(async () => {
    if (!usuarioId) return setEsteAparelho(null);
    const local = await lerDispositivoLocal();
    if (!local || local.usuarioId !== usuarioId) return setEsteAparelho(null);
    const { data, error } = await supabase.from('dispositivos').select('*').eq('id', local.dispositivoId).maybeSingle();
    if (error) return; // provavelmente offline: mantém o estado atual
    if (!data) {
      // Aparelho removido em outro lugar.
      await salvarDispositivoLocal(null);
      await pararCompartilhamento();
      return setEsteAparelho(null);
    }
    setEsteAparelho(data);
    await sincronizarComServidor(data.compartilhando);
  }, [usuarioId]);

  const definirEsteAparelho = useCallback(
    async (d: Dispositivo | null) => {
      await salvarDispositivoLocal(d && usuarioId ? { usuarioId, dispositivoId: d.id } : null);
      setEsteAparelho(d);
    },
    [usuarioId],
  );

  const sair = useCallback(async () => {
    // Nunca deixa o envio de localização ativo após sair da conta.
    const local = await lerDispositivoLocal();
    if (local) {
      await supabase.from('dispositivos').update({ compartilhando: false }).eq('id', local.dispositivoId);
    }
    await pararCompartilhamento();
    await salvarDispositivoLocal(null);
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void recarregarPerfil();
    void recarregarAparelho();
  }, [recarregarPerfil, recarregarAparelho]);

  const valor = useMemo(
    () => ({
      carregando: carregando || (!!sessao && !perfilPronto),
      sessao,
      perfil,
      esteAparelho,
      recarregarPerfil,
      recarregarAparelho,
      definirEsteAparelho,
      sair,
    }),
    [carregando, perfilPronto, sessao, perfil, esteAparelho, recarregarPerfil, recarregarAparelho, definirEsteAparelho, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSessao deve ser usado dentro de ProvedorSessao');
  return v;
}
