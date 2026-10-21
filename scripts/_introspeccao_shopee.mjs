// Script temporário de diagnóstico — descobre se a API da Shopee tem campo de categoria
// no productOfferV2, pra saber se dá pra montar um "nichos em alta". Apaga depois de usar.
import { createHash } from "node:crypto";

const BRUTO_ID = process.env.SHOPEE_APP_ID || "";
const BRUTO_SECRET = process.env.SHOPEE_SECRET || "";
const codigoSenha = texto => (texto.match(/[A-Za-z0-9]{20,}/g) || []).find(t => /[A-Za-z]/.test(t));
const APP_ID = (BRUTO_ID.match(/\d{6,}/) || [""])[0];
const SECRET = codigoSenha(BRUTO_SECRET) || codigoSenha(BRUTO_ID) || BRUTO_SECRET.trim();
const URL_API = "https://open-api.affiliate.shopee.com.br/graphql";

function assinatura(appId, timestamp, payload, secret) {
  return createHash("sha256").update(`${appId}${timestamp}${payload}${secret}`).digest("hex");
}

async function consultar(query) {
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(URL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${assinatura(APP_ID, timestamp, payload, SECRET)}`,
    },
    body: payload,
  });
  return res.json();
}

async function main() {
  console.log("=== Todas as queries disponíveis ===");
  const r3 = await consultar(`{ __schema { queryType { fields { name } } } }`);
  console.log(JSON.stringify(r3, null, 2));

  console.log("=== Testando productOfferV2 com productCatIds e categoryName ===");
  const r4 = await consultar(`{ productOfferV2(listType: 2, sortType: 2, page: 1, limit: 3) { nodes { itemId productName productCatIds } } }`);
  console.log(JSON.stringify(r4, null, 2));
}

main().catch(e => { console.error(e.message); process.exit(1); });
