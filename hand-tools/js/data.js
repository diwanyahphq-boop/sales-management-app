/* المثلث · نظام مستودع العدد الإنشائية — قاعدة البيانات ومنطق العمل */
'use strict';

const DB_KEY = 'mth-tls-db-v1';

const PERMS = [
  ['dash', 'لوحة القيادة'], ['pos', 'نقطة البيع'], ['invoices', 'الفواتير وعروض الأسعار'], ['deliveries', 'التوصيل'],
  ['materials', 'العدد والمخزن'], ['purchases', 'المشتريات'], ['customers', 'الزبائن'], ['suppliers', 'الموردون'],
  ['dues', 'القوائم المستحقة'], ['payments', 'سندات القبض والصرف'], ['messages', 'الرسائل'], ['docs', 'الماسح والمستندات'],
  ['reports', 'التقارير'], ['users', 'المستخدمون'], ['log', 'سجل العمليات'], ['settings', 'الإعدادات'],
  ['scanner', 'محطة الماسح'], ['chat', 'المحادثات الداخلية'], ['cashbox', 'الصندوق والمصروفات'], ['returns', 'المرتجعات'],
  ['cost', 'رؤية الكلفة والأرباح'], ['price', 'تعديل السعر والخصم'], ['void', 'الإلغاء والحذف']
];
const ALL_PERMS = PERMS.map(p => p[0]);
const ROLES = {
  admin: { name: 'مدير', perms: ALL_PERMS },
  acct: { name: 'محاسب', perms: ['dash', 'invoices', 'customers', 'suppliers', 'dues', 'payments', 'messages', 'docs', 'reports', 'cost', 'purchases', 'cashbox', 'chat', 'returns'] },
  sales: { name: 'مبيعات', perms: ['dash', 'pos', 'invoices', 'deliveries', 'customers', 'dues', 'messages', 'payments', 'scanner', 'chat', 'returns'] },
  store: { name: 'أمين مخزن', perms: ['dash', 'materials', 'purchases', 'deliveries', 'docs', 'suppliers', 'scanner', 'chat'] }
};
const UNITS = ['قطعة', 'طقم', 'علبة', 'كارتون', 'زوج', 'متر', 'لفة', 'درزن', 'كغم'];
const POWER = ['يدوية', 'كهربائية', 'شحن (بطارية)', 'هوائية', 'بنزين'];
const ORIGINS = ['ألمانيا', 'اليابان', 'الولايات المتحدة', 'السويد', 'إيطاليا', 'تايوان', 'الصين', 'تركيا', 'الهند'];
const SPEC_KEYS = ['القدرة', 'الجهد', 'السرعة', 'عزم الدوران', 'قطر القرص', 'سعة الظرف', 'البطارية', 'الطول', 'العرض', 'السماكة', 'عدد القطع', 'نوع الرأس', 'المعيار'];
const DOC_KINDS = ['فاتورة مورد', 'وصل استلام', 'كفالة / ضمان', 'كتالوج', 'مستمسك زبون', 'أخرى'];
const DEFAULT_TEMPLATES = {
  due: 'السيد/ة {الاسم} المحترم،\nتحية طيبة من {الشركة}.\nنود تذكيركم بوجود مبلغ مستحق قدره {المبلغ} عن {عدد_الفواتير} فاتورة، أقدم استحقاق فيها بتاريخ {تاريخ_الاستحقاق}.\nنرجو التفضل بالتسديد، وللاستفسار: {هاتف_الشركة}.\nمع الشكر والتقدير.',
  overdue: 'السيد/ة {الاسم} المحترم،\nنعلمكم بأن المبلغ {المبلغ} المستحق لـ{الشركة} قد تجاوز موعد استحقاقه بـ{أيام_التأخير} يوماً.\nنأمل التسديد في أقرب وقت تجنباً لإيقاف البيع الآجل.\nللتواصل: {هاتف_الشركة}.',
  thanks: 'السيد/ة {الاسم} المحترم،\nشكراً لتعاملكم مع {الشركة}. رصيدكم الحالي: {المبلغ}.\nيسعدنا خدمتكم دائماً.'
};
const PLACEHOLDERS = ['الاسم', 'المبلغ', 'عدد_الفواتير', 'تاريخ_الاستحقاق', 'أيام_التأخير', 'الشركة', 'هاتف_الشركة'];

function emptyDb() {
  return {
    v: 1,
    settings: {
      company: 'مستودع المثلث للعدد الإنشائية', phone: '', address: '', currency: 'د.ع', tax: 0, country: '964',
      blockNegative: true, invoiceNote: 'العدد المباعة لا تُرد إلا بحالتها الأصلية مع الكرتون والملحقات، والضمان حسب شروط الوكيل.', dueDays: 30,
      templates: { ...DEFAULT_TEMPLATES },
      wa: { mode: 'link', token: '', phoneId: '', apiType: 'template', template: '', lang: 'ar' }
    },
    users: [], categories: ['عدد البناء واللياسة', 'أدوات قياس وتسوية', 'حفر ونقل', 'قص وربط الحديد', 'مطارق وأزاميل', 'مفاتيح ومفكات', 'عدد كهربائية', 'عدد شحن', 'لقم وأقراص', 'معدات سلامة'],
    materials: [], customers: [], suppliers: [], invoices: [], purchases: [], payments: [], movements: [],
    messages: [], docs: [], notices: [], log: [], expenses: [], closings: [], serials: [],
    seq: { inv: 0, quo: 0, pur: 0, rec: 0, pay: 0, exp: 0, bar: 100000 }
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
  db.settings.company = 'مستودع المثلث للعدد الإنشائية';
  db.settings.phone = '07801234567';
  db.settings.address = 'الديوانية — الحي الصناعي، شارع المستودعات';
  const sup = [
    ['وكيل بوش — شركة الرافدين التجارية', '07811112222'], ['مكتب ستانلي وبلاك آند ديكر — بغداد', '07701113333'], ['شركة توتال وإنكو للعدد', '07803334444'], ['مستورد ماكيتا وبيلوتا', '07905556666']
  ].map(([name, phone]) => ({ id: uid(), name, phone, notes: '', created: Date.now() }));
  db.suppliers.push(...sup);
  // الاسم، الصنف، الوحدة، الكلفة، المفرد، الجملة، المخزون، الحد، المورد، الموقع، الماركة، الموديل، المقاس، المنشأ، الخامة، الوزن، الطاقة، الضمان(شهر)، تسلسلي، المواصفات
  const T = [
    ['مثقاب هيلتي SDS-plus 800 واط', 'عدد كهربائية', 'قطعة', 128000, 155000, 148000, 7, 3, 0, 'رف A1', 'Bosch', 'GBH 2-26', '26 ملم', 'ألمانيا', 'هيكل معدني ومقوى', '2.7 كغم', 'كهربائية', 12, true, [['القدرة', '800 واط'], ['قوة الضربة', '2.7 جول'], ['سعة الثقب في الخرسانة', '26 ملم'], ['الأوضاع', 'ثقب، ثقب مطرقي، تكسير']]],
    ['صاروخ قطع 230 ملم 2200 واط', 'عدد كهربائية', 'قطعة', 92000, 115000, 109000, 6, 3, 3, 'رف A1', 'Makita', 'GA9020', '230 ملم', 'اليابان', 'هيكل ألمنيوم', '5.8 كغم', 'كهربائية', 12, true, [['القدرة', '2200 واط'], ['السرعة', '6600 دورة/د'], ['قطر القرص', '230 ملم']]],
    ['هزاز خرسانة (فايبريتر) 1.5 كيلوواط مع خرطوم 4 م', 'عدد كهربائية', 'قطعة', 135000, 165000, 158000, 3, 2, 2, 'الساحة — رف 1', 'Total', 'TP615001', '35 ملم × 4 م', 'الصين', '—', '9 كغم', 'كهربائية', 6, true, [['القدرة', '1500 واط'], ['قطر الإبرة', '35 ملم'], ['طول الخرطوم', '4 م']]],
    ['خلاط مونة ودهان (مضرب) 1400 واط', 'عدد كهربائية', 'قطعة', 58000, 75000, 71000, 5, 2, 2, 'رف A2', 'Ingco', 'MX214008', '120 ملم', 'الصين', '—', '4.4 كغم', 'كهربائية', 6, true, [['القدرة', '1400 واط'], ['السرعة', 'متغيرة 6 مستويات'], ['قطر المضرب', '120 ملم']]],
    ['مفك براغي بالشحن 20 فولت مع بطاريتين', 'عدد شحن', 'طقم', 165000, 199000, 190000, 4, 2, 0, 'رف A2', 'DeWalt', 'DCD771C2', '13 ملم', 'الولايات المتحدة', '—', '1.6 كغم', 'شحن (بطارية)', 24, true, [['الجهد', '20 فولت'], ['البطارية', '2 × 1.3 أمبير/ساعة ليثيوم'], ['عزم الدوران', '42 نيوتن·م']]],
    ['مسطرين لياسة 7 انج بمقبض خشب', 'عدد البناء واللياسة', 'قطعة', 3500, 5500, 5000, 85, 25, 3, 'رف B1', 'Bellota', '5850-7', '7 انج', 'إسبانيا', 'فولاذ مقسّى', '320 غم', 'يدوية', 0, false, [['الشكل', 'مثلث رأس مدبب']]],
    ['مالج تنعيم ستيل 28 × 12 سم', 'عدد البناء واللياسة', 'قطعة', 5500, 8000, 7500, 40, 12, 3, 'رف B1', 'Kapriol', '23312', '28 × 12 سم', 'إيطاليا', 'ستانلس ستيل', '450 غم', 'يدوية', 0, false, [['السماكة', '0.7 ملم']]],
    ['قدّة ألمنيوم للتسوية 2 م', 'عدد البناء واللياسة', 'قطعة', 9000, 13000, 12000, 18, 6, 2, 'الساحة — رف 2', 'Total', 'THT26200', '2 م', 'الصين', 'ألمنيوم', '1.3 كغم', 'يدوية', 0, false, []],
    ['شاقول بناء 400 غم', 'أدوات قياس وتسوية', 'قطعة', 2500, 4000, 3600, 30, 10, 1, 'رف C1', 'Stanley', '0-47-973', '400 غم', 'تايوان', 'فولاذ مطلي', '400 غم', 'يدوية', 0, false, []],
    ['خيط بناء نايلون 100 م', 'أدوات قياس وتسوية', 'لفة', 1000, 2000, 1750, 120, 40, 2, 'رف C1', 'Ingco', 'HMLN100', '1.5 ملم × 100 م', 'الصين', 'نايلون', '90 غم', 'يدوية', 0, false, []],
    ['ميزان ماء ألمنيوم 120 سم', 'أدوات قياس وتسوية', 'قطعة', 22000, 30000, 28000, 10, 4, 1, 'رف C1', 'Stabila', '70-2 120', '120 سم', 'ألمانيا', 'ألمنيوم مقوى', '900 غم', 'يدوية', 0, false, [['عدد الفقاعات', '2'], ['الدقة', '0.5 ملم/م']]],
    ['شريط قياس 8 م', 'أدوات قياس وتسوية', 'قطعة', 5000, 7500, 7000, 45, 15, 1, 'رف C1', 'Stanley', 'STHT30656', '8 م × 25 ملم', 'الصين', 'شريط فولاذ مطلي', '400 غم', 'يدوية', 0, false, []],
    ['عربانة (عربة يدوية) 90 لتر عجلة هواء', 'حفر ونقل', 'قطعة', 38000, 50000, 47000, 8, 4, 2, 'الساحة', 'Total', 'THWB6501', '90 لتر', 'الصين', 'حوض فولاذ مجلفن', '14 كغم', 'يدوية', 0, false, [['الحمولة القصوى', '150 كغم'], ['العجلة', '16 انج هوائية']]],
    ['كريك (مجرفة) بمقبض خشب', 'حفر ونقل', 'قطعة', 6000, 9000, 8300, 2, 10, 3, 'الساحة', 'Bellota', '5502', '—', 'إسبانيا', 'فولاذ مطروق', '1.9 كغم', 'يدوية', 0, false, []],
    ['قزمة حفر 2.5 كغم', 'حفر ونقل', 'قطعة', 8000, 11500, 10800, 14, 5, 2, 'الساحة', 'Ingco', 'HPA02501', '2.5 كغم', 'الصين', 'فولاذ كربوني', '3.2 كغم', 'يدوية', 0, false, []],
    ['قاطعة شيش حديد 36 انج', 'قص وربط الحديد', 'قطعة', 26000, 35000, 33000, 9, 3, 1, 'رف D1', 'Bahco', '4559-36', '36 انج', 'السويد', 'فولاذ مقسّى', '6.4 كغم', 'يدوية', 0, false, [['أقصى قطع', 'حديد تسليح 13 ملم']]],
    ['كلّاب ربط شيش الحديد', 'قص وربط الحديد', 'قطعة', 3000, 4500, 4000, 36, 12, 2, 'رف D1', 'Ingco', 'HTP0412', '12 انج', 'الصين', 'كروم فاناديوم', '450 غم', 'يدوية', 0, false, []],
    ['مطرقة حجّار 1 كغم', 'مطارق وأزاميل', 'قطعة', 6500, 9500, 8800, 22, 8, 1, 'رف D2', 'Stanley', 'STHT54126', '1 كغم', 'تايوان', 'فولاذ مطروق، مقبض فايبر', '1.3 كغم', 'يدوية', 0, false, []],
    ['قرص قطع حجر وطابوق 230 ملم', 'لقم وأقراص', 'قطعة', 2500, 3750, 3400, 150, 40, 0, 'رف E1', 'Bosch', '2608600326', '230 × 3 ملم', 'ألمانيا', 'كربيد السيليكون', '450 غم', 'يدوية', 0, false, [['قطر القرص', '230 ملم'], ['السماكة', '3 ملم']]],
    ['خوذة سلامة مع حزام ذقن', 'معدات سلامة', 'قطعة', 3000, 5000, 4500, 3, 20, 2, 'رف F1', 'Total', 'TSP2609', 'قياس موحد', 'الصين', 'HDPE', '380 غم', 'يدوية', 0, false, [['المعيار', 'EN397']]]
  ];
  T.forEach(([name, cat, unit, cost, price, wprice, stock, min, si, loc, brand, model, size, origin, matl, weight, power, warranty, serialTracked, specs]) => db.materials.push({
    id: uid(), name, cat, unit, barcode: String(600000 + nextNo('bar')), cost, price, wprice, stock, min, supplierId: sup[si].id, loc,
    brand, model, size, origin, matl, weight, power, warranty, serialTracked, specs, desc: '', acc: [], created: Date.now()
  }));
  const M = db.materials;
  M[0].acc = [M[18].id]; M[1].acc = [M[18].id, M[19].id]; M[5].acc = [M[6].id, M[7].id, M[9].id];
  // أرقام تسلسلية للعدد الكهربائية في المخزن
  M.filter(m => m.serialTracked).forEach(m => { for (let k = 0; k < m.stock; k++) db.serials.push({ sn: `${m.brand.slice(0, 2).toUpperCase()}${m.model.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}${pad(2400 + Math.floor(rnd() * 7000), 5)}`, mid: m.id, status: 'stock', at: Date.now() }); });
  const C = [
    ['شركة الرافدين للمقاولات', 'شركة', '07801010101', 'مشروع مجمع الزهراء السكني', 20000000],
    ['المقاول حيدر عبد الأمير', 'مقاول', '07812020202', 'دور سكنية — حي الجمهوري', 6000000],
    ['مكتب البناء الحديث', 'شركة', '07703030303', 'بناية تجارية — شارع الكورنيش', 10000000],
    ['علي حسين كاظم', 'فرد', '07904040404', 'بيت — حي العسكري', 1000000],
    ['مؤسسة الفرات الإنشائية', 'شركة', '07805050505', 'مدرسة — ناحية الشافعية', 15000000],
    ['المقاول سجاد محمد', 'مقاول', '07716060606', 'ترميم — حي العروبة', 4000000]
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
      lines, sub, discount: 0, delivery: 0, taxRate: 0, tax: 0, total, paid, due: cash ? null : addDays(date, pick([15, 30, 30])), tier: c && c.type !== 'فرد' ? 'wholesale' : 'retail', note: '', user: admin.id,
      ship: c && rnd() < 0.35 ? { addr: c.site, driver: pick(['أبو مصطفى', 'كرار جبار', 'حسن فالح']), vehicle: pick(['بيك اب 3390', 'كيا 7713']), state: back > 2 ? 'done' : back > 0 ? 'road' : 'wait' } : null
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
  [['وقود ونقل', 25000, 0], ['رواتب', 900000, 3], ['كهرباء ومولدة', 110000, 6], ['تحميل وتنزيل', 45000, 2]].forEach(([cat, amount, back]) =>
    db.expenses.unshift({ id: uid(), no: nextNo('exp'), date: addDays(today(), -back), at: Date.now() - back * 86400000, cat, amount, note: '', user: admin.id }));
  db.notices.push({ id: uid(), at: Date.now(), from: admin.id, to: 'all', text: 'مرحباً بكم في نظام المثلث للعدد الإنشائية. سجّلوا الرقم التسلسلي لكل عدّة كهربائية عند البيع حتى يُعرف ضمانها لاحقاً بالمسح، وراجعوا القوائم المستحقة للمقاولين يومياً.', readBy: [] });
  logAct('إضافة بيانات تجريبية', `${db.materials.length} صنف، ${db.customers.length} زبائن`);
}
