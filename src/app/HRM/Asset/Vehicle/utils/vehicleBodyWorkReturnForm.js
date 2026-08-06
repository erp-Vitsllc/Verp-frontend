import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import {
    normalizeShopServiceDateValue,
    resolveShopServiceEndDate,
    resolveShopServiceReturnDate,
} from './vehicleShopWorkStatus';
import {
    buildNewConditionImagesPayload,
    validateNewConditionBodyPartMappings,
} from './vehicleServiceNewConditionPhotos';

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
        serviceEndDate: resolveShopServiceEndDate(service, asset),
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

    const endKey = normalizeShopServiceDateValue(formData.serviceEndDate);
    const returnKey = normalizeShopServiceDateValue(formData.returnDate);
    const handOverKey = normalizeShopServiceDateValue(formData.handOverDate);
    if (endKey && returnKey && returnKey < endKey) {
        errors.returnDate = 'Return date must be on or after the service end date';
    }
    if (endKey && handOverKey && handOverKey < endKey) {
        errors.handOverDate = 'Hand over date must be on or after the service end date';
    }

    const existingPhotos = Array.isArray(formData.existingNewConditionImages)
        ? formData.existingNewConditionImages.length
        : 0;
    const newPhotos = Array.isArray(formData.newConditionImages) ? formData.newConditionImages.length : 0;
    if (existingPhotos + newPhotos === 0) {
        errors.newConditionImages = 'New condition photos are required';
    }

    Object.assign(errors, validateNewConditionBodyPartMappings(formData));

    // Description is optional on Complete / return.

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

    const freshImages = buildNewConditionImagesPayload(formData.newConditionImages);
    if (freshImages.length) {
        body.newConditionImages = freshImages;
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
