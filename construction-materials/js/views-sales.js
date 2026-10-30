/* المثلث · نظام إدارة المواد الإنشائية — الشاشات: لوحة القيادة، نقطة البيع، الفواتير، التوصيل */
'use strict';

const Views = {};
const emptyHTML = (ico, t, s = '') => `<div class="empty">${ICO(ico)}<b>${t}</b>${s}</div>`;
const custName = id => { const c = id && custById(id); return c ? c.name : 'زبون نقدي'; };
const supName = id => { const s = id && supById(id); return s ? s.name : '—'; };
const meter = m => {
  const st = stockState(m), cap = Math.max((m.min || 1) * 4, 1), f = Math.max(0, Math.min(8, Math.round((m.stock / cap) * 8)));
  return `<div class="meter ${st === 'low' || st === 'out' ? 'low' : st === 'mid' ? 'mid' : ''}" title="الحد الأدنى ${fmt(m.min)}">${Array.from({ length: 8 }, (_, i) => `<i class="${i < f ? 'f' : ''}"></i>`).join('')}</div>`;
};
const initial = n => { const w = String(n || '?').trim().split(/\s+/); const k = w.length > 1 && /^(المقاول|شركة|مؤسسة|مكتب|معمل|مخازن)$/.test(w[0]) ? w[1] : w[0]; return k.replace(/^ال(?=..)/, '')[0] || '?'; };
const statusChip = inv => { const s = invStatus(inv); return `<span class="chip ${s.c}">${s.t}</span>`; };

/* مخطط أعمدة بسلسلة واحدة */
function barChart(points, { h = 190, label = 'المبيعات' } = {}) {
  const W = 640, pb = 26, pt = 10, pl = 58, max = Math.max(1, ...points.map(p => p.v));
  const step = (W - pl) / points.length, bw = Math.max(6, Math.min(30, step * 0.56));
  const nice = (() => { const e = Math.pow(10, Math.floor(Math.log10(max))), f = max / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; })();
  const y = v => pt + (h - pb - pt) * (1 - v / nice);
  const grid = [0, .5, 1].map(t => `<line class="grid-l" x1="0" x2="${W}" y1="${y(nice * t)}" y2="${y(nice * t)}"/><text class="ax" x="0" y="${y(nice * t) - 3}" text-anchor="start" direction="ltr">${t ? fmt(nice * t) : ''}</text>`).join('');
  const bars = points.map((p, i) => {
    const x = pl + i * step + (step - bw) / 2, top = y(p.v), bh = Math.max(0, h - pb - top), r = Math.min(4, bw / 2, bh);
    const d = bh > 0 ? `M${x},${h - pb}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${h - pb}Z` : '';
    return `<g><rect x="${pl + i * step}" y="0" width="${step}" height="${h - pb}" fill="transparent" data-tip="<b>${esc(p.tl)}</b><br>${label}: ${moneyT(p.v)}${p.n != null ? `<br>${p.n} فاتورة` : ''}"/>${d ? `<path class="bar ${p.hl ? 'today' : ''}" d="${d}" pointer-events="none"/>` : ''}
      ${p.l ? `<text class="ax" x="${x + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(p.l)}</text>` : ''}</g>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">${grid}${bars}</svg></div>`;
}
function salesByDay(from, to) {
  const out = []; const n = daysBetween(from, to);
  for (let i = 0; i <= n; i++) {
    const d = addDays(from, i), inv = liveSales().filter(x => x.date === d);
    const dt = new Date(d + 'T12:00:00');
    out.push({ d, v: inv.reduce((s, x) => s + x.total, 0), n: inv.length, l: n > 20 ? (i % 5 === 0 ? String(dt.getDate()) : '') : `${dt.getDate()}/${dt.getMonth() + 1}`, tl: `${AR_DAYS[dt.getDay()]} ${fdate(d)}`, hl: d === today() });
  }
  return out;
}

/* ===================== لوحة القيادة ===================== */
Views.dash = {
  dim: () => `${AR_DAYS[new Date().getDay()]}، ${fdate(today())}`,
  render() {
    const t = today(), mStart = t.slice(0, 8) + '01';
    const sales = liveSales(), tod = sales.filter(i => i.date === t), mon = sales.filter(i => i.date >= mStart);
    const dues = dueRows(), overAmt = dues.reduce((s, r) => s + r.overdueAmt, 0), allDue = dues.reduce((s, r) => s + r.amount, 0);
    const low = db.materials.filter(m => ['low', 'out'].includes(stockState(m))).sort((a, b) => a.stock / (a.min || 1) - b.stock / (b.min || 1));
    const h = new Date().getHours(), greet = h < 12 ? 'صباح الخير' : 'مساء الخير';
    const ships = db.invoices.filter(i => i.kind === 'sale' && !i.void && i.ship && i.ship.state !== 'done');
    const pts = salesByDay(addDays(t, -13), t);
    const sum14 = pts.reduce((s, p) => s + p.v, 0);
    return `
    <div class="hero"><div><h2>${greet}، ${esc(Session.user.name.split(' ')[0])}</h2><p>هذا ملخص حركة ${esc(db.settings.company)} اليوم.</p></div>
      <div class="qa">
        ${can('pos') ? `<button class="btn pri" data-go="pos">${ICO('pos')} فاتورة جديدة <kbd style="background:transparent;color:inherit;border-color:rgba(255,255,255,.4)">F2</kbd></button>` : ''}
        ${can('payments') ? `<button class="btn" data-act="newReceipt">${ICO('cash')} استلام دفعة</button>` : ''}
        ${can('materials') ? `<button class="btn" data-act="newMaterial">${ICO('plus')} مادة</button>` : ''}
        ${can('docs') ? `<button class="btn" data-go="docs">${ICO('scan')} مسح مستند</button>` : ''}
      </div></div>
    <div class="grid g4" style="margin-bottom:18px">
      <div class="card kpi" ${can('invoices') ? 'data-go="invoices"' : ''}><div class="k-top"><span class="k-ico">${ICO('pos')}</span>مبيعات اليوم</div><div class="k-val num">${money(tod.reduce((s, i) => s + i.total, 0))}</div><div class="k-sub">${tod.length} فاتورة</div></div>
      <div class="card kpi brass" ${can('reports') ? 'data-go="reports"' : ''}><div class="k-top"><span class="k-ico">${ICO('chart')}</span>مبيعات الشهر</div><div class="k-val num">${money(mon.reduce((s, i) => s + i.total, 0))}</div><div class="k-sub">${mon.length} فاتورة منذ ${fdate(mStart)}</div></div>
      <div class="card kpi danger" ${can('dues') ? 'data-go="dues"' : ''}><div class="k-top"><span class="k-ico">${ICO('alarm')}</span>ديون متأخرة</div><div class="k-val num">${money(overAmt)}</div><div class="k-sub">من أصل ${moneyT(allDue)} على ${dues.length} زبون</div></div>
      <div class="card kpi warn" ${can('materials') ? 'data-go="materials" data-low="1"' : ''}><div class="k-top"><span class="k-ico">${ICO('box')}</span>تحت حد الطلب</div><div class="k-val num">${low.length} <small>مادة</small></div><div class="k-sub">${db.materials.filter(m => m.stock <= 0).length} نافدة تماماً</div></div>
    </div>
    <div class="grid g-side" style="margin-bottom:18px">
      <div class="card marks"><div class="card-h"><h3>المبيعات خلال 14 يوماً <span class="tag">${moneyT(sum14)}</span></h3><span class="muted" style="font-size:12px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--brass);vertical-align:-1px"></span> اليوم</span></div>
        <div class="card-b">${barChart(pts)}</div></div>
      <div class="card"><div class="card-h"><h3>تحتاج إعادة طلب</h3>${can('purchases') ? `<button class="btn xs" data-act="newPurchase">${ICO('cart')} شراء</button>` : ''}</div>
        <div class="list">${low.slice(0, 6).map(m => `<div class="li"><div class="l-ico">${ICO('box')}</div><div class="l-main"><b>${esc(m.name)}</b><span>${esc(supName(m.supplierId))} · الحد ${fmt(m.min)} ${esc(m.unit)}</span></div><div class="l-end"><b class="${m.stock <= 0 ? 'danger-t' : 'warn-t'}">${fmt(m.stock)}</b> <small class="muted">${esc(m.unit)}</small></div></div>`).join('') || emptyHTML('check', 'المخزون بحالة جيدة')}</div></div>
    </div>
    <div class="grid g3">
      <div class="card"><div class="card-h"><h3>أعلى المستحقات</h3>${can('dues') ? `<button class="btn xs" data-go="dues">الكل</button>` : ''}</div>
        <div class="list">${dues.slice(0, 5).map(r => `<div class="li"><div class="l-ico">${esc(initial(r.c.name))}</div><div class="l-main"><b>${esc(r.c.name)}</b><span>${r.bucket === 'over' ? `<span class="danger-t">متأخر ${r.lateDays} يوماً</span>` : `يستحق ${fdate(r.oldest)}`}</span></div><div class="l-end num">${fmt(r.amount)}</div>
          ${can('messages') && r.c.phone ? `<button class="btn xs icon" data-act="remind" data-id="${r.c.id}" title="إرسال تذكير">${ICO('wa')}</button>` : ''}</div>`).join('') || emptyHTML('check', 'لا توجد ديون مستحقة')}</div></div>
      <div class="card"><div class="card-h"><h3>آخر الفواتير</h3>${can('invoices') ? `<button class="btn xs" data-go="invoices">الكل</button>` : ''}</div>
        <div class="list">${db.invoices.filter(i => i.kind === 'sale').slice(0, 5).map(i => `<div class="li" style="cursor:pointer" data-act="viewInv" data-id="${i.id}"><div class="l-ico">${ICO('inv')}</div><div class="l-main"><b>${esc(custName(i.customerId))}</b><span>رقم ${i.no} · ${fdate(i.date)}</span></div><div class="l-end"><div class="num">${fmt(i.total)}</div>${statusChip(i)}</div></div>`).join('') || emptyHTML('inv', 'لا توجد فواتير بعد')}</div></div>
      <div class="card"><div class="card-h"><h3>شحنات قيد التوصيل</h3>${can('deliveries') ? `<button class="btn xs" data-go="deliveries">اللوحة</button>` : ''}</div>
        <div class="list">${ships.slice(0, 5).map(i => `<div class="li"><div class="l-ico">${ICO('truck')}</div><div class="l-main"><b>${esc(i.ship.addr || custName(i.customerId))}</b><span>${esc(i.ship.driver || 'بدون سائق')} · ${esc(i.ship.vehicle || '')}</span></div><div class="l-end"><span class="chip ${i.ship.state === 'road' ? 'acc' : 'brass'}">${i.ship.state === 'road' ? 'في الطريق' : 'بانتظار التحميل'}</span></div></div>`).join('') || emptyHTML('truck', 'لا توجد شحنات معلّقة')}</div></div>
    </div>`;
  }
};

/* ===================== نقطة البيع ===================== */
const POS = { reset() { Object.assign(this, { kind: 'sale', customerId: null, lines: [], discount: 0, delivery: 0, tier: 'retail', pay: 'cash', paid: 0, due: addDays(today(), db.settings.dueDays || 30), ship: false, addr: '', driver: '', vehicle: '', note: '', fromQuote: null, cat: '', q: '' }); } };
POS.reset();
function posTotals() {
  const sub = round2(POS.lines.reduce((s, l) => s + l.qty * l.price, 0));
  const disc = Math.min(sub, num(POS.discount)), del = num(POS.delivery), rate = num(db.settings.tax);
  const tax = round2((sub - disc) * rate / 100), total = round2(sub - disc + del + tax);
  return { sub, disc, del, rate, tax, total };
}
function posAdd(mid, qty = 1) {
  const m = matById(mid); if (!m) return;
  const l = POS.lines.find(x => x.mid === mid);
  if (l) l.qty = round2(l.qty + qty);
  else POS.lines.push({ mid, name: m.name, unit: m.unit, qty, price: POS.tier === 'wholesale' ? m.wprice || m.price : m.price, cost: m.cost });
  if (Shell.route === 'pos') { renderTicket(); const el = $(`.tk-line[data-mid="${mid}"]`); if (el) { el.scrollIntoView({ block: 'nearest' }); el.style.background = 'var(--accent-soft)'; setTimeout(() => el.style.background = '', 600); } }
}
Views.pos = {
  dim: () => 'امسح الباركود أو اختر المادة · F2 فاتورة جديدة',
  render() {
    return `<div class="pos">
      <div>
        <div class="pos-tools"><div class="search">${ICO('search')}<input class="inp" id="pos-q" placeholder="ابحث بالاسم أو امسح الباركود ثم Enter…" value="${esc(POS.q)}" autocomplete="off"></div>
          <button class="btn lg" data-act="posCam" title="مسح بالكاميرا">${ICO('camera')}</button></div>
        <div class="cats" id="pos-cats"></div>
        <div class="tiles" id="pos-tiles"></div>
      </div>
      <div class="ticket"><div class="ticket-in" id="ticket"></div><div class="ticket-edge"></div></div>
    </div>`;
  },
  after() {
    const q = $('#pos-q');
    q.addEventListener('input', debounce(() => { POS.q = q.value; renderTiles(); }, 120));
    q.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const v = q.value.trim(); if (!v) return;
      const m = db.materials.find(x => x.barcode === v) || (() => { const r = filteredMats(); return r.length === 1 ? r[0] : null; })();
      if (m) { beep(); posAdd(m.id); q.value = ''; POS.q = ''; renderTiles(); }
      else toast('لم يتم العثور على مادة مطابقة', 'warn');
    });
    renderTiles(); renderTicket(); setTimeout(() => q.focus(), 30);
  }
};
const filteredMats = () => { const q = POS.q.trim().toLowerCase(); return db.materials.filter(m => (!POS.cat || m.cat === POS.cat) && (!q || m.name.toLowerCase().includes(q) || m.barcode.includes(q))); };
function renderTiles() {
  const cats = [...new Set(db.materials.map(m => m.cat))];
  $('#pos-cats').innerHTML = [`<button class="cat ${!POS.cat ? 'on' : ''}" data-act="posCat" data-c="">الكل</button>`, ...cats.map(c => `<button class="cat ${POS.cat === c ? 'on' : ''}" data-act="posCat" data-c="${esc(c)}">${esc(c)}</button>`)].join('');
  const list = filteredMats();
  $('#pos-tiles').innerHTML = list.map(m => {
    const st = stockState(m), inT = POS.lines.find(l => l.mid === m.id);
    const pr = POS.tier === 'wholesale' ? m.wprice || m.price : m.price;
    return `<button class="tile ${st === 'low' ? 'low' : st === 'out' ? 'out low' : ''}" data-act="posAdd" data-id="${m.id}">
      ${inT ? `<span class="t-badge">${fmt(inT.qty)}</span>` : ''}<span class="t-cat">${esc(m.cat)}</span><span class="t-name">${esc(m.name)}</span>
      <span class="t-price num">${fmt(pr)} <small>/ ${esc(m.unit)}</small></span><span class="t-stock">${meter(m)} ${fmt(m.stock)} ${esc(m.unit)}</span></button>`;
  }).join('') || `<div style="grid-column:1/-1">${emptyHTML('search', 'لا توجد مواد مطابقة', can('materials') ? `<br><button class="btn sm" data-act="newMaterial" style="margin-top:10px">${ICO('plus')} إضافة مادة</button>` : '')}</div>`;
}
function renderTicket() {
  const T = posTotals(), quote = POS.kind === 'quote';
  const c = POS.customerId && custById(POS.customerId);
  $('#ticket').innerHTML = `
    <div class="tk-h"><div class="row"><div class="seg"><button class="${!quote ? 'on' : ''}" data-act="posKind" data-k="sale">فاتورة بيع</button><button class="${quote ? 'on' : ''}" data-act="posKind" data-k="quote">عرض سعر</button></div>
      <span class="spacer"></span><span class="tk-no">${quote ? 'عرض' : 'فاتورة'} #${(quote ? db.seq.quo : db.seq.inv) + 1}</span></div>
      <div class="row" style="margin-top:10px"><select class="sel sm" id="pos-cust" style="flex:1"><option value="">زبون نقدي</option>${db.customers.map(x => `<option value="${x.id}" ${x.id === POS.customerId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        ${can('customers') ? `<button class="btn sm icon" data-act="posNewCust" title="زبون جديد">${ICO('plus')}</button>` : ''}</div>
      ${c ? `<div class="row" style="margin-top:6px;font-size:12px;color:var(--muted)"><span>الرصيد الحالي: <b class="${custBalance(c.id) > 0 ? 'danger-t' : ''}">${moneyT(custBalance(c.id))}</b></span>${c.limit ? `<span>· سقف الدين ${moneyT(c.limit)}</span>` : ''}</div>` : ''}
      <div class="row" style="margin-top:8px"><span class="muted" style="font-size:12.5px">التسعير:</span><div class="seg"><button class="${POS.tier === 'retail' ? 'on' : ''}" data-act="posTier" data-t="retail">مفرد</button><button class="${POS.tier === 'wholesale' ? 'on' : ''}" data-act="posTier" data-t="wholesale">جملة / مقاول</button></div></div>
    </div>
    <div class="tk-lines">${POS.lines.map((l, i) => `<div class="tk-line" data-mid="${l.mid}">
        <div class="nm">${esc(l.name)}<small>${fmt(l.price)} × ${fmt(l.qty)} ${esc(l.unit)}</small></div><div class="tot">${fmt(l.qty * l.price)}</div>
        <div class="ctl"><div class="qty"><button data-act="posQty" data-i="${i}" data-d="1">+</button><input value="${l.qty}" data-qi="${i}" inputmode="decimal"><button data-act="posQty" data-i="${i}" data-d="-1">−</button></div>
          ${can('price') ? `<input class="inp sm num pr" value="${l.price}" data-pi="${i}" inputmode="decimal" title="سعر الوحدة">` : ''}
          <span class="spacer"></span><button class="btn xs icon ghost" data-act="posDel" data-i="${i}" title="حذف">${ICO('trash')}</button></div></div>`).join('') ||
    `<div class="empty">${ICO('scan')}<b>الفاتورة فارغة</b>امسح باركود المادة أو اخترها من القائمة</div>`}</div>
    <div class="tk-sum">
      <div class="r"><span>المجموع</span><b class="num">${fmt(T.sub)}</b></div>
      ${can('price') ? `<div class="r"><span>الخصم</span><input class="inp sm num" id="pos-disc" value="${POS.discount || ''}" placeholder="0" inputmode="decimal"></div>` : ''}
      <div class="r"><label class="check"><input type="checkbox" id="pos-ship" ${POS.ship ? 'checked' : ''}> توصيل للموقع</label>${POS.ship ? `<input class="inp sm num" id="pos-del" value="${POS.delivery || ''}" placeholder="أجور النقل" inputmode="decimal">` : ''}</div>
      ${POS.ship ? `<input class="inp sm" id="pos-addr" placeholder="عنوان الموقع" value="${esc(POS.addr || (c ? c.site : ''))}">
        <div class="row" style="flex-wrap:nowrap"><input class="inp sm" id="pos-driver" placeholder="السائق" value="${esc(POS.driver)}"><input class="inp sm" id="pos-veh" placeholder="رقم العجلة" value="${esc(POS.vehicle)}"></div>` : ''}
      ${T.rate ? `<div class="r"><span>الضريبة ${T.rate}%</span><b class="num">${fmt(T.tax)}</b></div>` : ''}
    </div>
    <div class="tk-total"><span>الإجمالي</span><b class="num">${fmt(T.total)} <small style="font-size:13px">${esc(cur())}</small></b></div>
    <div class="tk-pay">
      ${!quote ? `<div class="seg" style="width:100%"><button style="flex:1" class="${POS.pay === 'cash' ? 'on' : ''}" data-act="posPay" data-p="cash">نقداً</button><button style="flex:1" class="${POS.pay === 'part' ? 'on' : ''}" data-act="posPay" data-p="part">دفعة جزئية</button><button style="flex:1" class="${POS.pay === 'credit' ? 'on' : ''}" data-act="posPay" data-p="credit">آجل</button></div>
      ${POS.pay !== 'cash' ? `<div class="row" style="flex-wrap:nowrap">${POS.pay === 'part' ? `<div class="field" style="flex:1"><label>المبلغ المدفوع</label><input class="inp sm num" id="pos-paid" value="${POS.paid || ''}" inputmode="decimal"></div>` : ''}<div class="field" style="flex:1"><label>تاريخ الاستحقاق</label><input class="inp sm" type="date" id="pos-due" value="${POS.due}"></div></div>` : ''}` : ''}
      <input class="inp sm" id="pos-note" placeholder="ملاحظة على الفاتورة (اختياري)" value="${esc(POS.note)}">
      <div class="row" style="flex-wrap:nowrap"><button class="btn pri lg" style="flex:1" data-act="posSave" data-print="1" ${POS.lines.length ? '' : 'disabled'}>${ICO('print')} حفظ وطباعة</button>
        <button class="btn lg" data-act="posSave" ${POS.lines.length ? '' : 'disabled'}>${ICO('check')} حفظ</button>
        <button class="btn lg icon ghost" data-act="posClear" title="تفريغ" style="width:46px">${ICO('trash')}</button></div>
      ${POS.fromQuote ? `<div class="chip brass plain">تحويل من عرض سعر</div>` : ''}
    </div>`;
  const bind = (id, k, f = v => v, re = false) => { const el = $('#' + id); if (el) el.addEventListener(re ? 'change' : 'input', () => { POS[k] = f(el.value); if (re) renderTicket(); else if (['discount', 'delivery'].includes(k)) updTotals(); }); };
  bind('pos-disc', 'discount', num); bind('pos-del', 'delivery', num); bind('pos-addr', 'addr'); bind('pos-driver', 'driver'); bind('pos-veh', 'vehicle');
  bind('pos-paid', 'paid', num); bind('pos-due', 'due'); bind('pos-note', 'note');
  $('#pos-cust').onchange = e => { POS.customerId = e.target.value || null; const cc = custById(POS.customerId); if (cc && cc.type !== 'فرد' && POS.tier === 'retail') setTier('wholesale'); else renderTicket(); };
  const sh = $('#pos-ship'); sh.onchange = () => { POS.ship = sh.checked; renderTicket(); };
  $$('[data-qi]').forEach(el => el.addEventListener('change', () => { const l = POS.lines[+el.dataset.qi]; l.qty = Math.max(0, num(el.value)); if (!l.qty) POS.lines.splice(+el.dataset.qi, 1); setTimeout(() => { renderTicket(); renderTiles(); }); }));
  $$('[data-pi]').forEach(el => el.addEventListener('change', () => { POS.lines[+el.dataset.pi].price = Math.max(0, num(el.value)); setTimeout(renderTicket); }));
  function updTotals() { const T2 = posTotals(); $('.tk-total b').innerHTML = `${fmt(T2.total)} <small style="font-size:13px">${esc(cur())}</small>`; }
}
function setTier(t) { POS.tier = t; POS.lines.forEach(l => { const m = matById(l.mid); if (m) l.price = t === 'wholesale' ? m.wprice || m.price : m.price; }); renderTicket(); renderTiles(); }
async function posSave(print) {
  const T = posTotals(), quote = POS.kind === 'quote';
  if (!POS.lines.length) return;
  if (!quote) {
    if (POS.pay !== 'cash' && !POS.customerId) return toast('البيع الآجل يحتاج اختيار زبون', 'warn');
    const short = POS.lines.filter(l => { const m = matById(l.mid); return m && l.qty > m.stock; });
    if (short.length) {
      const names = short.map(l => `${l.name} (المتوفر ${fmt(matById(l.mid).stock)})`).join('، ');
      if (db.settings.blockNegative) return toast('الكمية غير متوفرة: ' + names, 'err', 5500);
      if (!await confirmBox(`الكمية المطلوبة أكبر من المخزون: ${esc(names)}. هل تريد المتابعة؟`, { ok: 'متابعة البيع' })) return;
    }
    const paid = POS.pay === 'cash' ? T.total : POS.pay === 'part' ? Math.min(T.total, num(POS.paid)) : 0;
    const c = POS.customerId && custById(POS.customerId);
    if (c && c.limit && custBalance(c.id) + (T.total - paid) > c.limit) {
      if (!await confirmBox(`سيتجاوز رصيد <b>${esc(c.name)}</b> سقف الدين المسموح (${moneyT(c.limit)}). هل تريد المتابعة؟`, { ok: 'متابعة', danger: true })) return;
    }
    POS._paid = paid;
  }
  const inv = {
    id: uid(), kind: quote ? 'quote' : 'sale', no: nextNo(quote ? 'quo' : 'inv'), date: today(), at: Date.now(), customerId: POS.customerId,
    lines: POS.lines.map(l => ({ ...l })), sub: T.sub, discount: T.disc, delivery: T.del, taxRate: T.rate, tax: T.tax, total: T.total,
    paid: quote ? 0 : POS._paid, due: quote || POS.pay === 'cash' ? null : POS.due, tier: POS.tier, note: POS.note, user: Session.user.id,
    ship: POS.ship ? { addr: POS.addr || (custById(POS.customerId) || {}).site || '', driver: POS.driver, vehicle: POS.vehicle, state: 'wait' } : null
  };
  db.invoices.unshift(inv);
  if (!quote) {
    inv.lines.forEach(l => moveStock(l.mid, -l.qty, docNo('INV', inv.no), 'بيع'));
    if (inv.paid > 0) db.payments.unshift({ id: uid(), no: nextNo('rec'), type: 'in', party: 'c', partyId: inv.customerId, amount: inv.paid, method: 'نقدي', note: 'مع الفاتورة', date: inv.date, at: inv.at, alloc: [{ id: inv.id, amount: inv.paid }], user: Session.user.id });
    if (POS.fromQuote) { const q = byId('invoices', POS.fromQuote); if (q) q.converted = inv.id; }
    logAct('فاتورة بيع', `رقم ${inv.no} · ${custName(inv.customerId)} · ${moneyT(inv.total)}`);
  } else logAct('عرض سعر', `رقم ${inv.no} · ${custName(inv.customerId)}`);
  saveDb(); toast(`${quote ? 'عرض السعر' : 'الفاتورة'} رقم ${inv.no} محفوظ`);
  const keepTier = POS.tier; POS.reset(); POS.tier = keepTier;
  Shell.refresh();
  if (print) printInvoice(inv.id);
}
Object.assign(ACTS, {
  posAdd: el => posAdd(el.dataset.id),
  posCat: el => { POS.cat = el.dataset.c; renderTiles(); },
  posQty: el => { const l = POS.lines[+el.dataset.i]; const st = ['طن'].includes(l.unit) ? 0.5 : 1; l.qty = round2(l.qty + st * +el.dataset.d); if (l.qty <= 0) POS.lines.splice(+el.dataset.i, 1); renderTicket(); renderTiles(); },
  posDel: el => { POS.lines.splice(+el.dataset.i, 1); renderTicket(); renderTiles(); },
  posKind: el => { POS.kind = el.dataset.k; renderTicket(); },
  posTier: el => setTier(el.dataset.t),
  posPay: el => { POS.pay = el.dataset.p; renderTicket(); },
  posClear: async () => { if (!POS.lines.length || await confirmBox('تفريغ الفاتورة الحالية؟', { ok: 'تفريغ', danger: true })) { POS.reset(); renderTicket(); renderTiles(); } },
  posSave: el => posSave(!!el.dataset.print),
  posCam: () => Scanner.camera(code => onScanCode(code)),
  posNewCust: () => editCustomer(null, c => { POS.customerId = c.id; Shell.refresh(); }),
  newMaterial: () => editMaterial(null),
  viewInv: el => viewInvoice(el.dataset.id)
});

/* ===================== الفواتير ===================== */
const InvF = { kind: 'sale', st: '', q: '', from: '', to: '' };
Views.invoices = {
  dim: () => `${liveSales().length} فاتورة بيع · ${db.invoices.filter(i => i.kind === 'quote').length} عرض سعر`,
  render() {
    const q = InvF.q.toLowerCase();
    const rows = db.invoices.filter(i => i.kind === InvF.kind && (!InvF.st || invStatus(i).k === InvF.st || (InvF.st === 'open' && ['credit', 'part', 'over'].includes(invStatus(i).k)))
      && (!q || String(i.no) === q || custName(i.customerId).toLowerCase().includes(q) || i.lines.some(l => l.name.toLowerCase().includes(q)))
      && (!InvF.from || i.date >= InvF.from) && (!InvF.to || i.date <= InvF.to));
    const sale = InvF.kind === 'sale';
    const tot = rows.filter(r => !r.void).reduce((a, r) => ({ t: a.t + r.total, p: a.p + (r.paid || 0) }), { t: 0, p: 0 });
    const sts = sale ? [['', 'الكل'], ['open', 'غير مسددة'], ['over', 'متأخرة'], ['paid', 'مدفوعة'], ['void', 'ملغاة']] : [['', 'الكل'], ['quote', 'مفتوحة'], ['conv', 'محوّلة']];
    return `<div class="tabs"><button class="${sale ? 'on' : ''}" data-act="invKind" data-k="sale">فواتير البيع</button><button class="${!sale ? 'on' : ''}" data-act="invKind" data-k="quote">عروض الأسعار</button></div>
      <div class="toolbar"><div class="search">${ICO('search')}<input class="inp" id="inv-q" placeholder="رقم الفاتورة أو اسم الزبون أو المادة" value="${esc(InvF.q)}"></div>
        <div class="seg">${sts.map(([k, t]) => `<button class="${InvF.st === k ? 'on' : ''}" data-act="invSt" data-s="${k}">${t}</button>`).join('')}</div>
        <input type="date" class="inp" style="width:auto" id="inv-from" value="${InvF.from}" title="من"><input type="date" class="inp" style="width:auto" id="inv-to" value="${InvF.to}" title="إلى">
        <span class="spacer"></span>${can('pos') ? `<button class="btn pri" data-go="pos">${ICO('plus')} ${sale ? 'فاتورة' : 'عرض سعر'} جديد</button>` : ''}</div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الرقم</th><th>التاريخ</th><th>الزبون</th><th>المواد</th><th class="n">الإجمالي</th>${sale ? '<th class="n">المدفوع</th><th class="n">المتبقي</th><th>الاستحقاق</th>' : ''}<th>الحالة</th><th></th></tr></thead>
      <tbody>${rows.slice(0, 400).map(i => `<tr>
        <td class="mono">${i.no}</td><td>${fdate(i.date)}</td><td><div class="t-main">${esc(custName(i.customerId))}</div>${i.ship ? `<div class="t-sub">${ICO('truck').replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-2px"')} ${esc(i.ship.addr)}</div>` : ''}</td>
        <td><div class="t-sub" style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(i.lines.map(l => l.name).join('، '))}</div></td>
        <td class="n">${fmt(i.total)}</td>${sale ? `<td class="n">${fmt(i.paid)}</td><td class="n ${remaining(i) > 0 && !i.void ? 'danger-t' : ''}">${i.void ? '—' : fmt(remaining(i))}</td><td>${i.due ? fdate(i.due) : '—'}</td>` : ''}
        <td>${statusChip(i)}</td>
        <td><div class="acts"><button class="btn xs icon" data-act="viewInv" data-id="${i.id}" title="عرض">${ICO('eye')}</button><button class="btn xs icon" data-act="printInv" data-id="${i.id}" title="طباعة">${ICO('print')}</button>
          ${sale && !i.void && remaining(i) > 0 && i.customerId && can('payments') ? `<button class="btn xs icon" data-act="payInv" data-id="${i.id}" title="استلام دفعة">${ICO('cash')}</button>` : ''}
          ${!sale && !i.converted && can('pos') ? `<button class="btn xs" data-act="convQuote" data-id="${i.id}">${ICO('swap')} تحويل لفاتورة</button>` : ''}
          ${can('void') && sale && !i.void ? `<button class="btn xs icon dan" data-act="voidInv" data-id="${i.id}" title="إلغاء الفاتورة">${ICO('x')}</button>` : ''}
          ${can('void') && !sale ? `<button class="btn xs icon dan" data-act="delQuote" data-id="${i.id}" title="حذف">${ICO('trash')}</button>` : ''}</div></td></tr>`).join('')}</tbody>
      ${rows.length ? `<tfoot><tr><td colspan="4">${rows.length} سجل</td><td class="n">${fmt(tot.t)}</td>${sale ? `<td class="n">${fmt(tot.p)}</td><td class="n">${fmt(tot.t - tot.p)}</td><td></td>` : ''}<td colspan="2"></td></tr></tfoot>` : ''}</table>
      ${rows.length ? '' : emptyHTML('inv', 'لا توجد سجلات مطابقة')}</div></div>`;
  },
  after() {
    const q = $('#inv-q'); q.addEventListener('input', debounce(() => { InvF.q = q.value.trim(); const p = q.selectionStart; Shell.refresh(); const n = $('#inv-q'); n.focus(); n.setSelectionRange(p, p); }, 250));
    $('#inv-from').onchange = e => { InvF.from = e.target.value; Shell.refresh(); };
    $('#inv-to').onchange = e => { InvF.to = e.target.value; Shell.refresh(); };
  }
};
function invoiceHTML(inv) {
  const s = db.settings, c = inv.customerId && custById(inv.customerId), quote = inv.kind === 'quote';
  const code = `${quote ? 'QUO' : 'INV'}-${pad(inv.no, 5)}`;
  return `<div class="pr-h"><div>${brandHTML(s.company)}<div style="margin-top:6px;font-size:11.5px;color:#555">${esc(s.address)}${s.phone ? ` · هاتف ${esc(s.phone)}` : ''}</div></div>
      <div style="text-align:left"><p class="pr-title">${quote ? 'عرض سعر' : 'فاتورة بيع'}</p><div style="width:170px;margin-top:4px">${barcodeSVG(code, { h: 34 })}</div></div></div>
    <div class="pr-meta"><div><b>الرقم:</b> ${inv.no}</div><div><b>التاريخ:</b> ${fdate(inv.date)}</div>
      <div><b>الزبون:</b> ${esc(c ? c.name : 'زبون نقدي')}</div><div><b>الهاتف:</b> ${esc(c ? c.phone : '—')}</div>
      ${inv.ship ? `<div><b>موقع التسليم:</b> ${esc(inv.ship.addr)}</div><div><b>السائق / العجلة:</b> ${esc(inv.ship.driver || '—')} ${esc(inv.ship.vehicle || '')}</div>` : ''}
      ${!quote && inv.due ? `<div><b>تاريخ الاستحقاق:</b> ${fdate(inv.due)}</div>` : ''}<div><b>المحرر:</b> ${esc(userName(inv.user))}</div></div>
    <table><thead><tr><th>#</th><th>المادة</th><th>الوحدة</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">المبلغ</th></tr></thead>
    <tbody>${inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.unit)}</td><td class="n">${fmt(l.qty)}</td><td class="n">${fmt(l.price)}</td><td class="n">${fmt(l.qty * l.price)}</td></tr>`).join('')}</tbody></table>
    <div class="pr-tot"><div><span>المجموع</span><span>${fmt(inv.sub)}</span></div>${inv.discount ? `<div><span>الخصم</span><span>${fmt(inv.discount)}</span></div>` : ''}${inv.delivery ? `<div><span>أجور النقل</span><span>${fmt(inv.delivery)}</span></div>` : ''}${inv.tax ? `<div><span>الضريبة ${inv.taxRate}%</span><span>${fmt(inv.tax)}</span></div>` : ''}
      <div class="g"><span>الإجمالي</span><span>${moneyT(inv.total)}</span></div>${!quote ? `<div><span>المدفوع</span><span>${fmt(inv.paid)}</span></div><div><span>المتبقي</span><span>${fmt(remaining(inv))}</span></div>` : ''}</div>
    ${inv.note ? `<p><b>ملاحظة:</b> ${esc(inv.note)}</p>` : ''}${inv.void ? `<p style="color:#b3412e;font-weight:600">هذه الفاتورة ملغاة</p>` : ''}
    <p style="color:#555;font-size:11.5px">${esc(s.invoiceNote)}</p>
    <div class="pr-sign"><div>توقيع المستلم</div><div>توقيع أمين المخزن</div><div>الختم</div></div>
    <div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي</div>`;
}
function printInvoice(id) { const inv = byId('invoices', id); if (inv) printHTML(invoiceHTML(inv)); }
function viewInvoice(id) {
  const inv = byId('invoices', id); if (!inv) return;
  const c = inv.customerId && custById(inv.customerId);
  const m = modal({
    title: `${inv.kind === 'quote' ? 'عرض سعر' : 'فاتورة'} رقم ${inv.no} ${statusChip(inv)}`, size: 'wide',
    body: `<div class="doc-paper pr">${invoiceHTML(inv)}</div>`,
    foot: `<button class="btn pri" data-p>${ICO('print')} طباعة</button>
      ${c && c.phone ? `<button class="btn" data-wa>${ICO('wa')} إرسال للزبون</button>` : ''}
      ${inv.kind === 'sale' && !inv.void && remaining(inv) > 0 && c && can('payments') ? `<button class="btn" data-pay>${ICO('cash')} استلام دفعة</button>` : ''}`
  });
  $('[data-p]', m.el).onclick = () => printInvoice(id);
  const w = $('[data-wa]', m.el); if (w) w.onclick = () => {
    const txt = `${db.settings.company}\n${inv.kind === 'quote' ? 'عرض سعر' : 'فاتورة'} رقم ${inv.no} — ${fdate(inv.date)}\n` + inv.lines.map(l => `• ${l.name}: ${fmt(l.qty)} ${l.unit} × ${fmt(l.price)}`).join('\n') + `\nالإجمالي: ${moneyT(inv.total)}` + (inv.kind === 'sale' ? `\nالمتبقي: ${moneyT(remaining(inv))}` : '');
    sendOne(c, txt, `فاتورة ${inv.no}`);
  };
  const p = $('[data-pay]', m.el); if (p) p.onclick = () => { m.close(); paymentModal('in', inv.customerId, inv.id); };
}
Object.assign(ACTS, {
  invKind: el => { InvF.kind = el.dataset.k; InvF.st = ''; Shell.refresh(); },
  invSt: el => { InvF.st = el.dataset.s; Shell.refresh(); },
  printInv: el => printInvoice(el.dataset.id),
  payInv: el => { const i = byId('invoices', el.dataset.id); paymentModal('in', i.customerId, i.id); },
  convQuote: el => {
    const q = byId('invoices', el.dataset.id); POS.reset();
    Object.assign(POS, { kind: 'sale', customerId: q.customerId, tier: q.tier, lines: q.lines.map(l => { const m = matById(l.mid); return { ...l, cost: m ? m.cost : l.cost }; }).filter(l => matById(l.mid)), delivery: q.delivery, ship: !!q.delivery, discount: q.discount, note: q.note, fromQuote: q.id, pay: q.customerId ? 'credit' : 'cash' });
    Shell.go('pos'); toast('تم تحميل عرض السعر، راجع الكميات ثم احفظ');
  },
  delQuote: async el => { if (await confirmBox('حذف عرض السعر نهائياً؟', { ok: 'حذف', danger: true })) { db.invoices = db.invoices.filter(i => i.id !== el.dataset.id); logAct('حذف عرض سعر'); rerender(); } },
  voidInv: async el => {
    const inv = byId('invoices', el.dataset.id);
    if (!await confirmBox(`إلغاء الفاتورة رقم <b>${inv.no}</b>؟ ستُعاد الكميات إلى المخزن${inv.paid ? ` ويُسجّل سند صرف بإرجاع المبلغ المدفوع (${moneyT(inv.paid)}) للزبون` : ''}.`, { ok: 'إلغاء الفاتورة', danger: true })) return;
    inv.void = true; inv.lines.forEach(l => moveStock(l.mid, l.qty, docNo('INV', inv.no), 'إلغاء فاتورة'));
    if (inv.paid > 0) db.payments.unshift({ id: uid(), no: nextNo('pay'), type: 'out', party: 'c', partyId: inv.customerId, amount: inv.paid, method: 'نقدي', note: `إرجاع مبلغ الفاتورة الملغاة ${inv.no}`, date: today(), at: Date.now(), alloc: [], user: Session.user.id });
    logAct('إلغاء فاتورة', `رقم ${inv.no}`); rerender(); toast('أُلغيت الفاتورة');
  }
});

/* ===================== التوصيل ===================== */
Views.deliveries = {
  dim: () => 'متابعة شحنات المواد إلى مواقع العمل',
  render() {
    const all = db.invoices.filter(i => i.kind === 'sale' && !i.void && i.ship);
    const lanes = [['wait', 'بانتظار التحميل', 'var(--brass)'], ['road', 'في الطريق', 'var(--accent)'], ['done', 'تم التسليم', 'var(--ok)']];
    return `<div class="board">${lanes.map(([k, t, col]) => {
      const items = all.filter(i => i.ship.state === k).sort((a, b) => b.at - a.at).slice(0, k === 'done' ? 12 : 100);
      return `<div class="lane"><div class="lane-h"><i style="background:${col}"></i>${t}<span class="n">${all.filter(i => i.ship.state === k).length}</span></div>
        ${items.map(i => `<div class="dcard"><div class="row"><b>#${i.no}</b><span class="spacer"></span><span class="muted" style="font-size:12px">${fdate(i.date)}</span></div>
          <div class="meta"><span>${ICO('helmet')}${esc(custName(i.customerId))}</span><span>${ICO('pin')}${esc(i.ship.addr || '—')}</span><span>${ICO('truck')}${esc(i.ship.driver || 'بدون سائق')} · ${esc(i.ship.vehicle || '—')}</span>
          <span>${ICO('box')}${esc(i.lines.map(l => `${fmt(l.qty)} ${l.unit} ${l.name.split('—')[0]}`).join('، '))}</span></div>
          <div class="row">${k !== 'wait' ? `<button class="btn xs" data-act="shipMove" data-id="${i.id}" data-to="${k === 'done' ? 'road' : 'wait'}">→ رجوع</button>` : ''}<span class="spacer"></span>
            <button class="btn xs icon" data-act="shipEdit" data-id="${i.id}" title="تعديل">${ICO('edit')}</button>
            ${k !== 'done' ? `<button class="btn xs pri" data-act="shipMove" data-id="${i.id}" data-to="${k === 'wait' ? 'road' : 'done'}">${k === 'wait' ? 'انطلق' : 'تم التسليم'} ←</button>` : ''}</div></div>`).join('') || `<div class="empty" style="padding:24px 10px">لا يوجد</div>`}</div>`;
    }).join('')}</div>`;
  }
};
Object.assign(ACTS, {
  shipMove: el => { const i = byId('invoices', el.dataset.id); i.ship.state = el.dataset.to; if (el.dataset.to === 'done') i.ship.doneAt = Date.now(); logAct('تحديث توصيل', `فاتورة ${i.no} → ${{ wait: 'بانتظار التحميل', road: 'في الطريق', done: 'تم التسليم' }[el.dataset.to]}`); rerender(); },
  shipEdit: el => {
    const i = byId('invoices', el.dataset.id);
    const m = modal({
      title: `بيانات توصيل الفاتورة ${i.no}`, size: 'narrow',
      body: `<div class="stack" style="gap:12px"><div class="field"><label>عنوان الموقع</label><input class="inp" name="addr" value="${esc(i.ship.addr)}"></div>
        <div class="form-grid"><div class="field"><label>السائق</label><input class="inp" name="driver" value="${esc(i.ship.driver)}"></div><div class="field"><label>رقم العجلة</label><input class="inp" name="vehicle" value="${esc(i.ship.vehicle)}"></div></div></div>`,
      foot: `<button class="btn pri" data-ok>حفظ</button>`
    });
    $('[data-ok]', m.el).onclick = () => { Object.assign(i.ship, formVals(m.el)); m.close(); rerender(); };
  }
});
