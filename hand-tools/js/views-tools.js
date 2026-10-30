/* المثلث · نظام مستودع العدد الإنشائية — تفاصيل العدد، الأرقام التسلسلية، الضمان، الصيانة */
'use strict';

const toolSub = m => [m.brand, m.model, m.size].filter(Boolean).join(' · ');
const imgCache = new Map();
async function toolImg(id) { if (imgCache.has(id)) return imgCache.get(id); const v = await DocStore.get('img:' + id).catch(() => null); imgCache.set(id, v || null); return v; }
function loadImgs(root = document) { $$('[data-img]', root).forEach(async el => { const v = await toolImg(el.dataset.img); if (v) { el.style.backgroundImage = `url("${v}")`; el.classList.add('has'); } }); }

/* ===================== بطاقة تفاصيل العدّة ===================== */
function detailRows(m) {
  return [['الماركة', m.brand], ['الموديل', m.model], ['المقاس / الحجم', m.size], ['بلد المنشأ', m.origin], ['الخامة', m.matl], ['الوزن', m.weight], ['نوع الطاقة', m.power],
    ['الضمان', m.warranty ? `${m.warranty} شهراً` : 'بدون ضمان'], ['الصنف', m.cat], ['الوحدة', m.unit], ['موقع الخزن', m.loc], ['المورد', supName(m.supplierId)], ...(m.specs || [])].filter(r => r[1] && r[1] !== '—');
}
function quickMaterial(m) {
  if (!m) return;
  const st = stockState(m), sns = snOf(m.id), inStock = sns.filter(x => x.status === 'stock'), sold = sns.filter(x => x.status === 'sold');
  const sales = liveSales().filter(i => i.lines.some(l => l.mid === m.id)).slice(0, 6);
  const acc = (m.acc || []).map(matById).filter(Boolean);
  const md = modal({
    title: `بطاقة العدّة`, size: 'wide',
    body: `<div class="tool-card">
      <div class="tc-img" data-img="${m.id}">${ICO('wrench')}</div>
      <div class="tc-main"><div class="row" style="gap:6px">${m.brand ? `<span class="chip brass plain">${esc(m.brand)}</span>` : ''}<span class="chip plain">${esc(m.cat)}</span>${m.power ? `<span class="chip acc plain">${esc(m.power)}</span>` : ''}${m.serialTracked ? `<span class="chip plain">${ICO('key').replace('<svg', '<svg style="width:12px;height:12px"')} برقم تسلسلي</span>` : ''}</div>
        <h2 class="look-name">${esc(m.name)}</h2><div class="muted mono" style="direction:ltr;text-align:right">${esc([m.model, m.size].filter(Boolean).join(' · '))}</div>
        <div class="look-nums" style="margin-top:14px"><div><span>سعر المفرد</span><b>${money(m.price)}</b></div><div><span>سعر الجملة</span><b>${money(m.wprice)}</b></div>
          <div><span>المخزون</span><b class="${st === 'low' || st === 'out' ? 'danger-t' : ''}">${fmt(m.stock)} <small>${esc(m.unit)}</small></b></div><div><span>الضمان</span><b>${m.warranty ? `${m.warranty} <small>شهراً</small>` : '<small>بدون</small>'}</b></div></div>
        <div style="width:230px;margin-top:12px">${barcodeSVG(m.barcode, { h: 34 })}</div></div></div>
      ${m.desc ? `<p style="margin:16px 0 0;line-height:1.9">${esc(m.desc)}</p>` : ''}
      <div class="grid g2" style="margin-top:16px;align-items:start">
        <div class="card"><div class="card-h"><h3>${ICO('layers')} المواصفات والتفاصيل</h3></div><table class="tbl specs">${detailRows(m).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
        <div class="stack">
          ${m.serialTracked ? `<div class="card"><div class="card-h"><h3>${ICO('key')} الأرقام التسلسلية</h3><span class="tag">${inStock.length} في المخزن · ${sold.length} مباعة</span>${can('materials') || can('scanner') ? `<button class="btn xs" data-addsn>${ICO('plus')} إضافة</button>` : ''}</div>
            <div class="sn-list">${sns.slice(0, 40).map(x => `<button class="sn ${x.status}" data-sn="${esc(x.sn)}" title="${x.status === 'sold' ? esc(warrantyState(x).t) : 'في المخزن'}">${esc(x.sn)}</button>`).join('') || '<span class="muted" style="padding:12px 16px;display:block">لا توجد أرقام مسجلة</span>'}</div></div>` : ''}
          ${acc.length ? `<div class="card"><div class="card-h"><h3>${ICO('plus')} ملحقات مناسبة</h3></div><div class="list">${acc.map(a => `<div class="li" style="cursor:pointer" data-accid="${a.id}"><div class="l-ico">${ICO('box')}</div><div class="l-main"><b>${esc(a.name)}</b><span>${esc(toolSub(a))}</span></div><div class="l-end num">${fmt(a.price)}</div></div>`).join('')}</div></div>` : ''}
          <div class="card"><div class="card-h"><h3>${ICO('inv')} آخر المبيعات</h3></div><div class="list">${sales.map(i => `<div class="li" style="cursor:pointer" data-act="viewInv" data-id="${i.id}"><div class="l-main"><b>${esc(custName(i.customerId))}</b><span>فاتورة ${i.no} · ${fdate(i.date)}</span></div><div class="l-end num">${fmt(i.lines.filter(l => l.mid === m.id).reduce((s, l) => s + l.qty, 0))} ${esc(m.unit)}</div></div>`).join('') || '<div class="empty" style="padding:18px">لم يُبع بعد</div>'}</div></div>
        </div></div>`,
    foot: `${can('pos') ? `<button class="btn pri" data-sell>${ICO('pos')} إضافة إلى فاتورة</button>` : ''}${can('materials') ? `<button class="btn" data-edit>${ICO('edit')} تعديل</button>` : ''}<button class="btn" data-print>${ICO('print')} طباعة البطاقة</button>${can('chat') ? `<button class="btn ghost" data-act="shareChat" data-t="material" data-id="${m.id}">${ICO('msg')} مشاركة مع الفريق</button>` : ''}`
  });
  loadImgs(md.el);
  const s = $('[data-sell]', md.el); if (s) s.onclick = () => { md.close(); Shell.go('pos'); posAdd(m.id); };
  const e = $('[data-edit]', md.el); if (e) e.onclick = () => { md.close(); editMaterial(m.id); };
  $('[data-print]', md.el).onclick = async () => {
    const img = await toolImg(m.id);
    printHTML(`<div class="pr-h"><div>${brandHTML(db.settings.company)}</div><div style="text-align:left"><p class="pr-title">بطاقة مواصفات</p><div style="width:170px">${barcodeSVG(m.barcode, { h: 32 })}</div></div></div>
      <div style="display:flex;gap:20px;align-items:flex-start">${img ? `<img src="${img}" style="width:200px;border-radius:8px;border:1px solid #ddd">` : ''}<div style="flex:1"><h2 style="margin:0 0 6px;font-family:var(--fd)">${esc(m.name)}</h2><p style="margin:0 0 10px;color:#555">${esc(toolSub(m))}</p>
      <table><tbody>${detailRows(m).map(([k, v]) => `<tr><td style="width:150px;color:#555">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</tbody></table>
      <p style="font-size:18px"><b>السعر: ${moneyT(m.price)}</b></p></div></div>${m.desc ? `<p>${esc(m.desc)}</p>` : ''}<div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي</div>`);
  };
  $$('[data-sn]', md.el).forEach(b => b.onclick = () => { md.close(); warrantyCard(snFind(b.dataset.sn)); });
  $$('[data-accid]', md.el).forEach(b => b.onclick = () => { md.close(); quickMaterial(matById(b.dataset.accid)); });
  const as = $('[data-addsn]', md.el); if (as) as.onclick = () => { md.close(); addSerialsModal(m.id); };
}

/* ===================== إضافة / تعديل عدّة بكل تفاصيلها ===================== */
function editMaterial(id, preset = {}) {
  if (!can('materials')) return toast('لا تملك صلاحية إدارة الأصناف', 'warn');
  if (!id && !License.activated && db.materials.length >= APP.trialLimit) { toast(`النسخة التجريبية تسمح بـ ${APP.trialLimit} صنف فقط. فعّل البرنامج لإضافة المزيد.`, 'warn', 5000); return activateModal(); }
  const m = id ? matById(id) : { name: '', cat: db.categories[0], unit: 'قطعة', barcode: '', cost: '', price: '', wprice: '', stock: '', min: '', supplierId: null, loc: '', brand: '', model: '', size: '', origin: '', matl: '', weight: '', power: 'يدوية', warranty: 0, serialTracked: false, desc: '', specs: [], acc: [], ...preset };
  const specs = (m.specs || []).map(r => r.slice()); let acc = (m.acc || []).slice(), newImg; // undefined = بدون تغيير، null = حذف
  const cats = [...new Set([...db.categories, ...db.materials.map(x => x.cat)])], brands = [...new Set(db.materials.map(x => x.brand).filter(Boolean))];
  const md = modal({
    title: id ? 'تعديل عدّة' : 'عدّة / صنف جديد', size: 'wide',
    body: `<div class="tabs" id="em-tabs"><button class="on" data-tab="b">الأساسيات والأسعار</button><button data-tab="d">التفاصيل والمواصفات</button><button data-tab="i">الصورة والوصف</button><button data-tab="a">الملحقات</button></div>
    <div data-pane="b"><div class="form-grid c3">
      <div class="field" style="grid-column:span 2"><label>اسم الصنف</label><input class="inp" name="name" value="${esc(m.name)}" placeholder="مثال: مثقاب كهربائي مطرقي 13 ملم"></div>
      <div class="field"><label>الصنف</label><input class="inp" name="cat" value="${esc(m.cat)}" list="cat-list"><datalist id="cat-list">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label>الوحدة</label><input class="inp" name="unit" value="${esc(m.unit)}" list="unit-list"><datalist id="unit-list">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist></div>
      <div class="field" style="grid-column:span 2"><label>الباركود</label><div class="row" style="flex-wrap:nowrap"><input class="inp mono" name="barcode" value="${esc(m.barcode)}" dir="ltr" placeholder="امسح باركود العلبة هنا أو ولّد رقماً"><button type="button" class="btn icon" data-gen title="توليد">${ICO('sparkle')}</button><button type="button" class="btn icon" data-cam title="كاميرا">${ICO('camera')}</button></div><div id="bc-prev" style="height:40px;margin-top:6px;max-width:220px"></div></div>
      ${can('cost') ? `<div class="field"><label>سعر الكلفة</label><input class="inp num" name="cost" value="${m.cost}" inputmode="decimal"></div>` : ''}
      <div class="field"><label>سعر المفرد</label><input class="inp num" name="price" value="${m.price}" inputmode="decimal"></div>
      <div class="field"><label>سعر الجملة / المقاول</label><input class="inp num" name="wprice" value="${m.wprice}" inputmode="decimal"></div>
      ${id ? `<div class="field"><label>المخزون الحالي</label><input class="inp num" value="${m.stock}" disabled></div>` : `<div class="field"><label>الرصيد الافتتاحي</label><input class="inp num" name="stock" value="${m.stock}" inputmode="decimal"></div>`}
      <div class="field"><label>حد إعادة الطلب</label><input class="inp num" name="min" value="${m.min}" inputmode="decimal"></div>
      <div class="field"><label>المورد / الوكيل</label><select class="sel" name="supplierId"><option value="">—</option>${db.suppliers.map(s => `<option value="${s.id}" ${s.id === m.supplierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>موقع الخزن (الرف)</label><input class="inp" name="loc" value="${esc(m.loc)}" placeholder="رف A1"></div>
      <div class="field"><label>هامش الربح</label><div class="inp" id="margin" style="display:flex;align-items:center;background:transparent">—</div></div></div></div>
    <div data-pane="d" class="hidden"><div class="form-grid c3">
      <div class="field"><label>الماركة</label><input class="inp" name="brand" value="${esc(m.brand)}" list="br-list" dir="auto"><datalist id="br-list">${brands.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
      <div class="field"><label>الموديل / رقم القطعة</label><input class="inp mono" name="model" value="${esc(m.model)}" dir="ltr"></div>
      <div class="field"><label>المقاس / الحجم</label><input class="inp" name="size" value="${esc(m.size)}" placeholder="13 ملم، 10 انج، 16 أونصة"></div>
      <div class="field"><label>بلد المنشأ</label><input class="inp" name="origin" value="${esc(m.origin)}" list="or-list"><datalist id="or-list">${ORIGINS.map(o => `<option value="${o}">`).join('')}</datalist></div>
      <div class="field"><label>الخامة</label><input class="inp" name="matl" value="${esc(m.matl)}" placeholder="كروم فاناديوم"></div>
      <div class="field"><label>الوزن</label><input class="inp" name="weight" value="${esc(m.weight)}" placeholder="1.8 كغم"></div>
      <div class="field"><label>نوع الطاقة</label><select class="sel" name="power">${POWER.map(p => `<option ${m.power === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>مدة الضمان (بالأشهر)</label><input class="inp num" name="warranty" value="${m.warranty || ''}" placeholder="0 = بدون ضمان" inputmode="numeric"></div>
      <label class="check" style="align-self:end;margin-bottom:10px"><input type="checkbox" name="serialTracked" ${m.serialTracked ? 'checked' : ''}> يُباع برقم تسلسلي (لتتبع الضمان)</label></div>
      <div class="field" style="margin-top:16px"><label>المواصفات الفنية</label><div id="specs"></div><datalist id="sk-list">${SPEC_KEYS.map(k => `<option value="${k}">`).join('')}</datalist>
        <button type="button" class="btn sm" data-addspec style="margin-top:8px;align-self:flex-start">${ICO('plus')} إضافة مواصفة</button></div></div>
    <div data-pane="i" class="hidden"><div class="grid g2" style="align-items:start"><div><div class="tc-img big" id="em-img" data-img="${id || ''}">${ICO('camera')}</div>
        <div class="row" style="margin-top:10px"><label class="btn" style="cursor:pointer">${ICO('upload')} صورة / كاميرا<input type="file" accept="image/*" capture="environment" hidden id="em-file"></label><button type="button" class="btn ghost" data-rmimg>${ICO('trash')} حذف الصورة</button></div></div>
      <div class="field"><label>وصف العدّة (يظهر في البطاقة والطباعة)</label><textarea class="txt" name="desc" rows="9" placeholder="الاستخدامات، محتويات العلبة، ملاحظات للبائع…">${esc(m.desc)}</textarea></div></div></div>
    <div data-pane="a" class="hidden"><p class="muted" style="margin-top:0">اختر الملحقات أو القطع المكمّلة لتظهر في بطاقة العدّة وتقترح على البائع (مثل اللقم مع المثقاب، والأقراص مع الصاروخ).</p>
      <input class="inp" id="acc-q" placeholder="بحث…" style="margin-bottom:8px"><div id="acc-l" class="perm-grid" style="max-height:300px;overflow-y:auto;grid-template-columns:1fr 1fr"></div></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ</button>${!id ? `<button class="btn" data-ok data-more="1">حفظ وإضافة أخرى</button>` : ''}`
  });
  $$('[data-tab]', md.el).forEach(b => b.onclick = () => { $$('[data-tab]', md.el).forEach(x => x.classList.toggle('on', x === b)); $$('[data-pane]', md.el).forEach(p => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab)); });
  const bc = $('[name=barcode]', md.el), prev = () => $('#bc-prev', md.el).innerHTML = barcodeSVG(bc.value, { h: 30 });
  bc.addEventListener('input', prev); prev(); bc.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  $('[data-gen]', md.el).onclick = () => { bc.value = newBarcode(); prev(); };
  $('[data-cam]', md.el).onclick = () => Scanner.camera(c => { bc.value = c; prev(); });
  const mg = () => { const c = num(($('[name=cost]', md.el) || {}).value ?? m.cost), p = num($('[name=price]', md.el).value); $('#margin', md.el).innerHTML = c && p ? `<b class="${p > c ? 'ok-t' : 'danger-t'}">${fmt((p - c) / c * 100)}%</b>&nbsp;<span class="muted">(${fmt(p - c)} للقطعة)</span>` : '—'; };
  $$('[name=cost],[name=price]', md.el).forEach(i => i.addEventListener('input', mg)); mg();
  const drawSpecs = () => {
    $('#specs', md.el).innerHTML = specs.map((r, i) => `<div class="row" style="flex-wrap:nowrap;margin-bottom:6px"><input class="inp sm" data-sk="${i}" value="${esc(r[0])}" list="sk-list" placeholder="المواصفة" style="max-width:200px"><input class="inp sm" data-sv="${i}" value="${esc(r[1])}" placeholder="القيمة"><button type="button" class="btn xs icon ghost" data-rs="${i}">${ICO('x')}</button></div>`).join('') || '<span class="muted" style="font-size:13px">لا توجد مواصفات إضافية</span>';
    $$('[data-sk]', md.el).forEach(el => el.oninput = () => specs[+el.dataset.sk][0] = el.value);
    $$('[data-sv]', md.el).forEach(el => el.oninput = () => specs[+el.dataset.sv][1] = el.value);
    $$('[data-rs]', md.el).forEach(el => el.onclick = () => { specs.splice(+el.dataset.rs, 1); drawSpecs(); });
  };
  drawSpecs(); $('[data-addspec]', md.el).onclick = () => { specs.push(['', '']); drawSpecs(); const k = $$('[data-sk]', md.el).pop(); k && k.focus(); };
  const imgBox = $('#em-img', md.el); if (id) loadImgs(md.el);
  $('#em-file', md.el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const img = await loadImage(await fileToDataURL(f)); const c = scaled(img, 700); newImg = c.toDataURL('image/jpeg', .82); imgBox.style.backgroundImage = `url("${newImg}")`; imgBox.classList.add('has'); } catch { toast('تعذّرت قراءة الصورة', 'err'); }
  };
  $('[data-rmimg]', md.el).onclick = () => { newImg = null; imgBox.style.backgroundImage = ''; imgBox.classList.remove('has'); };
  const drawAcc = () => {
    const q = $('#acc-q', md.el).value.trim().toLowerCase();
    $('#acc-l', md.el).innerHTML = db.materials.filter(x => x.id !== id && (!q || x.name.toLowerCase().includes(q) || (x.brand || '').toLowerCase().includes(q))).slice(0, 80)
      .map(x => `<label class="check"><input type="checkbox" data-acc="${x.id}" ${acc.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('');
    $$('[data-acc]', md.el).forEach(c => c.onchange = () => { acc = c.checked ? [...acc, c.dataset.acc] : acc.filter(a => a !== c.dataset.acc); });
  };
  $('#acc-q', md.el).addEventListener('input', drawAcc); drawAcc();
  $$('[data-ok]', md.el).forEach(b => b.onclick = async () => {
    const v = formVals(md.el);
    if (!v.name) { $('[data-tab=b]', md.el).click(); return toast('أدخل اسم الصنف', 'warn'); }
    if (!v.barcode) v.barcode = newBarcode();
    if (/[^\x20-\x7e]/.test(v.barcode)) return toast('الباركود يقبل الأرقام والحروف الإنجليزية فقط', 'warn');
    if (db.materials.some(x => x.barcode === v.barcode && x.id !== id)) return toast('الباركود مستخدم لصنف آخر', 'warn');
    const rec = {
      name: v.name, cat: v.cat || 'عام', unit: v.unit || 'قطعة', barcode: v.barcode, price: num(v.price), wprice: num(v.wprice) || num(v.price), min: num(v.min), supplierId: v.supplierId || null, loc: v.loc,
      brand: v.brand, model: v.model, size: v.size, origin: v.origin, matl: v.matl, weight: v.weight, power: v.power, warranty: Math.max(0, Math.round(num(v.warranty))), serialTracked: !!v.serialTracked, desc: v.desc,
      specs: specs.filter(r => r[0].trim() && r[1].trim()).map(r => [r[0].trim(), r[1].trim()]), acc
    };
    if (v.cost !== undefined) rec.cost = num(v.cost);
    if (rec.cat && !db.categories.includes(rec.cat)) db.categories.push(rec.cat);
    let mid = id;
    if (id) { Object.assign(m, rec); logAct('تعديل صنف', rec.name); }
    else { const nm = { id: uid(), ...rec, cost: rec.cost || 0, stock: 0, created: Date.now() }; db.materials.push(nm); mid = nm.id; if (num(v.stock)) moveStock(nm.id, num(v.stock), 'رصيد افتتاحي', 'افتتاحي'); logAct('إضافة صنف', rec.name); }
    if (newImg !== undefined) { imgCache.delete(mid); if (newImg) await DocStore.put('img:' + mid, newImg); else await DocStore.del('img:' + mid); }
    saveDb(); md.close(); toast('حُفظ الصنف'); Shell.refresh();
    if (b.dataset.more) editMaterial(null, { cat: rec.cat, unit: rec.unit, supplierId: rec.supplierId, brand: rec.brand, origin: rec.origin, power: rec.power, warranty: rec.warranty, serialTracked: rec.serialTracked });
  });
}

/* ===================== الأرقام التسلسلية ===================== */
function addSerialsModal(mid) {
  const m = matById(mid); const list = [];
  const md = modal({
    title: `إضافة أرقام تسلسلية: ${esc(m.name)}`, size: 'narrow',
    body: `<p class="muted" style="margin-top:0">امسح الرقم التسلسلي من ملصق العدّة أو الكرتون (أو اكتبه ثم Enter). الأرقام المضافة تُسجّل كقطع موجودة في المخزن.</p>
      <div class="scan-field sm"><div class="laser"></div>${ICO('scan')}<input id="sn-in" class="mono" dir="ltr" placeholder="الرقم التسلسلي…" autocomplete="off"></div>
      <div id="sn-new" class="sn-list" style="margin-top:12px"></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ</button><label class="check"><input type="checkbox" id="sn-stock" checked> زيادة المخزون بعددها</label>`
  });
  const inp = $('#sn-in', md.el), draw = () => $('#sn-new', md.el).innerHTML = list.map(s => `<span class="sn stock">${esc(s)}</span>`).join('') || '<span class="muted">لم يُضف شيء بعد</span>';
  const add = v => { v = String(v || '').trim().toUpperCase(); if (!v) return; if (list.includes(v) || snFind(v)) { beep(320); return toast(`الرقم ${v} مسجل مسبقاً`, 'warn'); } beep(); list.push(v); draw(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(inp.value); inp.value = ''; } });
  Scanner.hook = add; const oc = md.onClose; md.onClose = () => { Scanner.hook = null; oc && oc(); };
  draw(); setTimeout(() => inp.focus(), 50);
  $('[data-ok]', md.el).onclick = () => {
    if (!list.length) return md.close();
    list.forEach(sn => db.serials.push({ sn, mid, status: 'stock', at: Date.now() }));
    if ($('#sn-stock', md.el).checked) moveStock(mid, list.length, 'أرقام تسلسلية', 'إدخال');
    logAct('إضافة أرقام تسلسلية', `${m.name}: ${list.length}`); saveDb(); md.close(); toast(`أُضيف ${list.length} رقم تسلسلي`); Shell.refresh();
  };
}
/* جمع الأرقام التسلسلية عند البيع */
function serialsForSale(lines) {
  return new Promise(res => {
    let done = false;
    const need = lines.filter(l => { const m = matById(l.mid); return m && m.serialTracked; });
    const md = modal({
      title: 'الأرقام التسلسلية للعدد المباعة', size: 'wide',
      body: `<p class="muted" style="margin-top:0">امسح الرقم التسلسلي لكل قطعة. يُحفظ مع الفاتورة لمعرفة الضمان لاحقاً بمسح الرقم نفسه.</p>
        ${need.map((l, i) => { const m = matById(l.mid), stockSn = snOf(l.mid).filter(x => x.status === 'stock'); return `<div class="card" style="margin-bottom:12px"><div class="card-h"><h3>${esc(l.name)} <span class="tag">${fmt(l.qty)} قطعة · ضمان ${m.warranty || 0} شهراً</span></h3></div><div class="card-b"><div class="form-grid c3">
          ${Array.from({ length: Math.round(l.qty) }, (_, k) => `<input class="inp mono" dir="ltr" data-sl="${i}" data-sk="${k}" value="${esc((l.serials || [])[k] || '')}" list="sl${i}" placeholder="رقم القطعة ${k + 1}" autocomplete="off">`).join('')}</div>
          <datalist id="sl${i}">${stockSn.map(x => `<option value="${esc(x.sn)}">`).join('')}</datalist></div></div>`; }).join('')}`,
      foot: `<button class="btn pri" data-ok>${ICO('check')} متابعة الحفظ</button><button class="btn ghost" data-skip>بيع بدون أرقام</button>`,
      onClose: () => { if (!done) res(false); }
    });
    const ins = $$('[data-sl]', md.el);
    ins.forEach((el, n) => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); beep(); (ins[n + 1] || $('[data-ok]', md.el)).focus(); } }));
    Scanner.hook = code => { const empty = ins.find(x => !x.value.trim()); if (empty) { beep(); empty.value = code; (ins[ins.indexOf(empty) + 1] || empty).focus(); } };
    const oc = md.onClose; md.onClose = () => { Scanner.hook = null; oc && oc(); };
    setTimeout(() => ins[0] && ins[0].focus(), 60);
    $('[data-skip]', md.el).onclick = async () => { if (await confirmBox('البيع بدون أرقام تسلسلية يعني عدم إمكانية التحقق من الضمان بالمسح لاحقاً. متابعة؟', { ok: 'متابعة' })) { done = true; md.close(); res(true); } };
    $('[data-ok]', md.el).onclick = () => {
      const all = ins.map(x => x.value.trim().toUpperCase()).filter(Boolean);
      if (new Set(all).size !== all.length) return toast('يوجد رقم تسلسلي مكرر', 'warn');
      const bad = all.find(sn => { const r = snFind(sn); return r && r.status === 'sold'; });
      if (bad) return toast(`الرقم ${bad} مباع مسبقاً`, 'err');
      const wrong = all.find(sn => { const r = snFind(sn); return r && !need.some(l => l.mid === r.mid && ins.some(x => x.value.trim().toUpperCase() === sn && +x.dataset.sl === need.indexOf(l))); });
      if (wrong) return toast(`الرقم ${wrong} مسجل لعدّة أخرى`, 'err');
      need.forEach((l, i) => { l.serials = ins.filter(x => +x.dataset.sl === i).map(x => x.value.trim().toUpperCase()).filter(Boolean); });
      done = true; md.close(); res(true);
    };
  });
}
const basePosSave = window.posSave;
window.posSave = async function (print) {
  if (POS.kind === 'sale' && POS.lines.some(l => { const m = matById(l.mid); return m && m.serialTracked; })) {
    if (!await serialsForSale(POS.lines)) return;
  }
  const before = db.invoices[0] && db.invoices[0].id;
  await basePosSave(print);
  const inv = db.invoices[0];
  if (!inv || inv.id === before || inv.kind !== 'sale') return;
  inv.lines.forEach(l => (l.serials || []).forEach(sn => {
    const m = matById(l.mid), w = m && m.warranty ? addMonths(inv.date, m.warranty) : null;
    const r = snFind(sn);
    if (r) Object.assign(r, { status: 'sold', invId: inv.id, customerId: inv.customerId, soldAt: inv.date, warrantyUntil: w });
    else db.serials.push({ sn, mid: l.mid, status: 'sold', invId: inv.id, customerId: inv.customerId, soldAt: inv.date, warrantyUntil: w, at: Date.now() });
  }));
  saveDb();
};
function releaseSerials(inv, mid, qty) {
  const line = inv.lines.find(x => x.mid === mid); if (!line || !line.serials) return;
  line.serials.map(snFind).filter(r => r && r.status === 'sold' && r.invId === inv.id).slice(0, qty)
    .forEach(r => Object.assign(r, { status: 'stock', invId: null, customerId: null, soldAt: null, warrantyUntil: null }));
}

/* ===================== بطاقة الضمان ===================== */
function warrantyCard(r) {
  if (!r) return;
  const m = matById(r.mid), w = warrantyState(r), inv = r.invId && byId('invoices', r.invId), c = r.customerId && custById(r.customerId);
  const md = modal({
    title: 'التحقق من الضمان', size: 'narrow',
    body: `<div class="warranty ${w.k}"><div class="w-ico">${ICO(w.k === 'on' ? 'shield' : w.k === 'off' ? 'warn' : 'box')}</div><div><b>${esc(w.t)}</b><div class="mono" style="direction:ltr;text-align:right">${esc(r.sn)}</div></div></div>
      <table class="tbl specs" style="margin-top:12px"><tr><th>العدّة</th><td>${esc(m ? m.name : '—')}<div class="t-sub">${esc(m ? toolSub(m) : '')}</div></td></tr>
      ${r.status === 'sold' ? `<tr><th>الزبون</th><td>${esc(c ? c.name : 'زبون نقدي')}</td></tr><tr><th>تاريخ البيع</th><td>${fdate(r.soldAt)}</td></tr><tr><th>فاتورة</th><td>${inv ? `رقم ${inv.no}` : '—'}</td></tr><tr><th>نهاية الضمان</th><td>${r.warrantyUntil ? fdate(r.warrantyUntil) : 'بدون ضمان'}</td></tr>` : ''}
      </table>`,
    foot: `${inv ? `<button class="btn" data-inv>${ICO('inv')} الفاتورة</button>` : ''}${m ? `<button class="btn ghost" data-tool>${ICO('box')} بطاقة العدّة</button>` : ''}`
  });
  const i = $('[data-inv]', md.el); if (i) i.onclick = () => { md.close(); viewInvoice(inv.id); };
  const t = $('[data-tool]', md.el); if (t) t.onclick = () => { md.close(); quickMaterial(m); };
}
/* توجيه المسح: الأرقام التسلسلية وتذاكر الصيانة قبل الباركود العادي */
const baseOnScan = window.onScanCode;
window.onScanCode = function (code) {
  code = String(code || '').trim();
  if (!Scanner.hook && !$('.modal-bg')) {
    if (!db.materials.some(m => m.barcode === code)) { const r = snFind(code); if (r) { beep(); return warrantyCard(r); } }
  }
  return baseOnScan(code);
};
const baseStationHandle = Station.handle.bind(Station);
Station.handle = function (code) {
  code = String(code || '').trim(); if (!code) return;
  if (!db.materials.some(m => m.barcode === code)) {
    const r = snFind(code);
    if (r) {
      const m = matById(r.mid);
      if (ST.mode === 'lookup') { beep(); ST.last = r.mid; this.push(code, r.mid, true, `${m ? m.name : ''} · رقم تسلسلي`); this.draw(); return warrantyCard(r); }
      if (ST.mode === 'count' && m) { if (r.status !== 'stock') { beep(320); return toast(`القطعة ${r.sn} مباعة وليست في المخزن`, 'warn'); } ST.cs = ST.cs || new Set(); if (ST.cs.has(r.sn)) { beep(320); return toast('هذه القطعة معدودة مسبقاً', 'warn'); } ST.cs.add(r.sn); return baseStationHandle(m.barcode); }
    }
  }
  return baseStationHandle(code);
};

/* ===================== التحقق من رقم تسلسلي ===================== */
ACTS.snCheck = () => {
  const md = modal({ title: 'التحقق من رقم تسلسلي وضمان', size: 'narrow', body: `<div class="scan-field sm"><div class="laser"></div>${ICO('scan')}<input id="wc-in" class="mono" dir="ltr" placeholder="امسح أو اكتب الرقم التسلسلي ثم Enter" autocomplete="off"></div>` });
  const go = v => { const r = snFind(v); if (!r) { beep(320); return toast('الرقم التسلسلي غير مسجل في النظام', 'warn'); } beep(); md.close(); warrantyCard(r); };
  $('#wc-in', md.el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(e.target.value); } });
  Scanner.hook = go; const oc = md.onClose; md.onClose = () => { Scanner.hook = null; oc && oc(); };
};
const baseRenderTiles = window.renderTiles;
window.renderTiles = function () { baseRenderTiles(); loadImgs($('#pos-tiles')); };
ACTS.toolCard = el => quickMaterial(matById(el.dataset.id));
