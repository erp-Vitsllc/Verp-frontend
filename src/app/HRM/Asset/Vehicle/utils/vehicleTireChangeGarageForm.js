import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { OIL_SERVICE_GARAGE_VENDOR_OPTIONS } from './vehicleOilServiceDetailForm';
import { validateServiceScheduleDates } from './vehicleServiceScheduleDates';

export { OIL_SERVICE_GARAGE_VENDOR_OPTIONS as TIRE_CHANGE_GARAGE_VENDOR_OPTIONS };

export function buildTireChangeGarageFormState(service, asset) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = parseVehicleServiceRemark(service) || {};
    const amount =
        Number(remark.hrReviewApprovedAmount) ||
        Number(remark.approvedAmount) ||
        Number(remark.estimatedCost) ||
        Number(service?.value) ||
        Number(base.value) ||
        0;

    return {
        garageName: remark.garageName || remark.vendorName || base.garageName || '',
        garageLocation: remark.garageLocation || base.garageLocation || '',
        garageContact: remark.garageContact || base.garageContact || '',
        zohoVendorId: String(remark.zohoVendorId || '').trim(),
        serviceStartDate:
            remark.serviceStartDate ||
            remark.scheduledServiceDate ||
            base.serviceStartDate ||
            '',
        serviceEndDate: remark.serviceEndDate || remark.serviceWindowEndDate || base.serviceEndDate || '',
        serviceIssue: String(remark.serviceIssue || remark.scheduleDescription || base.serviceIssue || '').trim(),
        amountFromInitiate: amount > 0 ? String(amount) : '',
    };
}

export function validateTireChangeGarageForm(formData) {
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
    Object.assign(errors, validateServiceScheduleDates(formData));
    return errors;
}

export function isTireChangeGarageFormComplete(formData) {
    return Object.keys(validateTireChangeGarageForm(formData)).length === 0;
}

export function buildTireChangeGarageUpdateBody(formData) {
    const garageName = String(formData.garageName || '').trim();
    const garageLocation = String(formData.garageLocation || '').trim();
    const garageContact = String(formData.garageContact || '').trim();
    const serviceStartDate = String(formData.serviceStartDate || '').trim();
    const serviceEndDate = String(formData.serviceEndDate || '').trim();
    const serviceIssue = String(formData.serviceIssue || '').trim();
    const zohoVendorId = String(formData.zohoVendorId || '').trim();

    return {
        serviceType: 'Tire Change',
        date: serviceStartDate || undefined,
        remark: JSON.stringify({
            garageName,
            garageLocation,
            garageContact,
            vendorName: garageName,
            serviceStartDate,
            serviceEndDate,
            scheduledServiceDate: serviceStartDate || undefined,
            ...(zohoVendorId ? { zohoVendorId } : {}),
            ...(serviceIssue ? { serviceIssue } : {}),
        }),
    };
}
