import fs from 'fs';

if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
        inverse() { return this; }
    };
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
console.log('pages', doc.numPages);
for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const view = page.getViewport({ scale: 1 });
    console.log('size', view.width, view.height);
    const items = content.items
        .filter((item) => item.str && item.str.trim())
        .map((item) => ({
            x: Math.round(item.transform[4]),
            y: Math.round(item.transform[5]),
            t: item.str,
        }))
        .sort((a, b) => b.y - a.y || a.x - b.x);
    console.log(items.map((item) => `${String(item.y).padStart(4)} ${String(item.x).padStart(4)} ${item.t}`).join('\n'));
}
