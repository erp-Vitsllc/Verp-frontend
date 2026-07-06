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
