const VISA_NUMBER_REGEX = /^[A-Za-z0-9]{5,20}$/;
const VISA_SPONSOR_REGEX = /^[A-Za-z\s]{2,100}$/;

export const OWNER_VISA_DOC_KEYS = {
    visit: 'visitVisa',
    employment: 'employmentVisa',
    spouse: 'spouseVisa',
};

export const OWNER_VISA_LABELS = {
    visitVisa: 'Visit Visa',
    employmentVisa: 'Employment Visa',
    spouseVisa: 'Spouse Visa',
};

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeVisaNumber(value) {
    return stripDangerousText(value).replace(/\s/g, '');
}

export function normalizeVisaSponsor(value) {
    return stripDangerousText(value);
}

export function normalizeVisaTypeLabel(value) {
    const t = stripDangerousText(value).toLowerCase();
    if (t === 'visit' || t === 'visiting') return 'Visit';
    if (t === 'employment') return 'Employment';
    if (t === 'spouse') return 'Spouse';
    return stripDangerousText(value);
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

export function validateVisaNumber(value, { requireUnique = false, existingNumbers = [], skipNumber = '' } = {}) {
    const normalized = normalizeVisaNumber(value);
    if (!normalized) return 'Visa Number is required';
    if (normalized.length < 5) return 'Visa Number must be at least 5 characters';
    if (normalized.length > 20) return 'Visa Number must be no more than 20 characters';
    if (!VISA_NUMBER_REGEX.test(normalized)) {
        return 'Visa Number may contain only letters and numbers (A–Z, a–z, 0–9)';
    }
    if (requireUnique) {
        const skip = normalizeVisaNumber(skipNumber);
        for (const other of existingNumbers) {
            const n = normalizeVisaNumber(other);
            if (n && n === normalized && n !== skip) {
                return 'Visa Number must be unique';
            }
        }
    }
    return '';
}

export function validateVisaIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    const today = startOfDay(new Date());
    if (d > today) return 'Issue Date cannot be in the future';
    return '';
}

export function validateVisaExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validateVisaSponsor(value) {
    const sponsor = normalizeVisaSponsor(value);
    if (!sponsor) return 'Visa Sponsor is required';
    if (sponsor.length < 2) return 'Visa Sponsor must be at least 2 characters';
    if (sponsor.length > 100) return 'Visa Sponsor must be no more than 100 characters';
    if (!VISA_SPONSOR_REGEX.test(sponsor)) {
        return 'Visa Sponsor may contain only letters and spaces';
    }
    return '';
}

export function validateVisaPdfFile(file) {
    if (!file) return 'Visa document is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Visa document cannot be empty';
    return '';
}

export function collectEmploymentVisaNumbersFromOwners(owners = [], { skipOwnerIndex = -1 } = {}) {
    const numbers = [];
    owners.forEach((owner, idx) => {
        if (idx === skipOwnerIndex) return;
        const n = owner?.employmentVisa?.number;
        if (n) numbers.push(n);
        const legacyType = normalizeVisaTypeLabel(owner?.visa?.type).toLowerCase();
        if (legacyType === 'employment' && owner?.visa?.number) {
            numbers.push(owner.visa.number);
        }
    });
    return numbers;
}

export function validateOwnerVisaFields(data, opts = {}) {
    const errors = {};
    const {
        visaDocKey = 'visitVisa',
        owners = [],
        ownerIndex = -1,
        requireAttachment = true,
    } = opts;

    const requireUnique = visaDocKey === 'employmentVisa';
    const existingNumbers = requireUnique
        ? collectEmploymentVisaNumbersFromOwners(owners, { skipOwnerIndex: ownerIndex })
        : [];
    const skipNumber = owners[ownerIndex]?.[visaDocKey]?.number || '';

    const numberErr = validateVisaNumber(data?.number, {
        requireUnique,
        existingNumbers,
        skipNumber,
    });
    if (numberErr) errors.number = numberErr;

    const issueErr = validateVisaIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateVisaExpiryDate(data?.expiryDate, data?.issueDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    if (visaDocKey === 'employmentVisa' || visaDocKey === 'spouseVisa') {
        const sponsorErr = validateVisaSponsor(data?.sponsor);
        if (sponsorErr) errors.sponsor = sponsorErr;
    }

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Visa document is required';
    }

    return errors;
}

export function normalizeOwnerVisaPayload(data, visaDocKey = 'visitVisa') {
    const payload = {
        number: normalizeVisaNumber(data?.number),
        type: normalizeVisaTypeLabel(
            data?.type ||
                (visaDocKey === 'visitVisa' ? 'Visit' : visaDocKey === 'spouseVisa' ? 'Spouse' : 'Employment'),
        ),
        issueDate: data?.issueDate || '',
        expiryDate: data?.expiryDate || '',
        attachment: data?.publicId || data?.attachment || null,
    };
    if (visaDocKey === 'employmentVisa' || visaDocKey === 'spouseVisa') {
        payload.sponsor = normalizeVisaSponsor(data?.sponsor);
    }
    return payload;
}
