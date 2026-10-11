// Minimal shims for Mangayomi-style JS extensions running in Worker
// Designed to be simple and deterministic; only what extensions commonly use.

export function createCryptoShim() {
  return {
    MD5: async (data) => {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const hash = await crypto.subtle.digest('MD5', bytes);
      return Array.from(new Uint8Array(hash));
    },
    SHA256: async (data) => {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const hash = await crypto.subtle.digest('SHA256', bytes);
      return Array.from(new Uint8Array(hash));
    },
    base64Encode: (str) => btoa(str),
    base64Decode: (str) => atob(str),
  };
}

export function createClientShim(fetchImpl = fetch) {
  return {
    get: async (url, options = {}) => {
      const res = await fetchImpl(url, { method: 'GET', ...options });
      return {
        body: await res.text(),
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      };
    },
    post: async (url, options = {}) => {
      const res = await fetchImpl(url, { method: 'POST', ...options });
      return {
        body: await res.text(),
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      };
    },
  };
}
