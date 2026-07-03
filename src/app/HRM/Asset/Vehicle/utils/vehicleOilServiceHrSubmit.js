import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

export function buildWorkflowUploadPayload(fileState) {
    const raw = String(fileState?.data || '').trim();
    if (!raw) return undefined;
    return {
        name: String(fileState?.name || '').trim() || 'document.pdf',
        data: raw,
        mime: String(fileState?.mime || '').trim() || undefined,
    };
}

export function buildOilServiceHrServiceUpdates(service, formPayload) {
    const existing = parseVehicleServiceRemark(service) || {};
    const garagePayload = buildWorkflowUploadPayload(formPayload.garageInvoice);
    const otherDocPayload = buildWorkflowUploadPayload(formPayload.otherDocument);
    const nextKm = formPayload.nextServiceKm !== '' ? Number(formPayload.nextServiceKm) : undefined;
    const totalCharge =
        formPayload.totalServiceCharge !== '' && formPayload.totalServiceCharge != null
            ? Number(formPayload.totalServiceCharge)
            : undefined;

    const remark = {
        ...existing,
        returnDate: String(formPayload.returnDate || '').trim() || undefined,
        handOverDate: String(formPayload.handOverDate || '').trim() || undefined,
        nextChangeKm: Number.isFinite(nextKm) ? nextKm : undefined,
        nextChangeMonth: String(formPayload.nextServiceMonth || '').trim() || undefined,
        totalServiceCharge: Number.isFinite(totalCharge) ? totalCharge : undefined,
        garageInvoiceName: garagePayload?.name || existing.garageInvoiceName,
        returnOtherDocName: otherDocPayload?.name || existing.returnOtherDocName,
    };

    return {
        remark: JSON.stringify(remark),
        ...(Number.isFinite(totalCharge) ? { value: totalCharge } : {}),
        ...(garagePayload ? { shopInvoice: garagePayload } : {}),
        ...(otherDocPayload ? { invoice: otherDocPayload } : {}),
    };
}
