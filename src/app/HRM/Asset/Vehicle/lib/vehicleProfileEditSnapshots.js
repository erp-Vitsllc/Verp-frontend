import { buildSectionRows } from '../components/VehicleActivationSubmitModal';

const normalizePlate = ({ code, digits, emirate }) => {
    const digitsOnly = String(digits || '').replace(/\D/g, '').slice(0, 6) || '1';
    const codePart = String(code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3);
    const plate = codePart ? `${codePart} ${digitsOnly}` : digitsOnly;
    const em = String(emirate || '').trim();
    return em ? `${em} ${plate}`.trim() : plate;
};

export function buildBasicProposedRows(form, asset) {
    return [
        { label: 'Asset ID', value: form.assetId || asset?.assetId || '—' },
        { label: 'Brand', value: form.brand || '—' },
        { label: 'Model', value: form.name || '—' },
        {
            label: 'Plate',
            value:
                normalizePlate({
                    code: form.plateCode,
                    digits: form.plateDigits,
                    emirate: form.plateEmirate,
                }) || '—',
        },
        { label: 'Model year', value: form.modelYear ?? '—' },
        {
            label: 'Purchase value',
            value:
                form.assetValue != null && String(form.assetValue).trim() !== ''
                    ? `AED ${Number(String(form.assetValue).replace(/\D/g, '') || 0).toLocaleString()}`
                    : '—',
        },
        {
            label: 'Current KM',
            value:
                form.currentKilometer != null && String(form.currentKilometer).trim() !== ''
                    ? Number(String(form.currentKilometer).replace(/\D/g, '') || 0).toLocaleString()
                    : '—',
        },
        {
            label: 'Monthly limit',
            value:
                form.fuelMonthlyLimit != null && String(form.fuelMonthlyLimit).trim() !== ''
                    ? `AED ${Number(form.fuelMonthlyLimit).toLocaleString()}`
                    : '—',
        },
    ];
}

export function buildRegistrationProposedRows(formData, { isRenew = false } = {}) {
    const hasCard = (formData.rows || []).some((r) => r.fileBase64 || r.hasExisting);
    return [
        { label: 'Registration date', value: formData.registrationDate || '—' },
        { label: 'Expiry', value: formData.expiryDate || '—' },
        {
            label: 'Registration value',
            value:
                formData.fee != null && String(formData.fee).trim() !== ''
                    ? `AED ${Number(formData.fee).toLocaleString()}`
                    : '—',
        },
        { label: 'Primary card on file', value: hasCard ? 'Yes' : 'No' },
        ...(isRenew ? [{ label: 'Action', value: 'Renew' }] : []),
    ];
}

export function buildInsuranceProposedRows(formData, { isRenew = false } = {}) {
    const hasCard = (formData.documents || formData.rows || []).some(
        (r) => r.fileBase64 || r.hasExisting || r.attachment,
    );
    return [
        { label: 'Insurer', value: formData.insuranceCompany || formData.company || '—' },
        { label: 'Policy', value: formData.policyNumber || formData.policy || '—' },
        { label: 'Start', value: formData.startDate || formData.issueDate || '—' },
        { label: 'End', value: formData.expiryDate || '—' },
        {
            label: 'Premium amount',
            value:
                formData.premiumAmount != null && String(formData.premiumAmount).trim() !== ''
                    ? `AED ${Number(formData.premiumAmount).toLocaleString()}`
                    : '—',
        },
        {
            label: 'Excess charge',
            value:
                formData.excessCharge != null && String(formData.excessCharge).trim() !== ''
                    ? `AED ${Number(formData.excessCharge).toLocaleString()}`
                    : '—',
        },
        { label: 'Card on file', value: hasCard ? 'Yes' : 'No' },
        ...(isRenew ? [{ label: 'Action', value: 'Renew' }] : []),
    ];
}

export function buildProfilePictureProposedRows() {
    return [{ label: 'Profile picture', value: 'New photo pending approval' }];
}

export function buildNotRenewProposedRows(sectionId, docLabel) {
    const label =
        sectionId === 'registration'
            ? 'Registration card'
            : sectionId === 'insurance'
              ? 'Insurance card'
              : docLabel || 'Document';
    return [
        { label: 'Action', value: 'Not renew' },
        { label: 'Document', value: label },
    ];
}

export function buildVehicleProfileEditSnapshots({ sectionId, asset, proposedRows }) {
    const previousRows = buildSectionRows(sectionId, asset);
    return {
        previousRows: Array.isArray(previousRows) ? previousRows : [],
        proposedRows: Array.isArray(proposedRows) ? proposedRows : [],
    };
}

const MONEY_KEYS = new Set([
    'assetValue',
    'fuelMonthlyLimit',
    'mortgageAmount',
    'loanAmount',
    'downPayment',
    'monthlyPayment',
    'balancePayment',
    'processCharge',
    'soldValue',
    'totalLossValue',
    'currentLoanAmount',
    'registrationExpense',
    'otherExpense',
    'balanceInHand',
]);

const ASSET_FIELD_LABELS = {
    name: 'Model',
    brand: 'Brand',
    modelYear: 'Model year',
    plateNumber: 'Plate number',
    plateEmirate: 'Emirate',
    assetValue: 'Purchase value',
    currentKilometer: 'Current KM',
    fuelMonthlyLimit: 'Monthly limit',
    mortgageBankName: 'Bank',
    mortgageBank: 'Bank',
    mortgageVehicleName: 'Vehicle name',
    mortgageAmount: 'Vehicle amount',
    loanAmount: 'Loan amount',
    interestRate: 'Interest',
    loanTenureMonths: 'Loan tenure (months)',
    mortgageStartDate: 'Start date',
    mortgageEndDate: 'End date',
    downPayment: 'Down payment',
    monthlyPayment: 'Monthly payment',
    balancePayment: 'Balance payment',
    processCharge: 'Process charge',
    soldValue: 'Sold value',
    totalLossValue: 'Total loss value',
    currentLoanAmount: 'Current loan',
    registrationExpense: 'Registration expense',
    otherExpense: 'Other expense',
    balanceInHand: 'Balance in hand',
};

const normChangeValue = (value) =>
    String(value ?? '')
        .replace(/[—–-]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();

const formatStepValue = (key, value) => {
    if (value == null || value === '') return '—';
    if (MONEY_KEYS.has(key)) return `AED ${Number(value).toLocaleString()}`;
    if (key === 'currentKilometer') return Number(value).toLocaleString();
    if (key === 'interestRate') return `${Number(value)}%`;
    if (/date/i.test(key)) return String(value).slice(0, 10);
    return String(value);
};

const rowsFromStep = (step) => {
    if (!step || typeof step !== 'object') return [];
    if (step.op === 'delete_document') {
        return [{ label: 'Document removed', value: 'Yes' }];
    }
    const body = step.body;
    if (!body || typeof body !== 'object') return [];
    const rows = [];
    if (typeof body.description === 'string' && body.description.trim().startsWith('{')) {
        try {
            const meta = JSON.parse(body.description);
            if (meta?.company) rows.push({ label: 'Insurer', value: String(meta.company) });
            if (meta?.policy) rows.push({ label: 'Policy', value: String(meta.policy) });
            if (meta?.fee != null && meta.fee !== '') {
                rows.push({ label: 'Registration value', value: `AED ${Number(meta.fee).toLocaleString()}` });
            }
            if (meta?.premiumAmount != null && meta.premiumAmount !== '') {
                rows.push({ label: 'Premium amount', value: `AED ${Number(meta.premiumAmount).toLocaleString()}` });
            }
            if (meta?.excessCharge != null && meta.excessCharge !== '') {
                rows.push({ label: 'Excess charge', value: `AED ${Number(meta.excessCharge).toLocaleString()}` });
            }
            if (meta?.vendor) rows.push({ label: 'Vendor', value: String(meta.vendor) });
            if (meta?.tagNo) rows.push({ label: 'Tag', value: String(meta.tagNo) });
            if (meta?.permitName) rows.push({ label: 'Permit name', value: String(meta.permitName) });
        } catch {
            /* plain description */
        }
    } else if (body.description) {
        rows.push({ label: 'Description', value: String(body.description) });
    }
    const docType = String(body.type || '').toLowerCase();
    if (body.issueDate) {
        rows.push({
            label: docType.includes('registration') ? 'Registration date' : 'Start',
            value: String(body.issueDate).slice(0, 10),
        });
    }
    if (body.expiryDate) {
        rows.push({
            label: docType.includes('registration') ? 'Expiry' : 'End',
            value: String(body.expiryDate).slice(0, 10),
        });
    }
    if (body.document?.name) rows.push({ label: 'Attachment', value: String(body.document.name) });
    for (const [key, value] of Object.entries(body)) {
        const label = ASSET_FIELD_LABELS[key];
        if (!label || value == null || typeof value === 'object') continue;
        rows.push({ label, value: formatStepValue(key, value) });
    }
    return rows;
};

/** Live vs proposed pairs for fields the user actually changed. */
export function profileEditChangedPairs(entry) {
    const previous = new Map();
    const proposed = new Map();
    for (const row of entry?.previousRows || []) {
        if (row?.label) previous.set(String(row.label), row.value ?? '—');
    }
    for (const row of entry?.proposedRows || []) {
        if (row?.label) proposed.set(String(row.label), row.value ?? '—');
    }
    for (const step of entry?.steps || []) {
        for (const row of rowsFromStep(step)) {
            if (!proposed.has(row.label)) proposed.set(row.label, row.value);
        }
    }
    const labels = [...new Set([...previous.keys(), ...proposed.keys()])];
    return labels
        .map((label) => ({
            label,
            live: previous.has(label) ? previous.get(label) : '—',
            proposed: proposed.has(label) ? proposed.get(label) : '—',
        }))
        .filter((row) => normChangeValue(row.live) !== normChangeValue(row.proposed));
}
