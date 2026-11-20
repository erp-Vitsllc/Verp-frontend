import { jsPDF } from 'jspdf';
import { loadVegaLetterhead, paintVegaLetterhead } from '../vegaLetterhead';

const TEAL = [0, 141, 147];
const NAVY = [31, 53, 69];
const MUTED = [102, 126, 140];
const INK = [22, 45, 59];
const MINT = [237, 249, 249];
const PANEL = [245, 249, 250];
const ZEBRA = [245, 250, 251];
const HAIRLINE = [228, 235, 240];
const RULE = [168, 186, 195];
const WHITE = [255, 255, 255];

const PAGE_H = 297;
const LEFT = 13;
const RIGHT = 197;
const WIDTH = RIGHT - LEFT;
const BOTTOM = 28;
const PAGE_TOP = 30;

const COLS = [
    { key: 'sl', label: 'SL', width: 12 },
    { key: 'category', label: 'Category / Subcategory', width: 40 },
    { key: 'item', label: 'Item / Description', width: 50 },
    { key: 'brand', label: 'Brand / Model', width: 32 },
    { key: 'qty', label: 'Qty', width: 14, align: 'right' },
    { key: 'price', label: 'Price', width: 18, align: 'right' },
    { key: 'amount', label: 'Amount', width: 18, align: 'right' },
];

function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function dash(value) {
    return clean(value) || '—';
}

function money(value) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileToken(value) {
    const token = clean(value).replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return token || 'Draft';
}

function lineAmount(line) {
    const quantity = Number(line.quantity);
    const price = Number(line.unitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(price)) return 0;
    return Math.round(quantity * price * 100) / 100;
}

function quantityLabel(value) {
    const text = clean(value);
    if (!text) return '0';
    const number = Number(text);
    if (!Number.isFinite(number)) return text;
    return String(number);
}

function buildDocument(source) {
    const lines = (Array.isArray(source.lines) ? source.lines : []).map((line, index) => ({
        sl: String(index + 1).padStart(2, '0'),
        category: clean(line.category),
        subcategory: clean(line.subcategory),
        itemName: clean(line.itemName || line.description),
        description: clean(line.description),
        brand: clean(line.brand),
        model: clean(line.model),
        quantity: quantityLabel(line.quantity),
        unitPrice: Number(line.unitPrice) || 0,
        amount: lineAmount(line),
    }));
    const totalAmount = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
    const sourceLabel = clean(source.purchaseSource).toLowerCase() === 'manual' ? 'Manual' : 'Vendor';
    return {
        vendorName: sourceLabel === 'Manual' ? '—' : dash(source.vendorName),
        purchaseSource: sourceLabel,
        purchaseDate: formatDate(source.purchaseDate) || '—',
        billNo: dash(source.billNo),
        lpoNo: dash(source.lpoNo),
        itemCount: String(lines.length),
        note: dash(source.note),
        attachmentName: dash(source.attachmentName),
        lines,
        totalAmount,
        fileNo: fileToken(source.billNo || 'Draft'),
    };
}

function wrapped(pdf, text, width, size, style) {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    return pdf.splitTextToSize(text || '—', width);
}

function paintLines(pdf, lines, x, y, size, style, color, maxLines) {
    const shown = lines.slice(0, maxLines);
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    shown.forEach((line, index) => {
        pdf.text(line, x, y + index * (size * 0.42));
    });
    return shown.length * (size * 0.42);
}

function drawSectionTitle(pdf, y, title, aside) {
    pdf.setFillColor(...TEAL);
    pdf.roundedRect(LEFT, y, 1.6, 4.4, 0.5, 0.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...NAVY);
    pdf.text(title, LEFT + 4.2, y + 3.6);
    if (aside) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...MUTED);
        pdf.text(aside, RIGHT, y + 3.4, { align: 'right' });
    }
    return y + 8;
}

function drawHeader(pdf) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...TEAL);
    pdf.text('VEGA DIGITAL / ERP RECORD', RIGHT, 26, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...NAVY);
    pdf.text('PURCHASE BILL', LEFT, 38);

    const badge = 'BILL / PRINT';
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const badgeW = pdf.getTextWidth(badge) + 8;
    const badgeX = RIGHT - badgeW;
    pdf.setFillColor(...MINT);
    pdf.roundedRect(badgeX, 32.2, badgeW, 7, 2, 2, 'F');
    pdf.setTextColor(...TEAL);
    pdf.text(badge, badgeX + badgeW / 2, 36.8, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text('Supplier bill / invoice details and purchased items', LEFT, 45);

    pdf.setDrawColor(...TEAL);
    pdf.setLineWidth(0.45);
    pdf.line(LEFT, 48.2, RIGHT, 48.2);
    return 54;
}

function valueBlock(pdf, label, value, width) {
    const lines = wrapped(pdf, dash(value), width, 10.5, 'bold').slice(0, 2);
    return { label, lines, height: 4.2 + lines.length * 4.5 };
}

function drawMeta(pdf, y, doc) {
    const colW = (WIDTH - 10) / 3;
    const top = [
        valueBlock(pdf, 'VENDOR NAME', doc.vendorName, colW - 4),
        valueBlock(pdf, 'PURCHASE SOURCE', doc.purchaseSource, colW - 4),
        valueBlock(pdf, 'PURCHASE DATE', doc.purchaseDate, colW - 4),
    ];
    const bottom = [
        valueBlock(pdf, 'BILL NUMBER', doc.billNo, colW - 4),
        valueBlock(pdf, 'LPO NUMBER', doc.lpoNo, colW - 4),
        valueBlock(pdf, 'ITEM LINES', doc.itemCount, colW - 4),
    ];
    const topH = Math.max(...top.map((field) => field.height));
    const bottomH = Math.max(...bottom.map((field) => field.height));
    const height = 7 + topH + 5 + bottomH + 3;
    pdf.setFillColor(...PANEL);
    pdf.roundedRect(LEFT, y, WIDTH, height, 2.2, 2.2, 'F');
    const drawField = (field, x, fieldY) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...MUTED);
        pdf.text(field.label, x, fieldY);
        paintLines(pdf, field.lines, x, fieldY + 5, 10.5, 'bold', INK, 2);
    };
    top.forEach((field, index) => drawField(field, LEFT + 5 + index * colW, y + 6));
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.2);
    pdf.line(LEFT + 5, y + 6 + topH + 1.5, RIGHT - 5, y + 6 + topH + 1.5);
    bottom.forEach((field, index) => drawField(field, LEFT + 5 + index * colW, y + 6 + topH + 6));
    return y + height + 6;
}

function columnX(index) {
    let x = LEFT;
    for (let i = 0; i < index; i += 1) x += COLS[i].width;
    return x;
}

function drawTableHeader(pdf, y) {
    const height = 8;
    pdf.setFillColor(...NAVY);
    pdf.roundedRect(LEFT, y, WIDTH, height, 1.6, 1.6, 'F');
    pdf.rect(LEFT, y + height - 1.6, WIDTH, 1.6, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...WHITE);
    COLS.forEach((column, index) => {
        const x = columnX(index);
        const labelX = column.align === 'right' ? x + column.width - 1.5 : x + 1.5;
        pdf.text(column.label, labelX, y + 5.1, { align: column.align === 'right' ? 'right' : 'left' });
    });
    return y + height;
}

function measureRow(pdf, line) {
    const categoryW = COLS[1].width - 3;
    const itemW = COLS[2].width - 3;
    const brandW = COLS[3].width - 3;
    const category = wrapped(pdf, dash(line.category), categoryW, 8, 'bold').slice(0, 2);
    const subcategory = wrapped(pdf, line.subcategory || '—', categoryW, 7.5, 'normal').slice(0, 2);
    const title = wrapped(pdf, dash(line.itemName), itemW, 8, 'bold').slice(0, 2);
    const extra = line.description && line.description !== line.itemName
        ? wrapped(pdf, line.description, itemW, 7.5, 'normal').slice(0, 2)
        : [];
    const brand = wrapped(pdf, dash(line.brand), brandW, 8, 'bold').slice(0, 2);
    const model = wrapped(pdf, line.model || '—', brandW, 7.5, 'normal').slice(0, 1);
    const leftLines = category.length + subcategory.length;
    const midLines = title.length + extra.length;
    const rightLines = brand.length + model.length;
    const height = Math.max(14, 5 + Math.max(leftLines, midLines, rightLines) * 3.6);
    return { category, subcategory, title, extra, brand, model, height };
}

function drawRow(pdf, y, line, measured, tinted) {
    if (tinted) {
        pdf.setFillColor(...ZEBRA);
        pdf.rect(LEFT, y, WIDTH, measured.height, 'F');
    }
    const mid = y + measured.height / 2 + 1;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...INK);
    pdf.text(line.sl, LEFT + 1.5, mid);

    let textY = y + 4.6;
    paintLines(pdf, measured.category, columnX(1) + 1.5, textY, 8, 'bold', INK, 2);
    textY += measured.category.length * 3.5;
    paintLines(pdf, measured.subcategory, columnX(1) + 1.5, textY, 7.5, 'normal', MUTED, 2);

    textY = y + 4.6;
    paintLines(pdf, measured.title, columnX(2) + 1.5, textY, 8, 'bold', INK, 2);
    textY += measured.title.length * 3.5;
    if (measured.extra.length) paintLines(pdf, measured.extra, columnX(2) + 1.5, textY, 7.5, 'normal', MUTED, 2);

    textY = y + 4.6;
    paintLines(pdf, measured.brand, columnX(3) + 1.5, textY, 8, 'bold', INK, 2);
    textY += measured.brand.length * 3.5;
    paintLines(pdf, measured.model, columnX(3) + 1.5, textY, 7.5, 'normal', MUTED, 1);

    const figures = [
        { index: 4, text: line.quantity },
        { index: 5, text: money(line.unitPrice) },
        { index: 6, text: money(line.amount) },
    ];
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...INK);
    figures.forEach((figure) => {
        const column = COLS[figure.index];
        pdf.text(figure.text, columnX(figure.index) + column.width - 1.5, mid, { align: 'right' });
    });
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.15);
    pdf.line(LEFT, y + measured.height, RIGHT, y + measured.height);
}

function drawEmptyRow(pdf, y) {
    const height = 12;
    pdf.setFillColor(...ZEBRA);
    pdf.rect(LEFT, y, WIDTH, height, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text('No items on this bill.', LEFT + WIDTH / 2, y + 7, { align: 'center' });
    return height;
}

function drawTotal(pdf, y, doc) {
    const height = 16;
    pdf.setFillColor(...MINT);
    pdf.roundedRect(LEFT, y, WIDTH, height, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...NAVY);
    pdf.text('TOTAL BILL AMOUNT (AED)', RIGHT - 5, y + 6, { align: 'right' });
    pdf.setFontSize(14);
    pdf.setTextColor(...TEAL);
    pdf.text(money(doc.totalAmount), RIGHT - 5, y + 12.2, { align: 'right' });
    return y + height + 6;
}

function drawNotes(pdf, y, doc) {
    const noteLines = wrapped(pdf, doc.note, WIDTH - 16, 9, 'normal').slice(0, 6);
    const fileLines = wrapped(pdf, doc.attachmentName, WIDTH - 16, 10, 'bold').slice(0, 2);
    const noteBlock = 4.6 + noteLines.length * 4;
    const fileBlock = 4.6 + fileLines.length * 4.4;
    const height = 8 + noteBlock + 6 + fileBlock + 4;
    pdf.setFillColor(...PANEL);
    pdf.roundedRect(LEFT, y, WIDTH, height, 2.2, 2.2, 'F');
    let cursor = y + 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text('NOTES', LEFT + 5, cursor);
    paintLines(pdf, noteLines, LEFT + 5, cursor + 4.6, 9, 'normal', INK, 6);
    cursor += noteBlock + 3;
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.2);
    pdf.line(LEFT + 5, cursor, RIGHT - 5, cursor);
    cursor += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text('BILL ATTACHMENT', LEFT + 5, cursor);
    paintLines(pdf, fileLines, LEFT + 5, cursor + 4.6, 10, 'bold', INK, 2);
    return y + height + 8;
}

function drawSignatures(pdf, y) {
    const gap = 12;
    const colW = (WIDTH - gap) / 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text('RECORDED BY', LEFT, y);
    pdf.text('VERIFIED BY', LEFT + colW + gap, y);
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.35);
    pdf.line(LEFT, y + 12, LEFT + colW, y + 12);
    pdf.line(LEFT + colW + gap, y + 12, RIGHT, y + 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text('VEGA / PURCHASE / BILL', RIGHT, y + 20, { align: 'right' });
}

function nextPage(state) {
    state.pdf.addPage();
    paintVegaLetterhead(state.pdf, state.letterhead);
    state.y = PAGE_TOP;
}

function ensure(state, height) {
    if (state.y + height <= PAGE_H - BOTTOM) return false;
    nextPage(state);
    return true;
}

export async function downloadPurchaseBillPdf(source, options = {}) {
    const letterhead = await loadVegaLetterhead();
    const doc = buildDocument(source || {});
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    paintVegaLetterhead(pdf, letterhead);
    const state = { pdf, letterhead, y: drawHeader(pdf) };
    state.y = drawMeta(pdf, state.y, doc);
    state.y = drawSectionTitle(pdf, state.y, 'PURCHASED ITEMS', 'One printed row per bill item');

    const strokeTable = (top, bottom) => {
        if (bottom - top < 2) return;
        pdf.setDrawColor(...HAIRLINE);
        pdf.setLineWidth(0.3);
        pdf.rect(LEFT, top, WIDTH, bottom - top, 'S');
    };
    const openTable = (continued) => {
        if (continued) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(...NAVY);
            pdf.text('PURCHASE BILL', LEFT, state.y + 2);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(...MUTED);
            pdf.text(doc.billNo, RIGHT, state.y + 2, { align: 'right' });
            state.y += 6;
        }
        const top = state.y;
        state.y = drawTableHeader(pdf, state.y);
        return top;
    };
    let tableTop = openTable(false);
    if (doc.lines.length === 0) {
        if (state.y + 14 > PAGE_H - BOTTOM) {
            strokeTable(tableTop, state.y);
            nextPage(state);
            tableTop = openTable(true);
        }
        state.y += drawEmptyRow(pdf, state.y);
        strokeTable(tableTop, state.y);
    } else {
        doc.lines.forEach((line, index) => {
            const measured = measureRow(pdf, line);
            if (state.y + measured.height > PAGE_H - BOTTOM) {
                strokeTable(tableTop, state.y);
                nextPage(state);
                tableTop = openTable(true);
            }
            drawRow(pdf, state.y, line, measured, index % 2 === 0);
            state.y += measured.height;
        });
        strokeTable(tableTop, state.y);
    }

    state.y += 5;
    if (ensure(state, 16)) state.y += 2;
    state.y = drawTotal(pdf, state.y, doc);
    const noteLines = wrapped(pdf, doc.note, WIDTH - 16, 9, 'normal').slice(0, 6);
    const noteHeight = 8 + (4.6 + noteLines.length * 4) + 6 + (4.6 + 4.4) + 4 + 8;
    if (ensure(state, noteHeight + 24)) state.y += 2;
    state.y = drawNotes(pdf, state.y, doc);
    if (ensure(state, 24)) state.y += 2;
    drawSignatures(pdf, state.y);

    const pages = pdf.getNumberOfPages();
    if (pages > 1) {
        for (let page = 1; page <= pages; page += 1) {
            pdf.setPage(page);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(...MUTED);
            pdf.text(`${page} / ${pages}`, RIGHT, PAGE_H - 26, { align: 'right' });
        }
    }
    if (options.output === 'arraybuffer') return pdf.output('arraybuffer');
    pdf.save(`Purchase-Bill-${doc.fileNo}.pdf`);
    return true;
}
