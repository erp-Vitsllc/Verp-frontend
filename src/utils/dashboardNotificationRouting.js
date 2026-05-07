import {
    buildCompanyDocumentExpiryPath,
    resolveCompanyExpiryTabFromExtra1,
} from '@/utils/expiryNotificationFallbacks';

const extractExpiryReminderLabel = (extra1 = '') => {
    const raw = String(extra1 || '').trim();
    const prefix = 'Expiry follow-up required:';
    const withoutPrefix = raw.toLowerCase().startsWith(prefix.toLowerCase())
        ? raw.slice(prefix.length).trim()
        : raw;
    return withoutPrefix.replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '').trim();
};

export const resolveEmployeeExpiryTabFromExtra1 = (extra1 = '') => {
    const label = extractExpiryReminderLabel(extra1).toLowerCase();
    if (label.includes('contract')) return 'work-details';

    // Basic-details document cards
    const basicCardExpiryLabels = [
        'passport',
        'visit visa',
        'employment visa',
        'spouse visa',
        'emirates id',
        'labour card',
        'medical insurance',
        'driving license',
    ];
    if (basicCardExpiryLabels.some((x) => label.includes(x))) return 'basic';

    const openDocs =
        label.includes('document with expiry') ||
        label.includes('document with expires') ||
        label.includes('document expiry date') ||
        label.includes('document with expiry date') ||
        label.includes('document') ||
        label.includes('ejari') ||
        label.includes('moa') ||
        label.includes('memo');
    if (openDocs) return 'documents';

    if (
        label.includes('passport') ||
        label.includes('visa') ||
        label.includes('emirates') ||
        label.includes('labour') ||
        label.includes('medical') ||
        label.includes('driving')
    ) {
        return 'basic';
    }
    if (label.includes('document') || label.includes('ejari') || label.includes('insurance')) return 'documents';
    // Any remaining expiry item is treated as document-card expiry by default.
    return 'documents';
};

const resolveEmployeeTabFromText = (text = '') => {
    const t = String(text || '').toLowerCase();
    if (!t) return { tab: 'basic' };

    // Explicit document-expiry style phrases should always open Documents.
    if (
        t.includes('document with expiry') ||
        t.includes('document with expires') ||
        t.includes('document expiry date') ||
        t.includes('document with expiry date')
    ) {
        return { tab: 'documents' };
    }

    if (
        t.includes('salary') ||
        t.includes('bank') ||
        t.includes('iban') ||
        t.includes('swift') ||
        t.includes('account number') ||
        t.includes('account name')
    ) {
        return { tab: 'salary' };
    }

    if (t.includes('education')) return { tab: 'personal', subTab: 'education' };
    if (t.includes('experience')) return { tab: 'personal', subTab: 'experience' };
    if (t.includes('personal') || t.includes('emergency contact') || t.includes('address'))
        return { tab: 'personal', subTab: 'personal-info' };

    if (
        t.includes('passport') ||
        t.includes('visa') ||
        t.includes('emirates') ||
        t.includes('labour') ||
        t.includes('medical') ||
        t.includes('driving') ||
        t.includes('basic details') ||
        t.includes('basic detail')
    ) {
        return { tab: 'basic' };
    }

    if (
        t.includes('document') ||
        t.includes('moa') ||
        t.includes('memo') ||
        t.includes('insurance') ||
        t.includes('ejari')
    ) {
        return { tab: 'documents' };
    }

    if (t.includes('training')) return { tab: 'training' };
    if (t.includes('work')) return { tab: 'work-details' };
    return { tab: 'basic' };
};

const parseMeta = (extra3) => {
    if (!extra3) return null;
    try {
        return typeof extra3 === 'string' ? JSON.parse(extra3) : extra3;
    } catch {
        return null;
    }
};

/** Lowercase label text from "Not renew pending: …" plus meta.label for routing. */
const extractCompanyNotRenewLabelText = (item, meta) => {
    const raw = String(item?.extra1 || '').trim();
    const prefix = 'not renew pending:';
    const stripped =
        raw.toLowerCase().startsWith(prefix) ? raw.slice(prefix.length).trim().toLowerCase() : raw.toLowerCase();
    const fromMeta = String(meta?.label || '').trim().toLowerCase();
    return `${stripped} ${fromMeta}`.trim();
};

const buildEmployeeNotRenewPath = (item, meta) => {
    const empKey = item.targetEmployeeId || item.id;
    if (!empKey) return '';
    const kind = String(meta?.kind || '').trim();
    const labelText = `${item?.extra1 || ''} ${meta?.label || ''}`.toLowerCase();
    if (kind === 'manualDocument') return `/emp/${encodeURIComponent(String(empKey))}?tab=documents`;
    if (kind === 'visa') return `/emp/${encodeURIComponent(String(empKey))}?tab=basic`;
    if (kind === 'passport' || kind === 'emiratesId' || kind === 'labourCard' || kind === 'medicalInsurance' || kind === 'drivingLicense') {
        return `/emp/${encodeURIComponent(String(empKey))}?tab=basic`;
    }
    if (
        labelText.includes('passport') ||
        labelText.includes('visa') ||
        labelText.includes('emirates') ||
        labelText.includes('labour') ||
        labelText.includes('medical') ||
        labelText.includes('driving')
    ) {
        return `/emp/${encodeURIComponent(String(empKey))}?tab=basic`;
    }
    if (
        labelText.includes('document with expiry') ||
        labelText.includes('moa') ||
        labelText.includes('memo') ||
        labelText.includes('document')
    ) {
        return `/emp/${encodeURIComponent(String(empKey))}?tab=documents`;
    }
    return `/emp/${encodeURIComponent(String(empKey))}?tab=documents`;
};

const buildCompanyNotRenewPath = (item, meta) => {
    const companyKey = item.targetEmployeeId || item.id;
    if (!companyKey) return '';
    const kind = String(meta?.kind || '').trim();
    const labelText = extractCompanyNotRenewLabelText(item, meta);
    const memoQuery = labelText.includes('memo') ? '&docStatusTab=memo' : '';

    if (kind === 'ownerDoc') {
        const ownerIdx = Number.isInteger(meta?.ownerIndex) && meta.ownerIndex >= 0 ? `&ownerTab=${encodeURIComponent(meta.ownerIndex)}` : '';
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=owner${ownerIdx}`;
    }
    if (kind === 'tradeLicense' || kind === 'establishmentCard') {
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=basic`;
    }
    // User-requested mapping: Ejari follows company basic details; documents/insurance go to Documents tab.
    if (kind === 'ejari') {
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=basic`;
    }
    if (kind === 'document' || kind === 'insurance') {
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=others${memoQuery}`;
    }
    if (
        labelText.includes('trade license') ||
        labelText.includes('establishment card')
    ) {
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=basic`;
    }
    if (
        labelText.includes('passport') ||
        labelText.includes('visa') ||
        labelText.includes('emirates') ||
        labelText.includes('labour') ||
        labelText.includes('medical') ||
        labelText.includes('driving')
    ) {
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=owner`;
    }
    if (
        labelText.includes('document with expiry') ||
        labelText.includes('moa') ||
        labelText.includes('memo') ||
        labelText.includes('ejari') ||
        labelText.includes('insurance')
    ) {
        return `/Company/${encodeURIComponent(String(companyKey))}?tab=others${memoQuery}`;
    }
    return `/Company/${encodeURIComponent(String(companyKey))}?tab=others${memoQuery}`;
};

/**
 * Returns exact destination path for a dashboard notification item.
 * Falls back to /dashboard request focus when no specific detail route exists.
 */
export const buildDashboardNotificationPath = (item) => {
    if (!item || typeof item !== 'object') return '';
    const typeRaw = String(item.type || '').trim();
    const type = typeRaw.toLowerCase();

    if (item.type === 'Document Expiry Reminder') {
        if (!item.id) return '';
        return buildCompanyDocumentExpiryPath(item.id, item.extra1, item.extra3);
    }

    if (item.type === 'Employee Document Expiry Reminder') {
        const empKey = item.targetEmployeeId || item.id;
        if (!empKey) return '';
        const tab = resolveEmployeeExpiryTabFromExtra1(item.extra1);
        return `/emp/${encodeURIComponent(String(empKey))}?tab=${encodeURIComponent(tab)}`;
    }

    if (type.includes('company activation')) {
        const companyKey = item.targetEmployeeId || item.extra2 || item.id;
        return companyKey ? `/Company/${encodeURIComponent(String(companyKey))}` : '';
    }

    if (type.includes('employee document not renew')) {
        const meta = parseMeta(item.extra3);
        return buildEmployeeNotRenewPath(item, meta);
    }

    if (type.includes('company document not renew')) {
        const meta = parseMeta(item.extra3);
        return buildCompanyNotRenewPath(item, meta);
    }

    if (type.includes('profile')) {
        const empKey = item.targetEmployeeId || item.extra1 || item.id;
        if (!empKey) return '';
        const textParts = [
            item.extra1 || '',
            item.extra2 || '',
            typeof item.extra3 === 'string' ? item.extra3 : JSON.stringify(item.extra3 || {}),
            item.type || '',
        ].join(' ');
        const match = resolveEmployeeTabFromText(textParts);
        let path = `/emp/${encodeURIComponent(String(empKey))}?tab=${encodeURIComponent(match.tab)}`;
        if (match.subTab) path += `&subTab=${encodeURIComponent(match.subTab)}`;
        return path;
    }

    if (type.includes('probation')) {
        const empKey = item.targetEmployeeId || item.id;
        return empKey ? `/emp/${encodeURIComponent(String(empKey))}?tab=work-details` : '';
    }

    if (type.includes('notice')) {
        const empKey = item.targetEmployeeId || item.extra1 || item.id;
        if (!empKey) return '';
        const textParts = [
            item.extra1 || '',
            item.extra2 || '',
            typeof item.extra3 === 'string' ? item.extra3 : JSON.stringify(item.extra3 || {}),
            item.type || '',
        ].join(' ');
        const match = resolveEmployeeTabFromText(textParts);
        let path = `/emp/${encodeURIComponent(String(empKey))}?tab=${encodeURIComponent(match.tab)}`;
        if (match.subTab) path += `&subTab=${encodeURIComponent(match.subTab)}`;
        return path;
    }

    if (type.includes('loan')) return item.id ? `/HRM/LoanAndAdvance/${encodeURIComponent(String(item.id))}` : '';
    if (type.includes('reward')) return item.id ? `/HRM/Reward/${encodeURIComponent(String(item.id))}` : '';
    if (type.includes('fine')) return item.id ? `/HRM/Fine/${encodeURIComponent(String(item.id))}` : '';

    if (type.includes('responsibility')) return '/Settings/FlowChart';
    if (type.includes('payment')) return '/Accounts/Payments';

    if (type.includes('vehicle service request')) {
        const meta = parseMeta(item.extra3);
        if (meta?.detailsPath) return meta.detailsPath;
        const vehicleId = meta?.vehicleId || item.id;
        const serviceRecordId = meta?.serviceRecordId || '';
        if (vehicleId && serviceRecordId) {
            return `/HRM/Asset/Vehicle/service-requests/details/${encodeURIComponent(String(vehicleId))}/${encodeURIComponent(String(serviceRecordId))}`;
        }
        return vehicleId
            ? `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}?tab=service`
            : '';
    }

    if (type.startsWith('asset')) {
        const meta = parseMeta(item.extra3);
        if (meta?.isBulkAssignment && meta?.bulkAssignmentGroupId) {
            return `/HRM/Asset?bulkAssignmentGroup=${encodeURIComponent(String(meta.bulkAssignmentGroupId))}`;
        }
        const isAccessoryAction = String(item.extra1 || '').includes('Accessory:');
        if (isAccessoryAction) {
            return `/HRM/Asset/details/${encodeURIComponent(String(item.id))}?tab=accessories&authAction=accessory`;
        }
        let query = '';
        const bulkIds = Array.isArray(meta?.bulkAssetIds) ? meta.bulkAssetIds.filter(Boolean).map(String) : [];
        if (typeRaw === 'Asset Approval' && meta?.isBulkCreation && bulkIds.length > 0) {
            query = `?bulkCreation=1&bulkAssetIds=${encodeURIComponent(bulkIds.join(','))}`;
        }
        return item.id ? `/HRM/Asset/details/${encodeURIComponent(String(item.id))}${query}` : '/HRM/Asset';
    }

    const requestId = item.actionId || item.id;
    if (!requestId) return '';
    const scope = item.scope === 'outgoing' ? 'outgoing' : 'incoming';
    return `/dashboard?scope=${scope}&requestId=${encodeURIComponent(String(requestId))}`;
};

export { resolveCompanyExpiryTabFromExtra1 };
