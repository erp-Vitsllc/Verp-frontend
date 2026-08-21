import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

function quoteKeyLabel(key) {
    if (key === 'q1') return 'Quote 1';
    if (key === 'q2') return 'Quote 2';
    if (key === 'q3') return 'Quote 3';
    return 'Quote';
}

function asText(value) {
    return String(value || '').trim();
}

function resolveSelectedQuoteKey(remark = {}) {
    return (
        asText(remark.approvedQuotationChoice) ||
        asText(remark.approvedQuoteKey) ||
        asText(remark.tireQuoteReview?.approvedQuote) ||
        asText(remark.quoteReview?.approvedQuote)
    );
}

function collectQuoteSources(service, remark) {
    const byKey = new Map();
    const set = (key, patch) => {
        if (!['q1', 'q2', 'q3'].includes(key)) return;
        const prev = byKey.get(key) || { key, url: '', name: '' };
        byKey.set(key, {
            key,
            url: asText(patch.url) || prev.url,
            name: asText(patch.name) || prev.name,
        });
    };

    set('q1', { url: service?.attachment, name: remark.attachmentName });
    set('q2', { url: service?.quotation2, name: remark.quotation2Name });
    set('q3', { url: service?.quotation3, name: remark.quotation3Name });

    const garageQuotes = Array.isArray(remark.accidentGarageQuotes) ? remark.accidentGarageQuotes : [];
    garageQuotes.forEach((row) => {
        const key = asText(row?.key).toLowerCase();
        set(key, { url: row?.url, name: row?.name });
    });

    const selectedKey = resolveSelectedQuoteKey(remark);
    if (selectedKey) {
        set(selectedKey, { url: remark.approvedQuoteUrl, name: remark.approvedQuoteName });
    }

    return [...byKey.values()].filter((row) => row.url || row.name);
}

/**
 * Documents attached to a vehicle service record (quotes, garage invoice, reports, etc.).
 */
export function buildVehicleServiceAttachmentRows(service) {
    if (!service) return [];
    const remark = parseVehicleServiceRemark(service) || {};
    const rows = [];
    const seen = new Set();

    const add = ({ id, label, url, name }) => {
        const href = asText(url);
        const fileName = asText(name);
        if (!href && !fileName) return;
        const dedupe = href || `${label}:${fileName}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        rows.push({
            id: id || dedupe,
            label,
            url: href,
            name: fileName,
        });
    };

    const selectedKey = resolveSelectedQuoteKey(remark);
    collectQuoteSources(service, remark).forEach((quote) => {
        const isSelected = selectedKey && quote.key === selectedKey;
        add({
            id: `quote-${quote.key}`,
            label: isSelected ? 'Service quote selected' : quoteKeyLabel(quote.key),
            url: quote.url,
            name: quote.name || (isSelected ? `${quoteKeyLabel(quote.key)}.pdf` : ''),
        });
    });

    add({
        id: 'garage-invoice',
        label: 'Garage invoice',
        url:
            service?.shopInvoice ||
            remark.garageInvoiceUrl ||
            remark.garageAttachmentUrl ||
            remark.garageBillAttachmentUrl,
        name:
            remark.garageInvoiceName ||
            remark.shopInvoiceName ||
            remark.garageAttachmentName,
    });

    add({
        id: 'service-report',
        label: 'Service report',
        url: service?.serviceCompletionReport || remark.garageReportUrl,
        name: remark.garageReportName || remark.serviceReportName,
    });

    add({
        id: 'other-document',
        label: 'Other document',
        url: service?.invoice || remark.returnOtherDocUrl,
        name: remark.returnOtherDocName,
    });

    const payGarage = Array.isArray(remark.paymentToGarageAttachments)
        ? remark.paymentToGarageAttachments
        : [];
    payGarage.forEach((row, index) => {
        add({
            id: `payment-to-garage-${index}`,
            label: payGarage.length > 1 ? `Payment to garage ${index + 1}` : 'Payment to garage',
            url: row?.url || row?.publicId,
            name: row?.name,
        });
    });

    const otherDocs = Array.isArray(remark.returnOtherDocs) ? remark.returnOtherDocs : [];
    otherDocs.forEach((row, index) => {
        add({
            id: `other-doc-${row?.id || index}`,
            label: asText(row?.docType || row?.type) || `Other document ${index + 1}`,
            url: row?.url,
            name: row?.name,
        });
    });

    const zohoBills = Array.isArray(remark.zohoBills) ? remark.zohoBills : [];
    zohoBills.forEach((row, index) => {
        add({
            id: `zoho-bill-${row?.id || index}`,
            label: zohoBills.length > 1 ? `Garage invoice ${index + 1}` : 'Garage invoice',
            url: row?.garageAttachmentUrl || row?.garageBillAttachmentUrl,
            name: row?.garageAttachmentName,
        });
    });

    return rows;
}
