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

const ASSET_CONTROLLER_VALUE = '__asset_controller__';

export function mapServiceRecordToFormData(service, assignedEmployee) {
    const initialDate = new Date().toISOString().slice(0, 10);
    if (!service) {
        return {
            serviceType: '',
            oilServiceTypeText: '',
            date: initialDate,
            adminScheduledServiceDate: '',
            adminServiceDurationDays: '',
            amountMode: 'amount',
            liableOn: 'company',
            liablePersonId: assignedEmployee?._id ? String(assignedEmployee._id) : '',
            serviceIssue: '',
            mechanicalDurationDays: '',
            value: '',
            tireNumber: '',
            previousChangeKm: '',
            currentKm: '',
            nextChangeKm: '',
            nextChangeMonth: '',
            carWashServiceDate: initialDate,
            accidentDate: '',
            accidentOwnerType: 'self',
            policeFineAmount: '',
            assignedByEmployeeId: '',
            vehicleOwnerEmployeeId: assignedEmployee?._id ? String(assignedEmployee._id) : ASSET_CONTROLLER_VALUE,
            insuranceCompany: '',
            insuranceFineAmount: '',
            accidentImages: [],
            existingAccidentImages: [],
            accidentRepairDurationDays: '',
            policyReportDate: '',
            accidentOwner: '',
            accidentStatus: 'Active',
            insuranceApprovalStatus: '',
            attachmentName: '',
            tireConditionName: '',
            tireConditionBase64: '',
            tireConditionMime: '',
            existingTireConditionUrl: '',
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
            bodyWorkImages: [],
            existingBodyWorkImages: [],
            expectedDurationDays: '',
            approvedQuotationChoice: '',
            vendorName: '',
            quotation1Amount: '',
            quotation2Amount: '',
            quotation3Amount: '',
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
        adminScheduledServiceDate:
            r.adminScheduledServiceDate || (service.date ? dateStr : '') || '',
        adminServiceDurationDays: r.adminServiceDurationDays != null ? String(r.adminServiceDurationDays) : '',
        amountMode: r.amountMode || (Number(service.value) === 0 ? 'warranty' : 'amount'),
        liableOn,
        liablePersonId: r.liablePersonId ? String(r.liablePersonId) : assignedEmployee?._id ? String(assignedEmployee._id) : '',
        serviceIssue: service.description || '',
        mechanicalDurationDays:
            r.mechanicalDurationDays != null ? String(r.mechanicalDurationDays) : '',
        value: service.value != null ? String(service.value) : '',
        tireNumber: r.tireNumber != null ? String(r.tireNumber) : '',
        previousChangeKm: r.previousChangeKm != null ? String(r.previousChangeKm) : '',
        currentKm:
            service.currentKm != null
                ? String(service.currentKm)
                : r.currentKm != null
                    ? String(r.currentKm)
                    : '',
        nextChangeKm: r.nextChangeKm != null ? String(r.nextChangeKm) : '',
        nextChangeMonth: r.nextChangeMonth || '',
        carWashServiceDate:
            r.carWashServiceDate ||
            (service.date ? dateStr : '') ||
            dateStr,
        accidentDate: r.accidentDate || '',
        accidentOwnerType:
            r.accidentOwnerType ||
            (r.accidentOwner === 'Third Party' || String(r.accidentOwner || '').toLowerCase().includes('third')
                ? 'thirdParty'
                : 'self'),
        policeFineAmount: r.policeFineAmount != null ? String(r.policeFineAmount) : '',
        assignedByEmployeeId: r.assignedByEmployeeId ? String(r.assignedByEmployeeId) : '',
        vehicleOwnerEmployeeId:
            r.vehicleOwnerEmployeeId != null
                ? String(r.vehicleOwnerEmployeeId)
                : assignedEmployee?._id
                    ? String(assignedEmployee._id)
                    : ASSET_CONTROLLER_VALUE,
        insuranceCompany: r.insuranceCompany != null ? String(r.insuranceCompany) : '',
        insuranceFineAmount: r.insuranceFineAmount != null ? String(r.insuranceFineAmount) : '',
        accidentImages: [],
        existingAccidentImages: Array.isArray(r.accidentImages) ? r.accidentImages : [],
        accidentRepairDurationDays:
            r.accidentRepairDurationDays != null ? String(r.accidentRepairDurationDays) : '',
        policyReportDate: r.policyReportDate || '',
        accidentOwner: r.accidentOwner || '',
        accidentStatus: r.accidentStatus || 'Active',
        insuranceApprovalStatus: r.insuranceApprovalStatus || '',
        attachmentName: '',
        tireConditionName: r.tireConditionName ? String(r.tireConditionName) : '',
        tireConditionBase64: '',
        tireConditionMime: '',
        existingTireConditionUrl: r.tireConditionUrl ? String(r.tireConditionUrl) : '',
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
        bodyWorkImages: [],
        existingBodyWorkImages: Array.isArray(r.bodyWorkImages) ? r.bodyWorkImages : [],
        expectedDurationDays: r.expectedDurationDays != null ? String(r.expectedDurationDays) : '',
        approvedQuotationChoice: r.approvedQuotationChoice || '',
        vendorName: r.vendorName || '',
        quotation1Amount:
            r.quotationAmounts?.q1 != null
                ? String(r.quotationAmounts.q1)
                : r.quotationAmountQ1 != null
                    ? String(r.quotationAmountQ1)
                    : '',
        quotation2Amount:
            r.quotationAmounts?.q2 != null
                ? String(r.quotationAmounts.q2)
                : r.quotationAmountQ2 != null
                    ? String(r.quotationAmountQ2)
                    : '',
        quotation3Amount:
            r.quotationAmounts?.q3 != null
                ? String(r.quotationAmounts.q3)
                : r.quotationAmountQ3 != null
                    ? String(r.quotationAmountQ3)
                    : '',
    };
}

function flags(formData) {
    const isOilService = formData.serviceType === 'Oil Service';
    const isTireChange = formData.serviceType === 'Tire Change';
    const isMechanicalWork = formData.serviceType === 'Mechanical Work';
    const isBodyWork = formData.serviceType === 'Body Work';
    const isAccidentRepair = formData.serviceType === 'Accident Repair';
    const isCarWash = formData.serviceType === 'Car Wash';
    const requiresKmSchedule = isTireChange || isCarWash;
    const requiresCurrentKmOnly = isMechanicalWork || isBodyWork;
    /** Tire/Mechanical/Body Work use 3; Oil uses 3 only in Amount mode. */
    const requiresThreeQuotations =
        isTireChange ||
        isMechanicalWork ||
        isBodyWork ||
        (isOilService && formData.amountMode === 'amount');
    /** Taxi, Other: one mandatory combined attachment. */
    const usesSingleMandatoryAttachment =
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

export function validateVehicleServiceForm(formData, options = {}) {
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
    if ((isOilService || isTireChange || isMechanicalWork) && formData.amountMode === 'warranty' && !String(formData.vendorName || '').trim()) {
        e.vendorName = 'Supplier is required when warranty is selected';
    }
    if (!formData.date) e.date = 'Date is required';
    if (!formData.serviceIssue) {
        e.serviceIssue = isAccidentRepair ? 'Accident description is required' : 'Service issue is required';
    }
    if (!isAccidentRepair && formData.amountMode === 'amount' && !formData.value && !requiresThreeQuotations) {
        e.value = 'Amount is required';
    }

    const hasPrimaryFile =
        (formData.attachmentBase64 && formData.attachmentName) || !!formData.existingAttachmentUrl;
    const hasTireCondition =
        (formData.tireConditionBase64 && formData.tireConditionName) || !!formData.existingTireConditionUrl;
    if (isTireChange && !hasTireCondition) e.tireCondition = 'Tire condition file is required';
    if (!isAccidentRepair && (requiresThreeQuotations || usesSingleMandatoryAttachment) && formData.amountMode !== 'warranty') {
        if (!hasPrimaryFile) {
            e.attachment = requiresThreeQuotations ? 'Quotation 1 is required' : 'Attachment is required';
        }
    }
    if (isAccidentRepair) {
        if (!hasPrimaryFile) e.attachment = 'Police report (PDF) is required';
        if (!formData.accidentDate) e.accidentDate = 'Accident date is required';
        if (!formData.accidentOwnerType) e.accidentOwnerType = 'Accident party is required';
        if (formData.accidentOwnerType === 'self') {
            const policeFine = Number(formData.policeFineAmount);
            if (!Number.isFinite(policeFine) || policeFine < 0) e.policeFineAmount = 'Police fine is required for self';
        }
        const ar = Number(formData.accidentRepairDurationDays);
        if (!Number.isFinite(ar) || ar < 1) e.accidentRepairDurationDays = 'Repair duration (days) is required';
    }
    if (isCarWash) {
        if (!formData.carWashServiceDate) e.carWashServiceDate = 'Service date is required';
        if (!formData.currentKm) e.currentKm = 'Current KM is required';
        const amount = Number(formData.value);
        if (!Number.isFinite(amount) || amount <= 0) e.value = 'Amount is required';
    }
    if ((isTireChange || isBodyWork || isMechanicalWork) && !formData.currentKm) e.currentKm = 'Current KM is required';
    if (isTireChange && !formData.previousChangeKm) e.previousChangeKm = 'Previous change KM is required';
    if (requiresThreeQuotations && formData.amountMode === 'amount') {
        const q1Amount = Number(formData.quotation1Amount);
        if (!Number.isFinite(q1Amount) || q1Amount <= 0) e.quotation1Amount = 'Quotation 1 amount is required';

        const hasQ2 = !!(formData.quotation2Base64 && formData.quotation2Name) || !!formData.existingQuotation2Url;
        const hasQ3 = !!(formData.quotation3Base64 && formData.quotation3Name) || !!formData.existingQuotation3Url;

        if (hasQ2) {
            const q2Amount = Number(formData.quotation2Amount);
            if (!Number.isFinite(q2Amount) || q2Amount <= 0) e.quotation2Amount = 'Quotation 2 amount is required';
        }
        if (hasQ3) {
            const q3Amount = Number(formData.quotation3Amount);
            if (!Number.isFinite(q3Amount) || q3Amount <= 0) e.quotation3Amount = 'Quotation 3 amount is required';
        }
    }
    if (requiresCurrentKmOnly && !formData.currentKm) e.currentKm = 'Current KM is required';
    if (isBodyWork && formData.liableOn === 'person' && !formData.liablePersonId) {
        e.liablePersonId = 'Please select the liable person';
    }
    const stage = options?.workflowStage || '';
    if (stage === 'pending_hr' && !isAccidentRepair) {
        if (!String(formData.vendorName || '').trim()) {
            e.vendorName = 'Vendor is required for HR approval';
        }
    }
    if (stage === 'pending_hr' && requiresThreeQuotations) {
        const hasQ1 = !!(formData.attachmentBase64 && formData.attachmentName) || !!formData.existingAttachmentUrl;
        const hasQ2 = !!(formData.quotation2Base64 && formData.quotation2Name) || !!formData.existingQuotation2Url;
        const hasQ3 = !!(formData.quotation3Base64 && formData.quotation3Name) || !!formData.existingQuotation3Url;
        const available = [
            hasQ1 ? 'q1' : null,
            hasQ2 ? 'q2' : null,
            hasQ3 ? 'q3' : null,
        ].filter(Boolean);
        if (available.length > 1) {
            if (!formData.approvedQuotationChoice) {
                e.approvedQuotationChoice = 'Select one quotation to proceed';
            } else if (!available.includes(formData.approvedQuotationChoice)) {
                e.approvedQuotationChoice = 'Selected quotation is missing';
            }
        }
    }
    if (stage === 'pending_admin') {
        if (!String(formData.adminScheduledServiceDate || '').trim()) {
            e.adminScheduledServiceDate = 'Planned first service day is required';
        }
        const d = Number(formData.adminServiceDurationDays);
        if (!Number.isFinite(d) || d < 1) {
            e.adminServiceDurationDays = 'Duration (calendar days) is required and must be at least 1';
        }
    }
    return e;
}

/**
 * Same shape as VehicleServiceModal POST body for /AssetItem/:id/service
 * @param {object} [options]
 * @param {string} [options.workflowStage] e.g. pending_admin appends scheduledServiceDate + serviceDurationDays
 */
export function buildAddServiceBody(formData, options = {}) {
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
                tireNumber: undefined,
                currentKm: Number(formData.currentKm || 0),
                previousChangeKm: isTireChange ? Number(formData.previousChangeKm || 0) : undefined,
                nextChangeKm: isOilService ? Number(formData.nextChangeKm || 0) : undefined,
                nextChangeMonth: isOilService ? formData.nextChangeMonth : undefined,
                carWashServiceDate: isCarWash ? formData.carWashServiceDate : undefined,
                attachmentName: String(formData.attachmentName || '').trim(),
                tireConditionName: isTireChange ? String(formData.tireConditionName || '').trim() : undefined,
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
            mechanicalDurationDays:
                formData.mechanicalDurationDays !== '' && formData.mechanicalDurationDays != null
                    ? Math.floor(Number(formData.mechanicalDurationDays))
                    : undefined,
            vendorName: String(formData.vendorName || '').trim(),
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
            bodyWorkImages: Array.isArray(formData.existingBodyWorkImages) ? formData.existingBodyWorkImages : [],
            attachmentName: formData.attachmentName || '',
            quotation2Name: String(formData.quotation2Name || '').trim(),
            quotation3Name: String(formData.quotation3Name || '').trim(),
        }
        : null;
    const accidentMeta = isAccidentRepair
        ? {
            accidentDate: formData.accidentDate,
            accidentOwnerType: formData.accidentOwnerType,
            accidentOwner: formData.accidentOwnerType === 'thirdParty' ? 'Third Party' : 'Self',
            accidentStatus: 'Active',
            policeFineAmount:
                formData.policeFineAmount !== '' && formData.policeFineAmount != null
                    ? Number(formData.policeFineAmount)
                    : undefined,
            assignedByEmployeeId: String(formData.assignedByEmployeeId || '').trim() || undefined,
            insuranceCompany: String(formData.insuranceCompany || '').trim(),
            insuranceFineAmount:
                formData.insuranceFineAmount !== '' && formData.insuranceFineAmount != null
                    ? Number(formData.insuranceFineAmount)
                    : undefined,
            policeReportName: String(formData.attachmentName || formData.remarkAttachmentName || '').trim(),
            claimReportName: String(formData.quotation2Name || '').trim(),
            insuranceFineCopyName: String(formData.quotation3Name || '').trim(),
            accidentRepairDurationDays:
                formData.accidentRepairDurationDays !== ''
                    ? Math.floor(Number(formData.accidentRepairDurationDays))
                    : undefined,
            existingAccidentImages: Array.isArray(formData.existingAccidentImages)
                ? formData.existingAccidentImages
                : [],
        }
        : null;

    const approvalMeta =
        String(formData.approvedQuotationChoice || '').trim() || String(formData.vendorName || '').trim()
            ? {
                approvedQuotationChoice: String(formData.approvedQuotationChoice || '').trim() || undefined,
                vendorName: String(formData.vendorName || '').trim() || undefined,
            }
            : null;

    const remarkObj = extraMeta || mechanicalMeta || bodyWorkMeta || accidentMeta || {};
    const selectedVehicleOwner = String(formData.vehicleOwnerEmployeeId || '').trim();
    remarkObj.vehicleOwnerEmployeeId = selectedVehicleOwner === ASSET_CONTROLLER_VALUE ? '' : selectedVehicleOwner;
    if (requiresThreeQuotations && !isAccidentRepair) {
        remarkObj.quotationAmounts = {
            q1: formData.quotation1Amount !== '' ? Number(formData.quotation1Amount) : undefined,
            q2: formData.quotation2Amount !== '' ? Number(formData.quotation2Amount) : undefined,
            q3: formData.quotation3Amount !== '' ? Number(formData.quotation3Amount) : undefined,
        };
    }
    if (approvalMeta) Object.assign(remarkObj, approvalMeta);
    const remarkStr = Object.keys(remarkObj).length ? JSON.stringify(remarkObj) : '';

    const body = {
        serviceType: formData.serviceType,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
        description: formData.serviceIssue,
        currentKm:
            isAccidentRepair
                ? (formData.currentKm !== '' ? Number(formData.currentKm) : undefined)
                : requiresKmSchedule || requiresCurrentKmOnly
                    ? Number(formData.currentKm || 0)
                    : undefined,
        paidBy: isBodyWork ? (formData.liableOn === 'person' ? 'Person' : 'Company') : undefined,
        value: isAccidentRepair
            ? 0
            : isCarWash
                ? Number(formData.value || 0)
            : formData.amountMode === 'warranty'
                ? 0
                : requiresThreeQuotations
                    ? Number(formData.quotation1Amount || 0)
                    : Number(formData.value),
        remark: remarkStr,
        attachment:
            formData.attachmentBase64 && formData.attachmentName
                ? {
                    name: formData.attachmentName,
                    data: formData.attachmentBase64,
                    mimeType: formData.attachmentMime,
                }
                : null,
        tireCondition:
            formData.tireConditionBase64 && formData.tireConditionName
                ? {
                    name: formData.tireConditionName,
                    data: formData.tireConditionBase64,
                    mimeType: formData.tireConditionMime,
                }
                : null,
        invoice: null,
        quotation2:
            (requiresThreeQuotations || isAccidentRepair) &&
            formData.quotation2Base64 &&
            formData.quotation2Name
                ? {
                    name: formData.quotation2Name,
                    data: formData.quotation2Base64,
                    mimeType: formData.quotation2Mime,
                }
                : null,
        quotation3:
            (requiresThreeQuotations || isAccidentRepair) &&
            formData.quotation3Base64 &&
            formData.quotation3Name
                ? {
                    name: formData.quotation3Name,
                    data: formData.quotation3Base64,
                    mimeType: formData.quotation3Mime,
                }
                : null,
        bodyWorkImages:
            isBodyWork && Array.isArray(formData.bodyWorkImages)
                ? formData.bodyWorkImages.map((img) => ({
                    name: img.name,
                    data: img.data,
                    mimeType: img.mimeType,
                }))
                : null,
        accidentImages:
            isAccidentRepair && Array.isArray(formData.accidentImages)
                ? formData.accidentImages.map((img) => ({
                    name: img.name,
                    data: img.data,
                    mimeType: img.mimeType,
                }))
                : null,
    };
    if (options.workflowStage === 'pending_admin') {
        if (formData.adminScheduledServiceDate) {
            body.scheduledServiceDate = new Date(formData.adminScheduledServiceDate).toISOString();
        }
        if (formData.adminServiceDurationDays) {
            body.serviceDurationDays = Math.floor(Number(formData.adminServiceDurationDays));
        }
    }
    return body;
}
