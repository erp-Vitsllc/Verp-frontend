import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { OIL_SERVICE_GARAGE_VENDOR_OPTIONS } from './vehicleOilServiceDetailForm';
import { normalizeShopServiceDateValue } from './vehicleShopWorkStatus';

export { OIL_SERVICE_GARAGE_VENDOR_OPTIONS as MECHANICAL_WORK_GARAGE_VENDOR_OPTIONS };

export function buildMechanicalWorkGarageFormState(service, asset) {
    const base = mapServiceRecordToFormData(service, asset?.assignedTo);
    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};

    return {
        garageName: remark.garageName || remark.vendorName || base.garageName || '',
        garageLocation: remark.garageLocation || base.garageLocation || '',
        garageContact: remark.garageContact || base.garageContact || '',
        serviceStartDate: normalizeShopServiceDateValue(
            remark.serviceStartDate ||
                remark.scheduledServiceDate ||
                wf.scheduledServiceDate ||
                base.serviceStartDate ||
                (service?.date ? new Date(service.date).toISOString().slice(0, 10) : ''),
        ),
        serviceEndDate: normalizeShopServiceDateValue(
            remark.serviceEndDate || remark.serviceWindowEndDate || wf.serviceWindowEndDate || base.serviceEndDate || '',
        ),
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
    if (!String(formData.serviceStartDate || '').trim()) {
        errors.serviceStartDate = 'Service start date is required';
    }
    if (!String(formData.serviceEndDate || '').trim()) {
        errors.serviceEndDate = 'Service end date is required';
    }
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
        }),
    };
}
