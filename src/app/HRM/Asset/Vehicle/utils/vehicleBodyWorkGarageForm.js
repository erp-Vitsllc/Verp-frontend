import { mapServiceRecordToFormData } from '../components/vehicleServicePayload';
import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { OIL_SERVICE_GARAGE_VENDOR_OPTIONS } from './vehicleOilServiceDetailForm';

export { OIL_SERVICE_GARAGE_VENDOR_OPTIONS as BODY_WORK_GARAGE_VENDOR_OPTIONS };

export function buildBodyWorkGarageFormState(service, asset) {
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
    };
}

export function validateBodyWorkGarageForm(formData) {
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

export function isBodyWorkGarageFormComplete(formData) {
    return Object.keys(validateBodyWorkGarageForm(formData)).length === 0;
}

export function buildBodyWorkGarageUpdateBody(formData) {
    const garageName = String(formData.garageName || '').trim();
    const garageLocation = String(formData.garageLocation || '').trim();
    const garageContact = String(formData.garageContact || '').trim();
    const serviceStartDate = String(formData.serviceStartDate || '').trim();
    const serviceEndDate = String(formData.serviceEndDate || '').trim();

    return {
        serviceType: 'Body Work',
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
