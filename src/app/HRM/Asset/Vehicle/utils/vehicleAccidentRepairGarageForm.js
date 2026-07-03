import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { OIL_SERVICE_GARAGE_VENDOR_OPTIONS } from './vehicleOilServiceDetailForm';

export { OIL_SERVICE_GARAGE_VENDOR_OPTIONS as ACCIDENT_REPAIR_GARAGE_VENDOR_OPTIONS };

export function buildAccidentRepairGarageFormState(service, asset) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = parseVehicleServiceRemark(service) || {};

    return {
        garageName: remark.garageName || remark.vendorName || base.garageName || '',
        garageLocation: remark.garageLocation || base.garageLocation || '',
        garageContact: remark.garageContact || base.garageContact || '',
        serviceStartDate:
            remark.serviceStartDate ||
            remark.scheduledServiceDate ||
            base.serviceStartDate ||
            (service?.date ? new Date(service.date).toISOString().slice(0, 10) : ''),
        serviceEndDate: remark.serviceEndDate || remark.serviceWindowEndDate || base.serviceEndDate || '',
        quotation2Name: remark.quotation2Name || remark.claimReportName || '',
        quotation2Base64: '',
        quotation2Mime: '',
        existingQuotation2Url: service?.quotation2 ? String(service.quotation2) : '',
    };
}

export function validateAccidentRepairGarageForm(formData) {
    const errors = {};
    if (!String(formData.garageName || '').trim()) {
        errors.garageName = 'Garage name is required';
    }
    if (!String(formData.garageLocation || '').trim()) {
        errors.garageLocation = 'Garage location is required';
    }
    if (!String(formData.garageContact || '').trim()) {
        errors.garageContact = 'Garage contact is required';
    }
    if (!String(formData.serviceStartDate || '').trim()) {
        errors.serviceStartDate = 'Service start date is required';
    }
    if (!String(formData.serviceEndDate || '').trim()) {
        errors.serviceEndDate = 'Service end date is required';
    }
    return errors;
}

export function isAccidentRepairGarageFormComplete(formData) {
    return Object.keys(validateAccidentRepairGarageForm(formData)).length === 0;
}

export function buildAccidentRepairGarageUpdateBody(formData) {
    const garageName = String(formData.garageName || '').trim();
    const garageLocation = String(formData.garageLocation || '').trim();
    const garageContact = String(formData.garageContact || '').trim();
    const serviceStartDate = String(formData.serviceStartDate || '').trim();
    const serviceEndDate = String(formData.serviceEndDate || '').trim();

    const body = {
        serviceType: 'Accident Repair',
        date: serviceStartDate || undefined,
        remark: JSON.stringify({
            garageName,
            garageLocation,
            garageContact,
            vendorName: garageName,
            serviceStartDate,
            serviceEndDate,
            scheduledServiceDate: serviceStartDate || undefined,
            quotation2Name: String(formData.quotation2Name || '').trim() || undefined,
            claimReportName: String(formData.quotation2Name || '').trim() || undefined,
        }),
    };

    if (formData.quotation2Base64 && formData.quotation2Name) {
        body.quotation2 = {
            name: formData.quotation2Name,
            data: formData.quotation2Base64,
            mimeType: formData.quotation2Mime || 'application/pdf',
        };
    }

    return body;
}
