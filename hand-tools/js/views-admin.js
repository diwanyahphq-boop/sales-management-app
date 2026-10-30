/* المثلث · نظام مستودع العدد الإنشائية — المخزن والمشتريات والمستندات والتقارير والإدارة */
'use strict';

/* ===================== العدد والمخزن ===================== */
const MatF = { q: '', cat: '', low: false, sel: new Set() };
Views.materials = {
  dim: () => `${db.materials.length} صنف · قيمة المخزون ${can('cost') ? moneyT(db.materials.reduce((s, m) => s + Math.max(0, m.stock) * m.cost, 0)) : '—'}`,
  render() {
    if (Shell.params.low) { MatF.low = true; Shell.params.low = null; }
    const q = MatF.q.toLowerCase();
    const rows = db.materials.filter(m => (!MatF.cat || m.cat === MatF.cat) && (!MatF.low || ['low', 'out'].includes(stockState(m))) && (!q || (m.name + ' ' + (m.brand || '') + ' ' + (m.model || '') + ' ' + (m.size || '')).toLowerCase().includes(q) || m.barcode.includes(q) || (m.loc || '').toLowerCase().includes(q)));
    const cats = [...new Set([...db.categories, ...db.materials.map(m => m.cat)])];
    return `<div class="toolbar"><div class="search">${ICO('search')}<input class="inp" id="m-q" placeholder="الاسم أو الموقع، أو امسح الباركود" value="${esc(MatF.q)}"></div><button class="btn icon" data-act="matCam" title="بحث بكاميرا الهاتف">${ICO('camera')}</button>
      <select class="sel" id="m-cat" style="width:auto"><option value="">كل الأصناف</option>${cats.map(c => `<option ${MatF.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="m-low" ${MatF.low ? 'checked' : ''}> تحت حد الطلب فقط</label>
      <span class="spacer"></span><button class="btn" data-act="labels" ${MatF.sel.size ? '' : 'disabled'}>${ICO('tag')} ملصقات باركود (${MatF.sel.size})</button>
      <button class="btn" data-act="snCheck">${ICO('shield')} تحقق من رقم تسلسلي</button><button class="btn" data-act="csvMaterials">${ICO('sheet')} Excel</button>${can('scanner') ? `<button class="btn" data-go="scanner">${ICO('scan')} إدخال بالماسح</button>` : ''}<button class="btn pri" data-act="newMaterial">${ICO('plus')} صنف جديد</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:34px"></th><th>الصنف</th><th>الباركود</th><th>الوحدة</th><th>المخزون</th>${can('cost') ? '<th class="n">الكلفة</th>' : ''}<th class="n">سعر المفرد</th><th class="n">سعر الجملة</th><th>الموقع</th><th></th></tr></thead><tbody>
      ${rows.map(m => {
        const st = stockState(m);
        return `<tr><td><input type="checkbox" data-msel="${m.id}" ${MatF.sel.has(m.id) ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--accent)"></td>
          <td><div class="row" style="flex-wrap:nowrap;gap:10px"><span class="t-img sm" data-img="${m.id}"></span><div style="cursor:pointer" data-act="toolCard" data-id="${m.id}"><div class="t-main">${esc(m.name)} ${m.serialTracked ? '<span class="chip plain" style="font-size:10.5px">S/N</span>' : ''}</div><div class="t-sub">${esc([m.brand, m.model, m.size].filter(Boolean).join(' · ') || m.cat)}${m.warranty ? ` · ضمان ${m.warranty} شهراً` : ''}</div></div></div></td>
          <td><div style="width:110px">${barcodeSVG(m.barcode, { h: 22, showText: false })}</div><div class="t-sub mono">${esc(m.barcode)}</div></td><td>${esc(m.unit)}</td>
          <td><div class="row" style="gap:8px;flex-wrap:nowrap">${meter(m)}<b class="num ${st === 'out' || st === 'low' ? 'danger-t' : ''}">${fmt(m.stock)}</b></div><div class="t-sub">الحد ${fmt(m.min)}</div></td>
          ${can('cost') ? `<td class="n">${fmt(m.cost)}</td>` : ''}<td class="n"><b>${fmt(m.price)}</b></td><td class="n">${fmt(m.wprice)}</td><td class="t-sub">${esc(m.loc || '—')}</td>
          <td><div class="acts"><button class="btn xs" data-act="adjStock" data-id="${m.id}">${ICO('swap')} تسوية</button><button class="btn xs icon" data-act="matMoves" data-id="${m.id}" title="الحركة">${ICO('log')}</button>
            <button class="btn xs icon" data-act="editMat" data-id="${m.id}" title="تعديل">${ICO('edit')}</button>${can('void') ? `<button class="btn xs icon dan" data-act="delMat" data-id="${m.id}" title="حذف">${ICO('trash')}</button>` : ''}</div></td></tr>`;
      }).join('')}</tbody></table>${rows.length ? '' : emptyHTML('box', 'لا توجد أصناف', '<br>أضف الأصناف أو امسح باركود صنف جديد لتسجيلها')}</div></div>`;
  },
  after() {
    const q = $('#m-q'); q.addEventListener('input', debounce(() => { MatF.q = q.value.trim(); Shell.refresh(); const n = $('#m-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
    q.addEventListener('keydown', e => { if (e.key !== 'Enter') return; const m = db.materials.find(x => x.barcode === q.value.trim()); if (m) { e.preventDefault(); beep(); quickMaterial(m); } else if (q.value.trim() && !db.materials.some(x => x.name.includes(q.value.trim()))) onScanCode(q.value.trim()); });
    $('#m-cat').onchange = e => { MatF.cat = e.target.value; Shell.refresh(); };
    $('#m-low').onchange = e => { MatF.low = e.target.checked; Shell.refresh(); };
    loadImgs($('#view'));
    $$('[data-msel]').forEach(cb => cb.onchange = () => { cb.checked ? MatF.sel.add(cb.dataset.msel) : MatF.sel.delete(cb.dataset.msel); $('[data-act=labels]').disabled = !MatF.sel.size; $('[data-act=labels]').innerHTML = `${ICO('tag')} ملصقات باركود (${MatF.sel.size})`; });
  }
};
function newBarcode() { let b; do { b = String(200000 + nextNo('bar')); } while (db.materials.some(m => m.barcode === b)); return b; }
function editMaterial(id, preset = {}) {
  if (!can('materials')) return toast('لا تملك صلاحية إدارة الأصناف', 'warn');
  if (!id && !License.activated && db.materials.length >= APP.trialLimit) { toast(`النسخة التجريبية تسمح بـ ${APP.trialLimit} صنف فقط. فعّل البرنامج لإضافة المزيد.`, 'warn', 5000); return activateModal(); }
  const m = id ? matById(id) : { name: '', cat: db.categories[0], unit: 'كيس', barcode: '', cost: '', price: '', wprice: '', stock: '', min: '', supplierId: null, loc: '', ...preset };
  const cats = [...new Set([...db.categories, ...db.materials.map(x => x.cat)])];
  const md = modal({
    title: id ? 'تعديل صنف' : 'صنف جديد', size: 'wide',
    body: `<div class="form-grid c3">
      <div class="field" style="grid-column:span 2"><label>اسم الصنف والمواصفة</label><input class="inp" name="name" value="${esc(m.name)}" placeholder="مثال: اسمنت مقاوم — كيس 50 كغم"></div>
      <div class="field"><label>الصنف</label><input class="inp" name="cat" value="${esc(m.cat)}" list="cat-list"><datalist id="cat-list">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label>وحدة القياس</label><input class="inp" name="unit" value="${esc(m.unit)}" list="unit-list"><datalist id="unit-list">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist></div>
      <div class="field" style="grid-column:span 2"><label>الباركود</label><div class="row" style="flex-wrap:nowrap"><input class="inp mono" name="barcode" value="${esc(m.barcode)}" dir="ltr" placeholder="امسح باركود الصنف هنا أو ولّد رقماً"><button type="button" class="btn icon" data-gen title="توليد">${ICO('sparkle')}</button><button type="button" class="btn icon" data-cam title="كاميرا">${ICO('camera')}</button></div><div id="bc-prev" style="height:40px;margin-top:6px;max-width:220px"></div></div>
      ${can('cost') ? `<div class="field"><label>سعر الكلفة</label><input class="inp num" name="cost" value="${m.cost}" inputmode="decimal"></div>` : ''}
      <div class="field"><label>سعر المفرد</label><input class="inp num" name="price" value="${m.price}" inputmode="decimal"></div>
      <div class="field"><label>سعر الجملة / المقاول</label><input class="inp num" name="wprice" value="${m.wprice}" inputmode="decimal"></div>
      ${id ? `<div class="field"><label>المخزون الحالي</label><input class="inp num" value="${m.stock}" disabled><span class="hint">للتعديل استخدم «تسوية»</span></div>` : `<div class="field"><label>الرصيد الافتتاحي</label><input class="inp num" name="stock" value="${m.stock}" inputmode="decimal"></div>`}
      <div class="field"><label>حد إعادة الطلب</label><input class="inp num" name="min" value="${m.min}" inputmode="decimal"></div>
      <div class="field"><label>المورد</label><select class="sel" name="supplierId"><option value="">—</option>${db.suppliers.map(s => `<option value="${s.id}" ${s.id === m.supplierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>موقع الخزن</label><input class="inp" name="loc" value="${esc(m.loc)}" placeholder="الساحة 1، المخزن A…"></div>
      <div class="field"><label>هامش الربح</label><div class="inp" id="margin" style="display:flex;align-items:center;background:transparent">—</div></div></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ</button>${!id ? `<button class="btn" data-ok data-more="1">حفظ وإضافة أخرى</button>` : ''}`
  });
  const bc = $('[name=barcode]', md.el), prev = () => $('#bc-prev', md.el).innerHTML = barcodeSVG(bc.value, { h: 30 });
  bc.addEventListener('input', prev); prev();
  bc.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  $('[data-gen]', md.el).onclick = () => { bc.value = newBarcode(); prev(); };
  $('[data-cam]', md.el).onclick = () => Scanner.camera(c => { bc.value = c; prev(); });
  const mg = () => { const c = num(($('[name=cost]', md.el) || {}).value ?? m.cost), p = num($('[name=price]', md.el).value); $('#margin', md.el).innerHTML = c && p ? `<b class="${p > c ? 'ok-t' : 'danger-t'}">${fmt((p - c) / c * 100)}%</b>&nbsp;<span class="muted">(${fmt(p - c)} للوحدة)</span>` : '—'; };
  $$('[name=cost],[name=price]', md.el).forEach(i => i.addEventListener('input', mg)); mg();
  $$('[data-ok]', md.el).forEach(b => b.onclick = () => {
    const v = formVals(md.el);
    if (!v.name) return toast('أدخل اسم الصنف', 'warn');
    if (!v.barcode) v.barcode = newBarcode();
    if (/[^\x20-\x7e]/.test(v.barcode)) return toast('الباركود يقبل الأرقام والحروف الإنجليزية فقط', 'warn');
    if (db.materials.some(x => x.barcode === v.barcode && x.id !== id)) return toast('الباركود مستخدم لمادة أخرى', 'warn');
    const rec = { name: v.name, cat: v.cat || 'عام', unit: v.unit || 'قطعة', barcode: v.barcode, price: num(v.price), wprice: num(v.wprice) || num(v.price), min: num(v.min), supplierId: v.supplierId || null, loc: v.loc };
    if (v.cost !== undefined) rec.cost = num(v.cost);
    if (rec.cat && !db.categories.includes(rec.cat)) db.categories.push(rec.cat);
    if (id) { Object.assign(m, rec); logAct('تعديل صنف', rec.name); }
    else {
      const nm = { id: uid(), ...rec, cost: rec.cost || 0, stock: 0, created: Date.now() }; db.materials.push(nm);
      if (num(v.stock)) moveStock(nm.id, num(v.stock), 'رصيد افتتاحي', 'افتتاحي');
      logAct('إضافة صنف', rec.name);
    }
    saveDb(); md.close(); toast('حُفظ الصنف'); Shell.refresh();
    if (b.dataset.more) editMaterial(null, { cat: rec.cat, unit: rec.unit, supplierId: rec.supplierId, loc: rec.loc });
  });
}
Object.assign(ACTS, {
  matCam: () => Scanner.camera(c => { MatF.q = c; Shell.refresh(); const m = db.materials.find(x => x.barcode === c); m ? quickMaterial(m) : onScanCode(c); }),
  editMat: el => editMaterial(el.dataset.id),
  delMat: async el => {
    const m = matById(el.dataset.id);
    if (db.invoices.some(i => i.lines.some(l => l.mid === m.id)) || db.purchases.some(p => p.lines.some(l => l.mid === m.id))) return toast('لا يمكن حذف صنف مستخدم في فواتير', 'warn');
    if (await confirmBox(`حذف الصنف <b>${esc(m.name)}</b>؟`, { ok: 'حذف', danger: true })) { db.materials = db.materials.filter(x => x.id !== m.id); logAct('حذف صنف', m.name); rerender(); }
  },
  adjStock: el => {
    const m = matById(el.dataset.id);
    const md = modal({
      title: `تسوية مخزون: ${esc(m.name)}`, size: 'narrow',
      body: `<p class="muted" style="margin-top:0">الرصيد الحالي: <b>${fmt(m.stock)} ${esc(m.unit)}</b></p>
        <div class="seg" style="margin-bottom:12px"><button class="on" data-mode="set">الرصيد الفعلي (جرد)</button><button data-mode="add">إضافة</button><button data-mode="sub">خصم</button></div>
        <div class="stack" style="gap:12px"><div class="field"><label id="adj-l">الكمية الفعلية بعد الجرد</label><input class="inp num" name="qty" inputmode="decimal"></div>
        <div class="field"><label>السبب</label><select class="sel" name="reason"><option>جرد دوري</option><option>تالف / كسر</option><option>مرتجع من زبون</option><option>استهلاك داخلي</option><option>تصحيح إدخال</option></select></div></div>`,
      foot: `<button class="btn pri" data-ok>تنفيذ</button>`
    });
    let mode = 'set';
    $$('[data-mode]', md.el).forEach(b => b.onclick = () => { mode = b.dataset.mode; $$('[data-mode]', md.el).forEach(x => x.classList.toggle('on', x === b)); $('#adj-l', md.el).textContent = mode === 'set' ? 'الكمية الفعلية بعد الجرد' : 'الكمية'; });
    $('[data-ok]', md.el).onclick = () => {
      const v = formVals(md.el), q = num(v.qty); if (v.qty === '') return toast('أدخل الكمية', 'warn');
      const delta = mode === 'set' ? round2(q - m.stock) : mode === 'add' ? q : -q;
      if (!delta) { md.close(); return; }
      moveStock(m.id, delta, 'تسوية', v.reason); logAct('تسوية مخزون', `${m.name}: ${delta > 0 ? '+' : ''}${fmt(delta)} (${v.reason})`);
      md.close(); rerender(); toast('تمت التسوية');
    };
  },
  matMoves: el => {
    const m = matById(el.dataset.id), mv = db.movements.filter(x => x.mid === m.id).slice(0, 200);
    modal({
      title: `حركة الصنف: ${esc(m.name)}`, size: 'wide',
      body: `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المرجع</th><th>البيان</th><th class="n">الكمية</th><th class="n">الرصيد بعدها</th><th>المستخدم</th></tr></thead><tbody>
        ${mv.map(x => `<tr><td class="t-sub">${ftime(x.at)}</td><td class="mono">${esc(x.ref)}</td><td>${esc(x.note)}</td><td class="n ${x.qty > 0 ? 'ok-t' : 'danger-t'}">${x.qty > 0 ? '+' : ''}${fmt(x.qty)}</td><td class="n">${fmt(x.after)}</td><td class="t-sub">${esc(userName(x.user))}</td></tr>`).join('')}</tbody></table>${mv.length ? '' : emptyHTML('log', 'لا توجد حركات')}</div>`
    });
  },
  labels: () => {
    const ms = db.materials.filter(m => MatF.sel.has(m.id));
    const html = `<div class="lbls">${ms.map(m => `<div class="lbl"><b>${esc(m.name)}</b>${barcodeSVG(m.barcode, { h: 40 })}<div style="font-weight:600">${moneyT(m.price)} / ${esc(m.unit)}</div></div>`).join('')}</div>`;
    const md = modal({ title: 'ملصقات الباركود', size: 'wide', body: html, foot: `<button class="btn pri" data-p>${ICO('print')} طباعة الملصقات</button>` });
    $('[data-p]', md.el).onclick = () => printHTML(html);
  }
});

/* ===================== المشتريات ===================== */
Views.purchases = {
  dim: () => `${db.purchases.length} فاتورة شراء`,
  render() {
    return `<div class="toolbar"><span class="spacer"></span><button class="btn pri" data-act="newPurchase">${ICO('plus')} فاتورة شراء جديدة</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th>الأصناف</th><th class="n">الإجمالي</th><th class="n">المدفوع</th><th class="n">المتبقي</th><th>المستند</th><th></th></tr></thead><tbody>
      ${db.purchases.map(p => `<tr><td class="mono">${p.no}${p.ref ? `<div class="t-sub">مورد: ${esc(p.ref)}</div>` : ''}</td><td>${fdate(p.date)}</td><td class="t-main">${esc(supName(p.supplierId))}</td>
        <td class="t-sub">${esc(p.lines.map(l => `${fmt(l.qty)} ${l.unit} ${l.name.split('—')[0]}`).join('، '))}</td><td class="n">${fmt(p.total)}</td><td class="n">${fmt(p.paid)}</td><td class="n ${remaining(p) > 0 ? 'warn-t' : ''}">${fmt(remaining(p))}</td>
        <td>${p.docId ? `<button class="btn xs" data-act="viewDoc" data-id="${p.docId}">${ICO('doc')} عرض</button>` : '<span class="muted">—</span>'}</td>
        <td><div class="acts">${remaining(p) > 0 && can('payments') ? `<button class="btn xs icon" data-act="payPur" data-id="${p.id}" title="تسديد">${ICO('cash')}</button>` : ''}</div></td></tr>`).join('')}
      </tbody></table>${db.purchases.length ? '' : emptyHTML('cart', 'لا توجد مشتريات', '<br>سجّل فواتير الموردين لزيادة المخزون تلقائياً')}</div></div>`;
  }
};
function createPurchase({ supplierId, ref = '', date = today(), due = addDays(today(), 30), lines, paid = 0, updCost = true }) {
  const total = round2(lines.reduce((s, l) => s + num(l.qty) * num(l.cost), 0));
  const p = { id: uid(), no: nextNo('pur'), ref, date: date || today(), at: Date.now(), supplierId, lines: lines.map(l => { const m = matById(l.mid); return { mid: l.mid, name: m.name, unit: m.unit, qty: num(l.qty), cost: num(l.cost) }; }), total, paid: 0, due, note: '', user: Session.user.id };
  db.purchases.unshift(p);
  p.lines.forEach(l => { moveStock(l.mid, l.qty, docNo('PUR', p.no), 'شراء'); if (updCost && l.cost) matById(l.mid).cost = l.cost; });
  if (paid > 0) addPayment({ type: 'out', partyId: supplierId, amount: Math.min(paid, total), method: 'نقدي', note: `مع فاتورة الشراء ${p.no}`, docId: p.id });
  logAct('فاتورة شراء', `رقم ${p.no} · ${supName(supplierId)} · ${moneyT(total)}`);
  return p;
}
function purchaseModal() {
  if (!can('purchases')) return toast('لا تملك صلاحية المشتريات', 'warn');
  if (!db.materials.length) return toast('أضف الأصناف أولاً', 'warn');
  const lines = [{ mid: '', qty: '', cost: '' }]; let scanFile = null;
  const md = modal({
    title: 'فاتورة شراء من مورد', size: 'wide',
    body: `<div class="form-grid c3" style="margin-bottom:14px"><div class="field"><label>المورد</label><select class="sel" name="sup"><option value="">— اختر —</option>${db.suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>رقم فاتورة المورد</label><input class="inp" name="ref"></div><div class="field"><label>التاريخ</label><input class="inp" type="date" name="date" value="${today()}"></div></div>
      <div class="scan-field sm" style="margin-bottom:12px"><div class="laser"></div>${ICO('scan')}<input id="pur-scan" class="mono" placeholder="امسح باركود الصنف لإضافته مباشرة…" dir="ltr" autocomplete="off"><button type="button" class="btn sm" data-pcam>${ICO('camera')}</button></div>
      <div id="pl"></div><button type="button" class="btn sm" data-add style="margin-top:8px">${ICO('plus')} سطر</button>
      <div class="form-grid c3" style="margin-top:16px"><div class="field"><label>المبلغ المدفوع</label><input class="inp num" name="paid" placeholder="0" inputmode="decimal"></div>
        <div class="field"><label>تاريخ الاستحقاق</label><input class="inp" type="date" name="due" value="${addDays(today(), 30)}"></div>
        <div class="field"><label>صورة فاتورة المورد</label><label class="btn" style="cursor:pointer">${ICO('scan')} <span id="sc-l">من الماسح / الكاميرا</span><input type="file" accept="image/*,application/pdf" capture="environment" hidden id="pur-file"></label></div></div>
      <label class="check" style="margin-top:12px"><input type="checkbox" name="upd" checked> تحديث سعر الكلفة للأصناف حسب هذه الفاتورة</label>
      <div class="tk-total" style="margin:16px -20px -18px;border-radius:0"><span>إجمالي الفاتورة</span><b id="pt">0</b></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ وإدخال المخزن</button>`
  });
  const draw = () => {
    $('#pl', md.el).innerHTML = `<table class="tbl"><thead><tr><th>الصنف</th><th style="width:130px">الكمية</th><th style="width:150px">كلفة الوحدة</th><th class="n" style="width:130px">المبلغ</th><th style="width:40px"></th></tr></thead><tbody>
      ${lines.map((l, i) => `<tr><td><select class="sel sm" data-l="${i}" data-f="mid"><option value="">— اختر الصنف —</option>${db.materials.map(m => `<option value="${m.id}" ${m.id === l.mid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
        <td><input class="inp sm num" data-l="${i}" data-f="qty" value="${l.qty}" placeholder="${l.mid ? esc(matById(l.mid).unit) : ''}" inputmode="decimal"></td><td><input class="inp sm num" data-l="${i}" data-f="cost" value="${l.cost}" inputmode="decimal"></td>
        <td class="n">${fmt(num(l.qty) * num(l.cost))}</td><td><button type="button" class="btn xs icon ghost" data-rm="${i}">${ICO('x')}</button></td></tr>`).join('')}</tbody></table>`;
    $$('[data-l]', md.el).forEach(el => el.addEventListener('change', () => {
      const l = lines[+el.dataset.l]; l[el.dataset.f] = el.value;
      if (el.dataset.f === 'mid' && el.value) { const m = matById(el.value); if (!l.cost) l.cost = m.cost; const s = $('[name=sup]', md.el); if (!s.value && m.supplierId) s.value = m.supplierId; }
      setTimeout(draw); // بعد انتهاء حدث الحقل حتى لا يُعاد الرسم أثناء فقدان التركيز
    }));
    $$('[data-rm]', md.el).forEach(b => b.onclick = () => { lines.splice(+b.dataset.rm, 1); if (!lines.length) lines.push({ mid: '', qty: '', cost: '' }); draw(); });
    $('#pt', md.el).textContent = moneyT(lines.reduce((s, l) => s + num(l.qty) * num(l.cost), 0));
  };
  draw();
  const addScan = code => {
    const m = db.materials.find(x => x.barcode === String(code).trim());
    if (!m) { beep(320); toast(`الباركود ${code} غير مسجل. سجّله من «محطة الماسح» في وضع إدخال الأصناف.`, 'warn', 5000); return; }
    beep(); const ex = lines.find(l => l.mid === m.id);
    if (ex) ex.qty = num(ex.qty) + 1; else { const empty = lines.find(l => !l.mid); const l = empty || {}; Object.assign(l, { mid: m.id, qty: 1, cost: m.cost }); if (!empty) lines.push(l); }
    const s = $('[name=sup]', md.el); if (!s.value && m.supplierId) s.value = m.supplierId; draw();
  };
  const ps = $('#pur-scan', md.el); ps.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addScan(ps.value); ps.value = ''; } });
  $('[data-pcam]', md.el).onclick = () => Scanner.camera(addScan, { continuous: true, title: 'مسح أصناف فاتورة الشراء' });
  Scanner.hook = addScan; const oc = md.onClose; md.onClose = () => { Scanner.hook = null; oc && oc(); };
  setTimeout(() => ps.focus(), 60);
  $('[data-add]', md.el).onclick = () => { lines.push({ mid: '', qty: '', cost: '' }); draw(); };
  $('#pur-file', md.el).onchange = e => { scanFile = e.target.files[0] || null; $('#sc-l', md.el).textContent = scanFile ? scanFile.name.slice(0, 22) : 'من الماسح / الكاميرا'; };
  $('[data-ok]', md.el).onclick = async () => {
    const v = formVals(md.el), ls = lines.filter(l => l.mid && num(l.qty) > 0);
    if (!v.sup) return toast('اختر المورد', 'warn');
    if (!ls.length) return toast('أضف صنفاً واحداً على الأقل', 'warn');
    const total = round2(ls.reduce((s, l) => s + num(l.qty) * num(l.cost), 0)), paid = Math.min(total, num(v.paid));
    const p = createPurchase({ supplierId: v.sup, ref: v.ref, date: v.date, due: v.due, lines: ls, paid, updCost: v.upd });
    if (scanFile) { try { const d = await saveScannedFile(scanFile, { title: `فاتورة المورد ${supName(v.sup)} ${v.ref || ''}`.trim(), kind: 'فاتورة مورد', party: 's', partyId: v.sup, refNo: `PUR-${p.no}` }); p.docId = d.id; } catch { toast('تعذّر حفظ صورة الفاتورة', 'err'); } }
    saveDb();
    saveDb(); md.close(); toast(`فاتورة الشراء ${p.no} محفوظة وأُدخلت الكميات إلى المخزن`); Shell.refresh();
  };
}
Object.assign(ACTS, {
  newPurchase: purchaseModal,
  payPur: el => { const p = byId('purchases', el.dataset.id); paymentModal('out', p.supplierId, p.id); }
});

/* ===================== الماسح والمستندات ===================== */
const DocF = { q: '', kind: '' };
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function scaled(img, max) { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; }
async function storeDoc(meta, dataURL, thumbURL) {
  const d = { id: uid(), at: Date.now(), date: today(), user: Session.user.id, size: Math.round(dataURL.length * 0.75), ...meta };
  await DocStore.put('f:' + d.id, dataURL); if (thumbURL) await DocStore.put('t:' + d.id, thumbURL);
  db.docs.unshift(d); logAct('أرشفة مستند', d.title); saveDb(); return d;
}
async function saveScannedFile(file, meta) {
  const src = await fileToDataURL(file);
  if (file.type === 'application/pdf') return storeDoc({ ...meta, mime: 'application/pdf' }, src, null);
  const img = await loadImage(src);
  return storeDoc({ ...meta, mime: 'image/jpeg' }, scaled(img, 1800).toDataURL('image/jpeg', .8), scaled(img, 360).toDataURL('image/jpeg', .7));
}
/* محرر المسح: تدوير وتحسين الصورة لتبدو كمستند ممسوح */
function processCanvas(img, rot, mode) {
  const base = scaled(img, 1800), c = document.createElement('canvas'), sw = rot % 180 ? base.height : base.width, sh = rot % 180 ? base.width : base.height;
  c.width = sw; c.height = sh; const x = c.getContext('2d');
  x.translate(sw / 2, sh / 2); x.rotate(rot * Math.PI / 180); x.drawImage(base, -base.width / 2, -base.height / 2); x.setTransform(1, 0, 0, 1, 0, 0);
  if (mode !== 'orig') {
    const d = x.getImageData(0, 0, sw, sh), p = d.data;
    let lo = 255, hi = 0;
    if (mode !== 'gray') { const hist = new Array(256).fill(0); for (let i = 0; i < p.length; i += 16) hist[(p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114) | 0]++; const tot = hist.reduce((a, b) => a + b, 0); let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (lo === 255 && acc > tot * .02) lo = v; if (acc > tot * .9) { hi = v; break; } } if (hi - lo < 30) { lo = 0; hi = 255; } }
    for (let i = 0; i < p.length; i += 4) {
      const y = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114;
      if (mode === 'gray') { p[i] = p[i + 1] = p[i + 2] = y; continue; }
      const stretch = v => Math.max(0, Math.min(255, (v - lo) * 255 / (hi - lo)));
      if (mode === 'doc') { let v = stretch(y); v = v > 200 ? 255 : v < 60 ? 0 : (v - 60) * 255 / 140; v = v < 128 ? v * .7 : 255 - (255 - v) * .6; p[i] = p[i + 1] = p[i + 2] = v; }
      else { p[i] = stretch(p[i]); p[i + 1] = stretch(p[i + 1]); p[i + 2] = stretch(p[i + 2]); }
    }
    x.putImageData(d, 0, 0);
  }
  return c;
}
function scanEditor(files) {
  const queue = [...files]; if (!queue.length) return;
  const next = async () => {
    const f = queue.shift(); if (!f) { Shell.refresh(); return; }
    if (f.size > 12 * 1024 * 1024) { toast(`الملف ${f.name} أكبر من 12 ميغابايت`, 'warn'); return next(); }
    const isPdf = f.type === 'application/pdf';
    if (!isPdf && !/^image\//.test(f.type)) { toast(`نوع الملف ${f.name} غير مدعوم`, 'warn'); return next(); }
    const src = await fileToDataURL(f), img = isPdf ? null : await loadImage(src).catch(() => null);
    if (!isPdf && !img) { toast('تعذّرت قراءة الصورة', 'err'); return next(); }
    let rot = 0, mode = 'doc', canvas;
    const md = modal({
      title: `أرشفة مستند ${queue.length ? `(متبقٍ ${queue.length})` : ''}`, size: 'wide',
      body: `<div class="scan-stage"><div class="scan-view" id="sv">${isPdf ? `<div class="empty">${ICO('doc')}<b>${esc(f.name)}</b>ملف PDF</div>` : ''}</div>
        <div class="stack" style="gap:12px">${isPdf ? '' : `<div class="field"><label>المعالجة</label><div class="seg" style="width:100%">${[['doc', 'مستند'], ['enh', 'تحسين'], ['gray', 'رمادي'], ['orig', 'أصلي']].map(([k, t]) => `<button class="${k === mode ? 'on' : ''}" data-mode="${k}" style="flex:1">${t}</button>`).join('')}</div></div>
          <button class="btn" data-rot>${ICO('rotate')} تدوير 90°</button>`}
          <div class="field"><label>عنوان المستند</label><input class="inp" name="title" value="${esc(f.name.replace(/\.[^.]+$/, ''))}"></div>
          <div class="field"><label>النوع</label><select class="sel" name="kind">${DOC_KINDS.map(k => `<option>${k}</option>`).join('')}</select></div>
          <div class="field"><label>مرتبط بـ</label><select class="sel" name="link"><option value="">— بدون —</option><optgroup label="الزبائن">${db.customers.map(c => `<option value="c:${c.id}">${esc(c.name)}</option>`).join('')}</optgroup><optgroup label="الموردون">${db.suppliers.map(s => `<option value="s:${s.id}">${esc(s.name)}</option>`).join('')}</optgroup></select></div>
          <div class="field"><label>رقم مرجعي (فاتورة، عقد…)</label><input class="inp" name="refNo"></div></div></div>`,
      foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ في الأرشيف</button>${queue.length ? `<button class="btn ghost" data-skip>تخطي</button>` : ''}`
    });
    const draw = () => { if (isPdf) return; canvas = processCanvas(img, rot, mode); const v = $('#sv', md.el); v.innerHTML = ''; v.append(canvas); };
    draw();
    $$('[data-mode]', md.el).forEach(b => b.onclick = () => { mode = b.dataset.mode; $$('[data-mode]', md.el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    const r = $('[data-rot]', md.el); if (r) r.onclick = () => { rot = (rot + 90) % 360; draw(); };
    const sk = $('[data-skip]', md.el); if (sk) sk.onclick = () => { md.close(); next(); };
    $('[data-ok]', md.el).onclick = async () => {
      const v = formVals(md.el), [pt, pid] = v.link ? v.link.split(':') : ['', ''];
      const meta = { title: v.title || 'مستند', kind: v.kind, party: pt, partyId: pid || null, refNo: v.refNo };
      try {
        if (isPdf) await storeDoc({ ...meta, mime: 'application/pdf' }, src, null);
        else { const tc = document.createElement('canvas'), k = 360 / Math.max(canvas.width, canvas.height); tc.width = canvas.width * k; tc.height = canvas.height * k; tc.getContext('2d').drawImage(canvas, 0, 0, tc.width, tc.height); await storeDoc({ ...meta, mime: 'image/jpeg' }, canvas.toDataURL('image/jpeg', .8), tc.toDataURL('image/jpeg', .7)); }
        toast('حُفظ المستند في الأرشيف'); md.close(); next();
      } catch { toast('تعذّر حفظ المستند', 'err'); }
    };
  };
  next();
}
Views.docs = {
  dim: () => `${db.docs.length} مستند مؤرشف`,
  render() {
    const q = DocF.q.toLowerCase();
    const list = db.docs.filter(d => (!DocF.kind || d.kind === DocF.kind) && (!q || d.title.toLowerCase().includes(q) || (d.refNo || '').toLowerCase().includes(q) || (d.partyId && (d.party === 's' ? supName(d.partyId) : custName(d.partyId)).toLowerCase().includes(q))));
    return `<label class="drop" id="drop" style="display:block;cursor:pointer;margin-bottom:18px">${ICO('scan')}<h3>اسحب المستندات الممسوحة هنا، أو انقر للاختيار</h3>
        <p class="muted" style="margin:0 0 12px">صور أو PDF من الماسح الضوئي · على الهاتف تفتح الكاميرا مباشرة · أو الصق صورة من الحافظة <kbd>Ctrl V</kbd></p>
        <span class="btn pri">${ICO('upload')} مسح / اختيار ملفات</span>
        <input type="file" id="doc-file" accept="image/*,application/pdf" multiple hidden></label>
      <div class="card" style="margin-bottom:18px"><div class="card-b" style="display:flex;gap:12px;align-items:flex-start;font-size:13px;color:var(--ink2)">${ICO('info').replace('<svg', '<svg style="width:18px;height:18px;flex:none;color:var(--brass);margin-top:2px"')}
        <div><b>طريقة السحب من الماسح الضوئي:</b> اضغط زر المسح في جهاز الماسح (أو من برنامج «الفاكس والمسح الضوئي» في ويندوز) ثم اسحب الملف إلى هذه الصفحة، أو انسخ الصورة والصقها هنا مباشرة. يحسّن النظام الصورة لتبدو كمستند ممسوح ويربطها بالزبون أو المورد. قراءة الماسح مباشرة بدون وسيط (TWAIN/WIA) تتاح عند تحويل البرنامج إلى نسخة سطح المكتب.</div></div></div>
      <div class="toolbar"><div class="search">${ICO('search')}<input class="inp" id="d-q" placeholder="العنوان، الرقم المرجعي، الزبون أو المورد" value="${esc(DocF.q)}"></div>
        <div class="seg"><button class="${!DocF.kind ? 'on' : ''}" data-act="docKind" data-k="">الكل</button>${DOC_KINDS.map(k => `<button class="${DocF.kind === k ? 'on' : ''}" data-act="docKind" data-k="${k}">${k}</button>`).join('')}</div></div>
      ${list.length ? `<div class="docs">${list.map(d => `<div class="doc" data-act="viewDoc" data-id="${d.id}"><div class="th" data-th="${d.id}">${ICO(d.mime === 'application/pdf' ? 'doc' : 'scan')}</div>
        <div class="dm"><b>${esc(d.title)}</b><span class="muted">${esc(d.kind)} · ${fdate(d.date)}</span>${d.partyId ? `<br><span class="ink2">${esc(d.party === 's' ? supName(d.partyId) : custName(d.partyId))}</span>` : ''}</div></div>`).join('')}</div>` : emptyHTML('doc', 'الأرشيف فارغ', '<br>امسح أول مستند لتبدأ')}`;
  },
  after() {
    const inp = $('#doc-file'), drop = $('#drop');
    inp.onchange = () => { scanEditor(inp.files); inp.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => scanEditor(e.dataTransfer.files));
    const q = $('#d-q'); q.addEventListener('input', debounce(() => { DocF.q = q.value.trim(); Shell.refresh(); const n = $('#d-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
    $$('[data-th]').forEach(async el => { const t = await DocStore.get('t:' + el.dataset.th).catch(() => null); if (t) { el.style.backgroundImage = `url("${t}")`; el.innerHTML = ''; } });
  }
};
document.addEventListener('paste', e => {
  if (!Session.user || Shell.route !== 'docs' || !can('docs')) return;
  const files = [...(e.clipboardData || {}).files || []].filter(f => /^image\//.test(f.type));
  if (files.length) { e.preventDefault(); scanEditor(files.map((f, i) => new File([f], `مستند ملصق ${i + 1}.png`, { type: f.type }))); }
});
Object.assign(ACTS, {
  docKind: el => { DocF.kind = el.dataset.k; Shell.refresh(); },
  viewDoc: async el => {
    const d = byId('docs', el.dataset.id); if (!d) return toast('المستند غير موجود', 'warn');
    const src = await DocStore.get('f:' + d.id).catch(() => null);
    if (!src) return toast('ملف المستند غير موجود في هذا المتصفح', 'warn');
    const md = modal({
      title: esc(d.title), size: 'wide',
      body: `<div class="scan-view" style="margin-bottom:12px">${d.mime === 'application/pdf' ? `<embed src="${src}" type="application/pdf" style="width:100%;height:60vh">` : `<img src="${src}" style="max-width:100%;max-height:62vh;border-radius:6px" alt="">`}</div>
        <div class="row" style="font-size:13px;color:var(--ink2);gap:16px"><span>${esc(d.kind)}</span><span>${ftime(d.at)}</span>${d.partyId ? `<span>${esc(d.party === 's' ? supName(d.partyId) : custName(d.partyId))}</span>` : ''}${d.refNo ? `<span class="mono">${esc(d.refNo)}</span>` : ''}<span>${fmt(d.size / 1024)} ك.ب</span><span>بواسطة ${esc(userName(d.user))}</span></div>`,
      foot: `${d.mime !== 'application/pdf' ? `<button class="btn pri" data-p>${ICO('print')} طباعة</button>` : ''}<button class="btn" data-dl>${ICO('download')} تنزيل</button>${can('void') ? `<button class="btn dan" data-del>${ICO('trash')} حذف</button>` : ''}`
    });
    const p = $('[data-p]', md.el); if (p) p.onclick = () => printHTML(`<img src="${src}" style="max-width:100%">`);
    $('[data-dl]', md.el).onclick = () => downloadFile(`${d.title}.${d.mime === 'application/pdf' ? 'pdf' : 'jpg'}`, src);
    const dl = $('[data-del]', md.el); if (dl) dl.onclick = async () => { if (await confirmBox('حذف المستند نهائياً؟', { ok: 'حذف', danger: true })) { await DocStore.del('f:' + d.id); await DocStore.del('t:' + d.id); db.docs = db.docs.filter(x => x.id !== d.id); db.purchases.forEach(x => { if (x.docId === d.id) x.docId = null; }); logAct('حذف مستند', d.title); md.close(); rerender(); } };
  }
});

/* ===================== التقارير ===================== */
const RepF = { p: 'month', from: '', to: '' };
function repRange() {
  const t = today();
  if (RepF.p === 'today') return [t, t];
  if (RepF.p === '7') return [addDays(t, -6), t];
  if (RepF.p === 'month') return [t.slice(0, 8) + '01', t];
  if (RepF.p === 'last') { const d = new Date(t + 'T12:00:00'); d.setDate(0); const e = dstr(d); return [e.slice(0, 8) + '01', e]; }
  return [RepF.from || addDays(t, -29), RepF.to || t];
}
function reportData() {
  const [from, to] = repRange();
  const inv = liveSales().filter(i => i.date >= from && i.date <= to);
  const byCat = {}, byMat = {}, byUser = {};
  let net = 0, cost = 0;
  inv.forEach(i => {
    const f = i.sub ? (i.sub - i.discount) / i.sub : 1;
    byUser[i.user] = (byUser[i.user] || { n: 0, v: 0 }); byUser[i.user].n++; byUser[i.user].v += invNet(i);
    i.lines.forEach(l => {
      const q = l.qty - retQty(i, l.mid); if (q <= 0) return;
      const m = matById(l.mid), cat = m ? m.cat : 'محذوفة', rev = q * l.price * f, c = q * (l.cost || 0);
      net += rev; cost += c; byCat[cat] = (byCat[cat] || 0) + rev;
      const k = byMat[l.mid] || (byMat[l.mid] = { name: l.name, unit: l.unit, q: 0, v: 0, c: 0 }); k.q += q; k.v += rev; k.c += c;
    });
  });
  const inP = p => p.date >= from && p.date <= to;
  const collected = db.payments.filter(p => p.type === 'in' && p.party === 'c' && inP(p)).reduce((s, p) => s + p.amount, 0) - db.payments.filter(p => p.type === 'out' && p.party === 'c' && inP(p)).reduce((s, p) => s + p.amount, 0);
  const purchases = db.purchases.filter(p => !p.void && inP(p)).reduce((s, p) => s + p.total, 0);
  const expenses = db.expenses.filter(inP).reduce((s, e) => s + e.amount, 0);
  const returns = liveSales().reduce((s, i) => s + (i.returns || []).filter(inP).reduce((a, r) => a + r.amount, 0), 0);
  const sales = inv.reduce((s, i) => s + invNet(i), 0);
  return { from, to, inv, sales, net, cost, profit: net - cost, expenses, netProfit: net - cost - expenses, returns, collected, purchases, byCat, byMat, byUser, delivery: inv.reduce((s, i) => s + (i.delivery || 0), 0) };
}
Views.reports = {
  dim: () => { const [f, t] = repRange(); return `${fdate(f)} — ${fdate(t)}`; },
  render() {
    const R = reportData(), cc = can('cost');
    const cats = Object.entries(R.byCat).sort((a, b) => b[1] - a[1]), maxC = Math.max(1, ...cats.map(c => c[1]));
    const mats = Object.values(R.byMat).sort((a, b) => b.v - a.v).slice(0, 12);
    const days = daysBetween(R.from, R.to);
    const stockVal = db.materials.reduce((s, m) => s + Math.max(0, m.stock) * m.cost, 0);
    return `<div class="toolbar"><div class="seg">${[['today', 'اليوم'], ['7', '7 أيام'], ['month', 'هذا الشهر'], ['last', 'الشهر الماضي'], ['custom', 'مخصص']].map(([k, t]) => `<button class="${RepF.p === k ? 'on' : ''}" data-act="repP" data-p="${k}">${t}</button>`).join('')}</div>
      ${RepF.p === 'custom' ? `<input type="date" class="inp" style="width:auto" id="r-from" value="${R.from}"><input type="date" class="inp" style="width:auto" id="r-to" value="${R.to}">` : ''}
      <span class="spacer"></span><button class="btn" data-act="repPrint">${ICO('print')} طباعة التقرير</button></div>
    <div class="grid g4" style="margin-bottom:18px">
      <div class="card kpi"><div class="k-top"><span class="k-ico">${ICO('pos')}</span>المبيعات</div><div class="k-val num">${money(R.sales)}</div><div class="k-sub">${R.inv.length} فاتورة · نقل ${fmt(R.delivery)}</div></div>
      ${cc ? `<div class="card kpi brass"><div class="k-top"><span class="k-ico">${ICO('chart')}</span>مجمل الربح</div><div class="k-val num">${money(R.profit)}</div><div class="k-sub">هامش ${R.net ? fmt(R.profit / R.net * 100) : 0}% · كلفة ${fmt(R.cost)}</div></div>` : ''}
      <div class="card kpi"><div class="k-top"><span class="k-ico">${ICO('cash')}</span>المقبوضات</div><div class="k-val num">${money(R.collected)}</div><div class="k-sub">نقدي وتسديدات ديون</div></div>
      <div class="card kpi warn"><div class="k-top"><span class="k-ico">${ICO('cart')}</span>المشتريات</div><div class="k-val num">${money(R.purchases)}</div><div class="k-sub">${cc ? `قيمة المخزون الحالي ${moneyT(stockVal)}` : ''}</div></div>
    </div>
    ${cc ? `<div class="grid g4" style="margin-bottom:18px">
      <div class="card kpi danger"><div class="k-top"><span class="k-ico">${ICO('wallet')}</span>المصروفات</div><div class="k-val num">${money(R.expenses)}</div><div class="k-sub">رواتب، نقل، كهرباء…</div></div>
      <div class="card kpi" style="grid-column:span 2"><div class="k-top"><span class="k-ico">${ICO('bolt')}</span>صافي الربح بعد المصروفات</div><div class="k-val num ${R.netProfit < 0 ? 'danger-t' : 'ok-t'}">${money(R.netProfit)}</div><div class="k-sub">مجمل الربح ${moneyT(R.profit)} − المصروفات ${moneyT(R.expenses)}</div></div>
      <div class="card kpi warn"><div class="k-top"><span class="k-ico">${ICO('undo')}</span>المرتجعات</div><div class="k-val num">${money(R.returns)}</div><div class="k-sub">مخصومة من المبيعات</div></div></div>` : ''}
    <div class="grid g-side" style="margin-bottom:18px">
      <div class="card"><div class="card-h"><h3>المبيعات اليومية</h3></div><div class="card-b">${days <= 92 ? barChart(salesByDay(R.from, R.to)) : '<p class="muted">اختر فترة أقصر من 3 أشهر لعرض المخطط اليومي.</p>'}</div></div>
      <div class="card"><div class="card-h"><h3>المبيعات حسب الصنف</h3></div><div class="card-b"><div class="hbars">${cats.map(([c, v]) => `<div class="hbar" data-tip="<b>${esc(c)}</b><br>${moneyT(v)} · ${R.sales ? fmt(v / R.sales * 100) : 0}%"><span>${esc(c)}</span><div class="tr"><i style="width:${v / maxC * 100}%"></i></div><span class="v">${fmt(v)}</span></div>`).join('') || '<p class="muted">لا توجد مبيعات</p>'}</div></div></div>
    </div>
    <div class="grid g-side">
      <div class="card"><div class="card-h"><h3>أكثر الأصناف مبيعاً</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th class="n">الكمية</th><th class="n">المبيعات</th>${cc ? '<th class="n">الربح</th>' : ''}</tr></thead><tbody>
        ${mats.map(m => `<tr><td>${esc(m.name)}</td><td class="n">${fmt(m.q)} <span class="muted">${esc(m.unit)}</span></td><td class="n">${fmt(m.v)}</td>${cc ? `<td class="n ok-t">${fmt(m.v - m.c)}</td>` : ''}</tr>`).join('')}</tbody></table>${mats.length ? '' : emptyHTML('chart', 'لا توجد بيانات')}</div></div>
      <div class="card"><div class="card-h"><h3>المبيعات حسب المستخدم</h3></div><div class="list">${Object.entries(R.byUser).sort((a, b) => b[1].v - a[1].v).map(([u, x]) => `<div class="li"><div class="l-ico">${esc(userName(u)[0])}</div><div class="l-main"><b>${esc(userName(u))}</b><span>${x.n} فاتورة</span></div><div class="l-end num">${fmt(x.v)}</div></div>`).join('') || emptyHTML('user', 'لا توجد بيانات')}</div></div>
    </div>`;
  },
  after() {
    const f = $('#r-from'), t = $('#r-to');
    if (f) { f.onchange = () => { RepF.from = f.value; Shell.refresh(); }; t.onchange = () => { RepF.to = t.value; Shell.refresh(); }; }
  }
};
Object.assign(ACTS, {
  repP: el => { RepF.p = el.dataset.p; Shell.refresh(); },
  repPrint: () => {
    const R = reportData(), cc = can('cost');
    printHTML(`<div class="pr-h"><div>${brandHTML(db.settings.company)}</div><div style="text-align:left"><p class="pr-title">تقرير المبيعات</p><div>${fdate(R.from)} — ${fdate(R.to)}</div></div></div>
      <div class="pr-meta"><div><b>المبيعات:</b> ${moneyT(R.sales)} (${R.inv.length} فاتورة)</div><div><b>المقبوضات:</b> ${moneyT(R.collected)}</div>${cc ? `<div><b>الكلفة:</b> ${moneyT(R.cost)}</div><div><b>مجمل الربح:</b> ${moneyT(R.profit)}</div>` : ''}<div><b>المشتريات:</b> ${moneyT(R.purchases)}</div><div><b>أجور النقل:</b> ${moneyT(R.delivery)}</div>${cc ? `<div><b>المصروفات:</b> ${moneyT(R.expenses)}</div><div><b>صافي الربح:</b> ${moneyT(R.netProfit)}</div>` : ''}<div><b>المرتجعات:</b> ${moneyT(R.returns)}</div></div>
      <table><thead><tr><th>الصنف</th><th class="n">الكمية</th><th class="n">المبيعات</th>${cc ? '<th class="n">الربح</th>' : ''}</tr></thead><tbody>${Object.values(R.byMat).sort((a, b) => b.v - a.v).map(m => `<tr><td>${esc(m.name)}</td><td class="n">${fmt(m.q)} ${esc(m.unit)}</td><td class="n">${fmt(m.v)}</td>${cc ? `<td class="n">${fmt(m.v - m.c)}</td>` : ''}</tr>`).join('')}</tbody></table>
      <div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي · طُبع بواسطة ${esc(Session.user.name)}</div>`);
  }
});

/* ===================== المستخدمون والصلاحيات ===================== */
Views.users = {
  dim: () => `${db.users.length} مستخدم · ${db.users.filter(u => u.active !== false).length} نشط`,
  render() {
    return `<div class="toolbar"><span class="spacer"></span><button class="btn" data-act="noticeAll">${ICO('msg')} رسالة داخلية</button><button class="btn pri" data-act="newUser">${ICO('plus')} مستخدم جديد</button></div>
      <div class="grid g3">${db.users.map(u => `<div class="card ${u.role === 'admin' ? 'marks' : ''}"><div class="card-b">
        <div class="row" style="flex-wrap:nowrap"><div class="avatar" style="${u.role === 'admin' ? '' : 'background:var(--accent-soft);color:var(--accent)'}">${esc(u.name.trim()[0])}</div>
          <div style="flex:1;min-width:0;line-height:1.35"><b style="font-family:var(--fd);font-weight:600">${esc(u.name)}</b>${u.id === Session.user.id ? ' <span class="chip acc plain">أنت</span>' : ''}<div class="muted mono" style="font-size:12px">${esc(u.username)}</div></div>
          <span class="chip ${u.active === false ? 'dan' : 'ok'}">${u.active === false ? 'موقوف' : 'نشط'}</span></div>
        <div class="ruler" style="margin:14px 0 10px;height:8px"></div>
        <div class="row" style="font-size:12.5px;color:var(--ink2)"><span class="chip ${u.role === 'admin' ? 'brass' : 'plain'}">${esc(ROLES[u.role] ? ROLES[u.role].name : 'مخصص')}</span><span>${u.role === 'admin' ? 'كل الصلاحيات' : `${(u.perms || []).length} صلاحية`}</span><span class="spacer"></span><span class="muted">آخر دخول: ${u.lastLogin ? ftime(u.lastLogin) : '—'}</span></div>
        <div class="row" style="margin-top:12px"><button class="btn sm" data-act="editUser" data-id="${u.id}">${ICO('edit')} تعديل</button>${u.id !== Session.user.id ? `<button class="btn sm" data-act="noticeUser" data-id="${u.id}">${ICO('msg')}</button><button class="btn sm dan" data-act="delUser" data-id="${u.id}">${ICO('trash')}</button>` : ''}</div>
      </div></div>`).join('')}</div>`;
  }
};
function editUser(id) {
  const u = id ? userById(id) : { name: '', username: '', role: 'sales', perms: ROLES.sales.perms.slice(), active: true };
  const md = modal({
    title: id ? 'تعديل مستخدم' : 'مستخدم جديد', size: 'wide',
    body: `<div class="form-grid" style="margin-bottom:14px"><div class="field"><label>الاسم</label><input class="inp" name="name" value="${esc(u.name)}"></div>
      <div class="field"><label>اسم المستخدم</label><input class="inp" name="username" value="${esc(u.username)}" dir="ltr"></div>
      <div class="field"><label>${id ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</label><input class="inp" type="password" name="pass" dir="ltr"></div>
      <div class="field"><label>الدور</label><select class="sel" name="role">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${r.name}</option>`).join('')}<option value="custom" ${!ROLES[u.role] ? 'selected' : ''}>مخصص</option></select></div></div>
      <div class="field"><label>الصلاحيات</label><div class="perm-grid">${PERMS.map(([k, t]) => `<label class="check"><input type="checkbox" data-perm="${k}" ${u.role === 'admin' || (u.perms || []).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
      <label class="check" style="margin-top:12px"><input type="checkbox" name="active" ${u.active !== false ? 'checked' : ''} ${id === Session.user.id ? 'disabled' : ''}> الحساب نشط</label>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ</button>`
  });
  const role = $('[name=role]', md.el), lock = () => $$('[data-perm]', md.el).forEach(c => { c.disabled = role.value === 'admin'; });
  role.onchange = () => { if (ROLES[role.value]) $$('[data-perm]', md.el).forEach(c => c.checked = ROLES[role.value].perms.includes(c.dataset.perm)); lock(); };
  $$('[data-perm]', md.el).forEach(c => c.addEventListener('change', () => { if (role.value !== 'custom') role.value = 'custom'; }));
  lock();
  $('[data-ok]', md.el).onclick = () => {
    const v = formVals(md.el), perms = $$('[data-perm]', md.el).filter(c => c.checked).map(c => c.dataset.perm);
    v.username = v.username.toLowerCase();
    if (!v.name || !v.username) return toast('أدخل الاسم واسم المستخدم', 'warn');
    if (db.users.some(x => x.username === v.username && x.id !== id)) return toast('اسم المستخدم مستخدم مسبقاً', 'warn');
    if (!id && v.pass.length < 4) return toast('كلمة المرور 4 أحرف على الأقل', 'warn');
    if (id && u.role === 'admin' && v.role !== 'admin' && db.users.filter(x => x.role === 'admin').length === 1) return toast('يجب أن يبقى مدير واحد على الأقل', 'warn');
    if (!perms.length && v.role !== 'admin') return toast('اختر صلاحية واحدة على الأقل', 'warn');
    const rec = { name: v.name, username: v.username, role: v.role, perms: v.role === 'admin' ? ALL_PERMS.slice() : perms, active: id === Session.user.id ? true : v.active };
    if (v.pass) { rec.salt = uid(); rec.hash = hashPass(v.pass, rec.salt); }
    if (id) Object.assign(u, rec); else db.users.push({ id: uid(), ...rec, created: Date.now() });
    logAct(id ? 'تعديل مستخدم' : 'إضافة مستخدم', `${v.name} (${ROLES[v.role] ? ROLES[v.role].name : 'مخصص'})`);
    md.close(); rerender(); toast('حُفظ المستخدم');
  };
}
Object.assign(ACTS, {
  newUser: () => editUser(null), editUser: el => editUser(el.dataset.id),
  noticeAll: () => composeNotice('all'), noticeUser: el => composeNotice(el.dataset.id),
  delUser: async el => {
    const u = userById(el.dataset.id);
    if (u.role === 'admin' && db.users.filter(x => x.role === 'admin').length === 1) return toast('لا يمكن حذف المدير الوحيد', 'warn');
    if (await confirmBox(`حذف المستخدم <b>${esc(u.name)}</b>؟ تبقى العمليات التي أجراها في السجل. يُفضّل إيقاف الحساب بدلاً من حذفه.`, { ok: 'حذف', danger: true })) { db.users = db.users.filter(x => x.id !== u.id); logAct('حذف مستخدم', u.name); rerender(); }
  }
});

/* ===================== سجل العمليات ===================== */
const LogF = { u: '', q: '' };
Views.log = {
  dim: () => `${db.log.length} عملية مسجلة`,
  render() {
    const q = LogF.q.toLowerCase(), rows = db.log.filter(l => (!LogF.u || l.user === LogF.u) && (!q || (l.action + ' ' + l.detail).toLowerCase().includes(q))).slice(0, 500);
    return `<div class="toolbar"><div class="search">${ICO('search')}<input class="inp" id="l-q" placeholder="بحث في العمليات" value="${esc(LogF.q)}"></div>
      <select class="sel" id="l-u" style="width:auto"><option value="">كل المستخدمين</option>${db.users.map(u => `<option value="${u.id}" ${LogF.u === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>
      ${rows.map(l => `<tr><td class="t-sub" style="white-space:nowrap">${ftime(l.at)}</td><td>${esc(userName(l.user))}</td><td class="t-main">${esc(l.action)}</td><td class="t-sub">${esc(l.detail)}</td></tr>`).join('')}</tbody></table>${rows.length ? '' : emptyHTML('log', 'لا توجد عمليات')}</div></div>`;
  },
  after() {
    const q = $('#l-q'); q.addEventListener('input', debounce(() => { LogF.q = q.value.trim(); Shell.refresh(); const n = $('#l-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
    $('#l-u').onchange = e => { LogF.u = e.target.value; Shell.refresh(); };
  }
};

/* ===================== الإعدادات ===================== */
Views.settings = {
  dim: () => 'بيانات المخزن، البيع، الترخيص والنسخ الاحتياطي',
  render() {
    const s = db.settings, th = lsGet(Theme.KEY, 'auto');
    return `<div class="grid g2" style="align-items:start">
      <div class="stack">
        <div class="card"><div class="card-h"><h3>${ICO('factory')} بيانات المخزن</h3></div><div class="card-b"><div class="form-grid" id="set-co">
          <div class="field full"><label>اسم المخزن / الشركة (يظهر في الفواتير والرسائل)</label><input class="inp" name="company" value="${esc(s.company)}"></div>
          <div class="field"><label>الهاتف</label><input class="inp" name="phone" value="${esc(s.phone)}" dir="ltr"></div><div class="field"><label>العنوان</label><input class="inp" name="address" value="${esc(s.address)}"></div>
          <div class="field full"><label>ملاحظة أسفل الفاتورة</label><input class="inp" name="invoiceNote" value="${esc(s.invoiceNote)}"></div></div></div></div>
        <div class="card"><div class="card-h"><h3>${ICO('pos')} البيع والمخزن</h3></div><div class="card-b"><div class="form-grid" id="set-sale">
          <div class="field"><label>العملة</label><input class="inp" name="currency" value="${esc(s.currency)}"></div><div class="field"><label>نسبة الضريبة %</label><input class="inp num" name="tax" value="${s.tax}"></div>
          <div class="field"><label>مدة الاستحقاق الافتراضية (يوم)</label><input class="inp num" name="dueDays" value="${s.dueDays}"></div><div class="field"><label>رمز الدولة للرسائل</label><input class="inp num" name="country" value="${esc(s.country)}"><span class="hint">العراق 964 — يحوّل 07XX إلى 9647XX</span></div>
          <label class="check full"><input type="checkbox" name="blockNegative" ${s.blockNegative ? 'checked' : ''}> منع البيع بكمية أكبر من المخزون المتوفر</label></div></div></div>
        <div class="card"><div class="card-h"><h3>${ICO('wa')} واتساب للأعمال — الإرسال المباشر</h3>${WA.api() ? '<span class="chip ok">مفعّل</span>' : '<span class="chip plain">غير مفعّل</span>'}</div><div class="card-b"><div class="form-grid" id="set-wa">
          <div class="field full"><label>طريقة الإرسال</label><select class="sel" name="mode"><option value="link" ${s.wa.mode !== 'api' ? 'selected' : ''}>فتح محادثة واتساب والنص جاهز (بدون إعداد)</option><option value="api" ${s.wa.mode === 'api' ? 'selected' : ''}>إرسال مباشر تلقائي من البرنامج (WhatsApp Cloud API)</option></select></div>
          <div class="field"><label>Phone Number ID</label><input class="inp mono" name="phoneId" value="${esc(s.wa.phoneId)}" dir="ltr"></div><div class="field"><label>رمز الوصول (Access Token)</label><input class="inp mono" type="password" name="token" value="${esc(s.wa.token)}" dir="ltr"></div>
          <div class="field"><label>نوع الرسالة</label><select class="sel" name="apiType"><option value="template" ${s.wa.apiType !== 'text' ? 'selected' : ''}>قالب معتمد بمتغير واحد {{1}}</option><option value="text" ${s.wa.apiType === 'text' ? 'selected' : ''}>نص حر (ضمن 24 ساعة من آخر رسالة للزبون)</option></select></div>
          <div class="field"><label>اسم القالب ولغته</label><div class="row" style="flex-wrap:nowrap"><input class="inp mono" name="template" value="${esc(s.wa.template)}" dir="ltr" placeholder="payment_reminder"><input class="inp mono" name="lang" value="${esc(s.wa.lang)}" dir="ltr" style="width:70px"></div></div>
          <p class="hint full" style="margin:0">تحصل على البيانات من حساب Meta for Developers ← WhatsApp. واتساب يشترط قالباً معتمداً للرسائل التي يبدأها المتجر، فأنشئ قالباً نصه {{1}} ليضع البرنامج رسالتك كاملة فيه. يُحفظ الرمز في هذا المتصفح فقط.</p>
          <div class="row full"><input class="inp" id="wa-test" placeholder="رقم للاختبار 07XXXXXXXXX" dir="ltr" style="max-width:220px"><button class="btn sm" data-act="waTest">${ICO('send')} إرسال رسالة اختبار</button></div></div></div></div>
        <div class="row"><button class="btn pri" data-act="saveSettings">${ICO('check')} حفظ الإعدادات</button></div>
      </div>
      <div class="stack">
        <div class="card marks"><div class="card-h"><h3>${ICO('key')} الترخيص</h3>${License.activated ? '<span class="chip ok">مفعّل</span>' : `<span class="chip brass">تجريبي — ${License.daysLeft} يوماً</span>`}</div><div class="card-b">
          <div class="machine"><div><div style="font-size:11.5px;color:var(--ink2)">رقم الحاسبة</div><div class="mono">${esc(License.data.machine)}</div></div><button class="btn sm" data-act="copyMachine">${ICO('copy')} نسخ</button></div>
          <p class="muted" style="margin:0 0 12px;font-size:13px">رمز البرنامج <b class="mono">${APP.code}</b> · الإصدار ${APP.version}</p>
          ${License.activated ? '' : `<button class="btn brass" data-act="activate">${ICO('key')} إدخال الرقم التسلسلي</button>`}</div></div>
        <div class="card"><div class="card-h"><h3>${ICO('moon')} المظهر</h3></div><div class="card-b"><div class="seg">${[['auto', 'حسب الجهاز'], ['light', 'نهاري'], ['dark', 'ليلي']].map(([k, t]) => `<button class="${th === k ? 'on' : ''}" data-act="setTheme" data-t="${k}">${t}</button>`).join('')}</div></div></div>
        <div class="card"><div class="card-h"><h3>${ICO('download')} النسخ الاحتياطي</h3></div><div class="card-b">
          <p class="muted" style="margin-top:0;font-size:13px">البيانات محفوظة في هذا المتصفح على هذا الجهاز. خذ نسخة احتياطية بانتظام واحفظها خارج الجهاز.</p>
          <label class="check" style="margin-bottom:12px"><input type="checkbox" id="bk-docs"> تضمين المستندات الممسوحة (حجم أكبر)</label>
          <div class="row"><button class="btn" data-act="backup">${ICO('download')} تنزيل نسخة</button><button class="btn" data-act="backupCopy">${ICO('copy')} نسخ للحافظة</button>
          <label class="btn" style="cursor:pointer">${ICO('upload')} استعادة من ملف<input type="file" id="restore-file" accept=".json,application/json" hidden></label><button class="btn ghost" data-act="restorePaste">استعادة بلصق النص</button></div></div></div>
        ${Session.user.role === 'admin' ? `<div class="card" style="border-color:color-mix(in srgb,var(--danger) 35%,var(--line))"><div class="card-h"><h3 class="danger-t">${ICO('warn')} منطقة الخطر</h3></div><div class="card-b"><p class="muted" style="margin-top:0;font-size:13px">حذف جميع البيانات والبدء من جديد. لا يمكن التراجع.</p><button class="btn dan" data-act="wipe">${ICO('trash')} حذف جميع البيانات</button></div></div>` : ''}
      </div></div>`;
  },
  after() { const f = $('#restore-file'); f.onchange = async () => { const file = f.files[0]; if (file) restoreData(await file.text()); f.value = ''; }; }
};
async function backupJSON() {
  const out = { app: 'mth-tls', version: APP.version, at: Date.now(), db, imgs: {} };
  for (const m of db.materials) { const v = await DocStore.get('img:' + m.id).catch(() => null); if (v) out.imgs[m.id] = v; }
  if ($('#bk-docs') && $('#bk-docs').checked) { out.files = {}; for (const d of db.docs) { out.files[d.id] = { f: await DocStore.get('f:' + d.id).catch(() => null), t: await DocStore.get('t:' + d.id).catch(() => null) }; } }
  return JSON.stringify(out);
}
async function restoreData(text) {
  let o; try { o = JSON.parse(text); } catch { return toast('الملف غير صالح', 'err'); }
  if (!o || o.app !== 'mth-tls' || !o.db || !Array.isArray(o.db.users)) return toast('هذه ليست نسخة احتياطية من هذا البرنامج', 'err');
  if (!await confirmBox(`استعادة النسخة المأخوذة بتاريخ <b>${ftime(o.at)}</b>؟ ستُستبدل جميع البيانات الحالية.`, { ok: 'استعادة', danger: true })) return;
  if (o.imgs) for (const [id, v] of Object.entries(o.imgs)) await DocStore.put('img:' + id, v);
  if (o.files) for (const [id, x] of Object.entries(o.files)) { if (x.f) await DocStore.put('f:' + id, x.f); if (x.t) await DocStore.put('t:' + id, x.t); }
  db = o.db; const base = emptyDb(); for (const k of Object.keys(base)) if (db[k] === undefined) db[k] = base[k];
  saveDb(); toast('تمت الاستعادة، سجّل الدخول من جديد'); Session.logout(); boot();
}
Object.assign(ACTS, {
  saveSettings: () => {
    const a = formVals($('#set-co')), b = formVals($('#set-sale'));
    const w = formVals($('#set-wa')); db.settings.wa = { ...db.settings.wa, ...w };
    if (w.mode === 'api' && (!w.token || !w.phoneId)) toast('أكمل Phone Number ID ورمز الوصول لتفعيل الإرسال المباشر', 'warn', 5000);
    Object.assign(db.settings, a, { currency: b.currency || 'د.ع', tax: num(b.tax), dueDays: num(b.dueDays) || 30, country: b.country.replace(/\D/g, '') || '964', blockNegative: b.blockNegative });
    logAct('تعديل الإعدادات'); rerender(); toast('حُفظت الإعدادات');
  },
  waTest: async () => {
    const w = formVals($('#set-wa')), ph = intlPhone($('#wa-test').value);
    if (!w.token || !w.phoneId) return toast('أدخل Phone Number ID ورمز الوصول', 'warn');
    if (!ph) return toast('أدخل رقم الاختبار', 'warn');
    const old = db.settings.wa; db.settings.wa = { ...old, ...w, mode: 'api' };
    const r = await WA.sendAPI(ph, `رسالة اختبار من ${db.settings.company} — نظام المثلث`); db.settings.wa = old;
    toast(r.ok ? 'نجح الاختبار، وصلت الرسالة. احفظ الإعدادات.' : 'فشل الاختبار: ' + r.err, r.ok ? 'ok' : 'err', 7000);
  },
  setTheme: el => { Theme.set(el.dataset.t); Shell.refresh(); },
  backup: async () => { downloadFile(`نسخة-المثلث-العدد-الإنشائية-${today()}.json`, await backupJSON()); logAct('نسخة احتياطية'); saveDb(); },
  backupCopy: async () => copyText(await backupJSON()),
  restorePaste: () => {
    const m = modal({ title: 'استعادة بلصق النص', body: `<textarea class="txt" rows="10" id="rp" dir="ltr" placeholder="الصق نص النسخة الاحتياطية هنا"></textarea>`, foot: `<button class="btn pri" data-ok>استعادة</button>` });
    $('[data-ok]', m.el).onclick = () => { const t = $('#rp', m.el).value; m.close(); restoreData(t); };
  },
  wipe: async () => {
    const m = modal({ title: 'حذف جميع البيانات', size: 'narrow', body: `<p style="margin-top:0">اكتب كلمة <b>حذف</b> للتأكيد.</p><input class="inp" id="wp">`, foot: `<button class="btn dan" data-ok>حذف نهائي</button>` });
    $('[data-ok]', m.el).onclick = async () => {
      if ($('#wp', m.el).value.trim() !== 'حذف') return toast('اكتب كلمة «حذف» للتأكيد', 'warn');
      for (const d of db.docs) { await DocStore.del('f:' + d.id).catch(() => { }); await DocStore.del('t:' + d.id).catch(() => { }); }
      try { localStorage.removeItem(DB_KEY); } catch { }
      db = emptyDb(); Session.user = null; try { sessionStorage.removeItem(Session.KEY); } catch { } m.close(); boot();
    };
  }
});
