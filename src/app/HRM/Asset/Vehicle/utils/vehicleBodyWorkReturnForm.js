import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { resolveShopServiceReturnDate } from './vehicleShopWorkStatus';

export function buildBodyWorkReturnFormState(service, asset) {
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
        returnOtherDocName: remark.returnOtherDocName || base.returnOtherDocName || '',
        returnOtherDocBase64: '',
        returnOtherDocMime: '',
        existingReturnOtherDocUrl: service?.invoice || remark.returnOtherDocUrl || base.existingReturnOtherDocUrl || '',
        returnDate: resolveShopServiceReturnDate(service, asset),
        handOverDate: remark.handOverDate || base.handOverDate || '',
        returnDescription: remark.returnDescription || base.returnDescription || '',
        existingNewConditionImages: Array.isArray(remark.newConditionImages)
            ? remark.newConditionImages
            : base.existingNewConditionImages || [],
        newConditionImages: [],
    };
}

export function validateBodyWorkReturnForm(formData) {
    const errors = {};
    const hasGarageReport =
        !!(formData.garageReportBase64 && formData.garageReportName) || !!formData.existingGarageReportUrl;
    const hasGarageInvoice =
        !!(formData.garageInvoiceBase64 && formData.garageInvoiceName) || !!formData.existingGarageInvoiceUrl;
    const hasOtherDoc =
        !!(formData.returnOtherDocBase64 && formData.returnOtherDocName) || !!formData.existingReturnOtherDocUrl;

    if (!hasGarageReport) errors.garageReport = 'Garage report is required';
    if (!hasGarageInvoice) errors.garageInvoice = 'Garage invoice is required';
    if (!hasOtherDoc) errors.returnOtherDoc = 'Other document is required';
    if (!String(formData.returnDate || '').trim()) errors.returnDate = 'Return date is required';
    if (!String(formData.handOverDate || '').trim()) errors.handOverDate = 'Hand over date is required';

    const existingPhotos = Array.isArray(formData.existingNewConditionImages)
        ? formData.existingNewConditionImages.length
        : 0;
    const newPhotos = Array.isArray(formData.newConditionImages) ? formData.newConditionImages.length : 0;
    if (existingPhotos + newPhotos === 0) {
        errors.newConditionImages = 'New condition photos are required';
    }

    if (!String(formData.returnDescription || '').trim()) {
        errors.returnDescription = 'Description is required';
    }

    return errors;
}

export function isBodyWorkReturnFormComplete(formData) {
    return Object.keys(validateBodyWorkReturnForm(formData)).length === 0;
}

function buildUploadPayload(name, base64, mime) {
    if (!base64 || !name) return null;
    return {
        name,
        data: base64,
        mime: mime || 'application/pdf',
    };
}

export function buildBodyWorkReturnUpdateBody(formData) {
    const remark = {
        returnDate: String(formData.returnDate || '').trim(),
        handOverDate: String(formData.handOverDate || '').trim(),
        returnDescription: String(formData.returnDescription || '').trim(),
        garageReportName: formData.garageReportName || undefined,
        garageInvoiceName: formData.garageInvoiceName || undefined,
        returnOtherDocName: formData.returnOtherDocName || undefined,
    };

    const body = {
        serviceType: 'Body Work',
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
    const returnOtherDoc = buildUploadPayload(
        formData.returnOtherDocName,
        formData.returnOtherDocBase64,
        formData.returnOtherDocMime,
    );

    if (completionReport) body.completionReport = completionReport;
    if (shopInvoice) body.shopInvoice = shopInvoice;
    if (returnOtherDoc) body.returnOtherDoc = returnOtherDoc;

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

export function buildBodyWorkReturnGoLivePayload(formData) {
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
