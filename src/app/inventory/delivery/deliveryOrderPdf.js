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
const WHITE = [255, 255, 255];

const PAGE_H = 297;
const LEFT = 13;
const RIGHT = 197;
const WIDTH = RIGHT - LEFT;
const BOTTOM = 28;
const PAGE_TOP = 30;

const COLS = [
    { key: 'sl', label: 'SL', width: 12 },
    { key: 'item', label: 'Item / Category', width: 60 },
    { key: 'brand', label: 'Brand / Model', width: 36 },
    { key: 'stock', label: 'In Stock', width: 20, align: 'right' },
    { key: 'qty', label: 'Qty', width: 16, align: 'right' },
    { key: 'price', label: 'Price', width: 20, align: 'right' },
    { key: 'amount', label: 'Amount', width: 20, align: 'right' },
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

function formatDoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCreated(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileToken(value) {
    const token = clean(value).replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return token || 'Draft';
}

function unitPriceOf(line, inventoryItems) {
    if (line?.unitPrice != null && line.unitPrice !== '') {
        const saved = Number(line.unitPrice);
        if (Number.isFinite(saved)) return saved;
    }
    const item = inventoryItems.find((row) => row._id === line.inventoryItemId);
    const price = Number(item?.lastStockPrice);
    return Number.isFinite(price) ? price : 0;
}

function stockOf(line, inventoryItems) {
    const item = inventoryItems.find((row) => row._id === line.inventoryItemId);
    if (item) return Number(item.availableQuantity) || 0;
    if (line?.stockOnHand != null && line.stockOnHand !== '') {
        const stock = Number(line.stockOnHand);
        if (Number.isFinite(stock)) return stock;
    }
    return null;
}

function categoryLabel(line) {
    const parts = [clean(line.categoryName), clean(line.subcategoryName)].filter(Boolean);
    return parts.join(' / ');
}

function itemDetail(line) {
    const category = categoryLabel(line);
    const name = clean(line.itemName);
    const description = clean(line.description);
    const extra = description && description !== name ? description : '';
    return [category, extra].filter(Boolean).join(' · ');
}

function buildDocument({ form, customerName, workOrderNo, deliveryNo, createdAt, inventoryItems }) {
    const scheduled = form.deliveryType === 'Project';
    const items = Array.isArray(inventoryItems) ? inventoryItems : [];
    const lines = (form.lines || []).map((line, index) => {
        const unitPrice = unitPriceOf(line, items);
        const quantity = Number(line.quantity) || 0;
        const stock = stockOf(line, items);
        return {
            sl: String(index + 1).padStart(2, '0'),
            itemName: clean(line.itemName || line.description),
            category: itemDetail(line),
            brand: clean(line.brandName),
            model: clean(line.modelNumber),
            stock: stock == null ? '—' : String(stock),
            quantity: String(quantity),
            unit: clean(line.unit),
            unitPrice,
            amount: Math.round(quantity * unitPrice * 100) / 100,
        };
    });
    const totalQty = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    const totalAmount = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
    return {
        deliveryType: dash(form.deliveryType),
        deliveryNo: dash(deliveryNo || 'Auto'),
        doDate: formatDoDate(form.doDate) || formatCreated(createdAt) || '—',
        projectName: scheduled ? dash(form.projectName) : '—',
        workOrderNo: scheduled ? dash(workOrderNo) : '—',
        customerName: dash(customerName),
        contactPersonName: dash(form.contactPersonName),
        deliveryAddress: dash(form.deliveryAddress),
        contactNumber: dash(form.contactNumber),
        note: dash(form.note),
        lines,
        totalQty,
        totalAmount,
        fileNo: fileToken(deliveryNo || 'Draft'),
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
    pdf.text('DELIVERY ORDER', LEFT, 38);

    const badge = 'DO / PRINT';
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
    pdf.text('Project or manual delivery - customer and issued stock items', LEFT, 45);

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
    const gap = 4;
    const colW = (WIDTH - 10) / 3;
    const projectW = (WIDTH - 10) * 0.56;
    const orderW = (WIDTH - 10) - projectW - gap;
    const top = [
        valueBlock(pdf, 'DELIVERY TYPE', doc.deliveryType, colW),
        valueBlock(pdf, 'DELIVERY ORDER NO', doc.deliveryNo, colW),
        valueBlock(pdf, 'DO DATE', doc.doDate, colW),
    ];
    const bottom = [
        valueBlock(pdf, 'PROJECT NAME (IF PROJECT)', doc.projectName, projectW),
        valueBlock(pdf, 'WORK ORDER NO (IF PROJECT)', doc.workOrderNo, orderW),
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
    drawField(bottom[0], LEFT + 5, y + 6 + topH + 6);
    drawField(bottom[1], LEFT + 5 + projectW + gap, y + 6 + topH + 6);
    return y + height + 6;
}

function drawLabeledLines(pdf, x, y, label, lines, size, style, color) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(label, x, y);
    return paintLines(pdf, lines, x, y + 4.6, size, style, color, lines.length);
}

function drawCustomer(pdf, y, doc) {
    const colW = (WIDTH - 18) / 2;
    const rightX = LEFT + 9 + colW;
    const nameLeft = wrapped(pdf, doc.customerName, colW, 10, 'bold').slice(0, 2);
    const nameRight = wrapped(pdf, doc.contactPersonName, colW, 10, 'bold').slice(0, 2);
    const addressLines = wrapped(pdf, doc.deliveryAddress, colW, 10, 'bold').slice(0, 4);
    const phoneLines = wrapped(pdf, doc.contactNumber, colW, 10, 'bold').slice(0, 2);
    const noteLines = wrapped(pdf, doc.note, WIDTH - 34, 9, 'normal').slice(0, 6);
    const nameBlock = 4.6 + Math.max(nameLeft.length, nameRight.length) * 4.4;
    const addressBlock = 4.6 + Math.max(addressLines.length, phoneLines.length) * 4.4;
    const noteBlock = Math.max(4, noteLines.length * 3.9);
    const height = 8 + nameBlock + 6 + addressBlock + 6 + noteBlock + 4;
    pdf.setFillColor(...PANEL);
    pdf.roundedRect(LEFT, y, WIDTH, height, 2.2, 2.2, 'F');

    let cursor = y + 6;
    drawLabeledLines(pdf, LEFT + 5, cursor, 'CUSTOMER NAME', nameLeft, 10, 'bold', INK);
    drawLabeledLines(pdf, rightX, cursor, 'CONTACT PERSON', nameRight, 10, 'bold', INK);
    cursor += nameBlock + 3;
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.2);
    pdf.line(LEFT + 5, cursor, RIGHT - 5, cursor);
    cursor += 5;
    drawLabeledLines(pdf, LEFT + 5, cursor, 'DELIVERY ADDRESS', addressLines, 10, 'bold', INK);
    drawLabeledLines(pdf, rightX, cursor, 'CONTACT NUMBER', phoneLines, 10, 'bold', INK);
    cursor += addressBlock + 3;
    pdf.line(LEFT + 5, cursor, RIGHT - 5, cursor);
    cursor += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text('NOTE', LEFT + 5, cursor);
    paintLines(pdf, noteLines, LEFT + 22, cursor, 9, 'normal', INK, 6);
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
    pdf.setFontSize(7.5);
    pdf.setTextColor(...WHITE);
    COLS.forEach((column, index) => {
        const x = columnX(index);
        const labelX = column.align === 'right' ? x + column.width - 2 : x + 2;
        pdf.text(column.label, labelX, y + 5.2, { align: column.align === 'right' ? 'right' : 'left' });
    });
    return y + height;
}

function measureRow(pdf, line) {
    const itemW = COLS[1].width - 4;
    const brandW = COLS[2].width - 4;
    const title = wrapped(pdf, dash(line.itemName), itemW, 8, 'bold').slice(0, 2);
    const category = wrapped(pdf, line.category || '—', itemW, 7.5, 'normal').slice(0, 2);
    const brand = wrapped(pdf, dash(line.brand), brandW, 8, 'bold').slice(0, 2);
    const model = wrapped(pdf, line.model || '—', brandW, 7.5, 'normal').slice(0, 1);
    const textLines = title.length + category.length;
    const brandLines = brand.length + model.length;
    const height = Math.max(14, 5 + Math.max(textLines, brandLines) * 3.6);
    return { title, category, brand, model, height };
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
    pdf.text(line.sl, LEFT + 2, mid);

    let textY = y + 4.6;
    paintLines(pdf, measured.title, columnX(1) + 2, textY, 8, 'bold', INK, 2);
    textY += measured.title.length * 3.5;
    paintLines(pdf, measured.category, columnX(1) + 2, textY, 7.5, 'normal', MUTED, 2);

    textY = y + 4.6;
    paintLines(pdf, measured.brand, columnX(2) + 2, textY, 8, 'bold', INK, 2);
    textY += measured.brand.length * 3.5;
    paintLines(pdf, measured.model, columnX(2) + 2, textY, 7.5, 'normal', MUTED, 1);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const withUnit = line.unit ? `${line.quantity} ${line.unit}` : line.quantity;
    const qty = pdf.getTextWidth(withUnit) <= COLS[4].width - 3 ? withUnit : line.quantity;
    const figures = [
        { index: 3, text: line.stock },
        { index: 4, text: qty },
        { index: 5, text: money(line.unitPrice) },
        { index: 6, text: money(line.amount) },
    ];
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...INK);
    figures.forEach((figure) => {
        const column = COLS[figure.index];
        const x = columnX(figure.index) + column.width - 2;
        pdf.text(figure.text, x, mid, { align: 'right' });
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
    pdf.text('No items on this delivery.', LEFT + WIDTH / 2, y + 7, { align: 'center' });
    return height;
}

function drawTotals(pdf, y, doc) {
    const height = 16;
    pdf.setFillColor(...MINT);
    pdf.roundedRect(LEFT, y, WIDTH, height, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...NAVY);
    pdf.text('TOTAL QTY', LEFT + 5, y + 6);
    pdf.setFontSize(12);
    pdf.setTextColor(...TEAL);
    pdf.text(String(doc.totalQty), LEFT + 5, y + 12);
    pdf.setFontSize(9);
    pdf.setTextColor(...NAVY);
    pdf.text('TOTAL MATERIAL AMOUNT (AED)', RIGHT - 5, y + 6, { align: 'right' });
    pdf.setFontSize(14);
    pdf.setTextColor(...TEAL);
    pdf.text(money(doc.totalAmount), RIGHT - 5, y + 12.2, { align: 'right' });
    return y + height + 8;
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

export async function downloadDeliveryOrderPdf(source, options = {}) {
    const letterhead = await loadVegaLetterhead();
    const doc = buildDocument(source);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    paintVegaLetterhead(pdf, letterhead);
    const state = { pdf, letterhead, y: drawHeader(pdf) };
    state.y = drawMeta(pdf, state.y, doc);
    state.y = drawSectionTitle(pdf, state.y, 'DELIVERY & CUSTOMER DETAILS');
    state.y = drawCustomer(pdf, state.y, doc);
    state.y = drawSectionTitle(pdf, state.y, 'DELIVERED ITEMS', 'One printed row per added delivery item');

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
            pdf.text('DELIVERY ORDER', LEFT, state.y + 2);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(...MUTED);
            pdf.text(doc.deliveryNo, RIGHT, state.y + 2, { align: 'right' });
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
    if (ensure(state, 24)) {
        state.y += 2;
    }
    drawTotals(pdf, state.y, doc);

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
    if (options.output === 'blob') {
        const raw = pdf.output('blob');
        return raw.type === 'application/pdf' ? raw : new Blob([raw], { type: 'application/pdf' });
    }
    pdf.save(`Delivery-Order-${doc.fileNo}.pdf`);
    return true;
}
