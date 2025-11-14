import axios from 'axios';
import api from './api';

// Derive backend base URL for internal endpoints. Prefer NEXT_PUBLIC_BACKEND_BASE_URL,
// otherwise try NEXT_PUBLIC_API_URL (may contain /api) and fallback to http://localhost:5000
const raw = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');
const backendBase = raw.replace(/\/api\/?$/i, '');

const backend = axios.create({ baseURL: backendBase });

// copy auth header from api axios instance if present (so client JWT is forwarded)
if (api.defaults.headers.common['Authorization']) {
  backend.defaults.headers.common['Authorization'] = api.defaults.headers.common['Authorization'];
}

async function importLatestShopifyOrder() {
  try {
    const resp = await backend.post('/internal/import-shopify-latest');
    return resp.data;
  } catch (err: any) {
    // Try one retry on network failure
    if (!err.response) {
      await new Promise(r => setTimeout(r, 500));
      const resp = await backend.post('/internal/import-shopify-latest');
      return resp.data;
    }
    // Re-throw to caller
    throw err;
  }
}

async function sendClientLog(payload: { level: string; message: string; stack?: any; raw?: any }) {
  try {
    await backend.post('/internal/logs', payload);
  } catch (e) {
    // swallow logging errors client-side
    // eslint-disable-next-line no-console
    console.error('Failed to send client log', e);
  }
}

export { importLatestShopifyOrder, sendClientLog };
