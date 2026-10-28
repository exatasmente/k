// Criptografia em repouso (RNF02): AES-GCM 256 com chave do aparelho.
// A chave é gerada como NÃO exportável e guardada no próprio IndexedDB
// (CryptoKey é clonável): o código do app usa a chave, mas não consegue lê-la.

const ALGORITHM = { name: 'AES-GCM', length: 256 };
const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function generateKey(subtle = globalThis.crypto.subtle) {
  return subtle.generateKey(ALGORITHM, false, ['encrypt', 'decrypt']);
}

/** @returns {Promise<{iv: Uint8Array, data: ArrayBuffer}>} */
export async function encryptJSON(key, value, cryptoImpl = globalThis.crypto) {
  const iv = cryptoImpl.getRandomValues(new Uint8Array(IV_BYTES));
  const data = await cryptoImpl.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return { iv, data };
}

export async function decryptJSON(key, { iv, data }, subtle = globalThis.crypto.subtle) {
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(decoder.decode(plain));
}
