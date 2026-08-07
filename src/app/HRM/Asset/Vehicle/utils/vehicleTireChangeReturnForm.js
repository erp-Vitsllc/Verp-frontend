import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import {
    normalizeShopServiceDateValue,
    resolveShopServiceEndDate,
    resolveShopServiceReturnDate,
} from './vehicleShopWorkStatus';

function newOtherDocRow() {
    return {
        id: `other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        docType: '',
        name: '',
        base64: '',
        mime: '',
        existingUrl: '',
    };
}

export function createTireChangeOtherDocRow() {
    return newOtherDocRow();
}

function normalizeReturnOtherDocs(remark = {}, service = null, base = {}) {
    if (Array.isArray(remark.returnOtherDocs) && remark.returnOtherDocs.length) {
        return remark.returnOtherDocs.map((row, index) => ({
            id: String(row?.id || `existing-${index}`),
            docType: String(row?.docType || row?.type || row?.fileName || '').trim(),
            name: String(row?.name || '').trim(),
            base64: '',
            mime: '',
            existingUrl: String(row?.url || '').trim(),
        }));
    }

    const legacyName = remark.returnOtherDocName || base.returnOtherDocName || '';
    const legacyUrl = service?.invoice || remark.returnOtherDocUrl || base.existingReturnOtherDocUrl || '';
    if (legacyName || legacyUrl) {
        return [
            {
                id: 'legacy-other-doc',
                docType: String(remark.returnOtherDocType || legacyName || 'Other').trim() || 'Other',
                name: String(legacyName || '').trim(),
                base64: '',
                mime: '',
                existingUrl: String(legacyUrl || '').trim(),
            },
        ];
    }
    return [];
}

export function buildTireChangeReturnFormState(service, asset) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = parseVehicleServiceRemark(service) || {};

    return {
        garageReportName: remark.garageReportName || remark.serviceReportName || base.garageReportName || '',
        garageReportBase64: '',
        garageReportMime: '',
        existingGarageReportUrl:
            service?.serviceCompletionReport || remark.garageReportUrl || base.existingGarageReportUrl || '',
        garageInvoiceName: remark.garageInvoiceName || remark.shopInvoiceName || base.garageInvoiceName || '',
        garageInvoiceBase64: '',
        garageInvoiceMime: '',
        existingGarageInvoiceUrl: service?.shopInvoice || remark.garageInvoiceUrl || base.existingGarageInvoiceUrl || '',
        returnOtherDocs: normalizeReturnOtherDocs(remark, service, base),
        returnDate: resolveShopServiceReturnDate(service, asset),
        handOverDate: remark.handOverDate || base.handOverDate || '',
        serviceEndDate: resolveShopServiceEndDate(service, asset),
        returnDescription: remark.returnDescription || base.returnDescription || '',
        existingNewConditionImages: Array.isArray(remark.newConditionImages)
            ? remark.newConditionImages
            : base.existingNewConditionImages || [],
        newConditionImages: [],
    };
}

export function validateTireChangeReturnForm(formData) {
    const errors = {};

    if (!String(formData.returnDate || '').trim()) errors.returnDate = 'Return date is required';
    if (!String(formData.handOverDate || '').trim()) errors.handOverDate = 'Hand over date is required';

    const endKey = normalizeShopServiceDateValue(formData.serviceEndDate);
    const returnKey = normalizeShopServiceDateValue(formData.returnDate);
    const handOverKey = normalizeShopServiceDateValue(formData.handOverDate);
    if (endKey && returnKey && returnKey < endKey) {
        errors.returnDate = 'Return date must be on or after the service end date';
    }
    if (endKey && handOverKey && handOverKey < endKey) {
        errors.handOverDate = 'Hand over date must be on or after the service end date';
    }

    const otherDocs = Array.isArray(formData.returnOtherDocs) ? formData.returnOtherDocs : [];
    otherDocs.forEach((row, index) => {
        const hasName = String(row?.docType || '').trim();
        const hasFile = !!(row?.base64 && row?.name) || !!String(row?.existingUrl || '').trim();
        if (!hasName && !hasFile) return;
        if (!hasName) {
            errors[`returnOtherDocs.${index}.docType`] = `Other document ${index + 1}: file name is required`;
        }
        if (!hasFile) {
            errors[`returnOtherDocs.${index}.file`] = `Other document ${index + 1}: attachment is required`;
        }
    });

    const existingPhotos = Array.isArray(formData.existingNewConditionImages)
        ? formData.existingNewConditionImages.length
        : 0;
    const newPhotos = Array.isArray(formData.newConditionImages) ? formData.newConditionImages.length : 0;
    if (existingPhotos + newPhotos === 0) {
        errors.newConditionImages = 'New condition photos are required';
    }

    // Garage report, garage invoice, and other documents are optional on Complete.

    return errors;
}

export function isTireChangeReturnFormComplete(formData) {
    return Object.keys(validateTireChangeReturnForm(formData)).length === 0;
}

function buildUploadPayload(name, base64, mime) {
    if (!base64 || !name) return null;
    return {
        name,
        data: base64,
        mime: mime || 'application/pdf',
    };
}

export function buildTireChangeReturnUpdateBody(formData) {
    const otherDocs = (Array.isArray(formData.returnOtherDocs) ? formData.returnOtherDocs : []).filter((row) => {
        const hasName = String(row?.docType || '').trim();
        const hasFile = !!(row?.base64 && row?.name) || !!String(row?.existingUrl || '').trim();
        return hasName || hasFile;
    });
    const firstOther = otherDocs[0] || null;

    const remark = {
        returnDate: String(formData.returnDate || '').trim(),
        handOverDate: String(formData.handOverDate || '').trim(),
        returnDescription: String(formData.returnDescription || '').trim(),
        garageReportName: formData.garageReportName || undefined,
        garageInvoiceName: formData.garageInvoiceName || undefined,
        returnOtherDocs: otherDocs.map((row) => ({
            id: row.id,
            docType: String(row.docType || '').trim(),
            name: String(row.name || '').trim() || undefined,
            url: String(row.existingUrl || '').trim() || undefined,
        })),
        returnOtherDocName: firstOther?.name || undefined,
        returnOtherDocType: firstOther?.docType || undefined,
        returnOtherDocUrl: firstOther?.existingUrl || undefined,
    };

    const body = {
        serviceType: 'Tire Change',
        remark: JSON.stringify(remark),
    };

    const completionReport = buildUploadPayload(
        formData.garageReportName,
        formData.garageReportBase64,
        formData.garageReportMime,
    );
    const shopInvoice = buildUploadPayload(
        formData.garageInvoiceName,
        formData.garageInvoiceBase64,
        formData.garageInvoiceMime,
    );

    if (completionReport) body.completionReport = completionReport;
    if (shopInvoice) body.shopInvoice = shopInvoice;

    const uploadOtherDocs = otherDocs
        .filter((row) => row?.base64 && row?.name)
        .map((row) => ({
            id: row.id,
            docType: String(row.docType || '').trim(),
            name: row.name,
            data: row.base64,
            mimeType: row.mime || 'application/pdf',
        }));
    if (uploadOtherDocs.length) {
        body.returnOtherDocs = uploadOtherDocs;
        body.returnOtherDoc = {
            name: uploadOtherDocs[0].name,
            data: uploadOtherDocs[0].data,
            mime: uploadOtherDocs[0].mimeType,
        };
    }

    const freshImages = (formData.newConditionImages || []).filter((img) => img?.data && img?.name);
    if (freshImages.length) {
        body.newConditionImages = freshImages.map((img) => ({
            name: img.name,
            data: img.data,
            mimeType: img.mimeType || 'image/jpeg',
        }));
    }

    return body;
}

export function buildTireChangeReturnGoLivePayload(formData) {
    const completionReport = buildUploadPayload(
        formData.garageReportName,
        formData.garageReportBase64,
        formData.garageReportMime,
    );
    const shopInvoice = buildUploadPayload(
        formData.garageInvoiceName,
        formData.garageInvoiceBase64,
        formData.garageInvoiceMime,
    );

    return {
        action: 'go_live',
        comment: String(formData.returnDescription || '').trim(),
        handOverDate: String(formData.handOverDate || '').trim() || undefined,
        returnDate: String(formData.returnDate || '').trim() || undefined,
        ...(completionReport ? { completionReport } : {}),
        ...(shopInvoice ? { shopInvoice } : {}),
    };
}
