import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// ─── CRC32 implementation ──────────────────────────────────────
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}

function chunk(type, data) {
  const buf = Buffer.alloc(4 + data.length);
  buf.write(type, 0, 4, 'ascii');
  data.copy(buf, 4);
  const crcVal = crc32(buf);
  const res = Buffer.alloc(4 + 4 + data.length + 4);
  res.writeUInt32BE(data.length, 0);
  buf.copy(res, 4);
  res.writeUInt32BE(crcVal, 8 + data.length);
  return res;
}

function createPng(width, height, getPixel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ─── SVG Icon ───────────────────────────────────────────────────
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="yaiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4B0084" />
      <stop offset="100%" stop-color="#260046" />
    </linearGradient>
    <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFF55" />
      <stop offset="100%" stop-color="#FFFF11" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Squircle -->
  <rect width="512" height="512" rx="112" fill="url(#yaiGrad)"/>

  <!-- Subtle Inner Border -->
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#FFFF11" stroke-width="2" stroke-opacity="0.3"/>

  <!-- Central Intelligence Crest -->
  <g transform="translate(256, 230)">
    <!-- Central Star / Spark -->
    <path d="M 0,-120 L 28,-32 L 116,0 L 28,32 L 0,120 L -28,32 L -116,0 L -28,-32 Z" fill="url(#sparkGrad)" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="18" fill="#4B0084" />
    <circle cx="0" cy="0" r="8" fill="#FFFF11" />
  </g>

  <!-- Wordmark "YAI" -->
  <text x="256" y="420" font-family="'Inter', system-ui, -apple-system, sans-serif" font-size="76" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="4">
    <tspan fill="#FFFF11">YAI</tspan>
  </text>
  <text x="256" y="456" font-family="'JetBrains Mono', monospace" font-size="22" font-weight="600" fill="#DDD6E2" text-anchor="middle" letter-spacing="6">
    STUDIO
  </text>
</svg>
`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf-8');
console.log('Created public/icons/icon.svg');

// ─── Raster Icon Generation (Standard & Maskable) ───────────────
function drawYaiIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background bounds
  const cornerRadius = isMaskable ? 0 : w * 0.22;
  const inSquircle = isMaskable || (
    Math.abs(dx) <= cx && Math.abs(dy) <= cy &&
    (Math.abs(dx) <= (cx - cornerRadius) || Math.abs(dy) <= (cy - cornerRadius) ||
     Math.hypot(Math.abs(dx) - (cx - cornerRadius), Math.abs(dy) - (cy - cornerRadius)) <= cornerRadius)
  );

  if (!inSquircle) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Base background: YVS Indigo #4B0084 with subtle vertical gradient to #260046
  const t = y / h;
  let bgR = Math.round(75 * (1 - t * 0.45));
  let bgG = 0;
  let bgB = Math.round(132 * (1 - t * 0.45));

  // Safe scale for maskable icons
  const scale = isMaskable ? 0.75 : 0.9;
  const relX = dx / (cx * scale);
  const relY = (dy + (h * 0.05)) / (cy * scale);

  // Spark shape: 4-pointed diamond star
  // Star formula: (|x|^p + |y|^p <= 1) with p ≈ 0.55
  const absX = Math.abs(relX);
  const absY = Math.abs(relY);
  const starDist = Math.pow(absX, 0.55) + Math.pow(absY, 0.55);

  if (starDist <= 0.85) {
    // Yellow Spark #FFFF11
    // Central ring cutout
    const centerDist = Math.hypot(relX, relY);
    if (centerDist >= 0.12 && centerDist <= 0.24) {
      return [75, 0, 132, 255]; // Purple inner ring
    }
    return [255, 255, 17, 255];
  }

  // Outer border stroke
  if (!isMaskable && (
    (Math.abs(Math.abs(dx) - (cx - 2)) <= 2 && Math.abs(dy) < cy - cornerRadius) ||
    (Math.abs(Math.abs(dy) - (cy - 2)) <= 2 && Math.abs(dx) < cx - cornerRadius)
  )) {
    return [255, 255, 17, 80];
  }

  return [bgR, bgG, bgB, 255];
}

for (const size of [192, 512]) {
  const stdPng = createPng(size, size, (x, y, w, h) => drawYaiIcon(x, y, w, h, false));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), stdPng);
  console.log(`Created public/icons/icon-${size}.png (${stdPng.length} bytes)`);

  const maskPng = createPng(size, size, (x, y, w, h) => drawYaiIcon(x, y, w, h, true));
  fs.writeFileSync(path.join(iconsDir, `icon-maskable-${size}.png`), maskPng);
  console.log(`Created public/icons/icon-maskable-${size}.png (${maskPng.length} bytes)`);
}

// ─── Favicon (32x32 standard ICO header + PNG payload) ─────────
const favPng = createPng(32, 32, (x, y, w, h) => drawYaiIcon(x, y, w, h, false));
const icoHeader = Buffer.alloc(6 + 16);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type: 1 = ICO
icoHeader.writeUInt16LE(1, 4); // Count: 1 image

icoHeader.writeUInt8(32, 6);  // Width
icoHeader.writeUInt8(32, 7);  // Height
icoHeader.writeUInt8(0, 8);   // Color palette
icoHeader.writeUInt8(0, 9);   // Reserved
icoHeader.writeUInt16LE(1, 10); // Color planes
icoHeader.writeUInt16LE(32, 12); // Bits per pixel
icoHeader.writeUInt32LE(favPng.length, 14); // Image size
icoHeader.writeUInt32LE(22, 18); // Offset to image data

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), Buffer.concat([icoHeader, favPng]));
console.log('Created public/favicon.ico');

// ─── Standalone Offline Fallback HTML (public/offline.html) ─────
const offlineHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offline — YAI Studio</title>
  <style>
    :root {
      --bg: #09060D;
      --fg: #F4F1F6;
      --muted: #A39BA8;
      --primary: #4B0084;
      --accent: #FFFF11;
      --card: #150F1D;
      --border: #2D2336;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #FFFFFF;
        --fg: #17121C;
        --muted: #655C6B;
        --primary: #4B0084;
        --accent: #FFFF11;
        --card: #F9F7FA;
        --border: #DDD6E2;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--fg);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 36px 32px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: var(--primary);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: 1px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--fg);
    }
    p {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    button, a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .primary-btn {
      background: var(--primary);
      color: #FFFFFF;
      border: none;
    }
    .secondary-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
    }
    button:hover, a:hover { opacity: 0.88; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">YAI</div>
    <h1>You are currently offline</h1>
    <p>
      YAI Studio is operating in local mode. Cached workspace data and on-device capabilities remain available, but synchronization with GitHub and cloud APIs will resume once your connection is restored.
    </p>
    <div class="actions">
      <button class="primary-btn" onclick="window.location.reload()">Retry Connection</button>
      <a href="/" class="secondary-btn">Return to Workspace</a>
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(publicDir, 'offline.html'), offlineHtml, 'utf-8');
console.log('Created public/offline.html');
