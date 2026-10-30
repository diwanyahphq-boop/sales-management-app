/* المثلث · نظام إدارة المواد الإنشائية — الواجهة العامة: الجلسة، النوافذ، الهيكل، الماسح، لوحة الأوامر */
'use strict';

/* ===== الجلسة والصلاحيات ===== */
const Session = {
  KEY: 'mth-bld-session', user: null,
  restore() { try { const id = sessionStorage.getItem(this.KEY); const u = id && userById(id); if (u && u.active !== false) this.user = u; } catch { } },
  login(u) { this.user = u; try { sessionStorage.setItem(this.KEY, u.id); } catch { } u.lastLogin = Date.now(); logAct('تسجيل دخول'); saveDb(); },
  logout() { logAct('تسجيل خروج'); saveDb(); this.user = null; try { sessionStorage.removeItem(this.KEY); } catch { } }
};
const can = p => !!Session.user && (Session.user.role === 'admin' || (Session.user.perms || []).includes(p));
const userName = id => { const u = id && userById(id); return u ? u.name : '—'; };

/* ===== التنبيهات المنبثقة ===== */
function toast(msg, type = 'ok', ms = 3400) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
  const t = document.createElement('div'); t.className = 'toast ' + type;
  t.innerHTML = ICO(type === 'ok' ? 'check' : type === 'err' ? 'x' : type === 'warn' ? 'warn' : 'info') + `<span>${esc(msg)}</span>`;
  box.append(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, ms);
}

/* ===== النوافذ ===== */
function modal({ title, body = '', foot = '', size = '', onClose = null }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button class="x" data-x aria-label="إغلاق">${ICO('x')}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  const m = { el: bg, onClose, closed: false, close() { if (this.closed) return; this.closed = true; bg.remove(); document.removeEventListener('keydown', key); this.onClose && this.onClose(); } };
  const key = e => { if (e.key === 'Escape' && $$('.modal-bg').pop() === bg) m.close(); };
  bg.addEventListener('mousedown', e => { if (e.target === bg) m.close(); });
  bg.querySelector('[data-x]').onclick = () => m.close();
  document.addEventListener('keydown', key);
  document.body.append(bg);
  setTimeout(() => { const f = bg.querySelector('[autofocus],.modal-b input:not([type=checkbox]):not([readonly]),.modal-b select,.modal-b textarea'); f && f.focus(); }, 30);
  return m;
}
function confirmBox(text, { ok = 'تأكيد', danger = false, title = 'تأكيد' } = {}) {
  return new Promise(res => {
    let done = false;
    const m = modal({
      title, size: 'narrow', body: `<p style="margin:0;line-height:1.8">${text}</p>`,
      foot: `<button class="btn ${danger ? 'dan' : 'pri'}" data-ok>${ok}</button><button class="btn ghost" data-no>تراجع</button>`,
      onClose: () => { if (!done) res(false); }
    });
    m.el.querySelector('[data-ok]').onclick = () => { done = true; m.close(); res(true); };
    m.el.querySelector('[data-no]').onclick = () => m.close();
    setTimeout(() => m.el.querySelector('[data-ok]').focus(), 40);
  });
}
const formVals = root => { const o = {}; $$('[name]', root).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; };
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('تم النسخ'); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = 0; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { } ta.remove();
    toast(ok ? 'تم النسخ' : 'تعذّر النسخ التلقائي، انسخ النص يدوياً', ok ? 'ok' : 'warn'); return ok;
  }
}
function downloadFile(name, content, mime = 'application/json') {
  try {
    const a = document.createElement('a'); a.href = typeof content === 'string' && content.startsWith('data:') ? content : URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name; document.body.append(a); a.click(); setTimeout(() => { a.remove(); }, 500);
  } catch { toast('تعذّر التنزيل في هذه البيئة، استخدم النسخ بدلاً منه', 'warn'); }
}
function printHTML(html) {
  const r = $('#print-root'); r.innerHTML = `<div class="pr">${html}</div>`;
  setTimeout(() => { try { window.print(); } catch { toast('الطباعة غير متاحة هنا', 'warn'); } }, 60);
}
function beep(f = 1250) {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.12, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .12); o.start(); o.stop(a.currentTime + .13); } catch { }
}
const openLink = url => {
  const w = window.open(url, '_blank');
  if (w) { try { w.opener = null; } catch { } }
  else toast('المتصفح منع فتح النافذة، اسمح بالنوافذ المنبثقة لهذه الصفحة', 'warn', 5000);
};

/* ===== السمة ===== */
const Theme = {
  KEY: 'mth-bld-theme',
  apply() { const t = lsGet(this.KEY, 'auto'); if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); },
  isDark() { const a = document.documentElement.getAttribute('data-theme'); return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; },
  toggle() { lsSet(this.KEY, this.isDark() ? 'light' : 'dark'); this.apply(); Shell.top(); },
  set(t) { lsSet(this.KEY, t); this.apply(); }
};

/* ===== الماسح الضوئي للباركود (لوحة المفاتيح + الكاميرا) ===== */
const Scanner = {
  buf: '', last: 0, first: 0,
  init() {
    document.addEventListener('keydown', e => {
      const t = e.target;
      if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (e.key === 'Enter') {
        const code = this.buf.trim(), fast = (now - this.first) / Math.max(1, code.length) < 45;
        this.buf = '';
        if (code.length >= 3 && fast) { e.preventDefault(); this.hit(code); }
        return;
      }
      if (e.key.length === 1) {
        if (now - this.last > 90) { this.buf = ''; this.first = now; }
        this.buf += e.key; this.last = now;
      }
    }, true);
  },
  hit(code) {
    const pill = $('.scan-pill'); if (pill) { pill.classList.add('hit'); setTimeout(() => pill.classList.remove('hit'), 700); }
    beep(); onScanCode(code);
  },
  hook: null, // معالج مؤقت لنافذة مفتوحة (مثل فاتورة الشراء)
  async camera(cb, { continuous = false, title = 'المسح بالكاميرا' } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('الكاميرا غير متاحة هنا. افتح البرنامج عبر https أو من الملف مباشرة، أو استخدم جهاز الماسح.', 'warn', 5000); return; }
    const m = modal({
      title, size: 'narrow',
      body: `<div class="cam"><video playsinline muted></video><div class="aim"></div></div><div class="cam-last" id="cam-last">${continuous ? 'امسح المواد واحدة تلو الأخرى، وتُضاف تلقائياً…' : 'وجّه الكاميرا نحو الباركود وسيُقرأ تلقائياً.'}</div>`,
      foot: continuous ? `<button class="btn pri" data-done>${ICO('check')} إنهاء المسح</button>` : ''
    });
    const v = $('video', m.el); let alive = true, stop = () => { }, last = '', lastAt = 0, n = 0;
    m.onClose = () => { alive = false; stop(); };
    const d = $('[data-done]', m.el); if (d) d.onclick = () => m.close();
    const got = code => {
      const now = Date.now(); if (!alive || (code === last && now - lastAt < 1800)) return;
      last = code; lastAt = now; beep();
      if (!continuous) { m.close(); cb(code); return; }
      n++; cb(code); const l = $('#cam-last', m.el); if (l) l.innerHTML = `قراءة رقم ${n}: <b class="mono">${esc(code)}</b>`;
    };
    if ('BarcodeDetector' in window) {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
      catch { m.close(); toast('تعذّر فتح الكاميرا، تحقق من الإذن', 'err'); return; }
      stop = () => stream.getTracks().forEach(t => t.stop());
      v.srcObject = stream; await v.play().catch(() => { });
      let fm = []; try { fm = await BarcodeDetector.getSupportedFormats(); } catch { }
      const det = new BarcodeDetector(fm.length ? { formats: fm } : undefined);
      const loop = async () => { if (!alive) return; try { const r = await det.detect(v); if (r.length) got(r[0].rawValue); } catch { } if (alive) setTimeout(loop, 150); };
      loop(); return;
    }
    // المتصفحات التي لا تدعم BarcodeDetector (مثل كروم على ويندوز): قارئ ZXing المضمّن مع البرنامج
    try { await loadZXing(); } catch { m.close(); toast('تعذّر تحميل قارئ الباركود', 'err'); return; }
    const reader = new ZXing.BrowserMultiFormatReader();
    stop = () => { try { reader.reset(); } catch { } };
    try { await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, v, res => { if (res) got(res.getText()); }); }
    catch { m.close(); toast('تعذّر فتح الكاميرا، تحقق من الإذن', 'err'); }
  }
};
let zxP = null;
const loadZXing = () => zxP || (zxP = new Promise((res, rej) => {
  if (window.ZXing) return res();
  const s = document.createElement('script'); s.src = 'js/vendor/zxing.min.js';
  s.onload = res; s.onerror = () => { zxP = null; rej(); }; document.head.append(s);
}));
function onScanCode(code) {
  code = String(code).trim();
  if (!code) return;
  if (Scanner.hook) return Scanner.hook(code);
  if ($('.modal-bg')) return;
  if (Shell.route === 'scanner' && can('scanner')) return Station.handle(code);
  const inv = /^(INV|QUO)-(\d+)$/i.exec(code);
  if (inv) {
    const kind = inv[1].toUpperCase() === 'INV' ? 'sale' : 'quote';
    const d = db.invoices.find(i => i.kind === kind && i.no === +inv[2]);
    if (d && can('invoices')) return viewInvoice(d.id);
  }
  const m = db.materials.find(x => x.barcode === code);
  if (Shell.route === 'pos' && can('pos')) {
    if (m) { posAdd(m.id); return; }
    toast(`لا توجد مادة بالباركود ${code}`, 'warn'); return;
  }
  if (m && Shell.route === 'materials') { MatF.q = code; Shell.refresh(); return quickMaterial(m); }
  if (m) return quickMaterial(m);
  if (can('scanner')) {
    confirmBox(`الباركود <b class="mono">${esc(code)}</b> غير مسجل. هل تريد تسجيله كمادة جديدة من محطة الماسح؟`, { ok: 'تسجيل المادة' }).then(y => { if (y) { Shell.go('scanner'); Station.handle(code); } });
  } else if (can('materials')) {
    confirmBox(`الباركود <b class="mono">${esc(code)}</b> غير مسجل. هل تريد إضافة مادة جديدة به؟`, { ok: 'إضافة مادة' }).then(y => y && editMaterial(null, { barcode: code }));
  } else toast(`الباركود ${code} غير مسجل`, 'warn');
}
function quickMaterial(m) {
  const st = stockState(m);
  const md = modal({
    title: esc(m.name), size: 'narrow',
    body: `<div style="text-align:center;margin-bottom:14px">${barcodeSVG(m.barcode, { h: 50 })}</div>
      <div class="grid g2" style="gap:10px">
        <div class="card kpi"><div class="k-top">سعر المفرد</div><div class="k-val">${money(m.price)}</div></div>
        <div class="card kpi"><div class="k-top">المخزون</div><div class="k-val ${st === 'low' || st === 'out' ? 'danger-t' : ''}">${fmt(m.stock)} <small>${esc(m.unit)}</small></div></div>
      </div><p class="muted" style="margin:12px 0 0">${esc(m.cat)} · ${esc(m.loc || 'بدون موقع')}</p>`,
    foot: `${can('pos') ? `<button class="btn pri" data-sell>${ICO('pos')} إضافة إلى البيع</button>` : ''}${can('materials') ? `<button class="btn" data-edit>${ICO('edit')} تعديل</button>` : ''}`
  });
  const s = $('[data-sell]', md.el); if (s) s.onclick = () => { md.close(); Shell.go('pos'); posAdd(m.id); };
  const e = $('[data-edit]', md.el); if (e) e.onclick = () => { md.close(); editMaterial(m.id); };
}

/* ===== الهيكل العام ===== */
const NAV = [
  ['', [['dash', 'لوحة القيادة', 'dash']]],
  ['المبيعات', [['pos', 'نقطة البيع', 'pos'], ['invoices', 'الفواتير والعروض', 'inv'], ['deliveries', 'التوصيل للمواقع', 'truck']]],
  ['المخزن', [['scanner', 'محطة الماسح', 'scan'], ['materials', 'المواد والمخزن', 'box'], ['purchases', 'المشتريات', 'cart']]],
  ['الحسابات', [['customers', 'الزبائن والمقاولون', 'helmet'], ['suppliers', 'الموردون', 'factory'], ['dues', 'القوائم المستحقة', 'alarm'], ['payments', 'سندات القبض والصرف', 'receipt'], ['cashbox', 'الصندوق والمصروفات', 'wallet']]],
  ['التواصل والأرشيف', [['chat', 'المحادثات', 'msg'], ['messages', 'رسائل الزبائن', 'wa'], ['docs', 'أرشيف المستندات', 'doc']]],
  ['الإدارة', [['reports', 'التقارير', 'chart'], ['users', 'المستخدمون والصلاحيات', 'shield'], ['log', 'سجل العمليات', 'log'], ['settings', 'الإعدادات', 'gear']]]
];
const ROUTE_TITLE = Object.fromEntries(NAV.flatMap(g => g[1]).map(r => [r[0], r[1]]));
const ROUTE_ICON = Object.fromEntries(NAV.flatMap(g => g[1]).map(r => [r[0], r[2]]));

const Shell = {
  route: 'dash', params: {},
  mount() {
    $('#app').innerHTML = `<div class="shell">
      <aside class="rail" aria-label="القائمة الرئيسية">${brandHTML()}<nav class="nav" id="nav"></nav><div class="rail-user" id="rail-user"></div></aside>
      <div class="main"><header class="topbar" id="topbar"></header><div id="trial"></div><main class="content" id="view"></main>${footHTML()}</div>
    </div>`;
    this.nav(); this.top(); this.trial();
  },
  counts() {
    const d = dueRows(); const over = d.filter(r => r.bucket === 'over').length;
    const low = db.materials.filter(m => ['low', 'out'].includes(stockState(m))).length;
    const ship = db.invoices.filter(i => i.kind === 'sale' && !i.void && i.ship && i.ship.state !== 'done').length;
    const chat = Session.user ? db.notices.filter(n => (n.to === 'all' || n.to === Session.user.id) && !n.readBy.includes(Session.user.id)).length : 0;
    return { dues: over, materials: low, deliveries: ship, chat };
  },
  nav() {
    const c = this.counts();
    $('#nav').innerHTML = NAV.map(([g, items]) => {
      const vis = items.filter(r => can(r[0])); if (!vis.length) return '';
      return `<div class="nav-group">${g ? `<div class="nav-label">${g}</div>` : ''}${vis.map(([r, t, i]) =>
        `<a data-go="${r}" class="${this.route === r ? 'on' : ''}">${ICO(i)}<span>${t}</span>${c[r] ? `<span class="count ${r === 'deliveries' ? 'alt' : ''}">${c[r]}</span>` : ''}</a>`).join('')}</div>`;
    }).join('');
    const u = Session.user;
    $('#rail-user').innerHTML = `<div class="avatar">${esc((u.name || '?').trim()[0])}</div><div class="who"><b>${esc(u.name)}</b><span>${esc(ROLES[u.role] ? ROLES[u.role].name : 'مخصص')} · ${esc(u.username)}</span></div>
      <button data-act="changePass" title="تغيير كلمة المرور">${ICO('key')}</button><button data-act="logout" title="تسجيل الخروج">${ICO('out')}</button>`;
  },
  top() {
    const v = Views[this.route] || {};
    const unread = this.counts().chat + this.counts().dues;
    $('#topbar').innerHTML = `
      <button class="icon-btn menu-btn" data-act="menu" aria-label="القائمة">${ICO('menu')}</button>
      <div class="page-title"><h1>${esc(ROUTE_TITLE[this.route] || '')}</h1><div class="dim"><i></i><span>${v.dim ? v.dim() : esc(db.settings.company)}</span><i></i></div></div>
      <div class="top-actions">
        <button class="cmd-btn" data-act="cmdk">${ICO('search')}<span>ابحث أو نفّذ أمراً…</span><kbd>Ctrl K</kbd></button>
        <div class="scan-pill" title="جهاز قراءة الباركود جاهز: امسح في أي وقت"><span class="led"></span>الماسح جاهز</div>
        <button class="icon-btn" data-act="camScan" title="مسح بالكاميرا">${ICO('camera')}</button>
        <button class="icon-btn" data-act="theme" title="تبديل الوضع">${ICO(Theme.isDark() ? 'sun' : 'moon')}</button>
        <button class="icon-btn" data-act="notices" title="التنبيهات">${ICO('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button>
      </div>`;
  },
  trial() {
    const el = $('#trial'); if (!el) return;
    if (License.activated) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="trial"><div class="t-ico">${ICO('lock')}</div><div class="t-days">${License.daysLeft}</div>
      <div class="t-txt"><b>نسخة تجريبية</b> — متبقٍ ${License.daysLeft} يوماً من ${APP.trialDays}. الحد الأقصى ${APP.trialLimit} مادة (المسجل ${db.materials.length}).</div>
      <button class="btn brass sm" data-act="activate">${ICO('key')} تفعيل البرنامج</button></div>`;
  },
  go(route, params = {}) {
    if (!can(route)) { const first = NAV.flatMap(g => g[1]).find(r => can(r[0])); route = first ? first[0] : 'dash'; }
    this.route = route; this.params = params;
    $('.shell') && $('.shell').classList.remove('nav-open');
    this.refresh(); window.scrollTo({ top: 0 });
  },
  refresh() {
    const v = Views[this.route];
    this.nav(); this.top(); this.trial();
    $('#view').innerHTML = v ? v.render() : '';
    v && v.after && v.after();
    document.title = `المثلث · ${ROUTE_TITLE[this.route] || 'المواد الإنشائية'}`;
  }
};
const rerender = () => { saveDb(); Shell.refresh(); };

/* ===== التنبيهات الداخلية ===== */
const myNotices = () => db.notices.filter(n => n.to === 'all' || n.to === Session.user.id).sort((a, b) => b.at - a.at);
function openNotices() {
  const c = Shell.counts(), list = myNotices();
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.style.background = 'rgba(8,16,14,.3)';
  const sys = [
    c.dues ? `<div class="notice"><div class="nh">${ICO('alarm')} تنبيه النظام</div><p>${c.dues} زبون لديهم مبالغ متأخرة السداد. <a href="#" data-go="dues">عرض القوائم المستحقة</a></p></div>` : '',
    c.materials ? `<div class="notice"><div class="nh">${ICO('box')} تنبيه النظام</div><p>${c.materials} مادة وصلت إلى حد إعادة الطلب أو نفدت. <a href="#" data-go="materials" data-low="1">عرض المواد</a></p></div>` : ''
  ].join('');
  bg.innerHTML = `<div class="drawer"><div class="modal-h"><h3>التنبيهات والرسائل الداخلية</h3>${can('chat') ? `<button class="btn sm" data-new>${ICO('msg')} فتح المحادثات</button>` : ''}<button class="x" data-x>${ICO('x')}</button></div>
    <div style="overflow-y:auto;flex:1">${sys}${list.map(n => `<div class="notice ${n.readBy.includes(Session.user.id) ? '' : 'unread'}"><div class="nh"><b>${esc(userName(n.from))}</b><span>·</span><span>${ftime(n.at)}</span><span>·</span><span>${n.to === 'all' ? 'للجميع' : 'لك'}</span></div><p>${esc(n.text)}</p></div>`).join('') || (!sys ? `<div class="empty">${ICO('bell')}<b>لا توجد تنبيهات</b></div>` : '')}</div></div>`;
  const close = () => { bg.remove(); list.forEach(n => { if (!n.readBy.includes(Session.user.id)) n.readBy.push(Session.user.id); }); saveDb(); Shell.top(); };
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  bg.querySelector('[data-x]').onclick = close;
  bg.addEventListener('click', e => { if (e.target.closest('[data-go]')) { e.preventDefault(); close(); } });
  const nb = bg.querySelector('[data-new]'); if (nb) nb.onclick = () => { close(); Shell.go('chat'); };
  document.body.append(bg);
}
/* ===== لوحة الأوامر ===== */
function openCmdk() {
  if ($('.cmdk')) return;
  const bg = document.createElement('div'); bg.className = 'cmdk';
  bg.innerHTML = `<div class="cmdk-box"><input class="inp" placeholder="ابحث عن صفحة، مادة، زبون، رقم فاتورة…" autofocus><div class="cmdk-list"></div></div>`;
  document.body.append(bg);
  const inp = $('input', bg), list = $('.cmdk-list', bg); let items = [], sel = 0;
  const actions = [
    can('pos') && { s: 'أوامر', t: 'فاتورة بيع جديدة', i: 'pos', k: 'F2', run: () => Shell.go('pos') },
    can('materials') && { s: 'أوامر', t: 'إضافة مادة جديدة', i: 'plus', run: () => editMaterial(null) },
    can('customers') && { s: 'أوامر', t: 'إضافة زبون جديد', i: 'helmet', run: () => editCustomer(null) },
    can('payments') && { s: 'أوامر', t: 'سند قبض من زبون', i: 'cash', run: () => paymentModal('in') },
    can('purchases') && { s: 'أوامر', t: 'فاتورة شراء جديدة', i: 'cart', run: () => purchaseModal() },
    can('scanner') && { s: 'أوامر', t: 'محطة الماسح: استعلام، إدخال مواد، جرد', i: 'scan', run: () => Shell.go('scanner') },
    can('chat') && { s: 'أوامر', t: 'المحادثات الداخلية', i: 'msg', run: () => Shell.go('chat') },
    can('cashbox') && { s: 'أوامر', t: 'تسجيل مصروف', i: 'wallet', run: () => expenseModal() },
    can('docs') && { s: 'أوامر', t: 'أرشفة مستند ممسوح', i: 'doc', run: () => { Shell.go('docs'); setTimeout(() => $('#doc-file') && $('#doc-file').click(), 50); } },
    { s: 'أوامر', t: 'تبديل الوضع الليلي/النهاري', i: 'moon', run: () => Theme.toggle() }
  ].filter(Boolean);
  const pages = NAV.flatMap(g => g[1]).filter(r => can(r[0])).map(([r, t, i]) => ({ s: 'الصفحات', t, i, run: () => Shell.go(r) }));
  const build = () => {
    const q = inp.value.trim().toLowerCase();
    const match = t => !q || t.toLowerCase().includes(q);
    items = [...actions.filter(a => match(a.t)), ...pages.filter(a => match(a.t))];
    if (q) {
      if (can('materials') || can('pos')) items.push(...db.materials.filter(m => m.name.toLowerCase().includes(q) || m.barcode === q).slice(0, 6).map(m => ({ s: 'المواد', t: m.name, i: 'box', k: `${fmt(m.stock)} ${m.unit}`, run: () => quickMaterial(m) })));
      if (can('customers')) items.push(...db.customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)).slice(0, 5).map(c => ({ s: 'الزبائن', t: c.name, i: 'helmet', k: moneyT(custBalance(c.id)), run: () => statement(c.id) })));
      if (can('invoices') && /^\d+$/.test(q)) items.push(...db.invoices.filter(i => String(i.no) === q).map(i => ({ s: 'الفواتير', t: `${i.kind === 'sale' ? 'فاتورة' : 'عرض سعر'} رقم ${i.no}`, i: 'inv', k: moneyT(i.total), run: () => viewInvoice(i.id) })));
    }
    sel = Math.min(sel, Math.max(0, items.length - 1)); let last = '';
    list.innerHTML = items.map((it, n) => { const h = it.s !== last ? `<div class="cmdk-sec">${it.s}</div>` : ''; last = it.s; return `${h}<div class="cmdk-it ${n === sel ? 'on' : ''}" data-n="${n}">${ICO(it.i)}<span>${esc(it.t)}</span>${it.k ? `<span class="k">${esc(it.k)}</span>` : ''}</div>`; }).join('') || `<div class="empty">لا نتائج</div>`;
  };
  const close = () => bg.remove();
  const run = n => { const it = items[n]; close(); it && it.run(); };
  inp.addEventListener('input', () => { sel = 0; build(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); build(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); build(); e.preventDefault(); }
    else if (e.key === 'Enter') run(sel);
    else if (e.key === 'Escape') close();
    const on = $('.cmdk-it.on', list); on && on.scrollIntoView({ block: 'nearest' });
  });
  list.addEventListener('click', e => { const it = e.target.closest('[data-n]'); it && run(+it.dataset.n); });
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  build(); inp.focus();
}

/* ===== شاشات الدخول والإعداد والتفعيل ===== */
const BLUEPRINT = `<svg class="bp" viewBox="0 0 560 380" fill="none" stroke-linecap="round" aria-hidden="true">
  <g stroke="#53b4a6" stroke-width="1.3">
    <path d="M30 330H540"/><path d="M110 330V130h230v200"/><path d="M110 180h230M110 230h230M110 280h230" stroke-dasharray="3 5"/>
    <path d="M130 145h30v22h-30zM185 145h30v22h-30zM240 145h30v22h-30zM295 145h30v22h-30zM130 195h30v22h-30zM185 195h30v22h-30zM240 195h30v22h-30zM295 195h30v22h-30zM130 245h30v22h-30zM240 245h30v22h-30zM295 245h30v22h-30z"/>
    <path d="M190 330v-38h44v38"/><path d="M100 130l125-36 125 36"/>
    <path d="M450 330V40M440 330V40M440 60h10M440 100h10M440 140h10M440 180h10M440 220h10M440 260h10M440 300h10M440 60l10 40M450 100l-10 40M440 140l10 40M450 180l-10 40M440 220l10 40M450 260l-10 40"/>
    <path d="M300 40h230M300 52h150M445 40V20l-40 20M445 20l85 20"/>
    <path d="M360 52v118" stroke-dasharray="2 4"/>
  </g>
  <g stroke="#d8a54c" stroke-width="1.3"><rect x="345" y="170" width="30" height="22" rx="2"/><path d="M110 352h230M110 346v12M340 346v12M84 130v200M78 130h12M78 330h12"/></g>
  <g fill="#d8a54c" font-family="Readex Pro,sans-serif" font-size="11"><text x="225" y="368" text-anchor="middle">24.00 م</text><text x="70" y="235" text-anchor="middle" transform="rotate(-90 70 235)">16.50 م</text></g>
</svg>`;
function gate(formHTML) {
  return `<div class="gate">
    <section class="gate-art">${brandHTML()}
      <div><h2>كل كيس اسمنت وكل طن حديد <em>في مكانه الصحيح</em></h2><p>نظام متكامل لمخازن ومعارض المواد الإنشائية: مبيعات ومخزن وحسابات المقاولين وتذكير الديون والأرشفة من الماسح الضوئي، في مكان واحد.</p>
      <div class="gate-feats"><span>نقطة بيع بالباركود</span><span>حسابات آجلة</span><span>رسائل واتساب للمستحقات</span><span>أرشيف الماسح</span><span>صلاحيات المستخدمين</span></div></div>
      <div>${BLUEPRINT}<div style="font-size:12px;color:#7f9a94">الإصدار ${APP.version}</div></div>
    </section>
    <section class="gate-form"><div class="gate-box">${formHTML}</div>${footHTML()}</section>
  </div>`;
}
function screenSetup() {
  $('#app').innerHTML = gate(`<h3>إعداد البرنامج لأول مرة</h3><p class="sub">أنشئ حساب المدير. يمكنك إضافة المستخدمين وتحديد صلاحياتهم لاحقاً.</p>
    <form id="f-setup" autocomplete="off">
      <div class="field"><label>اسم المخزن / الشركة</label><input class="inp" name="company" value="${esc(db.settings.company)}" required></div>
      <div class="field"><label>اسم المدير</label><input class="inp" name="name" required placeholder="مثال: أصيل الصافي"></div>
      <div class="form-grid"><div class="field"><label>اسم المستخدم</label><input class="inp" name="username" required value="admin" dir="ltr"></div>
      <div class="field"><label>كلمة المرور</label><input class="inp" type="password" name="pass" required minlength="4" dir="ltr"></div></div>
      <label class="check" style="margin:4px 0 6px"><input type="checkbox" name="demo" checked> إضافة بيانات تجريبية للمعاينة (مواد، زبائن، فواتير)</label>
      <div class="err" id="err"></div>
      <button class="btn pri lg" style="width:100%">${ICO('check')} إنشاء الحساب والبدء</button>
    </form>`);
  $('#f-setup').onsubmit = e => {
    e.preventDefault(); const v = formVals(e.target);
    if (v.pass.length < 4) return $('#err').textContent = 'كلمة المرور 4 أحرف على الأقل';
    const salt = uid();
    const u = { id: uid(), name: v.name, username: v.username.toLowerCase(), role: 'admin', perms: ALL_PERMS.slice(), salt, hash: hashPass(v.pass, salt), active: true, created: Date.now() };
    db.users.push(u); db.settings.company = v.company || db.settings.company;
    Session.user = u; logAct('إعداد البرنامج', 'إنشاء حساب المدير');
    if (v.demo) seedDemo();
    Session.login(u); boot();
  };
}
function screenLogin() {
  $('#app').innerHTML = gate(`<h3>تسجيل الدخول</h3><p class="sub">${esc(db.settings.company)}</p>
    <form id="f-login" autocomplete="off">
      <div class="field"><label>اسم المستخدم</label><input class="inp" name="username" required dir="ltr" autofocus></div>
      <div class="field"><label>كلمة المرور</label><input class="inp" type="password" name="pass" required dir="ltr"></div>
      <div class="err" id="err"></div>
      <button class="btn pri lg" style="width:100%">${ICO('lock')} دخول</button>
      <div class="ruler"></div>
      ${License.activated ? `<p class="muted" style="font-size:12.5px;margin:0">${ICO('shield', '').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} نسخة مفعّلة</p>` : `<p class="muted" style="font-size:12.5px;margin:0">نسخة تجريبية — متبقٍ ${License.daysLeft} يوماً · <a href="#" id="go-act">تفعيل</a></p>`}
    </form>`);
  setTimeout(() => $('[name=username]') && $('[name=username]').focus(), 30);
  const ga = $('#go-act'); if (ga) ga.onclick = e => { e.preventDefault(); screenActivate(true); };
  $('#f-login').onsubmit = e => {
    e.preventDefault(); const v = formVals(e.target);
    const u = db.users.find(x => x.username === v.username.toLowerCase());
    if (!u || u.hash !== hashPass(v.pass, u.salt)) { $('#err').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; return; }
    if (u.active === false) { $('#err').textContent = 'هذا الحساب موقوف، راجع المدير'; return; }
    Session.login(u); boot();
  };
}
function activationForm(back) {
  return `<div class="machine"><div><div style="font-size:11.5px;color:var(--ink2)">رقم الحاسبة</div><div class="mono">${esc(License.data.machine)}</div></div>
      <button type="button" class="btn sm" data-act="copyMachine">${ICO('copy')} نسخ</button></div>
    <p class="muted" style="font-size:13px;margin:0 0 14px">أرسل رقم الحاسبة إلى المبرمج للحصول على الرقم التسلسلي الخاص بهذا الجهاز. رمز البرنامج: <b class="mono">${APP.code}</b></p>
    <form id="f-act"><div class="field"><label>الرقم التسلسلي</label><input class="inp mono" name="serial" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" dir="ltr" required></div>
    <div class="err" id="err"></div>
    <button class="btn brass lg" style="width:100%">${ICO('key')} تفعيل</button>
    ${back ? `<button type="button" class="btn ghost" style="width:100%;margin-top:8px" id="act-back">رجوع</button>` : ''}</form>`;
}
function bindActivation(onDone) {
  $('#f-act').onsubmit = e => {
    e.preventDefault();
    if (License.activate(formVals(e.target).serial)) { toast('تم تفعيل البرنامج بنجاح، شكراً لك'); logAct('تفعيل البرنامج'); saveDb(); onDone(); }
    else $('#err').textContent = 'الرقم التسلسلي غير صحيح لهذا الجهاز';
  };
}
function screenActivate(back = false) {
  const exp = License.expired;
  $('#app').innerHTML = gate(`<h3>${exp ? 'انتهت الفترة التجريبية' : 'تفعيل البرنامج'}</h3>
    <p class="sub">${exp ? 'بياناتك محفوظة بأمان ولن تُحذف. فعّل البرنامج للمتابعة.' : `متبقٍ ${License.daysLeft} يوماً من الفترة التجريبية.`}</p>${activationForm(back)}`);
  bindActivation(boot);
  const b = $('#act-back'); if (b) b.onclick = boot;
}
function activateModal() {
  const m = modal({ title: 'تفعيل البرنامج', size: 'narrow', body: activationForm(false) });
  bindActivation(() => { m.close(); Shell.refresh(); });
}
function changePass() {
  const m = modal({
    title: 'تغيير كلمة المرور', size: 'narrow',
    body: `<div class="field" style="margin-bottom:12px"><label>كلمة المرور الحالية</label><input class="inp" type="password" name="old" dir="ltr"></div>
      <div class="field"><label>كلمة المرور الجديدة</label><input class="inp" type="password" name="pass" dir="ltr"></div>`,
    foot: `<button class="btn pri" data-ok>حفظ</button>`
  });
  $('[data-ok]', m.el).onclick = () => {
    const v = formVals(m.el), u = Session.user;
    if (u.hash !== hashPass(v.old, u.salt)) return toast('كلمة المرور الحالية غير صحيحة', 'err');
    if (v.pass.length < 4) return toast('كلمة المرور 4 أحرف على الأقل', 'warn');
    u.salt = uid(); u.hash = hashPass(v.pass, u.salt); logAct('تغيير كلمة المرور'); saveDb(); m.close(); toast('تم تغيير كلمة المرور');
  };
}

/* ===== الإجراءات العامة (تفويض النقرات) ===== */
const ACTS = {
  menu: () => $('.shell').classList.toggle('nav-open'),
  cmdk: openCmdk,
  theme: () => Theme.toggle(),
  notices: openNotices,
  activate: activateModal,
  changePass,
  copyMachine: () => copyText(License.data.machine),
  camScan: () => Scanner.camera(onScanCode),
  logout: async () => { if (await confirmBox('هل تريد تسجيل الخروج؟', { ok: 'خروج' })) { Session.logout(); boot(); } }
};
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g && Session.user) { e.preventDefault(); Shell.go(g.dataset.go, { ...g.dataset }); return; }
  const a = e.target.closest('[data-act]');
  if (a && ACTS[a.dataset.act]) { e.preventDefault(); ACTS[a.dataset.act](a, e); }
});
document.addEventListener('keydown', e => {
  if (!Session.user || !$('.shell')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); }
  else if (e.key === 'F2' && can('pos')) { e.preventDefault(); Shell.go('pos'); }
});
/* التلميح للمخططات */
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]'); let tip = $('.tip');
  if (!t) { tip && tip.remove(); return; }
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.append(tip); }
  tip.innerHTML = t.dataset.tip; const r = t.getBoundingClientRect();
  tip.style.left = (r.left + r.width / 2 - tip.offsetWidth) + 'px'; tip.style.top = (r.top - 6) + 'px';
  tip.style.transform = 'translate(50%,-100%)';
});

/* ===== الإقلاع ===== */
function boot() {
  License.load(); Theme.apply();
  if (!db.users.length) return screenSetup();
  if (License.expired) return screenActivate(false);
  Session.restore();
  if (!Session.user) return screenLogin();
  Shell.mount(); Shell.go(Shell.route || 'dash');
}
