#!/usr/bin/env node
/**
 * YAI Studio — Lightweight Local Companion Agent
 *
 * Runs locally on the user's machine to bridge browser requests from
 * https://yaistudio.yetvast.com to local Ollama on 127.0.0.1:11434.
 *
 * Provides:
 * - Proper CORS headers (Access-Control-Allow-Origin: *)
 * - Private Network Access (PNA) header support (Access-Control-Allow-Private-Network: true)
 * - Transparent proxying of Ollama endpoints (/api/version, /api/tags, /api/ps, /api/generate)
 * - Host memory telemetry (os.totalmem, os.freemem, os.cpus)
 *
 * Usage:
 *   node scripts/yai-local-agent.mjs [port] [ollama_url]
 * Default port: 11435
 * Default Ollama URL: http://127.0.0.1:11434
 */

import http from 'node:http';
import os from 'node:os';

const PORT = parseInt(process.env.YAI_AGENT_PORT || process.argv[2] || '11435', 10);
const OLLAMA_URL = (process.env.OLLAMA_HOST || process.argv[3] || 'http://127.0.0.1:11434').replace(/\/+$/, '');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health and System Telemetry
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    let ollamaStatus = 'unknown';
    let ollamaVersion = 'unknown';

    try {
      const probeRes = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2000) });
      if (probeRes.ok) {
        const data = await probeRes.json();
        ollamaStatus = 'connected';
        ollamaVersion = data.version || 'connected';
      } else {
        ollamaStatus = `error_http_${probeRes.status}`;
      }
    } catch (err) {
      ollamaStatus = 'disconnected';
    }

    const payload = {
      agent: 'YAI Local Companion Agent',
      version: '0.1.0',
      status: 'active',
      ollama: {
        url: OLLAMA_URL,
        status: ollamaStatus,
        version: ollamaVersion,
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
        freeMemoryBytes: os.freemem(),
        uptimeSec: os.uptime(),
      },
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  // Proxy Ollama routes: /api/version, /api/tags, /api/ps, /api/generate, /api/chat
  if (url.pathname.startsWith('/api/')) {
    const targetUrl = `${OLLAMA_URL}${url.pathname}${url.search}`;

    try {
      const fetchOptions = {
        method: req.method,
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'Accept': 'application/json',
        },
      };

      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        fetchOptions.body = Buffer.concat(chunks);
      }

      const ollamaRes = await fetch(targetUrl, fetchOptions);
      res.writeHead(ollamaRes.status, {
        'Content-Type': ollamaRes.headers.get('content-type') || 'application/json',
      });

      if (ollamaRes.body) {
        for await (const chunk of ollamaRes.body) {
          res.write(chunk);
        }
      }
      res.end();
      return;
    } catch (proxyErr) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Local Agent failed to proxy request to Ollama: ${proxyErr.message}`,
        ollamaUrl: OLLAMA_URL,
      }));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not found: ${url.pathname}` }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[YAI Local Agent] Running at http://127.0.0.1:${PORT}`);
  console.log(`[YAI Local Agent] Connected to Ollama target: ${OLLAMA_URL}`);
  console.log(`[YAI Local Agent] Ready to accept local connections from https://yaistudio.yetvast.com`);
});
