// Busca produtos no Mercado Livre pela API pública de busca (sites/MLB/search) e salva em
// ofertas-mercadolivre.json, que o Painel lê na aba Banco de Produtos. Roda sozinho todo dia pelo GitHub Actions.
//
// IMPORTANTE: o Mercado Livre não tem API oficial de afiliados (diferente da Shopee). Esta busca usa a API
// pública de catálogo — os mesmos dados que aparecem na busca do site — sem chave nem login, então não
// precisa de segredo no GitHub. Ela ajuda a ENCONTRAR produtos com desconto rápido, mas o link salvo aqui
// é o link normal do produto, sem comissão. Antes de postar, gere o link de afiliado certinho no painel de
// Afiliados do Mercado Livre e troque o link no Banco.
import { writeFileSync } from "node:fs";

const URL_API = "https://api.mercadolibre.com/sites/MLB/search";
const POR_GRUPO = 10;

// Um bloco por grupo do WhatsApp — mesma ideia da Shopee, ajuste as palavras-chave quando quiser.
const GRUPOS = [
  { id: "vip", nome: "Grupo VIP", keyword: "promoção" },
  { id: "natal", nome: "Natal", keyword: "decoração de natal" },
  { id: "beleza", nome: "Beleza e acessórios", keyword: "beleza" },
  { id: "kids", nome: "Kids", keyword: "infantil" },
];

async function buscar(keyword) {
  const url = `${URL_API}?q=${encodeURIComponent(keyword)}&limit=${POR_GRUPO * 3}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mercado Livre respondeu ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

function numero(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

export function converter(item) {
  const preco = numero(item.price);
  const precoOriginal = numero(item.original_price);
  const desconto = precoOriginal && preco && precoOriginal > preco
    ? Math.round((1 - preco / precoOriginal) * 100)
    : undefined;
  return {
    itemId: String(item.id),
    nome: item.title,
    link: item.permalink,
    loja: "mercadolivre",
    preco,
    vendas: numero(item.sold_quantity),
    desconto,
    foto: item.thumbnail ? item.thumbnail.replace(/^http:/, "https:") : undefined,
    loja_nome: item.seller && item.seller.nickname,
  };
}

async function main() {
  const usados = new Set();
  const grupos = [];
  for (const g of GRUPOS) {
    let itens = [];
    try {
      itens = await buscar(g.keyword);
    } catch (e) {
      console.error(`${g.nome}: falhou ao buscar (${e.message})`);
      grupos.push({ id: g.id, nome: g.nome, ofertas: [] });
      continue;
    }
    const ofertas = itens
      .filter(n => n.permalink && n.id && !usados.has(String(n.id)))
      .map(converter)
      .sort((a, b) => (b.desconto || 0) - (a.desconto || 0))
      .slice(0, POR_GRUPO);
    ofertas.forEach(o => usados.add(o.itemId));
    grupos.push({ id: g.id, nome: g.nome, ofertas });
    console.log(`${g.nome}: ${ofertas.length} ofertas`);
  }
  writeFileSync("ofertas-mercadolivre.json", JSON.stringify({ atualizadoEm: new Date().toISOString(), grupos }, null, 1) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
