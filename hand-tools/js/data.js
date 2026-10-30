/* المثلث · نظام إدارة العدد اليدوية — قاعدة البيانات ومنطق العمل */
'use strict';

const DB_KEY = 'mth-tls-db-v1';

const PERMS = [
  ['dash', 'لوحة القيادة'], ['pos', 'نقطة البيع'], ['invoices', 'الفواتير وعروض الأسعار'], ['deliveries', 'التوصيل'],
  ['materials', 'العدد والمخزن'], ['purchases', 'المشتريات'], ['customers', 'الزبائن'], ['suppliers', 'الموردون'],
  ['dues', 'القوائم المستحقة'], ['payments', 'سندات القبض والصرف'], ['messages', 'الرسائل'], ['docs', 'الماسح والمستندات'],
  ['reports', 'التقارير'], ['users', 'المستخدمون'], ['log', 'سجل العمليات'], ['settings', 'الإعدادات'],
  ['repairs', 'الصيانة والضمان'], ['scanner', 'محطة الماسح'], ['chat', 'المحادثات الداخلية'], ['cashbox', 'الصندوق والمصروفات'], ['returns', 'المرتجعات'],
  ['cost', 'رؤية الكلفة والأرباح'], ['price', 'تعديل السعر والخصم'], ['void', 'الإلغاء والحذف']
];
const ALL_PERMS = PERMS.map(p => p[0]);
const ROLES = {
  admin: { name: 'مدير', perms: ALL_PERMS },
  acct: { name: 'محاسب', perms: ['dash', 'invoices', 'customers', 'suppliers', 'dues', 'payments', 'messages', 'docs', 'reports', 'cost', 'purchases', 'cashbox', 'chat', 'returns'] },
  sales: { name: 'مبيعات', perms: ['dash', 'pos', 'invoices', 'deliveries', 'customers', 'dues', 'messages', 'payments', 'scanner', 'chat', 'returns', 'repairs'] },
  store: { name: 'أمين مخزن', perms: ['dash', 'materials', 'purchases', 'deliveries', 'docs', 'suppliers', 'scanner', 'chat', 'repairs'] }
};
const UNITS = ['قطعة', 'طقم', 'علبة', 'كارتون', 'زوج', 'متر', 'لفة', 'درزن'];
const POWER = ['يدوية', 'كهربائية', 'شحن (بطارية)', 'هوائية', 'بنزين'];
const ORIGINS = ['ألمانيا', 'اليابان', 'الولايات المتحدة', 'السويد', 'إيطاليا', 'تايوان', 'الصين', 'تركيا', 'الهند'];
const SPEC_KEYS = ['القدرة', 'الجهد', 'السرعة', 'عزم الدوران', 'قطر القرص', 'سعة الظرف', 'البطارية', 'الطول', 'العرض', 'السماكة', 'عدد القطع', 'نوع الرأس', 'المعيار'];
const TKT_STATES = [['recv', 'مستلمة', 'var(--brass)'], ['fix', 'قيد التصليح', 'var(--accent)'], ['ready', 'جاهزة للتسليم', 'var(--ok)'], ['done', 'سُلّمت', 'var(--muted)']];
const DOC_KINDS = ['فاتورة مورد', 'كفالة / ضمان', 'كتالوج', 'وصل صيانة', 'مستمسك زبون', 'أخرى'];
const DEFAULT_TEMPLATES = {
  due: 'السيد/ة {الاسم} المحترم،\nتحية طيبة من {الشركة}.\nنود تذكيركم بوجود مبلغ مستحق قدره {المبلغ} عن {عدد_الفواتير} فاتورة، أقدم استحقاق فيها بتاريخ {تاريخ_الاستحقاق}.\nنرجو التفضل بالتسديد، وللاستفسار: {هاتف_الشركة}.\nمع الشكر والتقدير.',
  overdue: 'السيد/ة {الاسم} المحترم،\nنعلمكم بأن المبلغ {المبلغ} المستحق لـ{الشركة} قد تجاوز موعد استحقاقه بـ{أيام_التأخير} يوماً.\nنأمل التسديد في أقرب وقت تجنباً لإيقاف البيع الآجل.\nللتواصل: {هاتف_الشركة}.',
  thanks: 'السيد/ة {الاسم} المحترم،\nشكراً لتعاملكم مع {الشركة}. رصيدكم الحالي: {المبلغ}.\nيسعدنا خدمتكم دائماً.',
  ready: 'السيد/ة {الاسم} المحترم،\nنعلمكم بأن {العدة} (تذكرة صيانة رقم {رقم_التذكرة}) جاهزة للاستلام من {الشركة}.\nكلفة الصيانة: {كلفة_الصيانة}.\nللاستفسار: {هاتف_الشركة}.'
};
const PLACEHOLDERS = ['الاسم', 'المبلغ', 'عدد_الفواتير', 'تاريخ_الاستحقاق', 'أيام_التأخير', 'الشركة', 'هاتف_الشركة'];

function emptyDb() {
  return {
    v: 1,
    settings: {
      company: 'مخازن المثلث للعدد اليدوية', phone: '', address: '', currency: 'د.ع', tax: 0, country: '964',
      blockNegative: true, repairFee: 10000, invoiceNote: 'العدد المباعة لا تُرد إلا بحالتها الأصلية مع الكرتون والملحقات، والضمان حسب شروط الوكيل.', dueDays: 30,
      templates: { ...DEFAULT_TEMPLATES },
      wa: { mode: 'link', token: '', phoneId: '', apiType: 'template', template: '', lang: 'ar' }
    },
    users: [], categories: ['مفاتيح ربط', 'مفكات', 'مطارق', 'كماشات وقواطع', 'أدوات قياس', 'مناشير', 'عدد كهربائية', 'عدد شحن', 'لقم وأقراص', 'أطقم وحقائب', 'معدات سلامة'],
    materials: [], customers: [], suppliers: [], invoices: [], purchases: [], payments: [], movements: [],
    messages: [], docs: [], notices: [], log: [], expenses: [], closings: [], serials: [], tickets: [],
    seq: { inv: 0, quo: 0, pur: 0, rec: 0, pay: 0, exp: 0, tkt: 0, bar: 100000 }
  };
}

let db = (() => {
  const d = lsGet(DB_KEY);
  if (!d) return emptyDb();
  const base = emptyDb();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  d.settings = { ...base.settings, ...d.settings, templates: { ...DEFAULT_TEMPLATES, ...(d.settings || {}).templates }, wa: { ...base.settings.wa, ...(d.settings || {}).wa } };
  d.seq = { ...base.seq, ...d.seq };
  return d;
})();
function saveDb() {
  if (!lsSet(DB_KEY, db)) toast('تعذّر الحفظ: مساحة التخزين ممتلئة. خذ نسخة احتياطية واحذف بعض السجلات القديمة.', 'err');
}

/* ===== استعلامات ===== */
const byId = (arr, id) => db[arr].find(x => x.id === id);
const matById = id => byId('materials', id);
const custById = id => byId('customers', id);
const supById = id => byId('suppliers', id);
const userById = id => byId('users', id);
const cur = () => db.settings.currency;
const money = n => `${fmt(n)} <small>${esc(cur())}</small>`;
const moneyT = n => `${fmt(n)} ${cur()}`;
const nextNo = k => { db.seq[k] = (db.seq[k] || 0) + 1; return db.seq[k]; };
const docNo = (prefix, n) => `${prefix}-${pad(n, 5)}`;

const remaining = d => round2((d.total || 0) - (d.returned || 0) - (d.paid || 0));
const invNet = d => round2((d.total || 0) - (d.returned || 0));
const retQty = (inv, mid) => (inv.returns || []).reduce((s, r) => s + r.lines.filter(l => l.mid === mid).reduce((a, l) => a + l.qty, 0), 0);
function invStatus(inv) {
  if (inv.kind === 'quote') return inv.converted ? { k: 'conv', t: 'تم تحويله', c: 'acc' } : { k: 'quote', t: 'عرض سعر', c: 'brass' };
  if (inv.void) return { k: 'void', t: 'ملغاة', c: 'plain' };
  const r = remaining(inv);
  if (r <= 0.001) return { k: 'paid', t: 'مدفوعة', c: 'ok' };
  if (inv.due && inv.due < today()) return { k: 'over', t: 'متأخرة', c: 'dan' };
  if ((inv.paid || 0) > 0) return { k: 'part', t: 'مدفوعة جزئياً', c: 'warn' };
  return { k: 'credit', t: 'آجلة', c: 'warn' };
}
const liveSales = () => db.invoices.filter(i => i.kind === 'sale' && !i.void);
const custInvoices = cid => liveSales().filter(i => i.customerId === cid);
const custBalance = cid => round2(custInvoices(cid).reduce((s, i) => s + remaining(i), 0));
const supPurchases = sid => db.purchases.filter(p => p.supplierId === sid && !p.void);
const supBalance = sid => round2(supPurchases(sid).reduce((s, p) => s + remaining(p), 0));
const stockState = m => m.stock <= 0 ? 'out' : m.stock <= (m.min || 0) ? 'low' : m.stock <= (m.min || 0) * 2 ? 'mid' : 'ok';

/* صف حساب الزبون: الفواتير المفتوحة والمبلغ وأقدم استحقاق (يُستخدم للقوائم المستحقة والرسائل) */
function partyRow(c) {
  const t = today();
  const open = custInvoices(c.id).filter(i => remaining(i) > 0.001).sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date));
  const amount = round2(open.reduce((s, i) => s + remaining(i), 0));
  const oldest = open.length ? (open[0].due || open[0].date) : null;
  const overdueAmt = round2(open.filter(i => (i.due || i.date) < t).reduce((s, i) => s + remaining(i), 0));
  const lateDays = oldest ? Math.max(0, daysBetween(oldest, t)) : 0;
  const bucket = !oldest ? 'none' : oldest < t ? 'over' : daysBetween(t, oldest) <= 7 ? 'soon' : 'later';
  const lastMsg = db.messages.filter(m => m.partyId === c.id).sort((a, b) => b.at - a.at)[0];
  return { c, open, amount, oldest, overdueAmt, lateDays, bucket, lastMsg };
}
function dueRows() {
  return db.customers.map(partyRow).filter(r => r.amount > 0.001).sort((a, b) => b.lateDays - a.lateDays || b.amount - a.amount);
}
function supDueRows() {
  const t = today();
  return db.suppliers.map(s => {
    const open = supPurchases(s.id).filter(p => remaining(p) > 0.001).sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date));
    if (!open.length) return null;
    const oldest = open[0].due || open[0].date;
    return { s, open, amount: round2(open.reduce((a, p) => a + remaining(p), 0)), oldest, lateDays: Math.max(0, daysBetween(oldest, t)), bucket: oldest < t ? 'over' : daysBetween(t, oldest) <= 7 ? 'soon' : 'later' };
  }).filter(Boolean).sort((a, b) => b.lateDays - a.lateDays || b.amount - a.amount);
}

function fillTemplate(tpl, row) {
  const s = db.settings;
  const map = {
    ...(row.extra || {}),
    'الاسم': row.c.name, 'المبلغ': moneyT(row.amount), 'عدد_الفواتير': row.open.length, 'تاريخ_الاستحقاق': row.oldest ? fdate(row.oldest) : '—',
    'أيام_التأخير': row.lateDays, 'الشركة': s.company, 'هاتف_الشركة': s.phone || '—'
  };
  return String(tpl).replace(/\{([^}]+)\}/g, (m, k) => map[k] !== undefined ? map[k] : m);
}
function intlPhone(p) {
  let d = String(p || '').replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = (db.settings.country || '964') + d.slice(1);
  return d;
}

/* ===== السجل والحركات ===== */
function logAct(action, detail = '') {
  db.log.unshift({ at: Date.now(), user: Session.user ? Session.user.id : null, action, detail });
  if (db.log.length > 3000) db.log.length = 3000;
}
function moveStock(mid, qty, ref, note = '') {
  const m = matById(mid); if (!m) return;
  m.stock = round2((m.stock || 0) + qty);
  db.movements.unshift({ at: Date.now(), date: today(), mid, qty, after: m.stock, ref, note, user: Session.user ? Session.user.id : null });
  if (db.movements.length > 5000) db.movements.length = 5000;
}

/* توزيع المبلغ المقبوض على الفواتير الأقدم أولاً */
function allocate(docs, amount) {
  let left = round2(amount); const alloc = [];
  for (const d of docs.filter(x => remaining(x) > 0.001).sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date) || a.no - b.no)) {
    if (left <= 0) break;
    const take = Math.min(left, remaining(d));
    d.paid = round2((d.paid || 0) + take); left = round2(left - take);
    alloc.push({ id: d.id, amount: take });
  }
  return { alloc, left };
}
function addPayment({ type, partyId, amount, method = 'نقدي', note = '', docId = null, date = today() }) {
  const isIn = type === 'in';
  const docs = isIn ? custInvoices(partyId) : supPurchases(partyId);
  const target = docId ? docs.filter(d => d.id === docId) : docs;
  const { alloc } = allocate(target, amount);
  const p = { id: uid(), no: nextNo(isIn ? 'rec' : 'pay'), type, party: isIn ? 'c' : 's', partyId, amount: round2(amount), method, note, date, at: Date.now(), alloc, user: Session.user ? Session.user.id : null };
  db.payments.unshift(p);
  return p;
}

/* ===== بيانات تجريبية ===== */
/* ===== الأرقام التسلسلية والضمان ===== */
const snFind = sn => db.serials.find(x => x.sn.toUpperCase() === String(sn || '').trim().toUpperCase());
const snOf = mid => db.serials.filter(x => x.mid === mid);
function warrantyState(rec) {
  if (!rec || rec.status !== 'sold' || !rec.warrantyUntil) return { k: 'none', t: rec && rec.status === 'stock' ? 'في المخزن' : 'بدون ضمان', c: 'plain', days: 0 };
  const d = daysBetween(today(), rec.warrantyUntil);
  return d >= 0 ? { k: 'on', t: `ضمن الضمان · متبقٍ ${d} يوماً`, c: 'ok', days: d } : { k: 'off', t: `انتهى الضمان منذ ${-d} يوماً`, c: 'dan', days: d };
}
const addMonths = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setMonth(d.getMonth() + n); return dstr(d); };

/* ===== بيانات تجريبية ===== */
function seedDemo() {
  let s = 20261031; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  db.settings.company = 'مركز المثلث للعدد اليدوية';
  db.settings.phone = '07801234567';
  db.settings.address = 'الديوانية — سوق العدد، شارع الصناعة';
  const sup = [
    ['وكيل بوش — شركة الرافدين التجارية', '07811112222'], ['مكتب ستانلي وبلاك آند ديكر — بغداد', '07701113333'], ['شركة توتال وإنكو للعدد', '07803334444'], ['مستورد ماكيتا ودي والت', '07905556666']
  ].map(([name, phone]) => ({ id: uid(), name, phone, notes: '', created: Date.now() }));
  db.suppliers.push(...sup);
  // الاسم، الصنف، الوحدة، الكلفة، المفرد، الجملة، المخزون، الحد، المورد، الموقع، الماركة، الموديل، المقاس، المنشأ، الخامة، الوزن، الطاقة، الضمان(شهر)، تسلسلي، المواصفات
  const T = [
    ['مثقاب كهربائي مطرقي 13 ملم', 'عدد كهربائية', 'قطعة', 62000, 78000, 74000, 9, 3, 0, 'رف A1', 'Bosch', 'GSB 13 RE', '13 ملم', 'ألمانيا', 'هيكل بلاستيك مقوى', '1.8 كغم', 'كهربائية', 12, true, [['القدرة', '650 واط'], ['الجهد', '220 فولت'], ['السرعة', '0–2800 دورة/د'], ['سعة الظرف', '1.5–13 ملم'], ['قطر الثقب في الخرسانة', '13 ملم']]],
    ['صاروخ قطع وجلي 115 ملم', 'عدد كهربائية', 'قطعة', 48000, 60000, 57000, 11, 3, 3, 'رف A1', 'Makita', 'GA4530', '115 ملم', 'اليابان', 'هيكل ألمنيوم', '1.9 كغم', 'كهربائية', 12, true, [['القدرة', '720 واط'], ['السرعة', '11000 دورة/د'], ['قطر القرص', '115 ملم'], ['سن العمود', 'M14']]],
    ['مفك براغي بالشحن 20 فولت مع بطاريتين', 'عدد شحن', 'طقم', 165000, 199000, 190000, 4, 2, 3, 'رف A2', 'DeWalt', 'DCD771C2', '13 ملم', 'الولايات المتحدة', '—', '1.6 كغم', 'شحن (بطارية)', 24, true, [['الجهد', '20 فولت'], ['البطارية', '2 × 1.3 أمبير/ساعة ليثيوم'], ['عزم الدوران', '42 نيوتن·م'], ['السرعة', 'سرعتان 0–450 / 0–1500']]],
    ['منشار أركت (جكسو) 650 واط', 'عدد كهربائية', 'قطعة', 39000, 52000, 49000, 2, 3, 2, 'رف A2', 'Total', 'TS206656', '65 ملم', 'الصين', '—', '2.1 كغم', 'كهربائية', 6, true, [['القدرة', '650 واط'], ['عمق القطع خشب', '65 ملم'], ['عمق القطع حديد', '6 ملم']]],
    ['طقم مفاتيح ربط مركبة 8–22 ملم (12 قطعة)', 'مفاتيح ربط', 'طقم', 26000, 35000, 32000, 18, 5, 1, 'رف B1', 'Stanley', 'STMT80943', '8–22 ملم', 'تايوان', 'كروم فاناديوم', '1.4 كغم', 'يدوية', 0, false, [['عدد القطع', '12'], ['المقاسات', '8، 9، 10، 11، 12، 13، 14، 15، 17، 19، 21، 22'], ['المعيار', 'DIN 3113']]],
    ['مفتاح ربط مركب 13 ملم', 'مفاتيح ربط', 'قطعة', 2200, 3500, 3000, 64, 20, 2, 'رف B1', 'Ingco', 'HCSPA131', '13 ملم', 'الصين', 'كروم فاناديوم', '90 غم', 'يدوية', 0, false, [['الطول', '170 ملم']]],
    ['مفتاح إنكليزي متحرك 10 انج', 'مفاتيح ربط', 'قطعة', 9500, 13000, 12000, 22, 6, 1, 'رف B1', 'Bahco', '9072', '10 انج', 'السويد', 'فولاذ كربوني مقسّى', '370 غم', 'يدوية', 0, false, [['أقصى فتحة', '34 ملم'], ['الطول', '255 ملم']]],
    ['مفك براغي مصلّب PH2 × 100 ملم', 'مفكات', 'قطعة', 4800, 7000, 6500, 40, 12, 2, 'رف B2', 'Wera', 'Kraftform 350', 'PH2', 'ألمانيا', 'كروم موليبدينوم فاناديوم', '70 غم', 'يدوية', 0, false, [['نوع الرأس', 'فيليبس PH2'], ['طول الساق', '100 ملم'], ['المقبض', 'ثنائي المادة']]],
    ['طقم مفكات دقيقة 32 قطعة', 'مفكات', 'طقم', 8000, 12000, 11000, 15, 5, 2, 'رف B2', 'Ingco', 'HKSD3201', '—', 'الصين', 'فولاذ S2', '300 غم', 'يدوية', 0, false, [['عدد القطع', '32'], ['نوع الرأس', 'مسطح، مصلّب، نجمة، سداسي']]],
    ['مطرقة مخلب 16 أونصة بمقبض فايبر', 'مطارق', 'قطعة', 9000, 13500, 12500, 3, 6, 1, 'رف B3', 'Stanley', 'STHT51391', '16 أونصة', 'تايوان', 'فولاذ مطروق، مقبض فايبر جلاس', '650 غم', 'يدوية', 0, false, [['الطول', '330 ملم']]],
    ['كماشة عامة 8 انج', 'كماشات وقواطع', 'قطعة', 16500, 23000, 21500, 12, 5, 1, 'رف B3', 'Knipex', '03 02 200', '8 انج', 'ألمانيا', 'فولاذ كروم فاناديوم مقسّى بالزيت', '300 غم', 'يدوية', 0, false, [['الطول', '200 ملم'], ['قطع سلك صلب', '2.5 ملم']]],
    ['قاطعة أسلاك جانبية 6 انج', 'كماشات وقواطع', 'قطعة', 3800, 6000, 5500, 30, 10, 2, 'رف B3', 'Ingco', 'HDCP08168', '6 انج', 'الصين', 'كروم فاناديوم', '180 غم', 'يدوية', 0, false, []],
    ['شريط قياس 5 متر', 'أدوات قياس', 'قطعة', 3500, 5500, 5000, 48, 15, 1, 'رف C1', 'Stanley', 'STHT36194', '5 م × 19 ملم', 'الصين', 'شريط فولاذ مطلي', '230 غم', 'يدوية', 0, false, [['الطول', '5 متر'], ['العرض', '19 ملم'], ['الدقة', 'الفئة II']]],
    ['ميزان ماء ألمنيوم 60 سم', 'أدوات قياس', 'قطعة', 6000, 9000, 8500, 14, 4, 2, 'رف C1', 'Total', 'TMT2606', '60 سم', 'الصين', 'ألمنيوم', '400 غم', 'يدوية', 0, false, [['عدد الفقاعات', '3'], ['الدقة', '0.5 ملم/م']]],
    ['ميزان ليزر خطي ذاتي الاستواء', 'أدوات قياس', 'قطعة', 95000, 125000, 118000, 3, 2, 0, 'رف C1', 'Bosch', 'GLL 3-80', '30 م', 'ألمانيا', '—', '0.8 كغم', 'شحن (بطارية)', 12, true, [['مدى العمل', '30 م'], ['الدقة', '±0.2 ملم/م'], ['البطارية', '4 × AA']]],
    ['منشار خشب يدوي 20 انج', 'مناشير', 'قطعة', 7000, 10500, 9800, 9, 4, 1, 'رف C2', 'Bahco', 'NP-20', '20 انج', 'السويد', 'فولاذ مقسّى', '450 غم', 'يدوية', 0, false, [['عدد الأسنان', '7 سن/انج']]],
    ['طقم لقم ثقب خرسانة SDS 5 قطع', 'لقم وأقراص', 'طقم', 7500, 11000, 10000, 26, 8, 0, 'رف D1', 'Bosch', '2607019447', '5–10 ملم', 'ألمانيا', 'كاربايد', '160 غم', 'يدوية', 0, false, [['المقاسات', '5، 6، 6، 8، 10 ملم'], ['نوع الساق', 'SDS-plus']]],
    ['قرص قطع حديد 115 ملم (علبة 25)', 'لقم وأقراص', 'علبة', 11000, 15000, 14000, 20, 6, 2, 'رف D1', 'Ingco', 'MCD301151', '115 × 1.2 ملم', 'الصين', 'أكسيد الألمنيوم', '1.1 كغم', 'يدوية', 0, false, [['قطر القرص', '115 ملم'], ['السماكة', '1.2 ملم'], ['عدد القطع', '25']]],
    ['حقيبة عدة شاملة 108 قطعة', 'أطقم وحقائب', 'طقم', 52000, 69000, 65000, 6, 2, 2, 'رف D2', 'Total', 'THKTHP21086', '—', 'الصين', 'كروم فاناديوم', '6.5 كغم', 'يدوية', 0, false, [['عدد القطع', '108'], ['المحتويات', 'لقم، مفاتيح، مفكات، كماشات، مطرقة']]],
    ['قفازات عمل مقاومة للقطع', 'معدات سلامة', 'زوج', 2500, 4000, 3600, 4, 20, 2, 'رف E1', 'Total', 'TSP1701', 'L', 'الصين', 'نايلون مطلي بولي يوريثان', '60 غم', 'يدوية', 0, false, [['المعيار', 'EN388 مستوى 5']]]
  ];
  T.forEach(([name, cat, unit, cost, price, wprice, stock, min, si, loc, brand, model, size, origin, matl, weight, power, warranty, serialTracked, specs]) => db.materials.push({
    id: uid(), name, cat, unit, barcode: String(600000 + nextNo('bar')), cost, price, wprice, stock, min, supplierId: sup[si].id, loc,
    brand, model, size, origin, matl, weight, power, warranty, serialTracked, specs, desc: '', acc: [], created: Date.now()
  }));
  const M = db.materials;
  M[0].acc = [M[16].id]; M[1].acc = [M[17].id, M[19].id]; M[2].acc = [M[16].id];
  // أرقام تسلسلية للعدد الكهربائية في المخزن
  M.filter(m => m.serialTracked).forEach(m => { for (let k = 0; k < m.stock; k++) db.serials.push({ sn: `${m.brand.slice(0, 2).toUpperCase()}${m.model.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}${pad(2400 + Math.floor(rnd() * 7000), 5)}`, mid: m.id, status: 'stock', at: Date.now() }); });
  const C = [
    ['ورشة الأمانة للحدادة', 'ورشة', '07801010101', 'الحي الصناعي — محل 14', 5000000],
    ['ورشة النجار حيدر جواد', 'ورشة', '07812020202', 'حي الجمهوري', 3000000],
    ['شركة النهرين للمقاولات', 'شركة', '07703030303', 'شارع الكورنيش', 12000000],
    ['علي حسين كاظم', 'فرد', '07904040404', 'حي العسكري', 500000],
    ['ورشة الفرات لصيانة السيارات', 'ورشة', '07805050505', 'طريق الحلة', 4000000],
    ['مصطفى عبد الرضا (كهربائي)', 'فرد', '07716060606', 'حي العروبة', 1500000]
  ];
  C.forEach(([name, type, phone, site, limit]) => db.customers.push({ id: uid(), name, type, phone, site, limit, notes: '', created: Date.now() }));
  const admin = db.users[0];
  for (let k = 0; k < 38; k++) {
    const back = Math.floor(rnd() * 45), date = addDays(today(), -back);
    const cash = rnd() < 0.4, c = cash ? null : pick(db.customers);
    const lines = [], n = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) {
      const m = pick(M); if (lines.some(l => l.mid === m.id)) continue;
      const q = m.serialTracked ? 1 : 1 + Math.floor(rnd() * (m.price < 10000 ? 6 : 2));
      const line = { mid: m.id, name: m.name, unit: m.unit, qty: q, price: c && c.type !== 'فرد' ? m.wprice : m.price, cost: m.cost };
      if (m.serialTracked) line.serials = [`${m.brand.slice(0, 2).toUpperCase()}${m.model.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}${pad(1000 + k * 37, 5)}`];
      lines.push(line);
    }
    const sub = round2(lines.reduce((a, l) => a + l.qty * l.price, 0)), total = sub;
    const paid = cash ? total : rnd() < 0.3 ? round2(total * 0.5) : rnd() < 0.3 ? total : 0;
    const inv = {
      id: uid(), kind: 'sale', no: nextNo('inv'), date, at: new Date(date + 'T' + pad(9 + Math.floor(rnd() * 9)) + ':20:00').getTime(), customerId: c ? c.id : null,
      lines, sub, discount: 0, delivery: 0, taxRate: 0, tax: 0, total, paid, due: cash ? null : addDays(date, pick([15, 30, 30])), tier: c && c.type !== 'فرد' ? 'wholesale' : 'retail', note: '', user: admin.id, ship: null
    };
    db.invoices.push(inv);
    lines.forEach(l => {
      db.movements.push({ at: inv.at, date, mid: l.mid, qty: -l.qty, after: matById(l.mid).stock, ref: docNo('INV', inv.no), note: 'بيع', user: admin.id });
      (l.serials || []).forEach(sn => db.serials.push({ sn, mid: l.mid, status: 'sold', invId: inv.id, customerId: inv.customerId, soldAt: date, warrantyUntil: addMonths(date, matById(l.mid).warranty || 0), at: inv.at }));
    });
    if (paid > 0) db.payments.push({ id: uid(), no: nextNo('rec'), type: 'in', party: 'c', partyId: c ? c.id : null, amount: paid, method: 'نقدي', note: 'مع الفاتورة', date, at: inv.at, alloc: [{ id: inv.id, amount: paid }], user: admin.id });
  }
  db.invoices.sort((a, b) => a.at - b.at).forEach((inv, i) => inv.no = i + 1);
  db.invoices.reverse();
  for (let k = 0; k < 3; k++) {
    const m = M[k * 4], q = m.serialTracked ? 5 : 30, date = addDays(today(), -(6 + k * 9)), total = round2(q * m.cost);
    db.purchases.unshift({ id: uid(), no: nextNo('pur'), date, at: new Date(date + 'T10:00:00').getTime(), supplierId: m.supplierId, lines: [{ mid: m.id, name: m.name, unit: m.unit, qty: q, cost: m.cost }], total, paid: k === 0 ? 0 : total, due: addDays(date, 30), note: '', user: admin.id });
  }
  // تذاكر صيانة
  const sold = db.serials.filter(x => x.status === 'sold' && x.customerId);
  const probs = ['لا يشتغل بعد سقوطه', 'الفحمات منتهية وشرارة عالية', 'البطارية لا تشحن', 'صوت عالٍ في الجيربوكس', 'الظرف لا يمسك اللقمة'];
  ['recv', 'fix', 'fix', 'ready', 'done'].forEach((st, k) => {
    const r = sold[k % sold.length]; if (!r) return; const m = matById(r.mid), w = warrantyState(r).k === 'on' && k % 2 === 0;
    db.tickets.unshift({ id: uid(), no: nextNo('tkt'), date: addDays(today(), -(k * 2 + 1)), at: Date.now() - (k * 2 + 1) * 86400000, customerId: r.customerId, name: custName0(r.customerId), phone: (custById(r.customerId) || {}).phone || '',
      mid: m.id, item: `${m.name} — ${m.brand} ${m.model}`, sn: r.sn, problem: w ? probs[k] : probs[k] + ' (كسر بسبب سوء الاستخدام — خارج الضمان)', received: k % 2 ? 'العدة مع الحقيبة' : 'العدة فقط', warranty: w, est: w ? 0 : 15000 + k * 5000, cost: st === 'done' || st === 'ready' ? (w ? 0 : 20000) : 0,
      paid: st === 'done' && !w ? 20000 : 0, tech: admin.id, state: st, due: addDays(today(), 2), log: [{ at: Date.now(), state: st, user: admin.id }], notes: '' });
  });
  [['وقود ونقل', 25000, 0], ['رواتب', 900000, 3], ['كهرباء ومولدة', 110000, 6], ['قطع غيار للصيانة', 45000, 2]].forEach(([cat, amount, back]) =>
    db.expenses.unshift({ id: uid(), no: nextNo('exp'), date: addDays(today(), -back), at: Date.now() - back * 86400000, cat, amount, note: '', user: admin.id }));
  db.notices.push({ id: uid(), at: Date.now(), from: admin.id, to: 'all', text: 'مرحباً بكم في نظام المثلث للعدد اليدوية. سجّلوا الرقم التسلسلي لكل عدّة كهربائية عند البيع حتى يُعرف ضمانها لاحقاً بالمسح.', readBy: [] });
  logAct('إضافة بيانات تجريبية', `${db.materials.length} صنف، ${db.customers.length} زبائن`);
}
const custName0 = id => { const c = id && custById(id); return c ? c.name : 'زبون نقدي'; };
