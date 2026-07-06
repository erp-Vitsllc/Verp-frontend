/** Shared strict validation for Violation → Vehicle Fine forms */

import {
    shouldValidateFineDeductionSchedule,
    validateFineDeductionVsVisa,
} from './validateFineDeductionVsVisa';

export const VEHICLE_FINE_LIMITS = {
    maxFineAmount: 999999.99,
    minFineAmount: 0.01,
    maxServiceCharge: 999999.99,
    minDescriptionLength: 10,
    maxDescriptionLength: 2000,
    minCompanyDescriptionLength: 10,
    maxCompanyDescriptionLength: 1000,
    maxAttachmentBytes: 5 * 1024 * 1024,
    payableDurationMin: 1,
    payableDurationMax: 6,
};

export const VEHICLE_FINE_ALLOWED_MIME = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
];

export function getVehicleFinePayableTotal(fineAmount, serviceCharge) {
    const baseFine = parseMoney(fineAmount) ?? 0;
    const charge = parseMoney(serviceCharge) ?? 0;
    return baseFine + charge;
}

const PLACEHOLDER_VEHICLE = /^test-v\d*$/i;

export function isPlaceholderVehicleId(vehicleId) {
    return PLACEHOLDER_VEHICLE.test(String(vehicleId || '').trim());
}

function parseMoney(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function hasAtMostTwoDecimals(value) {
    const s = String(value).trim();
    if (!s.includes('.')) return true;
    const frac = s.split('.')[1];
    return frac.length <= 2;
}

function isMeaningfulText(value, minLen) {
    const t = String(value || '').trim();
    if (t.length < minLen) return false;
    return /[a-zA-Z0-9\u0600-\u06FF]/.test(t);
}

function validateMonthStart(yyyyMM, { required }) {
    const raw = String(yyyyMM || '').trim();
    if (!raw) {
        return required ? 'Month start is required' : null;
    }
    if (!/^\d{4}-\d{2}$/.test(raw)) return 'Month start must be YYYY-MM';
    const [y, m] = raw.split('-').map(Number);
    if (m < 1 || m > 12) return 'Invalid month';
    const start = new Date(y, m - 1, 1);
    const now = new Date();
    const earliest = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const latest = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    if (start < earliest) return 'Month start cannot be more than 12 months in the past';
    if (start > latest) return 'Month start cannot be more than 3 months in the future';
    return null;
}

/**
 * @param {object} input
 * @param {{ mode?: 'draft'|'strict', employeeIds?: string[], hasExistingAttachment?: boolean }} options
 */
export function validateVehicleFine(input, options = {}) {
    const { mode = 'strict', employeeIds = [], hasExistingAttachment = false } = options;
    const isDraft = mode === 'draft';
    const errors = {};

    const vehicleId = String(input.vehicleId || '').trim();
    const employeeId = String(input.employeeId || '').trim();
    const responsibleFor = String(input.responsibleFor || 'Employee').trim();
    const companyId = String(input.companyId || '').trim();

    if (!vehicleId) {
        errors.vehicleId = 'Vehicle is required';
    } else if (isPlaceholderVehicleId(vehicleId)) {
        errors.vehicleId = 'Please select a valid vehicle from the fleet list';
    }

    if (!employeeId) {
        errors.employeeId = 'Employee is required';
    } else if (employeeIds.length > 0 && !employeeIds.includes(employeeId)) {
        errors.employeeId = 'Please select a valid employee from the list';
    }

    const baseFine = parseMoney(input.fineAmount);
    const serviceCharge = parseMoney(input.serviceCharge) ?? 0;
    const grandTotal =
        baseFine !== null ? baseFine + serviceCharge : serviceCharge > 0 ? serviceCharge : null;

    if (input.fineAmount === '' || input.fineAmount === null || input.fineAmount === undefined) {
        if (!isDraft) errors.fineAmount = 'Fine amount is required';
    } else if (!hasAtMostTwoDecimals(input.fineAmount)) {
        errors.fineAmount = 'Amount can have at most 2 decimal places';
    } else if (baseFine === null) {
        errors.fineAmount = 'Enter a valid fine amount';
    } else if (baseFine < VEHICLE_FINE_LIMITS.minFineAmount) {
        errors.fineAmount = `Fine amount must be at least AED ${VEHICLE_FINE_LIMITS.minFineAmount}`;
    } else if (baseFine > VEHICLE_FINE_LIMITS.maxFineAmount) {
        errors.fineAmount = `Fine amount cannot exceed AED ${VEHICLE_FINE_LIMITS.maxFineAmount.toLocaleString()}`;
    }

    if (input.serviceCharge !== '' && input.serviceCharge != null) {
        if (!hasAtMostTwoDecimals(input.serviceCharge)) {
            errors.serviceCharge = 'Service charge can have at most 2 decimal places';
        } else if (serviceCharge < 0) {
            errors.serviceCharge = 'Service charge cannot be negative';
        } else if (serviceCharge > VEHICLE_FINE_LIMITS.maxServiceCharge) {
            errors.serviceCharge = 'Service charge is too large';
        }
    }

    if (
        grandTotal !== null &&
        grandTotal > VEHICLE_FINE_LIMITS.maxFineAmount + VEHICLE_FINE_LIMITS.maxServiceCharge
    ) {
        errors.fineAmount = 'Combined fine and service charge total is too large';
    }

    const validResponsible = ['Employee', 'Company', 'Employee & Company'];
    if (!validResponsible.includes(responsibleFor)) {
        errors.responsibleFor = 'Select who is responsible for this fine';
    }

    if (responsibleFor === 'Employee & Company') {
        const empAmt = parseMoney(input.employeeAmount);
        const compAmt = parseMoney(input.companyAmount);

        if (input.employeeAmount === '' || input.employeeAmount == null) {
            errors.employeeAmount = 'Employee amount is required';
        } else if (!hasAtMostTwoDecimals(input.employeeAmount)) {
            errors.employeeAmount = 'Employee amount can have at most 2 decimal places';
        } else if (empAmt === null || empAmt < VEHICLE_FINE_LIMITS.minFineAmount) {
            errors.employeeAmount = 'Enter a valid employee amount greater than 0';
        }

        if (input.companyAmount === '' || input.companyAmount == null) {
            errors.companyAmount = 'Company amount is required';
        } else if (!hasAtMostTwoDecimals(input.companyAmount)) {
            errors.companyAmount = 'Company amount can have at most 2 decimal places';
        } else if (compAmt === null || compAmt < VEHICLE_FINE_LIMITS.minFineAmount) {
            errors.companyAmount = 'Enter a valid company amount greater than 0';
        }

        if (grandTotal !== null && empAmt !== null && compAmt !== null) {
            const sum = empAmt + compAmt + serviceCharge;
            if (Math.abs(sum - grandTotal) > 0.01) {
                errors.amountMismatch = `Employee (AED ${empAmt.toFixed(2)}) + company (AED ${compAmt.toFixed(2)}) + service charge (AED ${serviceCharge.toFixed(2)}) must equal total (AED ${grandTotal.toFixed(2)})`;
            }
        }
    }

    const desc = String(input.description || '');
    if (!isDraft) {
        if (!isMeaningfulText(desc, VEHICLE_FINE_LIMITS.minDescriptionLength)) {
            errors.description = `Description is required (at least ${VEHICLE_FINE_LIMITS.minDescriptionLength} characters)`;
        } else if (desc.trim().length > VEHICLE_FINE_LIMITS.maxDescriptionLength) {
            errors.description = `Description cannot exceed ${VEHICLE_FINE_LIMITS.maxDescriptionLength} characters`;
        }
    } else if (desc.trim() && !isMeaningfulText(desc, 3)) {
        errors.description = 'Description must be at least 3 characters when provided';
    } else if (desc.trim().length > VEHICLE_FINE_LIMITS.maxDescriptionLength) {
        errors.description = `Description cannot exceed ${VEHICLE_FINE_LIMITS.maxDescriptionLength} characters`;
    }

    const needsCompany = responsibleFor === 'Company' || responsibleFor === 'Employee & Company';
    if (needsCompany && !isDraft && !companyId) {
        errors.company = 'Company selection is required';
    }

    if (needsCompany && !isDraft) {
        const compDesc = String(input.companyDescription || '');
        if (!isMeaningfulText(compDesc, VEHICLE_FINE_LIMITS.minCompanyDescriptionLength)) {
            errors.companyDescription = `Company description is required (at least ${VEHICLE_FINE_LIMITS.minCompanyDescriptionLength} characters)`;
        } else if (compDesc.trim().length > VEHICLE_FINE_LIMITS.maxCompanyDescriptionLength) {
            errors.companyDescription = `Company description cannot exceed ${VEHICLE_FINE_LIMITS.maxCompanyDescriptionLength} characters`;
        }
    }

    if (responsibleFor !== 'Company') {
        const duration = parseInt(String(input.payableDuration || ''), 10);
        if (!isDraft) {
            if (!Number.isFinite(duration)) {
                errors.payableDuration = 'Fine payable duration is required';
            } else if (
                duration < VEHICLE_FINE_LIMITS.payableDurationMin ||
                duration > VEHICLE_FINE_LIMITS.payableDurationMax
            ) {
                errors.payableDuration = `Duration must be between ${VEHICLE_FINE_LIMITS.payableDurationMin} and ${VEHICLE_FINE_LIMITS.payableDurationMax} months`;
            }
        }
    }

    const monthErr = validateMonthStart(input.monthStart, {
        required: !isDraft && responsibleFor !== 'Company',
    });
    if (monthErr) errors.monthStart = monthErr;

    if (!isDraft && shouldValidateFineDeductionSchedule(responsibleFor)) {
        const visaErrors = validateFineDeductionVsVisa({
            monthStart: input.monthStart,
            payableDuration: input.payableDuration,
            employee: options.employee,
            employeeLabel: options.employeeLabel,
        });
        if (visaErrors) {
            Object.assign(errors, visaErrors);
        }
    }

    if (!isDraft && !hasExistingAttachment && !input.attachmentBase64) {
        errors.attachment = 'Supporting document is required (PDF, JPG, or PNG)';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}
