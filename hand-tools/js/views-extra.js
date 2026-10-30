/* المثلث · نظام إدارة العدد اليدوية — محطة الماسح، المحادثات، واتساب المباشر، الصندوق والمصروفات، المرتجعات، التصدير */
'use strict';

/* ===================== واتساب: فتح المحادثة أو الإرسال المباشر عبر WhatsApp Cloud API ===================== */
const WA = {
  get cfg() { return db.settings.wa; },
  api() { const w = this.cfg; return w.mode === 'api' && !!w.token && !!w.phoneId; },
  async sendAPI(phone, text) {
    const w = this.cfg;
    const body = w.apiType === 'text'
      ? { messaging_product: 'whatsapp', to: phone, type: 'text', text: { preview_url: false, body: text } }
      : { messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: w.template, language: { code: w.lang || 'ar' }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\s*\n+\s*/g, ' — ').replace(/ {4,}/g, ' ').slice(0, 1000) }] }] } };
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(w.phoneId)}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + w.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) return { ok: false, err: (j.error && (j.error.error_user_msg || j.error.message)) || `خطأ ${r.status}` };
      return { ok: true, id: j.messages && j.messages[0] && j.messages[0].id };
    } catch { return { ok: false, err: 'تعذّر الاتصال بخادم واتساب، تحقق من الإنترنت' }; }
  },
  /* إرسال رسالة واحدة لزبون من داخل البرنامج */
  async send(c, text, ref = '') {
    const ph = intlPhone(c.phone); if (!ph) { toast('لا يوجد رقم هاتف لهذا الزبون', 'warn'); return false; }
    if (this.api()) {
      const r = await this.sendAPI(ph, text);
      logMessage(c, 'wa-api', text, ref, r.ok ? 'sent' : 'failed', r.err); saveDb();
      toast(r.ok ? `أُرسلت إلى ${c.name} عبر واتساب` : 'فشل الإرسال: ' + r.err, r.ok ? 'ok' : 'err', r.ok ? 3000 : 6000);
      return r.ok;
    }
    openLink(msgLink('wa', ph, text)); logMessage(c, 'wa', text, ref); saveDb(); toast('فُتحت محادثة واتساب والنص جاهز، اضغط إرسال');
    return true;
  }
};

/* ===================== محطة الماسح ===================== */
const ST = { mode: 'lookup', mult: 1, recv: [], count: {}, log: [], last: null, pending: null, sup: '' };
const Station = {
  handle(code) {
    code = String(code || '').trim(); if (!code) return;
    const inv = /^(INV|QUO)-(\d+)$/i.exec(code);
    if (inv && ST.mode === 'lookup') {
      const d = db.invoices.find(i => i.kind === (inv[1].toUpperCase() === 'INV' ? 'sale' : 'quote') && i.no === +inv[2]);
      if (d) { this.push(code, null, true, `فاتورة ${d.no}`); return viewInvoice(d.id); }
    }
    const m = db.materials.find(x => x.barcode === code);
    if (!m) { beep(320); ST.pending = code; this.push(code, null, false); return this.draw(); }
    beep(); ST.pending = null; ST.last = m.id;
    const q = Math.max(0.01, num(ST.mult) || 1);
    if (ST.mode === 'recv') { const l = ST.recv.find(x => x.mid === m.id); if (l) l.qty = round2(l.qty + q); else ST.recv.unshift({ mid: m.id, qty: q, cost: m.cost }); if (!ST.sup && m.supplierId) ST.sup = m.supplierId; }
    if (ST.mode === 'count') ST.count[m.id] = round2((ST.count[m.id] || 0) + q);
    this.push(code, m.id, true);
    this.draw();
  },
  push(code, mid, ok, label) { ST.log.unshift({ at: Date.now(), code, mid, ok, label, mode: ST.mode }); ST.log.length = Math.min(ST.log.length, 40); },
  focus() { setTimeout(() => { const i = $('#st-in'); if (i && !$('.modal-bg') && !(document.activeElement && document.activeElement.closest('#st-body input,#st-body select,#st-body textarea'))) i.focus(); }, 30); },
  draw() { const b = $('#st-body'); if (!b) return; b.innerHTML = stationBody(); $('#st-log').innerHTML = stationLog(); bindStation(); this.focus(); }
};
const MODES = { lookup: ['استعلام وبحث', 'search', 'امسح أي صنف لمعرفة سعره ومخزونه وموقعه، أو امسح باركود فاتورة لفتحها'], recv: ['إدخال أصناف / استلام', 'download', 'امسح الأصناف الواردة: كل مسحة تضيف الكمية، والصنف الجديد يُسجّل فوراً'], count: ['جرد بالماسح', 'layers', 'امسح الأصناف في المخزن لعدّها ومقارنتها برصيد النظام'] };
Views.scanner = {
  dim: () => 'جهاز الماسح جاهز · امسح في أي لحظة',
  render() {
    return `<div class="station">
      <div class="stack">
        <div class="scan-hero card marks">
          <div class="row" style="margin-bottom:14px"><div class="seg">${Object.entries(MODES).map(([k, [t, i]]) => `<button class="${ST.mode === k ? 'on' : ''}" data-act="stMode" data-m="${k}">${ICO(i).replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px;margin-left:5px"')}${t}</button>`).join('')}</div>
            <span class="spacer"></span><button class="btn" data-act="stCam">${ICO('camera')} مسح متواصل بالكاميرا</button></div>
          <div class="scan-field"><div class="laser"></div>${ICO('scan')}<input id="st-in" class="mono" placeholder="امسح الباركود هنا…" autocomplete="off" dir="ltr">
            ${ST.mode !== 'lookup' ? `<label class="mult">الكمية لكل مسحة <input id="st-mult" class="inp sm num" value="${ST.mult}" inputmode="decimal"></label>` : ''}</div>
          <p class="muted" style="margin:10px 2px 0;font-size:13px">${MODES[ST.mode][2]}. يمكن أيضاً كتابة الباركود يدوياً ثم Enter.</p>
        </div>
        <div id="st-body">${stationBody()}</div>
      </div>
      <div class="card"><div class="card-h"><h3>سجل المسح</h3><button class="btn xs ghost" data-act="stClearLog">مسح السجل</button></div><div id="st-log">${stationLog()}</div></div>
    </div>`;
  },
  after() {
    const i = $('#st-in');
    i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = i.value; i.value = ''; Station.handle(v); } });
    const mu = $('#st-mult'); if (mu) mu.addEventListener('input', () => { ST.mult = mu.value; });
    bindStation(); Station.focus();
  }
};
function stationLog() {
  return ST.log.length ? `<div class="list">${ST.log.map(l => { const m = l.mid && matById(l.mid); return `<div class="li"><div class="l-ico" style="${l.ok ? 'color:var(--ok)' : 'color:var(--danger)'}">${ICO(l.ok ? 'check' : 'warn')}</div>
    <div class="l-main"><b>${esc(l.label || (m ? m.name : 'غير مسجل'))}</b><span class="mono">${esc(l.code)}</span></div><div class="l-end t-sub">${pad(new Date(l.at).getHours())}:${pad(new Date(l.at).getMinutes())}:${pad(new Date(l.at).getSeconds())}</div></div>`; }).join('')}</div>`
    : `<div class="empty">${ICO('scan')}<b>بانتظار أول مسحة</b>وصّل جهاز الماسح (USB أو بلوتوث) وامسح مباشرة</div>`;
}
function registerForm(code) {
  const cats = [...new Set([...db.categories, ...db.materials.map(x => x.cat)])];
  return `<div class="card" style="border-color:var(--brass)"><div class="card-h"><h3>${ICO('plus')} تسجيل صنف جديد <span class="tag mono">${esc(code)}</span></h3><button class="btn xs ghost" data-act="stCancel">تجاهل</button></div>
    <div class="card-b" id="st-reg"><div class="row" style="margin-bottom:14px;flex-wrap:nowrap"><div style="width:180px">${barcodeSVG(code, { h: 34 })}</div><p class="muted" style="margin:0;font-size:13px">هذا الباركود غير موجود في النظام. أدخل بيانات الصنف واحفظها، ثم تُكمل المسح مباشرة${ST.mode === 'recv' ? ' ويُضاف الصنف إلى قائمة الاستلام' : ''}.</p></div>
      <div class="form-grid c3"><div class="field" style="grid-column:span 2"><label>اسم الصنف والمواصفة</label><input class="inp" name="name" autofocus></div>
      <div class="field"><label>الماركة</label><input class="inp" name="brand" value="${esc(ST.lastBrand || '')}"></div><div class="field"><label>الموديل</label><input class="inp mono" name="model" dir="ltr"></div><div class="field"><label>المقاس</label><input class="inp" name="size"></div>
      <div class="field"><label>الصنف</label><input class="inp" name="cat" list="st-cats" value="${esc(ST.lastCat || db.categories[0])}"><datalist id="st-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label>الوحدة</label><input class="inp" name="unit" list="st-units" value="${esc(ST.lastUnit || 'كيس')}"><datalist id="st-units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist></div>
      ${can('cost') ? `<div class="field"><label>الكلفة</label><input class="inp num" name="cost" inputmode="decimal"></div>` : ''}
      <div class="field"><label>سعر المفرد</label><input class="inp num" name="price" inputmode="decimal"></div><div class="field"><label>سعر الجملة</label><input class="inp num" name="wprice" inputmode="decimal"></div>
      ${ST.mode === 'recv' ? '' : `<div class="field"><label>الرصيد الحالي</label><input class="inp num" name="stock" inputmode="decimal"></div>`}
      <div class="field"><label>حد إعادة الطلب</label><input class="inp num" name="min" inputmode="decimal"></div><div class="field"><label>موقع الخزن</label><input class="inp" name="loc"></div></div>
      <div class="row" style="margin-top:14px"><button class="btn pri" data-act="stSaveNew">${ICO('check')} حفظ ومتابعة المسح</button></div></div></div>`;
}
function stationBody() {
  if (ST.pending) return registerForm(ST.pending);
  if (ST.mode === 'lookup') {
    const m = ST.last && matById(ST.last);
    if (!m) return `<div class="card"><div class="empty" style="padding:50px 20px">${ICO('search')}<b>امسح صنفاً لعرض بطاقته</b>السعر، المخزون، الموقع، آخر الحركات</div></div>`;
    const st = stockState(m), mv = db.movements.filter(x => x.mid === m.id).slice(0, 5);
    return `<div class="card marks"><div class="card-b"><div class="look">
      <div><div class="t-sub">${esc(m.cat)} · ${esc(m.loc || 'بدون موقع')}</div><h2 class="look-name">${esc(m.name)}</h2><div style="width:220px;margin-top:6px">${barcodeSVG(m.barcode, { h: 36 })}</div></div>
      <div class="look-nums"><div><span>سعر المفرد</span><b>${money(m.price)}</b></div><div><span>سعر الجملة</span><b>${money(m.wprice)}</b></div>
        <div><span>المخزون</span><b class="${st === 'low' || st === 'out' ? 'danger-t' : ''}">${fmt(m.stock)} <small>${esc(m.unit)}</small></b></div>${can('cost') ? `<div><span>الكلفة</span><b>${money(m.cost)}</b></div>` : ''}</div></div>
      <div class="row" style="margin-top:14px">${can('pos') ? `<button class="btn pri" data-act="stSell" data-id="${m.id}">${ICO('pos')} إضافة إلى فاتورة</button>` : ''}${can('materials') ? `<button class="btn" data-act="editMat" data-id="${m.id}">${ICO('edit')} تعديل</button><button class="btn" data-act="adjStock" data-id="${m.id}">${ICO('swap')} تسوية</button>` : ''}</div></div>
      ${mv.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>آخر الحركات</th><th>المرجع</th><th class="n">الكمية</th><th class="n">الرصيد</th></tr></thead><tbody>${mv.map(x => `<tr><td class="t-sub">${ftime(x.at)} · ${esc(x.note)}</td><td class="mono">${esc(x.ref)}</td><td class="n ${x.qty > 0 ? 'ok-t' : 'danger-t'}">${x.qty > 0 ? '+' : ''}${fmt(x.qty)}</td><td class="n">${fmt(x.after)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  }
  if (ST.mode === 'recv') {
    const total = ST.recv.reduce((s, l) => s + l.qty * l.cost, 0);
    return `<div class="card"><div class="card-h"><h3>قائمة الاستلام <span class="tag">${ST.recv.length} صنف</span></h3>${ST.recv.length ? `<button class="btn xs ghost" data-act="stReset">تفريغ</button>` : ''}</div>
      ${ST.recv.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th>الرصيد الحالي</th><th style="width:130px">الكمية المستلمة</th>${can('cost') ? '<th style="width:140px">كلفة الوحدة</th><th class="n">المبلغ</th>' : ''}<th></th></tr></thead><tbody>
        ${ST.recv.map((l, i) => { const m = matById(l.mid); return `<tr><td class="t-main">${esc(m.name)}<div class="t-sub mono">${esc(m.barcode)}</div></td><td class="num">${fmt(m.stock)} ${esc(m.unit)}</td>
          <td><input class="inp sm num" data-rq="${i}" value="${l.qty}" inputmode="decimal"></td>${can('cost') ? `<td><input class="inp sm num" data-rc="${i}" value="${l.cost}" inputmode="decimal"></td><td class="n">${fmt(l.qty * l.cost)}</td>` : ''}
          <td><button class="btn xs icon ghost" data-act="stDel" data-i="${i}">${ICO('x')}</button></td></tr>`; }).join('')}</tbody></table></div>
        <div class="card-b" style="border-top:1px solid var(--line)"><div class="form-grid c3"><div class="field"><label>المورد (لفاتورة الشراء)</label><select class="sel" id="st-sup"><option value="">—</option>${db.suppliers.map(s => `<option value="${s.id}" ${s.id === ST.sup ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
          <div class="field"><label>رقم فاتورة المورد</label><input class="inp" id="st-ref"></div>${can('cost') ? `<div class="field"><label>الإجمالي</label><div class="inp" style="display:flex;align-items:center;font-weight:600">${moneyT(total)}</div></div>` : ''}</div>
          <div class="row" style="margin-top:14px">${can('purchases') ? `<button class="btn pri" data-act="stRecvPur">${ICO('cart')} حفظ كفاتورة شراء</button>` : ''}<button class="btn" data-act="stRecvIn">${ICO('download')} إدخال مخزني بدون فاتورة</button></div></div>`
        : `<div class="empty" style="padding:40px 20px">${ICO('download')}<b>امسح الأصناف الواردة</b>كل مسحة تضيف ${fmt(num(ST.mult) || 1)} إلى الكمية</div>`}</div>`;
  }
  const ids = Object.keys(ST.count), diffs = ids.map(id => ({ m: matById(id), c: ST.count[id] })).filter(x => x.m);
  return `<div class="card"><div class="card-h"><h3>نتيجة الجرد <span class="tag">${diffs.length} صنف</span></h3>${diffs.length ? `<button class="btn xs ghost" data-act="stReset">تفريغ</button>` : ''}</div>
    ${diffs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th class="n">رصيد النظام</th><th style="width:130px">المعدود</th><th class="n">الفرق</th></tr></thead><tbody>
      ${diffs.map(({ m, c }) => { const d = round2(c - m.stock); return `<tr><td class="t-main">${esc(m.name)}<div class="t-sub">${esc(m.loc || '')}</div></td><td class="n">${fmt(m.stock)} ${esc(m.unit)}</td><td><input class="inp sm num" data-cq="${m.id}" value="${c}" inputmode="decimal"></td>
        <td class="n"><b class="${d > 0 ? 'ok-t' : d < 0 ? 'danger-t' : 'muted'}">${d > 0 ? '+' : ''}${fmt(d)}</b></td></tr>`; }).join('')}</tbody></table></div>
      <div class="card-b" style="border-top:1px solid var(--line)"><button class="btn pri" data-act="stApplyCount">${ICO('check')} اعتماد الجرد وتسوية الفروقات</button><span class="muted" style="font-size:12.5px;margin-inline-start:10px">تُسوّى الأصناف الممسوحة فقط</span></div>`
      : `<div class="empty" style="padding:40px 20px">${ICO('layers')}<b>ابدأ الجرد</b>امسح كل قطعة، أو حدّد الكمية لكل مسحة (مثلاً 50 لكل رزمة)</div>`}</div>`;
}
function bindStation() {
  $$('[data-rq]').forEach(el => el.addEventListener('change', () => { ST.recv[+el.dataset.rq].qty = Math.max(0, num(el.value)); setTimeout(() => Station.draw()); }));
  $$('[data-rc]').forEach(el => el.addEventListener('change', () => { ST.recv[+el.dataset.rc].cost = Math.max(0, num(el.value)); setTimeout(() => Station.draw()); }));
  $$('[data-cq]').forEach(el => el.addEventListener('change', () => { ST.count[el.dataset.cq] = Math.max(0, num(el.value)); setTimeout(() => Station.draw()); }));
  const s = $('#st-sup'); if (s) s.onchange = () => { ST.sup = s.value; };
  const reg = $('#st-reg'); if (reg) { reg.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ACTS.stSaveNew(); } }); setTimeout(() => { const n = $('[name=name]', reg); n && n.focus(); }, 40); }
}
function createMaterial(v, stock = 0) {
  const rec = { brand: v.brand || '', model: v.model || '', size: v.size || '', power: 'يدوية', warranty: 0, serialTracked: false, specs: [], acc: [], desc: '', id: uid(), name: v.name, cat: v.cat || 'عام', unit: v.unit || 'قطعة', barcode: v.barcode, cost: num(v.cost), price: num(v.price), wprice: num(v.wprice) || num(v.price), stock: 0, min: num(v.min), supplierId: v.supplierId || null, loc: v.loc || '', created: Date.now() };
  db.materials.push(rec); if (rec.cat && !db.categories.includes(rec.cat)) db.categories.push(rec.cat);
  if (stock) moveStock(rec.id, stock, 'رصيد افتتاحي', 'افتتاحي');
  logAct('إضافة صنف', rec.name); return rec;
}
Object.assign(ACTS, {
  stMode: el => { ST.mode = el.dataset.m; ST.pending = null; Shell.refresh(); },
  stCam: () => Scanner.camera(c => Station.handle(c), { continuous: true, title: 'مسح متواصل — ' + MODES[ST.mode][0] }),
  stClearLog: () => { ST.log = []; Station.draw(); },
  stCancel: () => { ST.pending = null; Station.draw(); },
  stReset: async () => { if (await confirmBox('تفريغ القائمة الحالية؟', { ok: 'تفريغ', danger: true })) { if (ST.mode === 'recv') ST.recv = []; else { ST.count = {}; ST.cs = null; } Station.draw(); } },
  stDel: el => { ST.recv.splice(+el.dataset.i, 1); Station.draw(); },
  stSell: el => { Shell.go('pos'); posAdd(el.dataset.id); },
  stSaveNew: () => {
    const f = $('#st-reg'); if (!f || !ST.pending) return;
    if (!can('materials') && !can('scanner')) return;
    if (!License.activated && db.materials.length >= APP.trialLimit) { toast(`النسخة التجريبية تسمح بـ ${APP.trialLimit} صنف فقط`, 'warn', 5000); return activateModal(); }
    const v = formVals(f); if (!v.name) return toast('أدخل اسم الصنف', 'warn');
    if (/[^\x20-\x7e]/.test(ST.pending)) return toast('الباركود يقبل الأرقام والحروف الإنجليزية فقط', 'warn');
    ST.lastCat = v.cat; ST.lastUnit = v.unit; ST.lastBrand = v.brand;
    const code = ST.pending; createMaterial({ ...v, barcode: code }, num(v.stock)); saveDb();
    ST.pending = null; toast('سُجّل الصنف'); Station.handle(code); Shell.nav();
  },
  stRecvIn: async () => {
    const ls = ST.recv.filter(l => l.qty > 0); if (!ls.length) return;
    if (!await confirmBox(`إدخال ${ls.length} صنف إلى المخزن بدون فاتورة شراء؟`, { ok: 'إدخال' })) return;
    ls.forEach(l => moveStock(l.mid, l.qty, 'استلام بالماسح', 'إدخال مخزني'));
    logAct('إدخال مخزني بالماسح', `${ls.length} صنف`); ST.recv = []; ST.sup = ''; saveDb(); toast('أُدخلت الكميات إلى المخزن'); Shell.refresh();
  },
  stRecvPur: () => {
    const ls = ST.recv.filter(l => l.qty > 0); if (!ls.length) return;
    if (!ST.sup) return toast('اختر المورد لإنشاء فاتورة الشراء', 'warn');
    const p = createPurchase({ supplierId: ST.sup, ref: ($('#st-ref') || {}).value || '', lines: ls.map(l => ({ mid: l.mid, qty: l.qty, cost: l.cost })), paid: 0, updCost: true });
    ST.recv = []; ST.sup = ''; saveDb(); toast(`فاتورة الشراء ${p.no} محفوظة (آجلة)، يمكنك تسديدها من الموردين`); Shell.refresh();
  },
  stApplyCount: async () => {
    const ch = Object.entries(ST.count).map(([id, c]) => ({ m: matById(id), d: 0, c })).filter(x => x.m).map(x => ({ ...x, d: round2(x.c - x.m.stock) })).filter(x => x.d);
    if (!ch.length) { toast('لا توجد فروقات، الجرد مطابق'); ST.count = {}; return Station.draw(); }
    if (!await confirmBox(`سيتم تسوية ${ch.length} صنف حسب الجرد. متابعة؟`, { ok: 'اعتماد' })) return;
    ch.forEach(x => moveStock(x.m.id, x.d, 'جرد بالماسح', 'جرد'));
    logAct('اعتماد جرد بالماسح', `${ch.length} فرق`); ST.count = {}; ST.cs = null; saveDb(); toast('اعتُمد الجرد'); Shell.refresh();
  }
});

/* ===================== المحادثات الداخلية + محادثات واتساب مع الزبائن ===================== */
const ChatF = { conv: 'all', q: '' };
const teamThread = conv => {
  const me = Session.user.id;
  if (conv === 'all') return db.notices.filter(n => n.to === 'all');
  const u = conv.slice(2); return db.notices.filter(n => (n.from === me && n.to === u) || (n.from === u && n.to === me));
};
const unreadIn = conv => teamThread(conv).filter(n => n.from !== Session.user.id && !n.readBy.includes(Session.user.id)).length;
function refChip(r) {
  if (!r) return '';
  if (r.type === 'invoice') { const i = byId('invoices', r.id); return i ? `<button class="ref" data-act="viewInv" data-id="${i.id}">${ICO('inv')}<span>${i.kind === 'quote' ? 'عرض سعر' : 'فاتورة'} رقم ${i.no}<small>${esc(custName(i.customerId))} · ${moneyT(i.total)}</small></span></button>` : ''; }
  if (r.type === 'customer') { const c = custById(r.id); return c ? `<button class="ref" data-act="stmt" data-id="${c.id}">${ICO('helmet')}<span>${esc(c.name)}<small>الرصيد ${moneyT(custBalance(c.id))}</small></span></button>` : ''; }
  if (r.type === 'material') { const m = matById(r.id); return m ? `<button class="ref" data-act="refMat" data-id="${m.id}">${ICO('box')}<span>${esc(m.name)}<small>${fmt(m.stock)} ${esc(m.unit)} · ${moneyT(m.price)}</small></span></button>` : ''; }
  return '';
}
const linkify = t => esc(t).replace(/\n/g, '<br>');
Views.chat = {
  dim: () => 'تواصل الفريق داخل البرنامج، ومحادثات واتساب مع الزبائن',
  render() {
    const me = Session.user.id, conv = ChatF.conv;
    const users = db.users.filter(u => u.id !== me && u.active !== false);
    const lastOf = arr => arr.slice().sort((a, b) => b.at - a.at)[0];
    const item = (key, name, sub, unread, ico) => `<button class="conv ${conv === key ? 'on' : ''}" data-act="chatOpen" data-c="${key}"><span class="avatar sm">${ico}</span><span class="cv-main"><b>${esc(name)}</b><span>${esc(sub || '')}</span></span>${unread ? `<span class="count">${unread}</span>` : ''}</button>`;
    const q = ChatF.q.toLowerCase();
    const custs = db.customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)).map(c => ({ c, last: lastOf(db.messages.filter(m => m.partyId === c.id)) })).sort((a, b) => (b.last ? b.last.at : 0) - (a.last ? a.last.at : 0)).slice(0, 40);
    const la = lastOf(teamThread('all'));
    return `<div class="chat card">
      <aside class="chat-list">
        <div class="cl-sec">الفريق</div>
        ${item('all', 'المجموعة العامة', la ? `${userName(la.from).split(' ')[0]}: ${la.text}` : 'كل المستخدمين', unreadIn('all'), ICO('users'))}
        ${users.map(u => { const l = lastOf(teamThread('u:' + u.id)); return item('u:' + u.id, u.name, l ? l.text : (ROLES[u.role] || {}).name, unreadIn('u:' + u.id), esc(initial(u.name))); }).join('')}
        <div class="cl-sec">واتساب الزبائن ${WA.api() ? '<span class="chip ok plain" style="font-size:10.5px">مباشر</span>' : ''}</div>
        <div style="padding:0 10px 8px"><input class="inp sm" id="chat-q" placeholder="بحث عن زبون" value="${esc(ChatF.q)}"></div>
        ${custs.map(({ c, last }) => item('c:' + c.id, c.name, last ? last.text : c.phone || 'لا يوجد رقم', 0, ICO('wa'))).join('')}
      </aside>
      <section class="chat-main">${conv.startsWith('c:') ? custThreadHTML(conv.slice(2)) : teamThreadHTML(conv)}</section>
    </div>`;
  },
  after() {
    if (!ChatF.conv.startsWith('c:')) { let ch = false; teamThread(ChatF.conv).forEach(n => { if (!n.readBy.includes(Session.user.id)) { n.readBy.push(Session.user.id); ch = true; } }); if (ch) { saveDb(); Shell.nav(); Shell.top(); } }
    const box = $('.chat-msgs'); if (box) box.scrollTop = box.scrollHeight;
    const ta = $('#chat-in');
    if (ta) {
      const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
      ta.addEventListener('input', fit);
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ACTS.chatSend(); } });
      setTimeout(() => ta.focus(), 30);
    }
    const q = $('#chat-q'); if (q) q.addEventListener('input', debounce(() => { ChatF.q = q.value.trim(); Shell.refresh(); const n = $('#chat-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
  }
};
function teamThreadHTML(conv) {
  const me = Session.user.id, msgs = teamThread(conv).slice().sort((a, b) => a.at - b.at);
  const u = conv.startsWith('u:') && userById(conv.slice(2));
  let lastDay = '';
  return `<div class="chat-h"><span class="avatar sm">${conv === 'all' ? ICO('users') : esc(initial(u ? u.name : '?'))}</span><div style="flex:1;line-height:1.3"><b>${conv === 'all' ? 'المجموعة العامة' : esc(u ? u.name : 'مستخدم')}</b><div class="t-sub">${conv === 'all' ? `${db.users.length} مستخدم` : esc(u ? (ROLES[u.role] || {}).name || '' : '')}</div></div></div>
    <div class="chat-msgs">${msgs.map(n => { const d = dstr(new Date(n.at)), sep = d !== lastDay ? `<div class="day-sep"><span>${fdate(d)}</span></div>` : ''; lastDay = d; const mine = n.from === me;
      return `${sep}<div class="bub ${mine ? 'me' : ''}">${!mine && conv === 'all' ? `<b class="who">${esc(userName(n.from))}</b>` : ''}${n.text ? `<div>${linkify(n.text)}</div>` : ''}${refChip(n.ref)}<span class="tm">${pad(new Date(n.at).getHours())}:${pad(new Date(n.at).getMinutes())}${mine && conv !== 'all' ? ` ${n.readBy.includes(conv.slice(2)) ? '<i class="seen">✓✓</i>' : '✓'}` : ''}</span></div>`; }).join('') || `<div class="empty">${ICO('msg')}<b>ابدأ المحادثة</b>أرسل رسالة، أو أرفق فاتورة أو زبوناً أو صنفاً</div>`}</div>
    <div class="chat-in">${ChatF.ref ? `<div class="ref-pend">${refChip(ChatF.ref)}<button class="btn xs icon ghost" data-act="chatUnref">${ICO('x')}</button></div>` : ''}
      <div class="row" style="flex-wrap:nowrap;align-items:flex-end"><button class="btn icon" data-act="chatAttach" title="إرفاق فاتورة أو زبون أو صنف">${ICO('plus')}</button>
      <textarea id="chat-in" class="txt" rows="1" placeholder="اكتب رسالة… (Enter للإرسال، Shift+Enter لسطر جديد)"></textarea><button class="btn pri icon" data-act="chatSend" title="إرسال" style="width:42px;height:42px">${ICO('send')}</button></div></div>`;
}
function custThreadHTML(cid) {
  const c = custById(cid); if (!c) return '';
  const msgs = db.messages.filter(m => m.partyId === cid).slice().sort((a, b) => a.at - b.at), r = partyRow(c);
  let lastDay = '';
  const st = m => m.channel === 'wa-api' ? (m.status === 'failed' ? `<i class="danger-t" title="${esc(m.err || '')}">فشل</i>` : '<i class="seen">✓✓</i>') : m.channel === 'wa' ? '✓ فُتح في واتساب' : esc(CH_NAME[m.channel] || m.channel);
  return `<div class="chat-h"><span class="avatar sm" style="background:#25d366;color:#fff">${ICO('wa')}</span><div style="flex:1;line-height:1.3"><b>${esc(c.name)}</b><div class="t-sub"><bdi dir="ltr">${esc(c.phone || 'لا يوجد رقم')}</bdi> · الرصيد <b class="${r.amount ? 'danger-t' : ''}">${moneyT(r.amount)}</b></div></div>
      <button class="btn xs" data-act="stmt" data-id="${c.id}">${ICO('doc')} كشف</button>${can('payments') && r.amount ? `<button class="btn xs" data-act="custPay" data-id="${c.id}">${ICO('cash')} قبض</button>` : ''}</div>
    <div class="chat-msgs wa-bg">${msgs.map(m => { const d = dstr(new Date(m.at)), sep = d !== lastDay ? `<div class="day-sep"><span>${fdate(d)}</span></div>` : ''; lastDay = d;
      return `${sep}<div class="bub me wa">${linkify(m.text)}<span class="tm">${esc(userName(m.user).split(' ')[0])} · ${pad(new Date(m.at).getHours())}:${pad(new Date(m.at).getMinutes())} ${st(m)}</span></div>`; }).join('') || `<div class="empty">${ICO('wa')}<b>لا توجد رسائل مع هذا الزبون</b>اختر قالباً جاهزاً أو اكتب رسالة</div>`}</div>
    <div class="chat-in"><div class="row" style="gap:6px;margin-bottom:8px">${[['due', 'تذكير بالمستحق'], ['overdue', 'إشعار تأخير'], ['thanks', 'شكر ورصيد']].map(([k, t]) => `<button class="btn xs" data-act="chatTpl" data-k="${k}">${t}</button>`).join('')}<span class="spacer"></span><span class="t-sub">${WA.api() ? 'يُرسل مباشرة من البرنامج عبر واتساب للأعمال' : 'يفتح واتساب والنص جاهز · فعّل الإرسال المباشر من الإعدادات'}</span></div>
      <div class="row" style="flex-wrap:nowrap;align-items:flex-end"><textarea id="chat-in" class="txt" rows="1" placeholder="رسالة واتساب إلى ${esc(c.name)}…"></textarea><button class="btn icon" data-act="chatSend" title="إرسال" style="width:42px;height:42px;background:#25d366;border-color:#25d366;color:#fff">${ICO('send')}</button></div></div>`;
}
function pickRef(cb) {
  const m = modal({
    title: 'إرفاق في المحادثة', size: 'narrow',
    body: `<div class="seg" style="margin-bottom:12px"><button class="on" data-t="invoice">فاتورة</button><button data-t="customer">زبون</button><button data-t="material">صنف</button></div><input class="inp" id="pr-q" placeholder="بحث…"><div class="list" id="pr-l" style="max-height:44vh;overflow-y:auto;margin-top:8px"></div>`
  });
  let t = 'invoice';
  const draw = () => {
    const q = $('#pr-q', m.el).value.trim().toLowerCase();
    const rows = t === 'invoice' ? db.invoices.filter(i => !q || String(i.no) === q || custName(i.customerId).toLowerCase().includes(q)).slice(0, 30).map(i => [i.id, `${i.kind === 'quote' ? 'عرض' : 'فاتورة'} ${i.no} — ${custName(i.customerId)}`, moneyT(i.total)])
      : t === 'customer' ? db.customers.filter(c => !q || c.name.toLowerCase().includes(q)).slice(0, 30).map(c => [c.id, c.name, moneyT(custBalance(c.id))])
        : db.materials.filter(x => !q || x.name.toLowerCase().includes(q) || x.barcode === q).slice(0, 30).map(x => [x.id, x.name, `${fmt(x.stock)} ${x.unit}`]);
    $('#pr-l', m.el).innerHTML = rows.map(([id, a, b]) => `<div class="li" style="cursor:pointer" data-pid="${id}"><div class="l-main"><b>${esc(a)}</b></div><div class="l-end t-sub">${esc(b)}</div></div>`).join('') || '<div class="empty">لا نتائج</div>';
    $$('[data-pid]', m.el).forEach(el => el.onclick = () => { m.close(); cb({ type: t, id: el.dataset.pid }); });
  };
  $$('[data-t]', m.el).forEach(b => b.onclick = () => { t = b.dataset.t; $$('[data-t]', m.el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#pr-q', m.el).addEventListener('input', draw);
  Scanner.hook = code => { const x = db.materials.find(y => y.barcode === code); if (x) { m.close(); cb({ type: 'material', id: x.id }); } };
  const oc = m.onClose; m.onClose = () => { Scanner.hook = null; oc && oc(); };
  draw();
}
Object.assign(ACTS, {
  chatOpen: el => { ChatF.conv = el.dataset.c; ChatF.ref = null; Shell.refresh(); },
  chatAttach: () => pickRef(r => { ChatF.ref = r; const t = $('#chat-in') ? $('#chat-in').value : ''; Shell.refresh(); if ($('#chat-in')) $('#chat-in').value = t; }),
  chatUnref: () => { ChatF.ref = null; Shell.refresh(); },
  refMat: el => quickMaterial(matById(el.dataset.id)),
  chatTpl: el => { const c = custById(ChatF.conv.slice(2)); const ta = $('#chat-in'); ta.value = fillTemplate(db.settings.templates[el.dataset.k], partyRow(c)); ta.dispatchEvent(new Event('input')); ta.focus(); },
  chatSend: async () => {
    const ta = $('#chat-in'); if (!ta) return; const text = ta.value.trim();
    if (ChatF.conv.startsWith('c:')) {
      if (!text) return; const c = custById(ChatF.conv.slice(2));
      ta.disabled = true; const ok = await WA.send(c, text, 'محادثة'); ta.disabled = false;
      if (ok) { Shell.refresh(); }
      return;
    }
    if (!text && !ChatF.ref) return;
    const to = ChatF.conv === 'all' ? 'all' : ChatF.conv.slice(2);
    db.notices.push({ id: uid(), at: Date.now(), from: Session.user.id, to, text, ref: ChatF.ref || null, readBy: [Session.user.id] });
    ChatF.ref = null; saveDb(); Shell.refresh();
  },
  shareChat: (el) => { ChatF.ref = { type: el.dataset.t, id: el.dataset.id }; ChatF.conv = ChatF.conv.startsWith('c:') ? 'all' : ChatF.conv; $$('.modal-bg').forEach(x => x.remove()); Shell.go('chat'); }
});
function composeNotice(to = 'all') { ChatF.conv = to === 'all' ? 'all' : 'u:' + to; Shell.go('chat'); }

/* ===================== الصندوق اليومي والمصروفات ===================== */
const EXP_CATS = ['رواتب', 'إيجار', 'وقود ونقل', 'كهرباء ومولدة', 'صيانة', 'ضيافة', 'تحميل وتنزيل', 'أخرى'];
const CashF = { tab: 'day', date: today(), month: today().slice(0, 7) };
function cashDay(d) {
  const isCash = p => p.method === 'نقدي';
  const ins = db.payments.filter(p => p.date === d && p.type === 'in' && isCash(p));
  const outs = db.payments.filter(p => p.date === d && p.type === 'out' && isCash(p));
  const exps = db.expenses.filter(e => e.date === d);
  const prev = db.closings.filter(c => c.date < d).sort((a, b) => b.date.localeCompare(a.date))[0];
  const opening = prev ? prev.actual : 0;
  const tin = ins.reduce((s, p) => s + p.amount, 0), tout = outs.reduce((s, p) => s + p.amount, 0) + exps.reduce((s, e) => s + e.amount, 0);
  return { ins, outs, exps, opening, prev, tin, tout, expected: round2(opening + tin - tout), closing: db.closings.find(c => c.date === d) };
}
Views.cashbox = {
  dim: () => 'حركة النقد اليومية، المصروفات، وإغلاق الصندوق',
  render() {
    const tabs = `<div class="tabs">${[['day', 'الصندوق اليومي'], ['exp', 'المصروفات'], ['close', 'سجل الإغلاقات']].map(([k, t]) => `<button class="${CashF.tab === k ? 'on' : ''}" data-act="cashTab" data-t="${k}">${t}</button>`).join('')}</div>`;
    if (CashF.tab === 'exp') {
      const list = db.expenses.filter(e => e.date.startsWith(CashF.month)), tot = list.reduce((s, e) => s + e.amount, 0);
      const byCat = {}; list.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.amount);
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...cats.map(c => c[1]));
      return tabs + `<div class="toolbar"><input type="month" class="inp" style="width:auto" id="cash-m" value="${CashF.month}"><span class="chip brass plain">مجموع الشهر: ${moneyT(tot)}</span><span class="spacer"></span>
        <button class="btn" data-act="expCsv">${ICO('sheet')} تصدير Excel</button><button class="btn pri" data-act="newExpense">${ICO('plus')} مصروف جديد</button></div>
        <div class="grid g-side"><div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>التاريخ</th><th>البند</th><th>البيان</th><th class="n">المبلغ</th><th>المستخدم</th><th></th></tr></thead><tbody>
          ${list.map(e => `<tr><td>${fdate(e.date)}</td><td><span class="chip plain">${esc(e.cat)}</span></td><td class="t-sub">${esc(e.note)}</td><td class="n"><b>${fmt(e.amount)}</b></td><td class="t-sub">${esc(userName(e.user))}</td><td>${can('void') ? `<button class="btn xs icon dan" data-act="delExp" data-id="${e.id}">${ICO('trash')}</button>` : ''}</td></tr>`).join('')}</tbody></table>${list.length ? '' : emptyHTML('wallet', 'لا توجد مصروفات في هذا الشهر')}</div></div>
          <div class="card"><div class="card-h"><h3>حسب البند</h3></div><div class="card-b"><div class="hbars">${cats.map(([c, v]) => `<div class="hbar"><span>${esc(c)}</span><div class="tr"><i style="width:${v / mx * 100}%;background:var(--brass)"></i></div><span class="v">${fmt(v)}</span></div>`).join('') || '<p class="muted">—</p>'}</div></div></div></div>`;
    }
    if (CashF.tab === 'close') {
      const list = db.closings.slice().sort((a, b) => b.date.localeCompare(a.date));
      return tabs + `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>اليوم</th><th class="n">الافتتاحي</th><th class="n">المقبوض</th><th class="n">المدفوع</th><th class="n">المتوقع</th><th class="n">الفعلي</th><th class="n">الفرق</th><th>أغلقه</th></tr></thead><tbody>
        ${list.map(c => `<tr><td>${fdate(c.date)}</td><td class="n">${fmt(c.opening)}</td><td class="n ok-t">${fmt(c.tin)}</td><td class="n danger-t">${fmt(c.tout)}</td><td class="n">${fmt(c.expected)}</td><td class="n"><b>${fmt(c.actual)}</b></td><td class="n ${c.diff < 0 ? 'danger-t' : c.diff > 0 ? 'ok-t' : 'muted'}">${fmt(c.diff)}</td><td class="t-sub">${esc(userName(c.user))}</td></tr>`).join('')}</tbody></table>${list.length ? '' : emptyHTML('wallet', 'لم يُغلق الصندوق بعد')}</div></div>`;
    }
    const D = cashDay(CashF.date), rows = [
      ...D.ins.map(p => ({ at: p.at, t: `سند قبض ${p.no}`, w: custName(p.partyId), v: p.amount })),
      ...D.outs.map(p => ({ at: p.at, t: `سند صرف ${p.no}`, w: p.party === 's' ? supName(p.partyId) : custName(p.partyId), v: -p.amount })),
      ...D.exps.map(e => ({ at: e.at, t: `مصروف: ${e.cat}`, w: e.note, v: -e.amount }))].sort((a, b) => a.at - b.at);
    const c = D.closing;
    return tabs + `<div class="toolbar"><input type="date" class="inp" style="width:auto" id="cash-d" value="${CashF.date}">${c ? '<span class="chip ok">الصندوق مغلق لهذا اليوم</span>' : ''}<span class="spacer"></span><button class="btn" data-act="newExpense">${ICO('wallet')} مصروف</button>${can('payments') ? `<button class="btn" data-act="newReceipt">${ICO('cash')} سند قبض</button>` : ''}</div>
      <div class="grid g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="k-top"><span class="k-ico">${ICO('wallet')}</span>الرصيد الافتتاحي</div><div class="k-val num">${money(D.opening)}</div><div class="k-sub">${D.prev ? `من إغلاق ${fdate(D.prev.date)}` : 'لا يوجد إغلاق سابق'}</div></div>
        <div class="card kpi"><div class="k-top"><span class="k-ico">${ICO('download')}</span>المقبوض نقداً</div><div class="k-val num ok-t">${money(D.tin)}</div><div class="k-sub">${D.ins.length} سند</div></div>
        <div class="card kpi danger"><div class="k-top"><span class="k-ico">${ICO('upload')}</span>المدفوع والمصروفات</div><div class="k-val num">${money(D.tout)}</div><div class="k-sub">${D.outs.length} سند · ${D.exps.length} مصروف</div></div>
        <div class="card kpi brass"><div class="k-top"><span class="k-ico">${ICO('cash')}</span>المتوقع في الصندوق</div><div class="k-val num">${money(D.expected)}</div><div class="k-sub">${c ? `الفعلي ${moneyT(c.actual)}` : 'قبل الإغلاق'}</div></div></div>
      <div class="grid g-side"><div class="card"><div class="card-h"><h3>حركة النقد</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>الحركة</th><th>الجهة / البيان</th><th class="n">المبلغ</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td class="t-sub">${pad(new Date(r.at).getHours())}:${pad(new Date(r.at).getMinutes())}</td><td>${esc(r.t)}</td><td class="t-sub">${esc(r.w || '')}</td><td class="n ${r.v < 0 ? 'danger-t' : 'ok-t'}"><b>${r.v > 0 ? '+' : ''}${fmt(r.v)}</b></td></tr>`).join('')}</tbody></table>${rows.length ? '' : emptyHTML('wallet', 'لا توجد حركة نقدية في هذا اليوم')}</div></div>
        <div class="card marks"><div class="card-h"><h3>${ICO('lock')} إغلاق الصندوق</h3></div><div class="card-b">${c
          ? `<div class="stat-line" style="padding:0 0 12px;border:0"><div><span>الفعلي</span><b>${fmt(c.actual)}</b></div><div><span>الفرق</span><b class="${c.diff < 0 ? 'danger-t' : c.diff > 0 ? 'ok-t' : ''}">${fmt(c.diff)}</b></div></div><p class="t-sub">أغلقه ${esc(userName(c.user))} · ${ftime(c.at)}${c.note ? `<br>${esc(c.note)}` : ''}</p>
             <div class="row"><button class="btn" data-act="printClose">${ICO('print')} طباعة</button>${Session.user.role === 'admin' ? `<button class="btn ghost" data-act="reopenCash">إعادة فتح</button>` : ''}</div>`
          : `<div class="field" style="margin-bottom:10px"><label>المبلغ الفعلي المعدود في الصندوق</label><input class="inp num" id="cash-act" inputmode="decimal" value="${D.expected}"></div>
             <div id="cash-diff" class="t-sub" style="margin-bottom:10px">الفرق: 0</div><div class="field" style="margin-bottom:12px"><label>ملاحظة</label><input class="inp" id="cash-note"></div>
             <button class="btn pri" data-act="closeCash" style="width:100%">${ICO('lock')} إغلاق صندوق ${fdate(CashF.date)}</button>`}</div></div></div>`;
  },
  after() {
    const d = $('#cash-d'); if (d) d.onchange = () => { CashF.date = d.value || today(); Shell.refresh(); };
    const mm = $('#cash-m'); if (mm) mm.onchange = () => { CashF.month = mm.value || today().slice(0, 7); Shell.refresh(); };
    const a = $('#cash-act'); if (a) { const D = cashDay(CashF.date); const u = () => { const df = round2(num(a.value) - D.expected); $('#cash-diff').innerHTML = `الفرق: <b class="${df < 0 ? 'danger-t' : df > 0 ? 'ok-t' : ''}">${fmt(df)}</b> ${df < 0 ? '(عجز)' : df > 0 ? '(زيادة)' : ''}`; }; a.addEventListener('input', u); u(); }
  }
};
function expenseModal() {
  if (!can('cashbox')) return toast('لا تملك صلاحية المصروفات', 'warn');
  const m = modal({
    title: 'تسجيل مصروف', size: 'narrow',
    body: `<div class="stack" style="gap:12px"><div class="field"><label>البند</label><select class="sel" name="cat">${EXP_CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="form-grid"><div class="field"><label>المبلغ</label><input class="inp num" name="amount" inputmode="decimal"></div><div class="field"><label>التاريخ</label><input class="inp" type="date" name="date" value="${today()}"></div></div>
      <div class="field"><label>البيان</label><input class="inp" name="note" placeholder="مثال: وقود القلاب 2041"></div></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ</button>`
  });
  $('[data-ok]', m.el).onclick = () => {
    const v = formVals(m.el), amount = num(v.amount); if (amount <= 0) return toast('أدخل المبلغ', 'warn');
    if (db.closings.some(c => c.date === v.date)) return toast('صندوق هذا اليوم مغلق، لا يمكن إضافة مصروف عليه', 'warn');
    db.expenses.unshift({ id: uid(), no: nextNo('exp'), date: v.date || today(), at: Date.now(), cat: v.cat, amount, note: v.note, user: Session.user.id });
    logAct('مصروف', `${v.cat} · ${moneyT(amount)}`); saveDb(); m.close(); toast('سُجّل المصروف'); Shell.refresh();
  };
}
function closeHTML(c) {
  return `<div class="pr-h"><div>${brandHTML(db.settings.company)}</div><div style="text-align:left"><p class="pr-title">إغلاق الصندوق</p><div>${fdate(c.date)}</div></div></div>
    <div class="pr-tot" style="width:100%"><div><span>الرصيد الافتتاحي</span><span>${fmt(c.opening)}</span></div><div><span>المقبوض نقداً</span><span>${fmt(c.tin)}</span></div><div><span>المدفوع والمصروفات</span><span>${fmt(c.tout)}</span></div>
    <div><span>المتوقع</span><span>${fmt(c.expected)}</span></div><div class="g"><span>الفعلي المعدود</span><span>${moneyT(c.actual)}</span></div><div><span>الفرق</span><span>${fmt(c.diff)}</span></div></div>
    ${c.note ? `<p>${esc(c.note)}</p>` : ''}<div class="pr-sign"><div>أمين الصندوق: ${esc(userName(c.user))}</div><div>المدير</div></div><div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي</div>`;
}
Object.assign(ACTS, {
  cashTab: el => { CashF.tab = el.dataset.t; Shell.refresh(); },
  newExpense: () => expenseModal(),
  delExp: async el => { const e = byId('expenses', el.dataset.id); if (db.closings.some(c => c.date === e.date)) return toast('صندوق هذا اليوم مغلق', 'warn'); if (await confirmBox('حذف المصروف؟', { ok: 'حذف', danger: true })) { db.expenses = db.expenses.filter(x => x.id !== e.id); logAct('حذف مصروف', `${e.cat} · ${moneyT(e.amount)}`); rerender(); } },
  closeCash: async () => {
    const D = cashDay(CashF.date), actual = num($('#cash-act').value), diff = round2(actual - D.expected);
    if (!await confirmBox(`إغلاق صندوق <b>${fdate(CashF.date)}</b> بمبلغ فعلي ${moneyT(actual)}${diff ? ` (فرق ${fmt(diff)})` : ''}؟`, { ok: 'إغلاق' })) return;
    db.closings.push({ date: CashF.date, at: Date.now(), opening: D.opening, tin: D.tin, tout: D.tout, expected: D.expected, actual, diff, note: $('#cash-note').value.trim(), user: Session.user.id });
    logAct('إغلاق الصندوق', `${fdate(CashF.date)} · ${moneyT(actual)}`); rerender(); toast('أُغلق الصندوق');
  },
  reopenCash: async () => { if (await confirmBox('إعادة فتح صندوق هذا اليوم؟', { danger: true, ok: 'إعادة فتح' })) { db.closings = db.closings.filter(c => c.date !== CashF.date); logAct('إعادة فتح الصندوق', fdate(CashF.date)); rerender(); } },
  printClose: () => { const c = db.closings.find(x => x.date === CashF.date); if (c) printHTML(closeHTML(c)); },
  expCsv: () => exportCSV(`المصروفات-${CashF.month}`, ['التاريخ', 'البند', 'البيان', 'المبلغ', 'المستخدم'], db.expenses.filter(e => e.date.startsWith(CashF.month)).map(e => [e.date, e.cat, e.note, e.amount, userName(e.user)]))
});

/* ===================== المرتجعات ===================== */
function returnModal(id) {
  const inv = byId('invoices', id); if (!inv || inv.kind !== 'sale' || inv.void) return;
  if (!can('returns')) return toast('لا تملك صلاحية المرتجعات', 'warn');
  const f = inv.sub ? (inv.sub - inv.discount) / inv.sub * (1 + (inv.taxRate || 0) / 100) : 1;
  const ls = inv.lines.map(l => ({ ...l, max: round2(l.qty - retQty(inv, l.mid)), r: 0 })).filter(l => l.max > 0);
  if (!ls.length) return toast('أُرجعت كل أصناف هذه الفاتورة', 'warn');
  const m = modal({
    title: `مرتجع من الفاتورة ${inv.no}`, size: 'wide',
    body: `<p class="muted" style="margin-top:0">${esc(custName(inv.customerId))} · ${fdate(inv.date)}. تُعاد الكميات إلى المخزن، ويُخصم المبلغ من حساب الزبون، والزيادة عن المدفوع تُعاد له نقداً بسند صرف.</p>
      <table class="tbl"><thead><tr><th>الصنف</th><th class="n">المباع</th><th class="n">القابل للإرجاع</th><th style="width:140px">الكمية المرتجعة</th><th class="n">المبلغ</th></tr></thead><tbody>
      ${ls.map((l, i) => `<tr><td>${esc(l.name)}</td><td class="n">${fmt(l.qty)} ${esc(l.unit)}</td><td class="n">${fmt(l.max)}</td><td><input class="inp sm num" data-r="${i}" placeholder="0" inputmode="decimal"></td><td class="n" id="ra${i}">0</td></tr>`).join('')}</tbody></table>
      <div class="field" style="margin-top:12px"><label>سبب الإرجاع</label><select class="sel" name="reason"><option>زيادة عن الحاجة</option><option>قطعة تالفة</option><option>خطأ في الطلب</option><option>أخرى</option></select></div>
      <div class="tk-total" style="margin:16px -20px -18px"><span>مبلغ المرتجع</span><b id="rt">0</b></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('undo')} تنفيذ المرتجع</button>`
  });
  const upd = () => { let t = 0; ls.forEach((l, i) => { l.r = Math.min(l.max, Math.max(0, num($(`[data-r="${i}"]`, m.el).value))); const a = round2(l.r * l.price * f); t += a; $('#ra' + i, m.el).textContent = fmt(a); }); $('#rt', m.el).textContent = moneyT(t); return round2(t); };
  $$('[data-r]', m.el).forEach(el => el.addEventListener('input', upd));
  $('[data-ok]', m.el).onclick = async () => {
    const R = upd(), lines = ls.filter(l => l.r > 0).map(l => ({ mid: l.mid, name: l.name, unit: l.unit, qty: l.r, price: l.price, cost: l.cost }));
    if (!lines.length) return toast('أدخل الكميات المرتجعة', 'warn');
    inv.returns = inv.returns || []; inv.returns.push({ at: Date.now(), date: today(), lines, amount: R, reason: formVals(m.el).reason, user: Session.user.id });
    inv.returned = round2((inv.returned || 0) + R);
    lines.forEach(l => { moveStock(l.mid, l.qty, docNo('INV', inv.no), 'مرتجع مبيعات'); if (typeof releaseSerials === 'function') releaseSerials(inv, l.mid, l.qty); });
    const net = invNet(inv); let refund = 0;
    if (inv.paid > net + 0.001) { refund = round2(inv.paid - net); inv.paid = net; db.payments.unshift({ id: uid(), no: nextNo('pay'), type: 'out', party: 'c', partyId: inv.customerId, amount: refund, method: 'نقدي', note: `إرجاع مبلغ مرتجع الفاتورة ${inv.no}`, date: today(), at: Date.now(), alloc: [], user: Session.user.id }); }
    logAct('مرتجع مبيعات', `فاتورة ${inv.no} · ${moneyT(R)}${refund ? ` · أُعيد نقداً ${moneyT(refund)}` : ''}`);
    saveDb(); m.close(); toast(refund ? `تم المرتجع، أعد للزبون ${moneyT(refund)} نقداً` : 'تم المرتجع وخُصم من حساب الزبون', 'ok', 5000); Shell.refresh();
  };
}
ACTS.retInv = el => returnModal(el.dataset.id);

/* ===================== التصدير إلى Excel ===================== */
function exportCSV(name, head, rows) {
  const e = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  downloadFile(`${name}.csv`, '﻿' + [head, ...rows].map(r => r.map(e).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  logAct('تصدير Excel', name); saveDb();
}
Object.assign(ACTS, {
  csvMaterials: () => exportCSV(`العدد-${today()}`, ['الباركود', 'الاسم', 'الماركة', 'الموديل', 'المقاس', 'المنشأ', 'الضمان (شهر)', 'الصنف', 'الوحدة', 'المخزون', 'حد الطلب', ...(can('cost') ? ['الكلفة'] : []), 'سعر المفرد', 'سعر الجملة', 'المورد', 'الموقع'],
    db.materials.map(m => [m.barcode, m.name, m.brand, m.model, m.size, m.origin, m.warranty, m.cat, m.unit, m.stock, m.min, ...(can('cost') ? [m.cost] : []), m.price, m.wprice, supName(m.supplierId), m.loc])),
  csvCustomers: () => exportCSV(`الزبائن-${today()}`, ['الزبون', 'النوع', 'الهاتف', 'الموقع', 'سقف الدين', 'الرصيد المستحق'], db.customers.map(c => [c.name, c.type, c.phone, c.site, c.limit, custBalance(c.id)])),
  csvInvoices: () => exportCSV(`الفواتير-${today()}`, ['الرقم', 'التاريخ', 'الزبون', 'الأصناف', 'الإجمالي', 'المرتجع', 'المدفوع', 'المتبقي', 'الاستحقاق', 'الحالة', 'المستخدم'],
    db.invoices.filter(i => i.kind === 'sale').map(i => [i.no, i.date, custName(i.customerId), i.lines.map(l => `${l.name} ×${l.qty}`).join(' | '), i.total, i.returned || 0, i.paid, i.void ? 0 : remaining(i), i.due || '', invStatus(i).t, userName(i.user)])),
  csvDues: () => exportCSV(`القوائم-المستحقة-${today()}`, ['الزبون', 'الهاتف', 'فواتير مفتوحة', 'أقدم استحقاق', 'أيام التأخير', 'المتأخر', 'المجموع'], dueRows().map(r => [r.c.name, r.c.phone, r.open.length, r.oldest, r.lateDays, r.overdueAmt, r.amount]))
});
