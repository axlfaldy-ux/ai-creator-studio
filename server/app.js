import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 500;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 8;
const MAX_CONCURRENT_GENERATIONS = 2;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function apiError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function parseReference(referenceImage) {
  if (!referenceImage || typeof referenceImage !== 'object') return null;
  const dataUrl = referenceImage.dataUrl;
  if (typeof dataUrl !== 'string') throw Object.assign(new Error('Referensi gambar tidak valid.'), { status: 400, code: 'INVALID_IMAGE' });
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw Object.assign(new Error('Gunakan gambar JPG, PNG, atau WebP.'), { status: 400, code: 'UNSUPPORTED_IMAGE' });
  const [, mimeType, encoded] = match;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES || bytes.toString('base64') !== encoded) {
    throw Object.assign(new Error('Ukuran gambar maksimum 12 MB.'), { status: 413, code: 'IMAGE_TOO_LARGE' });
  }
  const suppliedName = typeof referenceImage.name === 'string' ? referenceImage.name : 'reference-image';
  const filename = path.basename(suppliedName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'reference-image';
  return { bytes, mimeType, filename };
}

function createRateLimiter() {
  const buckets = new Map();
  return (ip) => {
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
      buckets.set(ip, { startedAt: now, count: 1 });
      if (buckets.size > 1000) {
        for (const [address, value] of buckets) if (now - value.startedAt >= RATE_WINDOW_MS) buckets.delete(address);
      }
      return true;
    }
    if (bucket.count >= RATE_LIMIT) return false;
    bucket.count += 1;
    return true;
  };
}

export function createApp({ apiKey = process.env.OPENAI_API_KEY, imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare', fetchImpl = fetch } = {}) {
  const app = express();
  const allowGeneration = createRateLimiter();
  let activeGenerations = 0;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '18mb' }));

  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ status: 'ok', app: 'AI Creator Studio', mode: 'openai-image-api', imageProviderConfigured: Boolean(apiKey) });
  });

  app.post('/api/images/generate', async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (!apiKey) return apiError(response, 503, 'IMAGE_PROVIDER_NOT_CONFIGURED', 'Generasi gambar belum aktif. OPENAI_API_KEY harus diatur pada backend.');

    const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
    if (!prompt) return apiError(response, 400, 'PROMPT_REQUIRED', 'Tulis prompt gambar terlebih dahulu.');
    if (prompt.length > MAX_PROMPT_LENGTH) return apiError(response, 400, 'PROMPT_TOO_LONG', `Prompt maksimum ${MAX_PROMPT_LENGTH} karakter.`);

    let reference;
    try {
      reference = parseReference(request.body.referenceImage);
    } catch (error) {
      return apiError(response, error.status || 400, error.code || 'INVALID_IMAGE', error.message || 'Referensi gambar tidak valid.');
    }
    if (reference && !allowedImageTypes.has(reference.mimeType)) return apiError(response, 400, 'UNSUPPORTED_IMAGE', 'Gunakan gambar JPG, PNG, atau WebP.');
    if (!allowGeneration(request.ip || request.socket.remoteAddress || 'unknown')) {
      return apiError(response, 429, 'LOCAL_RATE_LIMIT', 'Batas sementara tercapai. Coba lagi dalam satu jam.');
    }
    if (activeGenerations >= MAX_CONCURRENT_GENERATIONS) {
      return apiError(response, 503, 'GENERATION_BUSY', 'Studio sedang memproses permintaan lain. Coba lagi sebentar.');
    }

    activeGenerations += 1;
    try {
      const endpoint = reference ? 'https://api.openai.com/v1/images/edits' : 'https://api.openai.com/v1/images/generations';
      let body;
      const headers = { Authorization: `Bearer ${apiKey}` };
      if (reference) {
        body = new FormData();
        body.append('model', imageModel);
        body.append('prompt', prompt);
        body.append('quality', 'medium');
        body.append('size', '1024x1536');
        body.append('output_format', 'png');
        body.append('image', new Blob([reference.bytes], { type: reference.mimeType }), reference.filename);
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ model: imageModel, prompt, quality: 'medium', size: '1024x1536', output_format: 'png' });
      }

      const upstream = await fetchImpl(endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(180_000) });
      let payload;
      try { payload = await upstream.json(); } catch { payload = null; }
      if (!upstream.ok) {
        if (upstream.status === 401 || upstream.status === 403) return apiError(response, 502, 'IMAGE_PROVIDER_AUTH_ERROR', 'Penyedia gambar menolak kredensial atau akses model backend.');
        if (upstream.status === 429) return apiError(response, 429, 'IMAGE_PROVIDER_RATE_LIMIT', 'Batas atau kuota penyedia gambar tercapai.');
        if (upstream.status >= 500) return apiError(response, 502, 'IMAGE_PROVIDER_UNAVAILABLE', 'Penyedia gambar sedang tidak tersedia. Coba lagi nanti.');
        return apiError(response, 422, 'IMAGE_PROVIDER_REQUEST_REJECTED', 'Permintaan gambar ditolak. Periksa prompt, format gambar, dan model yang diatur.');
      }
      const imageBase64 = payload?.data?.[0]?.b64_json;
      if (typeof imageBase64 !== 'string' || !imageBase64) return apiError(response, 502, 'IMAGE_PROVIDER_EMPTY_RESPONSE', 'Penyedia tidak mengembalikan gambar. Coba lagi.');
      return response.json({ imageDataUrl: `data:image/png;base64,${imageBase64}`, approved: false });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return apiError(response, 504, 'IMAGE_GENERATION_TIMEOUT', 'Proses gambar terlalu lama. Coba lagi.');
      return apiError(response, 502, 'IMAGE_PROVIDER_CONNECTION_ERROR', 'Backend tidak dapat menghubungi penyedia gambar. Coba lagi nanti.');
    } finally {
      activeGenerations -= 1;
    }
  });

  const distDirectory = path.join(projectRoot, 'dist');
  if (existsSync(path.join(distDirectory, 'index.html'))) {
    app.use(express.static(distDirectory, { index: false, maxAge: '1h' }));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next();
      response.sendFile(path.join(distDirectory, 'index.html'), (error) => { if (error) next(error); });
    });
  }

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large') return apiError(response, 413, 'REQUEST_TOO_LARGE', 'Permintaan terlalu besar. Gambar referensi maksimum 12 MB.');
    return apiError(response, 500, 'INTERNAL_SERVER_ERROR', 'Terjadi kesalahan pada server.');
  });
  return app;
}
