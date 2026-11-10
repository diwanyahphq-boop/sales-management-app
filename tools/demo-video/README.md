# فيديو الشرح (للعرض على الجوال)

يسجّل هذا المجلد فيديو عمودياً بمقاس 1080×1920. يعمل البرنامج الحقيقي داخل إطار هاتف، مع عناوين عربية لكل خطوة، ومؤشر للمسات، ومحاكاة لمسح الباركود.

```bash
# من جذر المستودع
python3 -m http.server 8765 --bind 127.0.0.1 &
mkdir -p /tmp/demo
node tools/demo-video/record.cjs c /tmp/demo   # c = المواد الإنشائية، t = مستودع العدد
ffmpeg -f concat -safe 0 -i /tmp/demo/list-c.txt -vf "fps=30,format=yuv420p" -c:v libx264 -crf 21 -movflags +faststart demo-c.mp4
```

المشاهد معرّفة في `stage.html`، في الكائن `scenes`، وكل مشهد دالة تتحكم بالبرنامج داخل الهاتف.
