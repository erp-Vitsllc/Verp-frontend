import { Country } from 'country-state-city';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import en from 'react-phone-number-input/locale/en.json';
import { validateOwnerSharePercentage } from './tradeLicenseValidation';

const FULL_NAME_REGEX = /^[A-Za-z\s.-]{3,100}$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function phoneCountryLabel(countryCode) {
    if (!countryCode) return 'this country';
    return en[countryCode] || countryCode;
}

const VALID_COUNTRY_NAMES = new Set(
    Country.getAllCountries().map((c) => String(c.name || '').trim()).filter(Boolean),
);

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeOwnerFullName(value) {
    return stripDangerousText(value);
}

export function normalizeOwnerEmail(value) {
    const raw = stripDangerousText(value).replace(/\s/g, '');
    return raw ? raw.toLowerCase() : '';
}

export function normalizeOwnerPhone(value) {
    const stripped = stripDangerousText(value).replace(/[\s\-()]/g, '');
    if (!stripped) return '';
    if (stripped.startsWith('+')) {
        const digits = stripped.slice(1).replace(/\D/g, '');
        return digits ? `+${digits}` : '';
    }
    return stripped.replace(/\D/g, '');
}

/** Per-owner: activated profile requires all rows; otherwise only rows with contact/nationality set. */
export function ownerRowNeedsDetailValidation(owner, profileActive = false) {
    if (profileActive) return true;
    return (
        String(owner?.phone || '').trim() !== '' ||
        String(owner?.nationality || '').trim() !== ''
    );
}

export function normalizeOwnerNationality(value) {
    return stripDangerousText(value);
}

export function validateOwnerFullName(value) {
    const name = normalizeOwnerFullName(value);
    if (!name) return 'Full Name is required';
    if (name.length < 3) return 'Full Name must be at least 3 characters';
    if (name.length > 100) return 'Full Name must be no more than 100 characters';
    if (!FULL_NAME_REGEX.test(name)) {
        return 'Full Name may contain only letters, spaces, and . -';
    }
    return '';
}

export function validateOwnerEmail(value, { requireEmail = false } = {}) {
    const email = normalizeOwnerEmail(value);
    if (!email) {
        return requireEmail ? 'Email Address is required' : '';
    }
    if (email.length < 5) return 'Email Address must be at least 5 characters';
    if (email.length > 150) return 'Email Address must be no more than 150 characters';
    if (!EMAIL_REGEX.test(email)) return 'Email Address must be a valid email format';
    return '';
}

export function validateOwnerPhone(value) {
    const phone = normalizeOwnerPhone(value);
    if (!phone) return 'Contact Number is required';

    const e164 = phone.startsWith('+') ? phone : `+${phone}`;
    const digitCount = e164.replace(/\D/g, '').length;
    if (digitCount < 7 || digitCount > 15) {
        return 'Contact Number must be 7–15 digits; optional leading + only';
    }

    if (!isValidPhoneNumber(e164)) {
        try {
            const parsed = parsePhoneNumber(e164);
            if (parsed?.country) {
                const cName = phoneCountryLabel(parsed.country);
                const nationalLen = String(parsed.nationalNumber || '').length;
                if (nationalLen > 10) {
                    return `Phone number is too long for ${cName}`;
                }
                return `Phone number is too short for ${cName}`;
            }
        } catch {
            /* use generic message below */
        }
        return 'Please enter a valid contact number';
    }
    return '';
}

export function validateOwnerNationality(value) {
    const nationality = normalizeOwnerNationality(value);
    if (!nationality) return 'Nationality is required';
    if (!VALID_COUNTRY_NAMES.has(nationality)) {
        return 'Nationality must be selected from the country list';
    }
    return '';
}

export { validateOwnerSharePercentage };

export function validateOwnerEmailUniqueAmongOwners(email, owners = [], skipIndex = -1) {
    const normalized = normalizeOwnerEmail(email);
    if (!normalized) return '';
    for (let i = 0; i < owners.length; i++) {
        if (i === skipIndex) continue;
        const other = normalizeOwnerEmail(owners[i]?.email);
        if (other && other === normalized) {
            return 'Email Address must be unique among owners';
        }
    }
    return '';
}

/** Redistribute owners below the changed row when share changes (total must stay 100%). */
export function redistributeOwnerShares(owners = [], changedIndex, rawShareValue) {
    const newOwners = (owners || []).map((o) => ({ ...o }));
    if (!newOwners.length) return newOwners;

    if (newOwners.length === 1) {
        newOwners[0].sharePercentage = '100';
        return newOwners;
    }

    const belowIndices = newOwners.map((_, i) => i).filter((i) => i > changedIndex);
    const sumAbove = newOwners
        .slice(0, changedIndex)
        .reduce((sum, o) => sum + (Number(o.sharePercentage) || 0), 0);
    const minBelowTotal = belowIndices.length * 0.01;
    const maxForChanged = Math.max(0.01, 100 - sumAbove - minBelowTotal);

    const parsed = Number(String(rawShareValue ?? '').trim());
    let newValue = Math.max(0.01, Number.isFinite(parsed) ? parsed : 0.01);
    newValue = Math.min(maxForChanged, newValue);

    newOwners[changedIndex] = {
        ...newOwners[changedIndex],
        sharePercentage: Number.isInteger(newValue) ? String(newValue) : newValue.toFixed(2),
    };

    if (!belowIndices.length) {
        return fixOwnerSharesTo100(newOwners);
    }

    const remaining = 100 - sumAbove - newValue;
    const currentSumBelow = belowIndices.reduce(
        (sum, i) => sum + (Number(newOwners[i].sharePercentage) || 0),
        0,
    );

    belowIndices.forEach((i) => {
        let newShare;
        if (currentSumBelow === 0) {
            newShare = remaining / belowIndices.length;
        } else {
            const ratio = (Number(newOwners[i].sharePercentage) || 0) / currentSumBelow;
            newShare = remaining * ratio;
        }
        if (newShare < 0.01) newShare = 0.01;
        newOwners[i] = {
            ...newOwners[i],
            sharePercentage: Number.isInteger(newShare) ? String(newShare) : newShare.toFixed(2),
        };
    });

    return fixOwnerSharesTo100(newOwners);
}

export function fixOwnerSharesTo100(owners = []) {
    if (!owners.length) return owners;
    const rows = owners.map((o) => ({ ...o }));
    if (rows.length === 1) {
        rows[0].sharePercentage = '100';
        return rows;
    }
    let total = rows.reduce((s, o) => s + (Number(o.sharePercentage) || 0), 0);
    if (Math.round(total * 100) / 100 === 100) return rows;
    const last = rows.length - 1;
    const sumOthers = rows.slice(0, last).reduce((s, o) => s + (Number(o.sharePercentage) || 0), 0);
    const adjusted = Math.max(0.01, 100 - sumOthers);
    rows[last].sharePercentage = Number.isInteger(adjusted) ? String(adjusted) : adjusted.toFixed(2);
    return rows;
}

export function redistributeOwnerSharesEqually(owners = []) {
    if (!owners.length) return [];
    const equalShare = (100 / owners.length).toFixed(2);
    const rows = owners.map((o) => ({ ...o, sharePercentage: equalShare }));
    return fixOwnerSharesTo100(rows);
}

/**
 * @param {object} data modal fields
 * @param {object} opts
 */
export function validateOwnerDetailsFields(data, opts = {}) {
    const errors = {};
    const {
        requireEmail = false,
        owners = [],
        ownerIndex = -1,
    } = opts;

    const nameErr = validateOwnerFullName(data?.name);
    if (nameErr) errors.name = nameErr;

    const emailErr = validateOwnerEmail(data?.email, { requireEmail });
    if (emailErr) errors.email = emailErr;
    else {
        const uniqueErr = validateOwnerEmailUniqueAmongOwners(data?.email, owners, ownerIndex);
        if (uniqueErr) errors.email = uniqueErr;
    }

    const phoneErr = validateOwnerPhone(data?.phone);
    if (phoneErr) errors.phone = phoneErr;

    const natErr = validateOwnerNationality(data?.nationality);
    if (natErr) errors.nationality = natErr;

    const shareErr = validateOwnerSharePercentage(data?.sharePercentage);
    if (shareErr) errors.percentage = shareErr;

    return errors;
}

export function normalizeOwnerDetailsPayload(data) {
    return {
        name: normalizeOwnerFullName(data?.name),
        email: normalizeOwnerEmail(data?.email),
        phone: normalizeOwnerPhone(data?.phone),
        nationality: normalizeOwnerNationality(data?.nationality),
        sharePercentage: String(data?.sharePercentage ?? '').trim(),
    };
}

/** Validates all owners (activation requires profileActive — every owner row complete, shares = 100%). */
export function validateOwnerDetailsOwnersPayload(
    owners = [],
    { requireEmail = false, profileActive = false } = {},
) {
    if (!Array.isArray(owners) || owners.length === 0) {
        return { ok: false, message: 'At least one owner is required' };
    }

    const emails = new Set();

    for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        const nameErr = validateOwnerFullName(owner?.name);
        if (nameErr) return { ok: false, message: nameErr };

        const shareErr = validateOwnerSharePercentage(owner?.sharePercentage);
        if (shareErr) return { ok: false, message: shareErr };

        if (!ownerRowNeedsDetailValidation(owner, profileActive)) continue;

        const emailErr = validateOwnerEmail(owner?.email, {
            requireEmail: profileActive || requireEmail,
        });
        if (emailErr) return { ok: false, message: emailErr };

        const emailKey = normalizeOwnerEmail(owner?.email);
        if (emailKey) {
            if (emails.has(emailKey)) {
                return { ok: false, message: 'Email Address must be unique among owners' };
            }
            emails.add(emailKey);
        }

        const phoneErr = validateOwnerPhone(owner?.phone);
        if (phoneErr) return { ok: false, message: phoneErr };

        const natErr = validateOwnerNationality(owner?.nationality);
        if (natErr) return { ok: false, message: natErr };
    }

    let total = 0;
    for (const owner of owners) {
        total += Number(owner.sharePercentage);
    }
    if (Math.round(total * 100) / 100 !== 100) {
        return {
            ok: false,
            message: `Total owner share must equal exactly 100% (currently ${Math.round(total * 100) / 100}%)`,
        };
    }

    return { ok: true };
}
