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
            existingAttachmentUrl: '',
            remarkAttachmentName: '',
            quotation2Name: '',
            quotation2Base64: '',
            quotation2Mime: '',
            existingQuotation2Url: '',
            quotation3Name: '',
            quotation3Base64: '',
            quotation3Mime: '',
            existingQuotation3Url: '',
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
        existingAttachmentUrl: service.attachment ? String(service.attachment) : '',
        remarkAttachmentName: r.attachmentName ? String(r.attachmentName) : '',
        quotation2Name: r.quotation2Name ? String(r.quotation2Name) : '',
        quotation2Base64: '',
        quotation2Mime: '',
        existingQuotation2Url: service.quotation2 ? String(service.quotation2) : '',
        quotation3Name: r.quotation3Name ? String(r.quotation3Name) : '',
        quotation3Base64: '',
        quotation3Mime: '',
        existingQuotation3Url: service.quotation3 ? String(service.quotation3) : '',
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
    /** Tire, Mechanical, Body, Accident: three quotation slots (Q1 required). */
    const requiresThreeQuotations = isTireChange || isMechanicalWork || isBodyWork || isAccidentRepair;
    /** Oil, Car Wash, Taxi, Other: one mandatory combined attachment. */
    const usesSingleMandatoryAttachment =
        formData.serviceType === 'Oil Service' ||
        formData.serviceType === 'Car Wash' ||
        formData.serviceType === 'Taxi Charge' ||
        formData.serviceType === 'Other';
    return {
        isOilService,
        isTireChange,
        isMechanicalWork,
        isBodyWork,
        isAccidentRepair,
        isCarWash,
        requiresKmSchedule,
        requiresCurrentKmOnly,
        requiresThreeQuotations,
        usesSingleMandatoryAttachment,
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
        requiresThreeQuotations,
        usesSingleMandatoryAttachment,
    } = flags(formData);

    if (!formData.serviceType) e.serviceType = 'Service type is required';
    if (isOilService && !String(formData.oilServiceTypeText || '').trim()) e.oilServiceTypeText = 'Oil service type is required';
    if (!formData.date) e.date = 'Date is required';
    if (!formData.serviceIssue) e.serviceIssue = 'Service issue is required';
    if (formData.amountMode === 'amount' && !formData.value) e.value = 'Amount is required';

    const hasPrimaryFile =
        (formData.attachmentBase64 && formData.attachmentName) || !!formData.existingAttachmentUrl;
    if (requiresThreeQuotations || usesSingleMandatoryAttachment) {
        if (!hasPrimaryFile) {
            e.attachment = requiresThreeQuotations ? 'Quotation 1 is required' : 'Attachment is required';
        }
    }
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
        requiresThreeQuotations,
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
                attachmentName: String(formData.attachmentName || '').trim(),
                ...(isTireChange
                    ? {
                        quotation2Name: String(formData.quotation2Name || '').trim(),
                        quotation3Name: String(formData.quotation3Name || '').trim(),
                    }
                    : {}),
            }
            : null;
    const mechanicalMeta = isMechanicalWork
        ? {
            amountMode: formData.amountMode,
            currentKm: Number(formData.currentKm || 0),
            liableOn: formData.liableOn,
            liablePersonId: formData.liableOn === 'person' ? formData.liablePersonId : '',
            attachmentName: formData.attachmentName || '',
            quotation2Name: String(formData.quotation2Name || '').trim(),
            quotation3Name: String(formData.quotation3Name || '').trim(),
        }
        : null;
    const bodyWorkMeta = isBodyWork
        ? {
            amountMode: formData.amountMode,
            currentKm: Number(formData.currentKm || 0),
            liableOn: formData.liableOn,
            liablePersonId: formData.liableOn === 'person' ? formData.liablePersonId : '',
            attachmentName: formData.attachmentName || '',
            quotation2Name: String(formData.quotation2Name || '').trim(),
            quotation3Name: String(formData.quotation3Name || '').trim(),
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
            quotation2Name: String(formData.quotation2Name || '').trim(),
            quotation3Name: String(formData.quotation3Name || '').trim(),
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
        invoice: null,
        quotation2:
            requiresThreeQuotations && formData.quotation2Base64 && formData.quotation2Name
                ? {
                    name: formData.quotation2Name,
                    data: formData.quotation2Base64,
                    mimeType: formData.quotation2Mime,
                }
                : null,
        quotation3:
            requiresThreeQuotations && formData.quotation3Base64 && formData.quotation3Name
                ? {
                    name: formData.quotation3Name,
                    data: formData.quotation3Base64,
                    mimeType: formData.quotation3Mime,
                }
                : null,
    };
}
