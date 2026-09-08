import { jsPDF } from 'jspdf';

function printedAtLabel() {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date());
}

function resolveWidths(pageWidth, margin, count, weights) {
    const usable = pageWidth - margin * 2;
    const n = Math.max(count, 1);
    if (!Array.isArray(weights) || weights.length !== n) {
        return Array.from({ length: n }, () => usable / n);
    }
    const total = weights.reduce((sum, w) => sum + (Number(w) || 0), 0) || n;
    return weights.map((w) => (usable * (Number(w) || 0)) / total);
}

export function downloadAccessFuelListedVehiclesPdf({
    title = 'Access Fuel',
    subtitle = '',
    headers = [],
    rows = [],
    fileName = 'access-fuel.pdf',
    columnWeights,
    columnAlign,
} = {}) {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const colCount = Math.max(headers.length, 1);
    const colW = resolveWidths(pageW, margin, colCount, columnWeights);
    const aligns = Array.isArray(columnAlign) ? columnAlign : [];
    const listed = Array.isArray(rows) ? rows : [];
    const lineH = 4;
    let y = 16;

    const drawCell = (text, colIndex, x, baseline) => {
        const width = colW[colIndex] - 2;
        const lines = pdf.splitTextToSize(String(text ?? '—'), width);
        const align = aligns[colIndex] === 'right' ? 'right' : 'left';
        const tx = align === 'right' ? x + colW[colIndex] - 1 : x + 1;
        pdf.text(lines, tx, baseline, { align, maxWidth: width });
        return lines.length;
    };

    const drawHeader = () => {
        pdf.setFillColor(15, 118, 110);
        pdf.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        let x = margin;
        headers.forEach((label, i) => {
            drawCell(label, i, x, y + 1);
            x += colW[i];
        });
        y += 8;
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'normal');
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(15, 118, 110);
    pdf.text(String(title), margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    if (subtitle) {
        pdf.text(String(subtitle), margin, y);
        y += 5;
    }
    pdf.text(
        `${listed.length} vehicle${listed.length === 1 ? '' : 's'} listed  ·  Printed ${printedAtLabel()}`,
        margin,
        y,
    );
    y += 8;

    drawHeader();
    pdf.setFontSize(8);

    listed.forEach((row, index) => {
        const cells = Array.isArray(row) ? row : [];
        const heights = cells.map((cell, i) =>
            pdf.splitTextToSize(String(cell ?? '—'), colW[i] - 2).length,
        );
        const rowH = Math.max(6, Math.max(1, ...heights) * lineH + 2);
        if (y + rowH > pageH - 14) {
            pdf.addPage();
            y = 16;
            drawHeader();
            pdf.setFontSize(8);
        }
        if (index % 2 === 0) {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, y - 3.5, pageW - margin * 2, rowH, 'F');
        }
        let x = margin;
        cells.forEach((cell, i) => {
            drawCell(cell, i, x, y);
            x += colW[i];
        });
        y += rowH;
    });

    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 6, { align: 'right' });
    }

    pdf.save(fileName);
}
