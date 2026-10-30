// يبني ملف HTML واحداً مستقلاً من مجلد البرنامج (للمعاينة على الجوال أو الإرسال)
// الاستخدام: node tools/build-single.cjs <مجلد البرنامج> <ملف الإخراج>
const fs = require('fs'), path = require('path');
const [dir, out] = process.argv.slice(2);
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (_, f) => `<style>\n${read(f)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
  let js = read(f);
  // قارئ الباركود بالكاميرا يُحمَّل من نسخة مضمّنة بدل الملف الخارجي
  if (f === 'js/ui.js') js = js.replace("s.src = 'js/vendor/zxing.min.js';", "const inl = document.getElementById('zxing-src'); if (inl) { s.textContent = inl.textContent; document.head.append(s); return res(); } s.src = 'js/vendor/zxing.min.js';");
  return `<script>\n${safe(js)}\n</script>`;
});
const zx = path.join(dir, 'js/vendor/zxing.min.js');
if (fs.existsSync(zx)) html = html.replace('</body>', `<script type="text/plain" id="zxing-src">${safe(fs.readFileSync(zx, 'utf8'))}</script>\n</body>`);
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
