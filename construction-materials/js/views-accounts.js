/* المثلث · نظام إدارة المواد الإنشائية — الحسابات: الزبائن، الموردون، القوائم المستحقة، السندات، الرسائل */
'use strict';

/* ===================== الزبائن ===================== */
const CustF = { q: '', type: '' };
Views.customers = {
  dim: () => `${db.customers.length} زبون · مجموع الذمم ${moneyT(db.customers.reduce((s, c) => s + custBalance(c.id), 0))}`,
  render() {
    const q = CustF.q.toLowerCase();
    const rows = db.customers.filter(c => (!CustF.type || c.type === CustF.type) && (!q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.site || '').toLowerCase().includes(q)));
    return `<div class="toolbar"><div class="search">${ICO('search')}<input class="inp" id="c-q" placeholder="الاسم أو الهاتف أو الموقع" value="${esc(CustF.q)}"></div>
      <div class="seg">${[['', 'الكل'], ['مقاول', 'مقاولون'], ['شركة', 'شركات'], ['فرد', 'أفراد']].map(([k, t]) => `<button class="${CustF.type === k ? 'on' : ''}" data-act="custType" data-t="${k}">${t}</button>`).join('')}</div>
      <span class="spacer"></span><button class="btn" data-act="csvCustomers">${ICO('sheet')} Excel</button><button class="btn pri" data-act="newCust">${ICO('plus')} زبون جديد</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الزبون</th><th>النوع</th><th>الهاتف</th><th class="n">الفواتير</th><th class="n">الرصيد المستحق</th><th>سقف الدين</th><th></th></tr></thead><tbody>
      ${rows.map(c => {
        const b = custBalance(c.id), n = custInvoices(c.id).length, pct = c.limit ? Math.min(100, b / c.limit * 100) : 0;
        return `<tr><td><div class="t-main">${esc(c.name)}</div><div class="t-sub">${esc(c.site || '')}</div></td><td><span class="chip plain">${esc(c.type)}</span></td>
          <td class="mono" dir="ltr" style="text-align:right">${esc(c.phone || '—')}</td><td class="n">${n}</td><td class="n ${b > 0 ? 'danger-t' : ''}"><b>${fmt(b)}</b></td>
          <td>${c.limit ? `<div class="hbar" style="grid-template-columns:70px auto;gap:8px"><div class="tr"><i style="width:${pct}%;${pct > 85 ? 'background:var(--danger)' : ''}"></i></div><span class="v">${fmt(c.limit)}</span></div>` : '<span class="muted">—</span>'}</td>
          <td><div class="acts"><button class="btn xs" data-act="stmt" data-id="${c.id}">${ICO('doc')} كشف حساب</button>
            ${b > 0 && can('payments') ? `<button class="btn xs icon" data-act="custPay" data-id="${c.id}" title="سند قبض">${ICO('cash')}</button>` : ''}
            ${c.phone && can('messages') ? `<button class="btn xs icon" data-act="remind" data-id="${c.id}" title="رسالة">${ICO('wa')}</button>` : ''}
            <button class="btn xs icon" data-act="editCust" data-id="${c.id}" title="تعديل">${ICO('edit')}</button>
            ${can('void') ? `<button class="btn xs icon dan" data-act="delCust" data-id="${c.id}" title="حذف">${ICO('trash')}</button>` : ''}</div></td></tr>`;
      }).join('')}</tbody></table>${rows.length ? '' : emptyHTML('helmet', 'لا يوجد زبائن', '<br>أضف المقاولين والشركات لتتبع حساباتهم الآجلة')}</div></div>`;
  },
  after() { const q = $('#c-q'); q.addEventListener('input', debounce(() => { CustF.q = q.value.trim(); Shell.refresh(); const n = $('#c-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250)); }
};
function editCustomer(id, onSaved) {
  const c = id ? custById(id) : { name: '', type: 'مقاول', phone: '', site: '', limit: 0, notes: '' };
  const m = modal({
    title: id ? 'تعديل بيانات الزبون' : 'زبون جديد',
    body: `<div class="form-grid"><div class="field full"><label>الاسم الكامل / اسم الشركة</label><input class="inp" name="name" value="${esc(c.name)}"></div>
      <div class="field"><label>النوع</label><select class="sel" name="type">${['مقاول', 'شركة', 'فرد'].map(t => `<option ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>رقم الهاتف (واتساب)</label><input class="inp" name="phone" value="${esc(c.phone)}" dir="ltr" placeholder="07XXXXXXXXX"></div>
      <div class="field full"><label>موقع العمل / العنوان</label><input class="inp" name="site" value="${esc(c.site)}"></div>
      <div class="field"><label>سقف الدين المسموح</label><input class="inp num" name="limit" value="${c.limit || ''}" placeholder="بدون سقف" inputmode="decimal"><span class="hint">ينبّه النظام عند تجاوزه في البيع الآجل</span></div>
      <div class="field"><label>ملاحظات</label><input class="inp" name="notes" value="${esc(c.notes)}"></div></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ</button>`
  });
  $('[data-ok]', m.el).onclick = () => {
    const v = formVals(m.el); if (!v.name) return toast('أدخل اسم الزبون', 'warn');
    if (db.customers.some(x => x.name === v.name && x.id !== id)) return toast('يوجد زبون بنفس الاسم', 'warn');
    v.limit = num(v.limit);
    let rec;
    if (id) { Object.assign(c, v); rec = c; logAct('تعديل زبون', v.name); }
    else { rec = { id: uid(), ...v, created: Date.now() }; db.customers.push(rec); logAct('إضافة زبون', v.name); }
    saveDb(); m.close(); toast('تم الحفظ'); onSaved ? onSaved(rec) : Shell.refresh();
  };
}
function statement(cid, isSup = false) {
  const p = isSup ? supById(cid) : custById(cid); if (!p) return;
  const docs = isSup ? supPurchases(cid) : custInvoices(cid);
  const pays = db.payments.filter(x => x.partyId === cid && x.party === (isSup ? 's' : 'c'));
  const rows = [
    ...docs.map(d => ({ at: d.at, date: d.date, t: `${isSup ? 'فاتورة شراء' : 'فاتورة بيع'} رقم ${d.no}`, dr: d.total, cr: 0 })),
    ...docs.flatMap(d => (d.returns || []).map(r => ({ at: r.at, date: r.date, t: `مرتجع من الفاتورة ${d.no}`, dr: 0, cr: r.amount }))),
    ...pays.map(x => ({ at: x.at, date: x.date, t: x.type === 'in' ? `سند قبض رقم ${x.no}${x.note ? ' — ' + x.note : ''}` : `سند صرف رقم ${x.no}${x.note ? ' — ' + x.note : ''}`, dr: x.type === 'out' && !isSup ? x.amount : 0, cr: (isSup ? x.type === 'out' : x.type === 'in') ? x.amount : 0 }))
  ].sort((a, b) => a.at - b.at);
  // المبالغ المرتجعة من فاتورة ملغاة تقابلها دفعة ملغاة، لذلك نستبعد الفواتير الملغاة ومبالغها
  const voidPaid = isSup ? 0 : db.invoices.filter(i => i.kind === 'sale' && i.void && i.customerId === cid).reduce((s, i) => s + (i.paid || 0), 0);
  let bal = 0;
  const body = rows.map(r => { bal = round2(bal + r.dr - r.cr); return `<tr><td>${fdate(r.date)}</td><td>${esc(r.t)}</td><td class="n">${r.dr ? fmt(r.dr) : ''}</td><td class="n">${r.cr ? fmt(r.cr) : ''}</td><td class="n"><b>${fmt(bal)}</b></td></tr>`; }).join('');
  const balance = isSup ? supBalance(cid) : custBalance(cid);
  const html = `<div class="pr-h"><div>${brandHTML(db.settings.company)}</div><div style="text-align:left"><p class="pr-title">كشف حساب</p><div>${fdate(today())}</div></div></div>
    <div class="pr-meta"><div><b>${isSup ? 'المورد' : 'الزبون'}:</b> ${esc(p.name)}</div><div><b>الهاتف:</b> ${esc(p.phone || '—')}</div><div><b>عدد الفواتير:</b> ${docs.length}</div><div><b>الرصيد المستحق:</b> ${moneyT(balance)}</div></div>
    <table><thead><tr><th>التاريخ</th><th>البيان</th><th class="n">مدين</th><th class="n">دائن</th><th class="n">الرصيد</th></tr></thead><tbody>${body || '<tr><td colspan="5">لا توجد حركات</td></tr>'}</tbody></table>
    ${voidPaid ? `<p style="font-size:11.5px;color:#555">تتضمن الحركات مبالغ مرتجعة عن فواتير ملغاة.</p>` : ''}
    <div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي</div>`;
  const m = modal({
    title: `كشف حساب: ${esc(p.name)}`, size: 'wide', body: `<div class="doc-paper pr">${html}</div>`,
    foot: `<button class="btn pri" data-p>${ICO('print')} طباعة</button>${!isSup && p.phone && can('messages') ? `<button class="btn" data-wa>${ICO('wa')} إرسال الرصيد</button>` : ''}
      ${balance > 0 && can('payments') ? `<button class="btn" data-pay>${ICO('cash')} ${isSup ? 'سند صرف' : 'سند قبض'}</button>` : ''}`
  });
  $('[data-p]', m.el).onclick = () => printHTML(html);
  const w = $('[data-wa]', m.el); if (w) w.onclick = () => { m.close(); composeMessages([partyRow(p)], 'due'); };
  const py = $('[data-pay]', m.el); if (py) py.onclick = () => { m.close(); paymentModal(isSup ? 'out' : 'in', cid); };
}
Object.assign(ACTS, {
  custType: el => { CustF.type = el.dataset.t; Shell.refresh(); },
  newCust: () => editCustomer(null),
  editCust: el => editCustomer(el.dataset.id),
  stmt: el => statement(el.dataset.id),
  custPay: el => paymentModal('in', el.dataset.id),
  remind: el => { const c = custById(el.dataset.id); const r = partyRow(c); composeMessages([r], r.bucket === 'over' ? 'overdue' : r.amount > 0 ? 'due' : 'thanks'); },
  delCust: async el => {
    const c = custById(el.dataset.id);
    if (db.invoices.some(i => i.customerId === c.id)) return toast('لا يمكن حذف زبون لديه فواتير', 'warn');
    if (await confirmBox(`حذف الزبون <b>${esc(c.name)}</b>؟`, { ok: 'حذف', danger: true })) { db.customers = db.customers.filter(x => x.id !== c.id); logAct('حذف زبون', c.name); rerender(); }
  }
});

/* ===================== الموردون ===================== */
Views.suppliers = {
  dim: () => `${db.suppliers.length} مورد · مستحق لهم ${moneyT(db.suppliers.reduce((s, x) => s + supBalance(x.id), 0))}`,
  render() {
    return `<div class="toolbar"><span class="spacer"></span>${can('purchases') ? `<button class="btn" data-act="newPurchase">${ICO('cart')} فاتورة شراء</button>` : ''}<button class="btn pri" data-act="newSup">${ICO('plus')} مورد جديد</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>المورد</th><th>الهاتف</th><th>المواد المورّدة</th><th class="n">المشتريات</th><th class="n">المستحق له</th><th></th></tr></thead><tbody>
      ${db.suppliers.map(s => {
        const ps = supPurchases(s.id), b = supBalance(s.id), mats = db.materials.filter(m => m.supplierId === s.id);
        return `<tr><td><div class="t-main">${esc(s.name)}</div><div class="t-sub">${esc(s.notes || '')}</div></td><td class="mono" dir="ltr" style="text-align:right">${esc(s.phone || '—')}</td>
          <td><div class="t-sub">${mats.length ? esc(mats.slice(0, 3).map(m => m.name.split('—')[0]).join('، ')) + (mats.length > 3 ? ` و${mats.length - 3} أخرى` : '') : '—'}</div></td>
          <td class="n">${fmt(ps.reduce((a, p) => a + p.total, 0))}</td><td class="n ${b > 0 ? 'warn-t' : ''}"><b>${fmt(b)}</b></td>
          <td><div class="acts"><button class="btn xs" data-act="supStmt" data-id="${s.id}">${ICO('doc')} كشف</button>${b > 0 && can('payments') ? `<button class="btn xs icon" data-act="supPay" data-id="${s.id}" title="سند صرف">${ICO('cash')}</button>` : ''}
          <button class="btn xs icon" data-act="editSup" data-id="${s.id}">${ICO('edit')}</button>${can('void') ? `<button class="btn xs icon dan" data-act="delSup" data-id="${s.id}">${ICO('trash')}</button>` : ''}</div></td></tr>`;
      }).join('')}</tbody></table>${db.suppliers.length ? '' : emptyHTML('factory', 'لا يوجد موردون')}</div></div>`;
  }
};
function editSupplier(id) {
  const s = id ? supById(id) : { name: '', phone: '', notes: '' };
  const m = modal({
    title: id ? 'تعديل المورد' : 'مورد جديد', size: 'narrow',
    body: `<div class="stack" style="gap:12px"><div class="field"><label>اسم المورد / المعمل</label><input class="inp" name="name" value="${esc(s.name)}"></div>
      <div class="field"><label>الهاتف</label><input class="inp" name="phone" value="${esc(s.phone)}" dir="ltr"></div><div class="field"><label>ملاحظات</label><input class="inp" name="notes" value="${esc(s.notes)}"></div></div>`,
    foot: `<button class="btn pri" data-ok>حفظ</button>`
  });
  $('[data-ok]', m.el).onclick = () => {
    const v = formVals(m.el); if (!v.name) return toast('أدخل اسم المورد', 'warn');
    if (id) Object.assign(s, v); else db.suppliers.push({ id: uid(), ...v, created: Date.now() });
    logAct(id ? 'تعديل مورد' : 'إضافة مورد', v.name); m.close(); rerender();
  };
}
Object.assign(ACTS, {
  newSup: () => editSupplier(null), editSup: el => editSupplier(el.dataset.id),
  supStmt: el => statement(el.dataset.id, true), supPay: el => paymentModal('out', el.dataset.id),
  delSup: async el => {
    const s = supById(el.dataset.id);
    if (db.purchases.some(p => p.supplierId === s.id)) return toast('لا يمكن حذف مورد لديه مشتريات', 'warn');
    if (await confirmBox(`حذف المورد <b>${esc(s.name)}</b>؟`, { ok: 'حذف', danger: true })) { db.suppliers = db.suppliers.filter(x => x.id !== s.id); db.materials.forEach(m => { if (m.supplierId === s.id) m.supplierId = null; }); logAct('حذف مورد', s.name); rerender(); }
  }
});

/* ===================== القوائم المستحقة ===================== */
const DueF = { tab: 'c', b: '', sel: new Set() };
Views.dues = {
  dim: () => 'الديون المستحقة على الزبائن وللموردين، مع إرسال التذكيرات',
  render() {
    const rows = dueRows(), sup = supDueRows();
    const tot = rows.reduce((s, r) => s + r.amount, 0), over = rows.filter(r => r.bucket === 'over'), soon = rows.filter(r => r.bucket === 'soon');
    const list = rows.filter(r => !DueF.b || r.bucket === DueF.b);
    DueF.sel = new Set([...DueF.sel].filter(id => list.some(r => r.c.id === id)));
    const bChip = r => r.bucket === 'over' ? `<span class="chip dan">متأخر ${r.lateDays} يوماً</span>` : r.bucket === 'soon' ? `<span class="chip warn">خلال ${daysBetween(today(), r.oldest)} أيام</span>` : `<span class="chip acc">${fdate(r.oldest)}</span>`;
    const cTab = DueF.tab === 'c';
    return `<div class="grid g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="k-top"><span class="k-ico">${ICO('cash')}</span>مجموع المستحق</div><div class="k-val num">${money(tot)}</div><div class="k-sub">على ${rows.length} زبون</div></div>
        <div class="card kpi danger" data-act="dueB" data-b="over"><div class="k-top"><span class="k-ico">${ICO('alarm')}</span>متأخرة السداد</div><div class="k-val num">${money(over.reduce((s, r) => s + r.overdueAmt, 0))}</div><div class="k-sub">${over.length} زبون</div></div>
        <div class="card kpi warn" data-act="dueB" data-b="soon"><div class="k-top"><span class="k-ico">${ICO('log')}</span>تستحق خلال 7 أيام</div><div class="k-val num">${money(soon.reduce((s, r) => s + r.amount, 0))}</div><div class="k-sub">${soon.length} زبون</div></div>
        <div class="card kpi brass"><div class="k-top"><span class="k-ico">${ICO('factory')}</span>مستحق للموردين</div><div class="k-val num">${money(sup.reduce((s, r) => s + r.amount, 0))}</div><div class="k-sub">${sup.length} مورد</div></div>
      </div>
      <div class="tabs"><button class="${cTab ? 'on' : ''}" data-act="dueTab" data-t="c">ديون الزبائن (${rows.length})</button><button class="${!cTab ? 'on' : ''}" data-act="dueTab" data-t="s">مستحقات الموردين (${sup.length})</button></div>
      ${cTab ? `<div class="toolbar"><div class="seg">${[['', 'الكل'], ['over', 'متأخرة'], ['soon', 'خلال أسبوع'], ['later', 'لاحقة']].map(([k, t]) => `<button class="${DueF.b === k ? 'on' : ''}" data-act="dueB" data-b="${k}">${t}</button>`).join('')}</div>
        <span class="spacer"></span>${can('messages') ? `<button class="btn brass" data-act="dueSend" ${DueF.sel.size ? '' : 'disabled'}>${ICO('send')} إرسال تذكير للمحدد (${DueF.sel.size})</button>
        <button class="btn" data-act="dueSendAll" ${list.length ? '' : 'disabled'}>${ICO('wa')} تذكير الكل (${list.length})</button>` : ''}<button class="btn" data-act="duePrint">${ICO('print')} طباعة القائمة</button><button class="btn" data-act="csvDues">${ICO('sheet')} Excel</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:36px"><input type="checkbox" class="check" id="due-all" ${list.length && DueF.sel.size === list.length ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--accent)"></th><th>الزبون</th><th class="n">فواتير مفتوحة</th><th>أقدم استحقاق</th><th class="n">المتأخر</th><th class="n">مجموع المستحق</th><th>آخر تذكير</th><th></th></tr></thead><tbody>
        ${list.map(r => `<tr><td><input type="checkbox" data-sel="${r.c.id}" ${DueF.sel.has(r.c.id) ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--accent)"></td>
          <td><div class="t-main">${esc(r.c.name)}</div><div class="t-sub mono" dir="ltr" style="text-align:right">${esc(r.c.phone || 'لا يوجد رقم')}</div></td><td class="n">${r.open.length}</td><td>${bChip(r)}</td>
          <td class="n ${r.overdueAmt ? 'danger-t' : 'muted'}">${fmt(r.overdueAmt)}</td><td class="n"><b>${fmt(r.amount)}</b></td>
          <td>${r.lastMsg ? `<span class="t-sub">${ftime(r.lastMsg.at)}</span>` : '<span class="muted">—</span>'}</td>
          <td><div class="acts">${can('messages') ? `<button class="btn xs icon" data-act="remind" data-id="${r.c.id}" title="تذكير">${ICO('wa')}</button>` : ''}${can('payments') ? `<button class="btn xs icon" data-act="custPay" data-id="${r.c.id}" title="سند قبض">${ICO('cash')}</button>` : ''}<button class="btn xs icon" data-act="stmt" data-id="${r.c.id}" title="كشف حساب">${ICO('doc')}</button></div></td></tr>`).join('')}
        </tbody></table>${list.length ? '' : emptyHTML('check', 'لا توجد ديون في هذه القائمة')}</div></div>`
      : `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>المورد</th><th class="n">فواتير مفتوحة</th><th>أقدم استحقاق</th><th class="n">المستحق له</th><th></th></tr></thead><tbody>
        ${sup.map(r => `<tr><td><div class="t-main">${esc(r.s.name)}</div><div class="t-sub">${esc(r.s.phone || '')}</div></td><td class="n">${r.open.length}</td><td>${r.bucket === 'over' ? `<span class="chip dan">متأخر ${r.lateDays} يوماً</span>` : `<span class="chip acc">${fdate(r.oldest)}</span>`}</td><td class="n"><b>${fmt(r.amount)}</b></td>
          <td><div class="acts">${can('payments') ? `<button class="btn xs" data-act="supPay" data-id="${r.s.id}">${ICO('cash')} تسديد</button>` : ''}<button class="btn xs icon" data-act="supStmt" data-id="${r.s.id}">${ICO('doc')}</button></div></td></tr>`).join('')}</tbody></table>
        ${sup.length ? '' : emptyHTML('check', 'لا توجد مستحقات للموردين')}</div></div>`}`;
  },
  after() {
    const all = $('#due-all'); if (!all) return;
    all.onchange = () => { const list = dueRows().filter(r => !DueF.b || r.bucket === DueF.b); DueF.sel = all.checked ? new Set(list.map(r => r.c.id)) : new Set(); Shell.refresh(); };
    $$('[data-sel]').forEach(cb => cb.onchange = () => { cb.checked ? DueF.sel.add(cb.dataset.sel) : DueF.sel.delete(cb.dataset.sel); Shell.refresh(); });
  }
};
Object.assign(ACTS, {
  dueTab: el => { DueF.tab = el.dataset.t; Shell.refresh(); },
  dueB: el => { DueF.tab = 'c'; DueF.b = el.dataset.b; DueF.sel.clear(); Shell.refresh(); },
  dueSend: () => composeMessages(dueRows().filter(r => DueF.sel.has(r.c.id)), DueF.b === 'over' ? 'overdue' : 'due'),
  dueSendAll: () => composeMessages(dueRows().filter(r => !DueF.b || r.bucket === DueF.b), DueF.b === 'over' ? 'overdue' : 'due'),
  duePrint: () => {
    const rows = dueRows().filter(r => !DueF.b || r.bucket === DueF.b);
    printHTML(`<div class="pr-h"><div>${brandHTML(db.settings.company)}</div><div style="text-align:left"><p class="pr-title">القائمة المستحقة</p><div>${fdate(today())}</div></div></div>
      <table><thead><tr><th>#</th><th>الزبون</th><th>الهاتف</th><th class="n">فواتير</th><th>أقدم استحقاق</th><th class="n">أيام التأخير</th><th class="n">المبلغ</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.c.name)}</td><td>${esc(r.c.phone || '')}</td><td class="n">${r.open.length}</td><td>${fdate(r.oldest)}</td><td class="n">${r.lateDays}</td><td class="n">${fmt(r.amount)}</td></tr>`).join('')}
      <tr><td colspan="6"><b>المجموع</b></td><td class="n"><b>${moneyT(rows.reduce((s, r) => s + r.amount, 0))}</b></td></tr></tbody></table>
      <div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي</div>`);
  },
  newReceipt: () => paymentModal('in'),
  newPayout: () => paymentModal('out')
});

/* ===== منشئ الرسائل وطابور الإرسال ===== */
function msgLink(channel, phone, text) {
  return channel === 'sms' ? `sms:+${phone}?body=${encodeURIComponent(text)}` : `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
function logMessage(c, channel, text, ref = '', status = '', err = '') {
  db.messages.unshift({ id: uid(), at: Date.now(), partyId: c ? c.id : null, to: c ? c.name : '', phone: c ? c.phone : '', channel, text, ref, status, err, user: Session.user.id });
  if (db.messages.length > 3000) db.messages.length = 3000;
}
function sendOne(c, text, ref) { return WA.send(c, text, ref); }
const CH_NAME = { api: 'واتساب مباشر', wa: 'واتساب', sms: 'رسالة SMS', copy: 'نسخ' , 'wa-api': 'واتساب مباشر' };
function composeMessages(rows, tplKey = 'due') {
  if (!rows.length) return toast('لا يوجد مستلمون', 'warn');
  const T = db.settings.templates;
  let channel = lsGet('mth-bld-ch', WA.api() ? 'api' : 'wa'); if (channel === 'api' && !WA.api()) channel = 'wa';
  let text = tplKey === 'custom' ? 'السيد/ة {الاسم} المحترم،\n' : T[tplKey] || T.due;
  const m = modal({ title: `إرسال رسالة إلى ${rows.length} ${rows.length === 1 ? 'مستلم' : 'مستلمين'}`, size: 'wide', body: '<div id="cmp"></div>', foot: '<div id="cmp-f" class="row" style="width:100%"></div>' });
  const step1 = () => {
    const first = rows[0];
    $('#cmp', m.el).innerHTML = `<div class="grid g2" style="gap:18px;align-items:start"><div class="stack" style="gap:12px">
        <div class="field"><label>قناة الإرسال</label><div class="seg">${['api', 'wa', 'sms', 'copy'].filter(k => k !== 'api' || WA.api()).map(k => `<button class="${channel === k ? 'on' : ''}" data-ch="${k}">${k === 'api' ? ICO('bolt').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"') + ' ' : ''}${k === 'wa' && WA.api() ? 'واتساب (فتح المحادثة)' : CH_NAME[k]}</button>`).join('')}</div>${WA.api() ? '' : `<span class="hint">للإرسال الآلي المباشر من داخل البرنامج فعّل «واتساب للأعمال» من الإعدادات.</span>`}</div>
        <div class="field"><label>القالب</label><select class="sel" id="tpl">${[['due', 'تذكير بمبلغ مستحق'], ['overdue', 'إشعار تأخر السداد'], ['thanks', 'شكر وإشعار رصيد'], ['custom', 'نص حر']].map(([k, t]) => `<option value="${k}" ${k === tplKey ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>نص الرسالة</label><textarea class="txt" id="msg" rows="8">${esc(text)}</textarea>
          <div class="ph-list">${PLACEHOLDERS.map(p => `<button type="button" data-ph="${p}">{${p}}</button>`).join('')}</div><span class="hint">تُستبدل الحقول بين الأقواس ببيانات كل زبون تلقائياً.</span></div>
      </div><div><div class="field"><label>معاينة — ${esc(first.c.name)}</label><div class="preview-msg" id="pv"></div></div>
        <p class="muted" style="font-size:12.5px;margin-top:12px">${ICO('info').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} ${channel === 'api' ? 'تُرسل الرسائل تلقائياً من داخل البرنامج عبر واتساب للأعمال دون فتح أي نافذة، وتظهر حالة كل رسالة.' : 'يفتح البرنامج محادثة واتساب أو تطبيق الرسائل لكل مستلم والنص جاهز، وتضغط أنت «إرسال».'}</p>
        ${rows.filter(r => !intlPhone(r.c.phone)).length ? `<p class="warn-t" style="font-size:13px">${rows.filter(r => !intlPhone(r.c.phone)).length} مستلم بدون رقم هاتف سيُتخطّى.</p>` : ''}</div></div>`;
    $('#cmp-f', m.el).innerHTML = `<button class="btn pri" id="go">${ICO('send')} متابعة إلى الإرسال</button><label class="check"><input type="checkbox" id="savetpl"> حفظ النص كقالب</label>`;
    const ta = $('#msg', m.el), pv = () => $('#pv', m.el).textContent = fillTemplate(ta.value, first);
    ta.oninput = pv; pv();
    $$('[data-ch]', m.el).forEach(b => b.onclick = () => { channel = b.dataset.ch; lsSet('mth-bld-ch', channel); text = ta.value; step1(); });
    $('#tpl', m.el).onchange = e => { tplKey = e.target.value; ta.value = tplKey === 'custom' ? 'السيد/ة {الاسم} المحترم،\n' : T[tplKey]; pv(); };
    $$('[data-ph]', m.el).forEach(b => b.onclick = () => { const s = ta.selectionStart; ta.setRangeText(`{${b.dataset.ph}}`, s, ta.selectionEnd, 'end'); ta.focus(); pv(); });
    $('#go', m.el).onclick = () => {
      text = ta.value; if (!text.trim()) return toast('اكتب نص الرسالة', 'warn');
      if ($('#savetpl', m.el).checked && tplKey !== 'custom') { T[tplKey] = text; saveDb(); }
      step2();
    };
  };
  const step2 = () => {
    const q = rows.map(r => ({ r, phone: intlPhone(r.c.phone), msg: fillTemplate(text, r), done: false, err: '' })); let running = false;
    const draw = () => {
      const done = q.filter(x => x.done).length, valid = q.filter(x => x.phone || channel === 'copy'), next = valid.find(x => !x.done);
      $('#cmp', m.el).innerHTML = `<div class="row" style="margin-bottom:12px"><b style="font-family:var(--fd)">تم ${done} من ${valid.length}</b><span class="spacer"></span><span class="chip acc plain">${CH_NAME[channel]}</span></div>
        <div class="hbar" style="grid-template-columns:1fr;margin-bottom:14px"><div class="tr"><i style="width:${valid.length ? done / valid.length * 100 : 0}%"></i></div></div>
        <div class="queue">${q.map((x, i) => `<div class="q-it ${x.done ? 'done' : x === next ? 'cur' : ''}"><div class="l-ico" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--panel2)">${x.done ? ICO('check') : i + 1}</div>
          <div class="l-main"><b>${esc(x.r.c.name)}</b><br><span>${x.phone ? `<bdi dir="ltr">+${x.phone}</bdi>` : 'لا يوجد رقم'} · ${moneyT(x.r.amount)}</span>${x.err ? `<br><span class="danger-t">${esc(x.err)}</span>` : ''}</div>
          ${x.phone || channel === 'copy' ? `<button class="btn sm ${x === next ? 'pri' : ''}" data-q="${i}">${x.done ? 'إعادة' : channel === 'copy' ? 'نسخ' : 'إرسال'}</button>` : '<span class="chip plain">تُخطّي</span>'}</div>`).join('')}</div>`;
      if (channel === 'api') {
        const left = valid.filter(x => !x.done);
        $('#cmp-f', m.el).innerHTML = running ? `<button class="btn lg" id="stop">إيقاف الإرسال</button><span class="muted">جارٍ الإرسال…</span>` : left.length ? `<button class="btn brass lg" id="auto">${ICO('bolt')} إرسال تلقائي إلى ${left.length}</button><button class="btn ghost" id="bk">رجوع للتعديل</button>` : `<button class="btn pri" id="fin">${ICO('check')} إنهاء</button>`;
        $$('[data-q]', m.el).forEach(b => b.onclick = () => fire(q[+b.dataset.q]));
        const au = $('#auto', m.el); if (au) au.onclick = async () => { running = true; draw(); for (const x of q) { if (!running || m.closed) break; if (x.done || !x.phone) continue; await fire(x); await new Promise(r => setTimeout(r, 700)); } running = false; if (!m.closed) draw(); };
        const sp = $('#stop', m.el); if (sp) sp.onclick = () => { running = false; };
        const bk2 = $('#bk', m.el); if (bk2) bk2.onclick = step1;
        const fn2 = $('#fin', m.el); if (fn2) fn2.onclick = () => m.close();
        return;
      }
      $('#cmp-f', m.el).innerHTML = next ? `<button class="btn brass lg" id="nx">${ICO('send')} ${channel === 'copy' ? 'نسخ' : 'إرسال'} التالي: ${esc(next.r.c.name)}</button><button class="btn ghost" id="bk">رجوع للتعديل</button>` : `<button class="btn pri" id="fin">${ICO('check')} إنهاء</button>`;
      $$('[data-q]', m.el).forEach(b => b.onclick = () => fire(q[+b.dataset.q]));
      const nx = $('#nx', m.el); if (nx) nx.onclick = () => fire(next);
      const bk = $('#bk', m.el); if (bk) bk.onclick = step1;
      const fin = $('#fin', m.el); if (fin) fin.onclick = () => m.close();
    };
    const fire = async x => {
      if (channel === 'api') {
        x.err = ''; const it = $(`[data-q="${q.indexOf(x)}"]`, m.el); if (it) { it.disabled = true; it.textContent = '…'; }
        const r = await WA.sendAPI(x.phone, x.msg);
        logMessage(x.r.c, 'wa-api', x.msg, 'تذكير مستحقات', r.ok ? 'sent' : 'failed', r.err);
        if (r.ok) x.done = true; else x.err = r.err; saveDb(); if (!m.closed) draw(); return;
      }
      if (channel === 'copy') copyText(x.msg); else openLink(msgLink(channel, x.phone, x.msg));
      if (!x.done) { logMessage(x.r.c, channel, x.msg, 'تذكير مستحقات'); x.done = true; saveDb(); }
      draw();
    };
    m.onClose = () => { running = false; const n = q.filter(x => x.done).length; if (n) { logAct('إرسال رسائل', `${n} رسالة عبر ${CH_NAME[channel]}`); saveDb(); Shell.refresh(); } };
    draw();
  };
  step1();
}

/* ===================== السندات ===================== */
const PayF = { tab: 'in' };
Views.payments = {
  dim: () => 'سندات القبض من الزبائن والصرف للموردين',
  render() {
    const rows = db.payments.filter(p => p.type === PayF.tab);
    const t = today(), sumT = rows.filter(p => p.date === t).reduce((s, p) => s + p.amount, 0);
    return `<div class="tabs"><button class="${PayF.tab === 'in' ? 'on' : ''}" data-act="payTab" data-t="in">سندات القبض</button><button class="${PayF.tab === 'out' ? 'on' : ''}" data-act="payTab" data-t="out">سندات الصرف</button></div>
      <div class="toolbar"><span class="chip acc plain">مجموع اليوم: ${moneyT(sumT)}</span><span class="spacer"></span>
        <button class="btn pri" data-act="newReceipt">${ICO('plus')} سند قبض</button><button class="btn" data-act="newPayout">${ICO('plus')} سند صرف لمورد</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الرقم</th><th>التاريخ</th><th>${PayF.tab === 'in' ? 'من' : 'إلى'}</th><th>طريقة الدفع</th><th>البيان</th><th class="n">المبلغ</th><th>المستخدم</th><th></th></tr></thead><tbody>
      ${rows.slice(0, 400).map(p => `<tr><td class="mono">${p.no}</td><td>${fdate(p.date)}</td><td class="t-main">${esc(p.party === 's' ? supName(p.partyId) : custName(p.partyId))}</td><td>${esc(p.method)}</td>
        <td class="t-sub">${esc(p.note || (p.alloc && p.alloc.length ? 'على الفواتير: ' + p.alloc.map(a => (byId(p.party === 's' ? 'purchases' : 'invoices', a.id) || {}).no).join('، ') : ''))}</td>
        <td class="n"><b>${fmt(p.amount)}</b></td><td class="t-sub">${esc(userName(p.user))}</td><td><div class="acts"><button class="btn xs icon" data-act="printPay" data-id="${p.id}" title="طباعة">${ICO('print')}</button></div></td></tr>`).join('')}
      </tbody></table>${rows.length ? '' : emptyHTML('receipt', 'لا توجد سندات')}</div></div>`;
  }
};
function paymentModal(type, partyId = null, docId = null) {
  if (!can('payments')) return toast('لا تملك صلاحية السندات', 'warn');
  const isIn = type === 'in', parties = isIn ? db.customers : db.suppliers;
  const bal = id => isIn ? custBalance(id) : supBalance(id);
  const m = modal({
    title: isIn ? 'سند قبض من زبون' : 'سند صرف لمورد', size: 'narrow',
    body: `<div class="stack" style="gap:12px">
      <div class="field"><label>${isIn ? 'الزبون' : 'المورد'}</label><select class="sel" name="party"><option value="">— اختر —</option>${parties.map(p => `<option value="${p.id}" ${p.id === partyId ? 'selected' : ''}>${esc(p.name)} (${fmt(bal(p.id))})</option>`).join('')}</select></div>
      <div class="field"><label>الفاتورة</label><select class="sel" name="doc"></select><span class="hint">عند اختيار «الأقدم أولاً» يوزّع المبلغ على الفواتير المفتوحة حسب تاريخ استحقاقها.</span></div>
      <div class="form-grid"><div class="field"><label>المبلغ</label><input class="inp num" name="amount" inputmode="decimal"></div>
        <div class="field"><label>طريقة الدفع</label><select class="sel" name="method"><option>نقدي</option><option>تحويل مصرفي</option><option>صك</option><option>زين كاش / محفظة</option></select></div></div>
      <div class="field"><label>ملاحظة</label><input class="inp" name="note"></div><div id="pay-info" class="muted" style="font-size:13px"></div></div>`,
    foot: `<button class="btn pri" data-ok>${ICO('check')} حفظ السند</button><button class="btn" data-ok data-print="1">${ICO('print')} حفظ وطباعة</button>`
  });
  const ps = $('[name=party]', m.el), ds = $('[name=doc]', m.el), am = $('[name=amount]', m.el);
  const fill = () => {
    const id = ps.value, docs = id ? (isIn ? custInvoices(id) : supPurchases(id)).filter(d => remaining(d) > 0.001) : [];
    ds.innerHTML = `<option value="">الأقدم أولاً (${docs.length} مفتوحة)</option>` + docs.map(d => `<option value="${d.id}" ${d.id === docId ? 'selected' : ''}>رقم ${d.no} — ${fdate(d.date)} — المتبقي ${fmt(remaining(d))}</option>`).join('');
    upd();
  };
  const upd = () => {
    const id = ps.value; if (!id) { $('#pay-info', m.el).textContent = ''; return; }
    const d = ds.value && byId(isIn ? 'invoices' : 'purchases', ds.value), max = d ? remaining(d) : bal(id);
    if (!am.value || docId) am.value = max; docId = null;
    $('#pay-info', m.el).innerHTML = `الرصيد المستحق: <b>${moneyT(bal(id))}</b>`;
  };
  ps.onchange = () => { am.value = ''; fill(); }; ds.onchange = () => { am.value = ''; upd(); };
  fill();
  $$('[data-ok]', m.el).forEach(b => b.onclick = () => {
    const v = formVals(m.el), amount = num(v.amount);
    if (!v.party) return toast('اختر ' + (isIn ? 'الزبون' : 'المورد'), 'warn');
    if (amount <= 0) return toast('أدخل مبلغاً صحيحاً', 'warn');
    const d = v.doc && byId(isIn ? 'invoices' : 'purchases', v.doc), max = d ? remaining(d) : bal(v.party);
    if (amount > max + 0.001) return toast(`المبلغ أكبر من المستحق (${moneyT(max)})`, 'warn');
    const p = addPayment({ type, partyId: v.party, amount, method: v.method, note: v.note, docId: v.doc || null });
    logAct(isIn ? 'سند قبض' : 'سند صرف', `رقم ${p.no} · ${isIn ? custName(v.party) : supName(v.party)} · ${moneyT(amount)}`);
    saveDb(); m.close(); toast(`سند رقم ${p.no} محفوظ`); Shell.refresh();
    if (b.dataset.print) printPayment(p.id);
  });
}
function printPayment(id) {
  const p = byId('payments', id); if (!p) return;
  const isIn = p.type === 'in', name = p.party === 's' ? supName(p.partyId) : custName(p.partyId);
  const one = `<div style="border:1.5px solid #0e5a52;border-radius:10px;padding:18px;margin-bottom:24px">
    <div class="pr-h" style="margin-bottom:10px"><div>${brandHTML(db.settings.company)}</div><div style="text-align:left"><p class="pr-title">${isIn ? 'سند قبض' : 'سند صرف'}</p><div>رقم ${p.no} · ${fdate(p.date)}</div></div></div>
    <p style="font-size:14px;line-height:2.2">${isIn ? 'استلمنا من' : 'صرفنا إلى'} السيد/ة: <b>${esc(name)}</b><br>مبلغاً قدره: <b style="font-size:17px">${moneyT(p.amount)}</b><br>طريقة الدفع: ${esc(p.method)}${p.note ? `<br>وذلك عن: ${esc(p.note)}` : ''}</p>
    <div class="pr-sign" style="margin-top:20px"><div>المستلم</div><div>المحاسب: ${esc(userName(p.user))}</div></div></div>`;
  printHTML(one + `<div class="pr-foot">المثلث · ${APP.name} — حقوق البرمجة © أصيل الصافي</div>`);
}
Object.assign(ACTS, { payTab: el => { PayF.tab = el.dataset.t; Shell.refresh(); }, printPay: el => printPayment(el.dataset.id) });

/* ===================== الرسائل ===================== */
const MsgF = { tab: 'log', aud: 'debt' };
Views.messages = {
  dim: () => `${db.messages.length} رسالة مرسلة`,
  render() {
    const tabs = `<div class="tabs">${[['log', 'سجل الرسائل'], ['bulk', 'رسالة جماعية'], ['tpl', 'القوالب']].map(([k, t]) => `<button class="${MsgF.tab === k ? 'on' : ''}" data-act="msgTab" data-t="${k}">${t}</button>`).join('')}</div>`;
    if (MsgF.tab === 'tpl') {
      const names = { due: 'تذكير بمبلغ مستحق', overdue: 'إشعار تأخر السداد', thanks: 'شكر وإشعار رصيد' };
      return tabs + `<div class="grid g3">${Object.entries(names).map(([k, t]) => `<div class="card"><div class="card-h"><h3>${t}</h3></div><div class="card-b"><textarea class="txt" rows="9" data-tpl="${k}">${esc(db.settings.templates[k])}</textarea>
        <div class="ph-list">${PLACEHOLDERS.map(p => `<button type="button" data-ins="${k}" data-ph="${p}">{${p}}</button>`).join('')}</div></div></div>`).join('')}</div>
        <div class="row" style="margin-top:16px"><button class="btn pri" data-act="saveTpl">${ICO('check')} حفظ القوالب</button><button class="btn ghost" data-act="resetTpl">استعادة القوالب الأصلية</button></div>`;
    }
    if (MsgF.tab === 'bulk') {
      const aud = audience(MsgF.aud);
      return tabs + `<div class="card"><div class="card-b"><div class="field"><label>الجمهور المستهدف</label><div class="seg">${[['debt', 'أصحاب الديون'], ['over', 'المتأخرون'], ['all', 'جميع الزبائن'], ['مقاول', 'المقاولون'], ['شركة', 'الشركات'], ['فرد', 'الأفراد']].map(([k, t]) => `<button class="${MsgF.aud === k ? 'on' : ''}" data-act="msgAud" data-a="${k}">${t}</button>`).join('')}</div></div>
        <p class="muted">${aud.length} مستلم، منهم ${aud.filter(r => intlPhone(r.c.phone)).length} لديهم رقم هاتف.</p>
        <div class="row" style="gap:8px;margin-bottom:14px;flex-wrap:wrap">${aud.slice(0, 30).map(r => `<span class="chip plain">${esc(r.c.name)}</span>`).join('')}${aud.length > 30 ? `<span class="muted">و${aud.length - 30} آخرين</span>` : ''}</div>
        <button class="btn brass" data-act="bulkGo" ${aud.length ? '' : 'disabled'}>${ICO('send')} كتابة الرسالة وإرسالها</button></div></div>`;
    }
    return tabs + `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المستلم</th><th>القناة</th><th>النص</th><th>المرسل</th></tr></thead><tbody>
      ${db.messages.slice(0, 300).map(x => `<tr><td class="t-sub" style="white-space:nowrap">${ftime(x.at)}</td><td><div class="t-main">${esc(x.to)}</div><div class="t-sub mono" dir="ltr" style="text-align:right">${esc(x.phone)}</div></td>
        <td><span class="chip ${x.status === 'failed' ? 'dan' : x.channel.startsWith('wa') ? 'ok' : 'acc'}" title="${esc(x.err || '')}">${CH_NAME[x.channel] || x.channel}${x.status === 'failed' ? ' · فشل' : x.status === 'sent' ? ' · أُرسلت' : ''}</span></td><td><div class="t-sub" style="max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(x.text)}">${esc(x.text)}</div></td><td class="t-sub">${esc(userName(x.user))}</td></tr>`).join('')}
      </tbody></table>${db.messages.length ? '' : emptyHTML('msg', 'لم تُرسل رسائل بعد', '<br>أرسل التذكيرات من «القوائم المستحقة»')}</div></div>`;
  },
  after() { $$('[data-ins]').forEach(b => b.onclick = () => { const ta = $(`[data-tpl="${b.dataset.ins}"]`); ta.setRangeText(`{${b.dataset.ph}}`, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); }); }
};
function audience(a) {
  if (a === 'debt') return dueRows();
  if (a === 'over') return dueRows().filter(r => r.bucket === 'over');
  return db.customers.filter(c => a === 'all' || c.type === a).map(partyRow);
}
Object.assign(ACTS, {
  msgTab: el => { MsgF.tab = el.dataset.t; Shell.refresh(); },
  msgAud: el => { MsgF.aud = el.dataset.a; Shell.refresh(); },
  bulkGo: () => composeMessages(audience(MsgF.aud), MsgF.aud === 'over' ? 'overdue' : ['debt'].includes(MsgF.aud) ? 'due' : 'custom'),
  saveTpl: () => { $$('[data-tpl]').forEach(t => db.settings.templates[t.dataset.tpl] = t.value); logAct('تعديل قوالب الرسائل'); saveDb(); toast('حُفظت القوالب'); },
  resetTpl: async () => { if (await confirmBox('استعادة القوالب الأصلية؟')) { db.settings.templates = { ...DEFAULT_TEMPLATES }; rerender(); } }
});
