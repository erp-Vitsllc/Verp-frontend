import { crudAccess, crudAccessUnion, isAdmin } from '@/utils/permissions';

export const COMPANY_LIST_MODULE = 'hrm_company_list';
export const COMPANY_ADD_MODULE = 'hrm_company_add';
export const COMPANY_VIEW_MODULE = 'hrm_company_view';

export const COMPANY_PERM = {
    tradeLicense: 'hrm_company_view_basic_trade_license',
    establishment: 'hrm_company_view_basic_establishment_card',
    ejari: 'hrm_company_view_basic_ejari',
    address: 'hrm_company_view_basic_address',
    basic: 'hrm_company_view_basic',
    assets: 'hrm_company_view_assets',
    fine: 'hrm_company_view_fine',
    moa: 'hrm_company_view_documents_moa',
    memo: 'hrm_company_view_documents_memo',
    certificate: 'hrm_company_view_documents_certificate',
    docLive: 'hrm_company_view_documents_live',
    docLiveWithExpiry: 'hrm_company_view_documents_live_with_expiry',
    docLiveWithoutExpiry: 'hrm_company_view_documents_live_without_expiry',
    docOld: 'hrm_company_view_documents_old',
    ownerPassport: 'hrm_company_view_owner_passport',
    ownerVisa: 'hrm_company_view_owner_visa',
    ownerLabourCard: 'hrm_company_view_owner_labour_card',
    ownerEmiratesId: 'hrm_company_view_owner_emirates_id',
    ownerMedical: 'hrm_company_view_owner_medical_insurance',
    ownerDrivingLicense: 'hrm_company_view_owner_driving_license',
};

const OWNER_MODAL_MODULE = {
    ownerPassport: COMPANY_PERM.ownerPassport,
    ownerVisa: COMPANY_PERM.ownerVisa,
    ownerLabourCard: COMPANY_PERM.ownerLabourCard,
    ownerEmiratesId: COMPANY_PERM.ownerEmiratesId,
    ownerMedical: COMPANY_PERM.ownerMedical,
    ownerDrivingLicense: COMPANY_PERM.ownerDrivingLicense,
};

/** All company profile card / document CRUD flags for one screen. */
export function getCompanyProfileAccess() {
    return {
        tradeLicense: crudAccess(COMPANY_PERM.tradeLicense),
        establishment: crudAccess(COMPANY_PERM.establishment),
        ejari: crudAccess(COMPANY_PERM.ejari),
        address: crudAccess(COMPANY_PERM.address),
        basic: crudAccess(COMPANY_PERM.basic),
        assets: crudAccess(COMPANY_PERM.assets),
        fine: crudAccess(COMPANY_PERM.fine),
        moa: crudAccess(COMPANY_PERM.moa),
        memo: crudAccess(COMPANY_PERM.memo),
        certificate: crudAccess(COMPANY_PERM.certificate),
        docLive: crudAccessUnion([
            COMPANY_PERM.docLive,
            COMPANY_PERM.docLiveWithExpiry,
            COMPANY_PERM.docLiveWithoutExpiry,
        ]),
        docLiveWithExpiry: crudAccess(COMPANY_PERM.docLiveWithExpiry),
        docLiveWithoutExpiry: crudAccess(COMPANY_PERM.docLiveWithoutExpiry),
        docOld: crudAccess(COMPANY_PERM.docOld),
        addCompany: crudAccess(COMPANY_ADD_MODULE),
        ownerPassport: crudAccess(COMPANY_PERM.ownerPassport),
        ownerVisa: crudAccess(COMPANY_PERM.ownerVisa),
        ownerLabourCard: crudAccess(COMPANY_PERM.ownerLabourCard),
        ownerEmiratesId: crudAccess(COMPANY_PERM.ownerEmiratesId),
        ownerMedical: crudAccess(COMPANY_PERM.ownerMedical),
        ownerDrivingLicense: crudAccess(COMPANY_PERM.ownerDrivingLicense),
    };
}

export function ownerDocHasContent(docObj) {
    if (!docObj || typeof docObj !== 'object') return false;
    const scalarKeys = [
        'number',
        'idNumber',
        'nationality',
        'type',
        'provider',
        'issueDate',
        'expiryDate',
        'startDate',
        'countryOfIssue',
        'sponsor',
        'lastUpdated',
    ];
    if (scalarKeys.some((k) => {
        const v = docObj[k];
        return v != null && String(v).trim() !== '';
    })) {
        return true;
    }
    const att = docObj.attachment;
    if (!att) return false;
    const url = typeof att === 'string' ? att : att?.url;
    return Boolean(url && String(url).trim());
}

export function ownerDocAccessByKey(docKey, access = getCompanyProfileAccess()) {
    const map = {
        passport: access.ownerPassport,
        visa: access.ownerVisa,
        labourCard: access.ownerLabourCard,
        emiratesId: access.ownerEmiratesId,
        medical: access.ownerMedical,
        drivingLicense: access.ownerDrivingLicense,
    };
    return map[docKey] || { view: false, create: false, edit: false, delete: false, download: false };
}

export function docStatusTabAccess(docStatusTab, access = getCompanyProfileAccess()) {
    if (docStatusTab === 'memo') return access.memo;
    if (docStatusTab === 'certificate') return access.certificate;
    if (docStatusTab === 'old') return access.docOld;
    return access.docLive;
}

/** Live / dynamic rows: pick module from document context string. */
export function accessForCompanyDocumentContext(context, access = getCompanyProfileAccess()) {
    const c = String(context || '').toLowerCase();
    if (c === 'moa' || c.includes('moa')) return access.moa;
    if (c === 'memo') return access.memo;
    if (c === 'certificate') return access.certificate;
    if (c === 'document_with_expiry' || c.includes('with_expiry')) return access.docLiveWithExpiry;
    if (c === 'document_without_expiry' || c.includes('without_expiry')) return access.docLiveWithoutExpiry;
    if (c === 'ejari') return access.ejari;
    if (c === 'company_address') return access.address;
    if (c === 'insurance') return access.docLiveWithExpiry;
    if (c.includes('trade')) return access.tradeLicense;
    if (c.includes('establishment')) return access.establishment;
    return access.docLive;
}

const MODAL_TYPE_MODULE = {
    tradeLicense: COMPANY_PERM.tradeLicense,
    establishmentCard: COMPANY_PERM.establishment,
    basicDetails: COMPANY_PERM.basic,
    companyAddress: COMPANY_PERM.address,
    addEjari: COMPANY_PERM.ejari,
    ownerDetails: COMPANY_PERM.basic,
    ...OWNER_MODAL_MODULE,
};

export function accessForCompanyModal(type, contextTab, profileAccess) {
    if (type === 'companyDocument') {
        return accessForCompanyDocumentContext(contextTab, profileAccess || getCompanyProfileAccess());
    }
    const moduleId = MODAL_TYPE_MODULE[type];
    if (!moduleId) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }
    return crudAccess(moduleId);
}

/**
 * @param {{ isRenewal?: boolean, isNew?: boolean }} opts
 * isNew: opening add flow (no existing row index)
 * Renew / Not Renew / Edit on compliance cards all require edit permission.
 */
export function canOpenCompanyModal(access, { isRenewal = false, isNew = false } = {}) {
    if (isAdmin()) return true;
    if (isRenewal) return access.edit;
    if (isNew) return access.create;
    return access.edit;
}

export function notifyNoPermission(toast, actionLabel) {
    if (!toast) return;
    toast({
        variant: 'destructive',
        title: 'No permission',
        description: `You do not have permission to ${actionLabel}.`,
    });
}
