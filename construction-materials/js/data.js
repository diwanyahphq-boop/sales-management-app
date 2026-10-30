/* المثلث · نظام إدارة المواد الإنشائية — قاعدة البيانات ومنطق العمل */
'use strict';

const DB_KEY = 'mth-bld-db-v1';

const PERMS = [
  ['dash', 'لوحة القيادة'], ['pos', 'نقطة البيع'], ['invoices', 'الفواتير وعروض الأسعار'], ['deliveries', 'التوصيل'],
  ['materials', 'المواد والمخزن'], ['purchases', 'المشتريات'], ['customers', 'الزبائن'], ['suppliers', 'الموردون'],
  ['dues', 'القوائم المستحقة'], ['payments', 'سندات القبض والصرف'], ['messages', 'الرسائل'], ['docs', 'الماسح والمستندات'],
  ['reports', 'التقارير'], ['users', 'المستخدمون'], ['log', 'سجل العمليات'], ['settings', 'الإعدادات'],
  ['cost', 'رؤية الكلفة والأرباح'], ['price', 'تعديل السعر والخصم'], ['void', 'الإلغاء والحذف']
];
const ALL_PERMS = PERMS.map(p => p[0]);
const ROLES = {
  admin: { name: 'مدير', perms: ALL_PERMS },
  acct: { name: 'محاسب', perms: ['dash', 'invoices', 'customers', 'suppliers', 'dues', 'payments', 'messages', 'docs', 'reports', 'cost', 'purchases'] },
  sales: { name: 'مبيعات', perms: ['dash', 'pos', 'invoices', 'deliveries', 'customers', 'dues', 'messages', 'payments'] },
  store: { name: 'أمين مخزن', perms: ['dash', 'materials', 'purchases', 'deliveries', 'docs', 'suppliers'] }
};
const UNITS = ['كيس', 'طن', 'قطعة', 'م³', 'م²', 'متر', 'لفة', 'سطل', 'ألف طابوقة', 'كارتون', 'حمل'];
const DOC_KINDS = ['فاتورة مورد', 'وصل استلام', 'عقد', 'مستمسك زبون', 'مخطط موقع', 'أخرى'];
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
      company: 'مخازن المثلث للمواد الإنشائية', phone: '', address: '', currency: 'د.ع', tax: 0, country: '964',
      blockNegative: true, invoiceNote: 'المواد المباعة لا ترد بعد خروجها من المخزن إلا بموافقة الإدارة.', dueDays: 30,
      templates: { ...DEFAULT_TEMPLATES }
    },
    users: [], categories: ['اسمنت', 'حديد', 'طابوق وبلوك', 'رمل وحصى', 'جص ومواد لياسة', 'بلاط وسيراميك', 'صحيات', 'كهربائيات', 'دهانات', 'عوازل', 'أخشاب'],
    materials: [], customers: [], suppliers: [], invoices: [], purchases: [], payments: [], movements: [],
    messages: [], docs: [], notices: [], log: [],
    seq: { inv: 0, quo: 0, pur: 0, rec: 0, pay: 0, bar: 100000 }
  };
}

let db = (() => {
  const d = lsGet(DB_KEY);
  if (!d) return emptyDb();
  const base = emptyDb();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  d.settings = { ...base.settings, ...d.settings, templates: { ...DEFAULT_TEMPLATES, ...(d.settings || {}).templates } };
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

const remaining = d => round2((d.total || 0) - (d.paid || 0));
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
function seedDemo() {
  let s = 20261030; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  db.settings.company = 'مخازن المثلث للمواد الإنشائية';
  db.settings.phone = '07801234567';
  db.settings.address = 'الديوانية — الحي الصناعي، قرب ساحة الاحتفالات';
  const sup = [
    ['معمل اسمنت الكوفة', '07811112222'], ['شركة حديد الشرق', '07701113333'], ['معمل طابوق النجف الحديث', '07803334444'], ['مكتب الفرات للرمل والحصى', '07905556666']
  ].map(([name, phone]) => ({ id: uid(), name, phone, notes: '', created: Date.now() }));
  db.suppliers.push(...sup);
  const M = [
    ['اسمنت مقاوم للأملاح — كيس 50 كغم', 'اسمنت', 'كيس', 7400, 8500, 8100, 520, 150, 0, 'المخزن A'],
    ['اسمنت عادي بورتلاندي — كيس 50 كغم', 'اسمنت', 'كيس', 6500, 7500, 7200, 860, 200, 0, 'المخزن A'],
    ['اسمنت أبيض — كيس 40 كغم', 'اسمنت', 'كيس', 12000, 14000, 13300, 38, 40, 0, 'المخزن A'],
    ['حديد تسليح 12 ملم', 'حديد', 'طن', 965000, 1050000, 1020000, 14.5, 5, 1, 'الساحة 2'],
    ['حديد تسليح 16 ملم', 'حديد', 'طن', 960000, 1045000, 1015000, 9, 5, 1, 'الساحة 2'],
    ['شيش حديد 8 ملم', 'حديد', 'طن', 975000, 1065000, 1035000, 3.2, 4, 1, 'الساحة 2'],
    ['طابوق أحمر فرشي', 'طابوق وبلوك', 'ألف طابوقة', 185000, 210000, 200000, 42, 10, 2, 'الساحة 1'],
    ['بلوك كونكريتي 20 سم', 'طابوق وبلوك', 'قطعة', 480, 600, 560, 6400, 1500, 2, 'الساحة 1'],
    ['رمل نهري ناعم', 'رمل وحصى', 'م³', 19000, 25000, 23000, 140, 30, 3, 'الساحة 3'],
    ['حصى مغسول', 'رمل وحصى', 'م³', 23000, 30000, 28000, 22, 30, 3, 'الساحة 3'],
    ['جص بورك — كيس 25 كغم', 'جص ومواد لياسة', 'كيس', 2800, 3500, 3300, 410, 100, 0, 'المخزن B'],
    ['سيراميك أرضي 60×60 سم', 'بلاط وسيراميك', 'م²', 11500, 14000, 13200, 640, 120, null, 'المعرض'],
    ['بورسلين لماع 120×60 سم', 'بلاط وسيراميك', 'م²', 21000, 26000, 24500, 85, 100, null, 'المعرض'],
    ['أنبوب PPR قطر 1 انج', 'صحيات', 'قطعة', 4600, 6000, 5500, 300, 80, null, 'المخزن C'],
    ['سلك كهرباء 4 ملم', 'كهربائيات', 'لفة', 47000, 55000, 52000, 26, 10, null, 'المخزن C'],
    ['دهان أكريليك داخلي — سطل 18 لتر', 'دهانات', 'سطل', 37000, 45000, 42500, 54, 15, null, 'المخزن B'],
    ['لفائف عزل مائي (ممبرين)', 'عوازل', 'لفة', 17500, 22000, 20500, 7, 12, null, 'المخزن B']
  ];
  M.forEach(([name, cat, unit, cost, price, wprice, stock, min, si, loc]) => db.materials.push({
    id: uid(), name, cat, unit, barcode: String(200000 + nextNo('bar')), cost, price, wprice, stock, min,
    supplierId: si == null ? null : sup[si].id, loc, created: Date.now()
  }));
  const C = [
    ['شركة الرافدين للمقاولات', 'مقاول', '07801010101', 'مشروع مجمع الزهراء السكني', 60000000],
    ['المقاول حيدر عبد الأمير', 'مقاول', '07812020202', 'دور سكنية — حي الجمهوري', 15000000],
    ['مكتب البناء الحديث', 'شركة', '07703030303', 'بناية تجارية — شارع الكورنيش', 25000000],
    ['علي حسين كاظم', 'فرد', '07904040404', 'بيت — حي العسكري', 3000000],
    ['مؤسسة الفرات الإنشائية', 'شركة', '07805050505', 'مدرسة — ناحية الشافعية', 40000000],
    ['المقاول سجاد محمد', 'مقاول', '07716060606', 'ترميم — حي العروبة', 8000000]
  ];
  C.forEach(([name, type, phone, site, limit]) => db.customers.push({ id: uid(), name, type, phone, site, limit, notes: '', created: Date.now() }));
  const admin = db.users[0];
  const drivers = ['أبو مصطفى', 'كرار جبار', 'حسن فالح'], vehicles = ['قلاب 2041', 'لوري 7713', 'بيك اب 3390'];
  for (let k = 0; k < 34; k++) {
    const back = Math.floor(rnd() * 45), date = addDays(today(), -back);
    const cash = rnd() < 0.35, c = cash ? null : pick(db.customers);
    const lines = [], n = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) {
      const m = pick(db.materials); if (lines.some(l => l.mid === m.id)) continue;
      const q = m.unit === 'طن' ? round2(0.5 + rnd() * 2) : m.unit === 'قطعة' ? 100 * (1 + Math.floor(rnd() * 8)) : m.unit === 'ألف طابوقة' ? 1 + Math.floor(rnd() * 4) : 5 + Math.floor(rnd() * 40);
      lines.push({ mid: m.id, name: m.name, unit: m.unit, qty: q, price: c && c.type !== 'فرد' ? m.wprice : m.price, cost: m.cost });
    }
    const sub = round2(lines.reduce((a, l) => a + l.qty * l.price, 0));
    const delivery = rnd() < 0.5 ? 25000 : 0;
    const total = round2(sub + delivery);
    const paid = cash ? total : rnd() < 0.3 ? round2(total * 0.4) : rnd() < 0.25 ? total : 0;
    const inv = {
      id: uid(), kind: 'sale', no: nextNo('inv'), date, at: new Date(date + 'T' + pad(8 + Math.floor(rnd() * 9)) + ':15:00').getTime(), customerId: c ? c.id : null,
      lines, sub, discount: 0, delivery, taxRate: 0, tax: 0, total, paid, due: cash ? null : addDays(date, pick([15, 30, 30, 45])),
      tier: c && c.type !== 'فرد' ? 'wholesale' : 'retail', note: '', user: admin.id,
      ship: delivery ? { addr: c ? c.site : 'حي الإسكان', driver: pick(drivers), vehicle: pick(vehicles), state: back > 2 ? 'done' : back > 0 ? 'road' : 'wait' } : null
    };
    db.invoices.push(inv);
    lines.forEach(l => { const m = matById(l.mid); db.movements.push({ at: inv.at, date, mid: l.mid, qty: -l.qty, after: m.stock, ref: docNo('INV', inv.no), note: 'بيع', user: admin.id }); });
    if (paid > 0) db.payments.push({ id: uid(), no: nextNo('rec'), type: 'in', party: 'c', partyId: c ? c.id : null, amount: paid, method: 'نقدي', note: 'مع الفاتورة', date, at: inv.at, alloc: [{ id: inv.id, amount: paid }], user: admin.id });
  }
  db.invoices.sort((a, b) => a.at - b.at).forEach((inv, i) => inv.no = i + 1);
  db.invoices.reverse();
  for (let k = 0; k < 3; k++) {
    const m = db.materials[k * 3], q = m.unit === 'طن' ? 10 : 200, date = addDays(today(), -(5 + k * 9));
    const total = round2(q * m.cost);
    db.purchases.unshift({ id: uid(), no: nextNo('pur'), date, at: new Date(date + 'T10:00:00').getTime(), supplierId: m.supplierId || sup[0].id, lines: [{ mid: m.id, name: m.name, unit: m.unit, qty: q, cost: m.cost }], total, paid: k === 0 ? 0 : total, due: addDays(date, 30), note: '', user: admin.id });
  }
  db.invoices.unshift({
    id: uid(), kind: 'quote', no: nextNo('quo'), date: today(), at: Date.now(), customerId: db.customers[4].id,
    lines: [{ mid: db.materials[3].id, name: db.materials[3].name, unit: 'طن', qty: 6, price: db.materials[3].wprice, cost: db.materials[3].cost }, { mid: db.materials[0].id, name: db.materials[0].name, unit: 'كيس', qty: 300, price: db.materials[0].wprice, cost: db.materials[0].cost }],
    sub: 0, discount: 0, delivery: 50000, taxRate: 0, tax: 0, total: 0, paid: 0, due: null, tier: 'wholesale', note: 'العرض نافذ لمدة 7 أيام', user: admin.id, ship: null
  });
  const q = db.invoices[0]; q.sub = round2(q.lines.reduce((a, l) => a + l.qty * l.price, 0)); q.total = q.sub + q.delivery;
  db.notices.push({ id: uid(), at: Date.now(), from: admin.id, to: 'all', text: 'مرحباً بكم في نظام المثلث للمواد الإنشائية. يرجى مراجعة القوائم المستحقة يومياً وإرسال التذكيرات.', readBy: [] });
  logAct('إضافة بيانات تجريبية', `${db.materials.length} مادة، ${db.customers.length} زبائن`);
}
