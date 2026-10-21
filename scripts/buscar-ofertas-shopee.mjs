// Busca as ofertas do dia na API de afiliados da Shopee e salva em ofertas-shopee.json,
// que o Painel lê na aba Banco de Produtos. Roda sozinho todo dia pelo GitHub Actions.
// A chave fica nos "Secrets" do GitHub (SHOPEE_APP_ID e SHOPEE_SECRET), nunca no código.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

// Os valores colados no GitHub pelo celular às vezes vêm com espaço, quebra de linha ou o rótulo junto
// ("AppID: 123..."), então pega só o número do ID e o código da senha.
const BRUTO_ID = process.env.SHOPEE_APP_ID || "";
const BRUTO_SECRET = process.env.SHOPEE_SECRET || "";
const codigoSenha = texto => (texto.match(/[A-Za-z0-9]{20,}/g) || []).find(t => /[A-Za-z]/.test(t));
const APP_ID = (BRUTO_ID.match(/\d{6,}/) || [""])[0];
const SECRET = codigoSenha(BRUTO_SECRET) || codigoSenha(BRUTO_ID) || BRUTO_SECRET.trim();
export const chavesLidas = { APP_ID, SECRET };
const URL_API = "https://open-api.affiliate.shopee.com.br/graphql";
const POR_GRUPO = 10;
const POR_EM_ALTA = 15; // "🔥 Em Alta" é uma lista de monitoramento separada dos grupos — não disputa produto com eles

// Um bloco por grupo do WhatsApp. keyword vazia = mais vendidos da Shopee em geral.
const GRUPOS = [
  { id: "vip", nome: "Grupo VIP", keyword: "" },
  { id: "natal", nome: "Natal", keyword: "decoração de natal" },
  { id: "beleza", nome: "Beleza e acessórios", keyword: "beleza" },
  { id: "kids", nome: "Kids", keyword: "infantil" },
];

const CAMPOS = "itemId productName priceMin priceMax commissionRate commission sales ratingStar priceDiscountRate imageUrl offerLink shopName";

export function assinatura(appId, timestamp, payload, secret) {
  return createHash("sha256").update(`${appId}${timestamp}${payload}${secret}`).digest("hex");
}

async function buscar(keyword, limitePedido = POR_GRUPO * 2) {
  const filtros = keyword
    ? `keyword: ${JSON.stringify(keyword)}, sortType: 2, page: 1, limit: ${limitePedido}`
    : `listType: 2, sortType: 2, page: 1, limit: ${limitePedido}`;
  const payload = JSON.stringify({ query: `{ productOfferV2(${filtros}) { nodes { ${CAMPOS} } } }` });
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(URL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${assinatura(APP_ID, timestamp, payload, SECRET)}`,
    },
    body: payload,
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(`Shopee respondeu: ${json.errors[0].message}`);
  return json.data.productOfferV2.nodes || [];
}

function numero(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

export function converter(node) {
  const precoMin = numero(node.priceMin);
  const precoMax = numero(node.priceMax);
  return {
    itemId: String(node.itemId),
    nome: node.productName,
    link: node.offerLink,
    loja: "shopee",
    preco: precoMax && precoMin && precoMax > precoMin ? { min: precoMin, max: precoMax } : precoMin,
    comissao: numero(node.commissionRate) !== undefined ? Math.round(numero(node.commissionRate) * 1000) / 10 : undefined,
    valorComissao: numero(node.commission),
    vendas: node.sales,
    nota: numero(node.ratingStar),
    desconto: node.priceDiscountRate || undefined,
    foto: node.imageUrl,
    loja_nome: node.shopName,
  };
}

async function main() {
  if (!APP_ID || !SECRET) {
    console.error("Faltam os segredos SHOPEEID e SHOPEESENHA no GitHub.");
    process.exit(1);
  }
  const usados = new Set();
  const grupos = [];
  for (const g of GRUPOS) {
    const nodes = await buscar(g.keyword);
    const ofertas = nodes
      .filter(n => n.offerLink && !usados.has(String(n.itemId)))
      .slice(0, POR_GRUPO)
      .map(converter);
    ofertas.forEach(o => usados.add(o.itemId));
    grupos.push({ id: g.id, nome: g.nome, ofertas });
    console.log(`${g.nome}: ${ofertas.length} ofertas`);
  }

  // "🔥 Em Alta": os mais vendidos no geral, como lista própria de monitoramento (não tira produto dos grupos acima)
  let emAlta = [];
  try {
    const nodesEmAlta = await buscar("", POR_EM_ALTA * 2);
    emAlta = nodesEmAlta.filter(n => n.offerLink).slice(0, POR_EM_ALTA).map(converter);
    console.log(`Em Alta: ${emAlta.length} produtos`);
  } catch (e) {
    console.error(`Em Alta: falhou ao buscar (${e.message})`);
  }

  writeFileSync("ofertas-shopee.json", JSON.stringify({ atualizadoEm: new Date().toISOString(), grupos, emAlta }, null, 1) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
