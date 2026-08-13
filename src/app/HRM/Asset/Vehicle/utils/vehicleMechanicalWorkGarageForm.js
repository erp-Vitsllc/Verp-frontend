import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { OIL_SERVICE_GARAGE_VENDOR_OPTIONS } from './vehicleOilServiceDetailForm';
import { normalizeShopServiceDateValue } from './vehicleShopWorkStatus';
import { validateServiceScheduleDates } from './vehicleServiceScheduleDates';

export { OIL_SERVICE_GARAGE_VENDOR_OPTIONS as MECHANICAL_WORK_GARAGE_VENDOR_OPTIONS };

export function buildMechanicalWorkGarageFormState(service, asset) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};
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
        serviceStartDate: normalizeShopServiceDateValue(
            remark.serviceStartDate ||
                remark.scheduledServiceDate ||
                wf.scheduledServiceDate ||
                base.serviceStartDate ||
                '',
        ),
        serviceEndDate: normalizeShopServiceDateValue(
            remark.serviceEndDate ||
                remark.serviceWindowEndDate ||
                wf.serviceWindowEndDate ||
                base.serviceEndDate ||
                '',
        ),
        serviceIssue: String(remark.serviceIssue || remark.scheduleDescription || base.serviceIssue || '').trim(),
        amountFromInitiate: amount > 0 ? String(amount) : '',
    };
}

export function validateMechanicalWorkGarageForm(formData) {
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

export function isMechanicalWorkGarageFormComplete(formData) {
    return Object.keys(validateMechanicalWorkGarageForm(formData)).length === 0;
}

export function buildMechanicalWorkGarageUpdateBody(formData) {
    const garageName = String(formData.garageName || '').trim();
    const garageLocation = String(formData.garageLocation || '').trim();
    const garageContact = String(formData.garageContact || '').trim();
    const serviceStartDate = String(formData.serviceStartDate || '').trim();
    const serviceEndDate = String(formData.serviceEndDate || '').trim();
    const serviceIssue = String(formData.serviceIssue || '').trim();
    const zohoVendorId = String(formData.zohoVendorId || '').trim();

    return {
        serviceType: 'Mechanical Work',
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
