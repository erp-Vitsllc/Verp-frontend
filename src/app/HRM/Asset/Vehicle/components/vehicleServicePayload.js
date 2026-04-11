/**
 * Shared mapping between AssetItem.services[] records and VehicleServiceModal form state,
 * and building POST /AssetItem/:id/service bodies (also used for workflow approval updates).
 */

export function parseServiceRemark(remark) {
    if (!remark) return {};
    if (typeof remark === 'object') return remark;
    try {
        return JSON.parse(remark);
    } catch {
        return {};
    }
}

export function mapServiceRecordToFormData(service, assignedEmployee) {
    const initialDate = new Date().toISOString().slice(0, 10);
    if (!service) {
        return {
            serviceType: '',
            oilServiceTypeText: '',
            date: initialDate,
            amountMode: 'amount',
            liableOn: 'company',
            liablePersonId: assignedEmployee?._id ? String(assignedEmployee._id) : '',
            serviceIssue: '',
            value: '',
            tireNumber: '',
            currentKm: '',
            nextChangeKm: '',
            nextChangeMonth: '',
            accidentDate: '',
            policyReportDate: '',
            accidentOwner: '',
            accidentStatus: 'Active',
            insuranceApprovalStatus: '',
            attachmentName: '',
            attachmentBase64: '',
            attachmentMime: '',
            invoiceName: '',
            invoiceBase64: '',
            invoiceMime: '',
            existingAttachmentUrl: '',
            existingInvoiceUrl: '',
            remarkAttachmentName: '',
        };
    }

    const r = parseServiceRemark(service.remark);
    const dateStr = service.date ? new Date(service.date).toISOString().slice(0, 10) : initialDate;
    const st = service.serviceType || '';
    const paid = service.paidBy || 'Company';
    const liableOn = paid === 'Person' || paid === 'Employee' ? 'person' : 'company';

    return {
        serviceType: st,
        oilServiceTypeText: r.oilServiceTypeText || '',
        date: dateStr,
        amountMode: r.amountMode || (Number(service.value) === 0 ? 'warranty' : 'amount'),
        liableOn,
        liablePersonId: r.liablePersonId ? String(r.liablePersonId) : assignedEmployee?._id ? String(assignedEmployee._id) : '',
        serviceIssue: service.description || '',
        value: service.value != null ? String(service.value) : '',
        tireNumber: r.tireNumber != null ? String(r.tireNumber) : '',
        currentKm:
            service.currentKm != null
                ? String(service.currentKm)
                : r.currentKm != null
                  ? String(r.currentKm)
                  : '',
        nextChangeKm: r.nextChangeKm != null ? String(r.nextChangeKm) : '',
        nextChangeMonth: r.nextChangeMonth || '',
        accidentDate: r.accidentDate || '',
        policyReportDate: r.policyReportDate || '',
        accidentOwner: r.accidentOwner || '',
        accidentStatus: r.accidentStatus || 'Active',
        insuranceApprovalStatus: r.insuranceApprovalStatus || '',
        attachmentName: '',
        attachmentBase64: '',
        attachmentMime: '',
        invoiceName: '',
        invoiceBase64: '',
        invoiceMime: '',
        existingAttachmentUrl: service.attachment ? String(service.attachment) : '',
        existingInvoiceUrl: service.invoice ? String(service.invoice) : '',
        remarkAttachmentName: r.attachmentName ? String(r.attachmentName) : '',
    };
}

function flags(formData) {
    const isOilService = formData.serviceType === 'Oil Service';
    const isTireChange = formData.serviceType === 'Tire Change';
    const isMechanicalWork = formData.serviceType === 'Mechanical Work';
    const isBodyWork = formData.serviceType === 'Body Work';
    const isAccidentRepair = formData.serviceType === 'Accident Repair';
    const isCarWash = formData.serviceType === 'Car Wash';
    const requiresKmSchedule = isOilService || isTireChange || isCarWash;
    const requiresCurrentKmOnly = isMechanicalWork || isBodyWork;
    return {
        isOilService,
        isTireChange,
        isMechanicalWork,
        isBodyWork,
        isAccidentRepair,
        isCarWash,
        requiresKmSchedule,
        requiresCurrentKmOnly,
    };
}

export function validateVehicleServiceForm(formData) {
    const e = {};
    const {
        isOilService,
        isTireChange,
        isMechanicalWork,
        isBodyWork,
        isAccidentRepair,
        requiresKmSchedule,
        requiresCurrentKmOnly,
    } = flags(formData);

    if (!formData.serviceType) e.serviceType = 'Service type is required';
    if (isOilService && !String(formData.oilServiceTypeText || '').trim()) e.oilServiceTypeText = 'Oil service type is required';
    if (!formData.date) e.date = 'Date is required';
    if (!formData.serviceIssue) e.serviceIssue = 'Service issue is required';
    if (formData.amountMode === 'amount' && !formData.value) e.value = 'Amount is required';
    if (isTireChange && !formData.tireNumber) e.tireNumber = 'Number is required';
    if (requiresCurrentKmOnly && !formData.currentKm) e.currentKm = 'Current KM is required';
    if ((isMechanicalWork || isBodyWork) && formData.liableOn === 'person' && !formData.liablePersonId) {
        e.liablePersonId = 'Please select the liable person';
    }
    if (requiresKmSchedule) {
        if (!formData.currentKm) e.currentKm = 'Current KM is required';
        if (!formData.nextChangeKm) e.nextChangeKm = 'Next change KM is required';
        if (!formData.nextChangeMonth) e.nextChangeMonth = 'Next change month is required';
    }
    if (isAccidentRepair) {
        if (!formData.accidentDate) e.accidentDate = 'Accident date is required';
        if (!formData.policyReportDate) e.policyReportDate = 'Policy report date is required';
        if (!formData.accidentOwner) e.accidentOwner = 'Accident owner is required';
        if (!formData.accidentStatus) e.accidentStatus = 'Accident status is required';
        if (formData.accidentStatus === 'Active' && !formData.insuranceApprovalStatus) {
            e.insuranceApprovalStatus = 'Insurance approval status is required when accident is active';
        }
    }
    return e;
}

/**
 * Same shape as VehicleServiceModal POST body for /AssetItem/:id/service
 */
export function buildAddServiceBody(formData) {
    const {
        isOilService,
        isTireChange,
        isMechanicalWork,
        isBodyWork,
        isAccidentRepair,
        isCarWash,
        requiresKmSchedule,
        requiresCurrentKmOnly,
    } = flags(formData);

    const extraMeta =
        isOilService || isTireChange || isCarWash
            ? {
                  serviceSubtype: formData.serviceType,
                  oilServiceTypeText: isOilService ? String(formData.oilServiceTypeText || '').trim() : undefined,
                  amountMode: formData.amountMode,
                  tireNumber: isTireChange ? Number(formData.tireNumber || 0) : undefined,
                  currentKm: Number(formData.currentKm || 0),
                  nextChangeKm: Number(formData.nextChangeKm || 0),
                  nextChangeMonth: formData.nextChangeMonth,
              }
            : null;
    const mechanicalMeta = isMechanicalWork
        ? {
              amountMode: formData.amountMode,
              currentKm: Number(formData.currentKm || 0),
              liableOn: formData.liableOn,
              liablePersonId: formData.liableOn === 'person' ? formData.liablePersonId : '',
              attachmentName: formData.attachmentName || '',
          }
        : null;
    const bodyWorkMeta = isBodyWork
        ? {
              amountMode: formData.amountMode,
              currentKm: Number(formData.currentKm || 0),
              liableOn: formData.liableOn,
              liablePersonId: formData.liableOn === 'person' ? formData.liablePersonId : '',
              attachmentName: formData.attachmentName || '',
          }
        : null;
    const accidentMeta = isAccidentRepair
        ? {
              accidentDate: formData.accidentDate,
              policyReportDate: formData.policyReportDate,
              accidentOwner: formData.accidentOwner,
              accidentStatus: formData.accidentStatus,
              insuranceApprovalStatus:
                  formData.accidentStatus === 'Active' ? formData.insuranceApprovalStatus : '',
              attachmentName: formData.attachmentName || '',
          }
        : null;

    const remarkStr = extraMeta
        ? JSON.stringify(extraMeta)
        : mechanicalMeta
          ? JSON.stringify(mechanicalMeta)
          : bodyWorkMeta
            ? JSON.stringify(bodyWorkMeta)
            : accidentMeta
              ? JSON.stringify(accidentMeta)
              : '';

    return {
        serviceType: formData.serviceType,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
        description: formData.serviceIssue,
        currentKm: requiresKmSchedule || requiresCurrentKmOnly ? Number(formData.currentKm || 0) : undefined,
        paidBy: isMechanicalWork || isBodyWork ? (formData.liableOn === 'person' ? 'Person' : 'Company') : undefined,
        value: formData.amountMode === 'warranty' ? 0 : Number(formData.value),
        remark: remarkStr,
        attachment:
            formData.attachmentBase64 && formData.attachmentName
                ? {
                      name: formData.attachmentName,
                      data: formData.attachmentBase64,
                      mimeType: formData.attachmentMime,
                  }
                : null,
        invoice:
            formData.invoiceBase64 && formData.invoiceName
                ? { name: formData.invoiceName, data: formData.invoiceBase64, mimeType: formData.invoiceMime }
                : null,
    };
}
