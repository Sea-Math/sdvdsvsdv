'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const REFERER = 'https://vidlink.pro/';
const ORIGIN = 'https://vidlink.pro';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124';
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

let bootPromise = null;

function assetPath(fileName) {
  const candidates = [
    path.join(__dirname, fileName),
    path.join(__dirname, '..', '..', 'api', fileName),
    path.join(process.cwd(), 'api', fileName),
  ];

  const match = candidates.find(candidate => fs.existsSync(candidate));
  if (!match) throw new Error(`Missing bundled asset: ${fileName}`);
  return match;
}

function bootWasm() {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    globalThis.document = { createElement: () => ({}), body: { appendChild: () => {} } };

    const sodium = require('libsodium-wrappers');
    await sodium.ready;
    globalThis.sodium = sodium;

    eval(fs.readFileSync(assetPath('script.js'), 'utf8'));

    const go = new Dm();
    const wasmBuf = fs.readFileSync(assetPath('stream-token.wasm'));
    const { instance } = await WebAssembly.instantiate(wasmBuf, go.importObject);
    go.run(instance);

    await new Promise(resolve => setTimeout(resolve, 500));
    if (typeof globalThis.getAdv !== 'function') throw new Error('getAdv not found after WASM boot');
  })();

  return bootPromise;
}

async function getStream(id, season, episode) {
  await bootWasm();
  const token = globalThis.getAdv(String(id));
  if (!token) throw new Error('getAdv returned null');

  const apiUrl = season
    ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode || 1}?multiLang=0`
    : `https://vidlink.pro/api/b/movie/${token}?multiLang=0`;

  const response = await fetch(apiUrl, {
    headers: { Referer: REFERER, Origin: ORIGIN, 'User-Agent': UA },
  });

  if (!response.ok) throw new Error(`vidlink API returned ${response.status}`);
  const data = await response.json();
  const playlist = data?.stream?.playlist;
  if (!playlist) throw new Error('No playlist in response');
  return playlist;
}

function fetchUpstream(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));

    (url.startsWith('https') ? https : http).get(url, {
      headers: { Referer: REFERER, Origin: ORIGIN, 'User-Agent': UA, Accept: '*/*' },
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const location = response.headers.location;
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;
        return resolve(fetchUpstream(nextUrl, redirects + 1));
      }

      resolve(response);
    }).on('error', reject);
  });
}

function rewriteM3u8(body, url) {
  const base = url.split('?')[0];
  const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
  const origin = new URL(url).origin;

  return body.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const absoluteUrl = trimmed.startsWith('http')
      ? trimmed
      : trimmed.startsWith('/')
        ? origin + trimmed
        : baseDir + trimmed;

    return '/api?url=' + encodeURIComponent(absoluteUrl);
  }).join('\n');
}

function response(statusCode, body, headers = {}, isBase64Encoded = false) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...headers },
    body,
    isBase64Encoded,
  };
}

async function proxyUrl(url) {
  const upstream = await fetchUpstream(url);
  const contentType = (upstream.headers['content-type'] || '').toLowerCase();
  const isM3u8 = contentType.includes('mpegurl') || contentType.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url.split('?')[0]);

  const chunks = [];
  for await (const chunk of upstream) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  if (isM3u8) {
    return response(upstream.statusCode || 200, rewriteM3u8(body.toString('utf8'), url), {
      'Content-Type': 'application/vnd.apple.mpegurl',
    });
  }

  const headers = { 'Content-Type': contentType || 'application/octet-stream' };
  if (upstream.headers['content-length']) headers['Content-Length'] = upstream.headers['content-length'];
  return response(upstream.statusCode || 200, body.toString('base64'), headers, true);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return response(204, '');

  const query = event.queryStringParameters || {};

  if (query.url) {
    try {
      return await proxyUrl(decodeURIComponent(query.url));
    } catch (error) {
      return response(502, error.message, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  }

  if (!query.id) {
    return response(400, JSON.stringify({ error: 'missing id' }), {
      'Content-Type': 'application/json',
    });
  }

  try {
    const url = await getStream(query.id, query.s, query.e);
    return response(200, JSON.stringify({ url }), { 'Content-Type': 'application/json' });
  } catch (error) {
    return response(500, JSON.stringify({ error: error.message }), {
      'Content-Type': 'application/json',
    });
  }
};
