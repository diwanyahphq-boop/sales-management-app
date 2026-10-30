/* المثلث · نظام إدارة العدد اليدوية — الأساسيات: أدوات، تشفير، ترخيص، تخزين، باركود، أيقونات */
'use strict';

const APP = {
  code: 'TLS',
  name: 'نظام إدارة العدد اليدوية',
  short: 'المثلث للعدد اليدوية',
  version: '1.0.0',
  trialDays: 10,
  trialLimit: 50 // عدد الأصناف المسموح في النسخة التجريبية
};

/* ===== أدوات عامة ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v ?? '').replace(/[,،\s]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return isFinite(n) ? n : 0; };
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fmt = n => NF.format(round2(+n || 0));
const pad = (n, l = 2) => String(n).padStart(l, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dstr(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const fdate = s => { if (!s) return '—'; const d = new Date(String(s).slice(0, 10) + 'T12:00:00'); return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const ftime = ts => { const d = new Date(ts); return `${fdate(dstr(d))} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/* ===== SHA-256 (لكلمات المرور) ===== */
const sha256 = (() => {
  const K = [], H = [];
  const isP = x => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; };
  const frac = x => ((x - Math.floor(x)) * 4294967296) >>> 0;
  for (let n = 2, c = 0; c < 64; n++) if (isP(n)) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c] = frac(Math.pow(n, 1 / 3)); c++; }
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  return str => {
    const b = new TextEncoder().encode(str), l = b.length;
    const p = new Uint8Array(((l + 9 + 63) >> 6) << 6); p.set(b); p[l] = 0x80;
    const dv = new DataView(p.buffer);
    dv.setUint32(p.length - 4, (l * 8) >>> 0); dv.setUint32(p.length - 8, Math.floor(l * 8 / 4294967296));
    let h = H.slice(); const w = new Array(64);
    for (let i = 0; i < p.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, hh] = h;
      for (let t = 0; t < 64; t++) {
        const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h = [a, bb, c, d, e, f, g, hh].map((v, j) => (h[j] + v) | 0);
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();
const hashPass = (pass, salt) => sha256(salt + '|' + pass + '|mth-tls');

/* ===== الترخيص (خوارزمية المثلث الموحدة) ===== */
const LIC_SECRET = 'MTH-7f3a91c2-2026-ASL-K9x';
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
function serialFor(code, machine) {
  const m = String(machine).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const h = cyrb128(LIC_SECRET + '|' + String(code).toUpperCase() + '|' + m);
  return h.map(x => x.toString(16).padStart(8, '0')).join('').toUpperCase().slice(0, 20).match(/.{4}/g).join('-');
}
const normSerial = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const License = {
  KEY: 'mth-lic-v1',
  data: null,
  load() {
    let d = lsGet(this.KEY);
    if (!d || !d.machine) {
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint32Array(12);
      (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => r[i] = Math.random() * 1e9);
      const m = [...r].map(x => A[x % A.length]).join('').match(/.{4}/g).join('-');
      const now = Date.now();
      d = { machine: m, trialStart: now, lastSeen: now, serials: {} };
    }
    d.serials = d.serials || {};
    // لكل برنامج بداية تجربة مستقلة على نفس الحاسبة (رقم الحاسبة مشترك بين برامج المثلث)
    d.trials = d.trials || {};
    if (!d.trials[APP.code]) d.trials[APP.code] = (APP.code === 'BLD' && d.trialStart) || Date.now();
    d.lastSeen = Math.max(Date.now(), d.lastSeen || 0); // إرجاع الساعة لا يمدد التجربة
    this.data = d; lsSet(this.KEY, d);
    return this;
  },
  get activated() { const s = this.data.serials[APP.code]; return !!s && normSerial(s) === normSerial(serialFor(APP.code, this.data.machine)); },
  get daysLeft() { const now = Math.max(Date.now(), this.data.lastSeen || 0); return Math.max(0, Math.ceil(APP.trialDays - (now - this.data.trials[APP.code]) / 86400000)); },
  get expired() { return !this.activated && this.daysLeft <= 0; },
  activate(serial) {
    if (normSerial(serial) !== normSerial(serialFor(APP.code, this.data.machine))) return false;
    this.data.serials[APP.code] = serialFor(APP.code, this.data.machine); lsSet(this.KEY, this.data); return true;
  }
};

/* ===== المستندات الممسوحة (IndexedDB) ===== */
const DocStore = {
  db: null, mem: new Map(),
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('mth-tls-docs', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('docs');
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => res();
      } catch { res(); }
    });
  },
  tx(mode, fn) {
    return new Promise((res, rej) => {
      if (!this.db) return res(fn(null));
      try { const t = this.db.transaction('docs', mode), s = t.objectStore('docs'); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }
      catch (e) { rej(e); }
    });
  },
  put(k, v) { if (!this.db) { this.mem.set(k, v); return Promise.resolve(); } return this.tx('readwrite', s => s.put(v, k)); },
  get(k) { if (!this.db) return Promise.resolve(this.mem.get(k)); return this.tx('readonly', s => s.get(k)); },
  del(k) { if (!this.db) { this.mem.delete(k); return Promise.resolve(); } return this.tx('readwrite', s => s.delete(k)); }
};

/* ===== باركود Code 128-B ===== */
const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112').split(' ');
function barcodeSVG(text, { h = 48, showText = true, color = '#111' } = {}) {
  const s = String(text || '').replace(/[^\x20-\x7e]/g, '');
  if (!s) return '';
  const codes = [104]; let sum = 104;
  [...s].forEach((ch, i) => { const v = ch.charCodeAt(0) - 32; codes.push(v); sum += v * (i + 1); });
  codes.push(sum % 103, 106);
  let x = 10, bars = '';
  codes.forEach(c => { [...C128[c]].forEach((w, i) => { w = +w; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w; }); });
  const W = x + 10, th = showText ? 14 : 0;
  return `<svg viewBox="0 0 ${W} ${h + th}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(s)}"><rect width="${W}" height="${h + th}" fill="#fff"/><g fill="${color}">${bars}</g>${showText ? `<text x="${W / 2}" y="${h + 12}" text-anchor="middle" font-family="monospace" font-size="11" fill="${color}">${esc(s)}</text>` : ''}</svg>`;
}

/* ===== الأيقونات ===== */
const ICO = (() => {
  const p = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    pos: '<path d="M4 7h16l-1.5 9.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
    inv: '<path d="M6 2h9l4 4v15l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3a1 1 0 0 1 1-1z"/><path d="M9 9h6M9 13h6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    truck: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    helmet: '<path d="M3 18h18M5 18v-3a7 7 0 0 1 14 0v3"/><path d="M10 8V5h4v3"/>',
    factory: '<path d="M2 21V10l6 4V10l6 4V4h4l2 17z"/><path d="M6 17h2M11 17h2"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>',
    msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M11 11v7M15 7v11M19 12v6"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
    log: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    print: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    wa: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c.4 2.2 2.3 4.2 4.5 4.6l1.2-1.2 2 .9-.4 1.6c-3.6.6-8-3.8-7.4-7.4l1.6-.4.9 2z"/>',
    sms: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    rotate: '<path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    swap: '<path d="M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2"/><path d="M22 10h-6a2 2 0 0 0 0 4h6z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'
  };
  const f = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[n] || p.info}</svg>`;
  return f;
})();
const LOGO = `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 44 41H4z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M24 20 33.5 36h-19z" fill="currentColor" opacity=".45"/></svg>`;
const brandHTML = (sub = APP.name) => `<div class="brand">${LOGO}<div><div class="brand-name">المثلث</div><div class="brand-sub">${esc(sub)}</div></div></div>`;
const footHTML = () => `<div class="foot"><b>المثلث · ${APP.name}</b><br>حقوق البرمجة © أصيل الصافي</div>`;
