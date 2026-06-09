import { Country, State } from 'country-state-city';
import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';

export const EMPLOYEE_ADD_PATTERNS = {
    PERSON_NAME: /^[A-Za-z\s'-]{2,50}$/,
    FATHER_NAME: /^[A-Za-z\s'.-]{2,100}$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    ADDRESS: /^[A-Za-z0-9\s#/,.\-]{5,255}$/,
    APARTMENT: /^[A-Za-z0-9\s/-]{1,50}$/,
    CITY: /^[A-Za-z\s'-]{2,100}$/,
    POSTAL_CODE: /^[A-Za-z0-9\s-]{3,20}$/,
    DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
    SALARY_AMOUNT: /^\d+(\.\d{1,2})?$/,
};

const GENDER_VALUES = ['male', 'female', 'other'];
const COUNTRY_ISO_CODES = new Set(Country.getAllCountries().map((c) => c.isoCode));
const COUNTRY_NAMES = new Set(Country.getAllCountries().map((c) => c.name.toUpperCase()));

export function getCountryIsoCode(nameOrCode) {
    if (!nameOrCode) return '';
    const trimmed = String(nameOrCode).trim();
    if (trimmed.length === 2) {
        return trimmed.toUpperCase();
    }
    const country = Country.getAllCountries().find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.isoCode.toLowerCase() === trimmed.toLowerCase()
    );
    return country ? country.isoCode : trimmed.toUpperCase();
}

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function isActiveCompany(company) {
    return String(company?.status || '').toLowerCase() === 'active';
}

function ok(error = '') {
    return { isValid: !error, error };
}

function parseIsoDate(value) {
    if (!value || !EMPLOYEE_ADD_PATTERNS.DATE_ISO.test(value)) return null;
    const [y, m, day] = value.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
    return d;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function calculateAgeOnDate(birthIso, onIso) {
    const birth = parseIsoDate(birthIso);
    const on = parseIsoDate(onIso);
    if (!birth || !on) return null;
    let age = on.getFullYear() - birth.getFullYear();
    const md = on.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && on.getDate() < birth.getDate())) age--;
    return age;
}

export function sanitizePersonNameInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z\s'-]/g, '').slice(0, 50);
}

export function sanitizeFatherNameInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z\s'.-]/g, '').slice(0, 100);
}

export function sanitizeAddressInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z0-9\s#/,.\-]/g, '').slice(0, 255);
}

export function sanitizeApartmentInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z0-9\s/-]/g, '').slice(0, 50);
}

export function sanitizeCityInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z\s'-]/g, '').slice(0, 100);
}

export function sanitizePostalInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z0-9\s-]/g, '').slice(0, 20);
}

export function validateCompany(companyId, companies = []) {
    if (!companyId) return ok('Company is required');
    const found = companies.find((c) => String(c._id) === String(companyId));
    if (!found) return ok('Please select a valid company from the list');
    if (!isActiveCompany(found)) return ok('Only active companies can be selected');
    return ok();
}

export function validatePersonName(value, label = 'Name') {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok(`${label} is required`);
    if (!EMPLOYEE_ADD_PATTERNS.PERSON_NAME.test(cleaned)) {
        return ok(`${label} must be 2–50 characters; letters, spaces, apostrophe and hyphen only`);
    }
    return ok();
}

export function validateEmployeeId(value) {
    const cleaned = stripDangerousText(value).replace(/\s+/g, '').toUpperCase();
    if (!cleaned) return ok('Employee ID is required');
    return ok();
}

export function validateEmployeeEmail(value) {
    const cleaned = stripDangerousText(value).toLowerCase();
    if (!cleaned) return ok('Email is required');
    if (cleaned.length > 254) return ok('Email must be no more than 254 characters');
    if (/\.\./.test(cleaned)) return ok('Email cannot contain consecutive dots');
    if (!EMPLOYEE_ADD_PATTERNS.EMAIL.test(cleaned)) {
        return ok('Please enter a valid email address');
    }
    return ok();
}

export function validateInternationalPhone(phoneNumber, defaultCountry = 'AE') {
    const cleaned = stripDangerousText(phoneNumber).replace(/\s/g, '');
    if (!cleaned) return ok('Contact number is required');
    if (!/^\+?\d+$/.test(cleaned)) {
        return ok('Phone number may contain digits only, with optional leading +');
    }
    const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    const iso = String(defaultCountry || 'AE').length === 2
        ? defaultCountry.toUpperCase()
        : 'AE';
    try {
        const parsed = parsePhoneNumberFromString(withPlus, iso);
        if (!parsed || !isValidPhoneNumber(parsed.number)) {
            return ok('Please enter a valid international phone number');
        }
        const len = String(parsed.nationalNumber || '').length;
        if (len < 8 || len > 15) {
            return ok('Phone number must be between 8 and 15 digits (excluding country code)');
        }
        return ok();
    } catch {
        return ok('Please enter a valid international phone number');
    }
}

export function validateDateOfJoining(value, { dateOfBirth } = {}) {
    const d = parseIsoDate(value);
    if (!d) return ok('Date of Joining is required and must be a valid date');
    const today = startOfDay(new Date());
    const joining = startOfDay(d);
    if (joining > today) return ok('Date of Joining cannot be in the future');
    if (dateOfBirth) {
        const dob = parseIsoDate(dateOfBirth);
        if (dob) {
            if (joining <= startOfDay(dob)) {
                return ok('Date of Joining must be after Date of Birth');
            }
            const ageAtJoin = calculateAgeOnDate(dateOfBirth, value);
            if (ageAtJoin !== null && ageAtJoin < 18) {
                return ok('Employee must be at least 18 years old at the time of joining');
            }
        }
    }
    return ok();
}

export function validateContractJoiningDate(value, { dateOfJoining } = {}) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return ok();
    const d = parseIsoDate(trimmed);
    if (!d) return ok('Contract Joining Date must be a valid date');
    const today = startOfDay(new Date());
    const contract = startOfDay(d);
    if (contract > today) return ok('Contract Joining Date cannot be in the future');
    if (dateOfJoining) {
        const doj = parseIsoDate(dateOfJoining);
        if (doj && contract < startOfDay(doj)) {
            return ok('Contract Joining Date cannot be earlier than Date of Joining');
        }
    }
    return ok();
}

export function validateDateOfBirth(value) {
    const d = parseIsoDate(value);
    if (!d) return ok('Date of Birth is required and must be a valid date');
    const today = startOfDay(new Date());
    const dob = startOfDay(d);
    if (dob >= today) return ok('Date of Birth cannot be today or in the future');
    const age = calculateAgeOnDate(value, formatTodayIso());
    if (age !== null && age < 18) return ok('Employee must be at least 18 years old');
    if (age !== null && age > 100) return ok('Employee age must not exceed 100 years');
    return ok();
}

function formatTodayIso() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function validateNationality(isoCode) {
    const code = String(isoCode || '').trim().toUpperCase();
    if (!code) return ok('Nationality is required');
    if (!COUNTRY_ISO_CODES.has(code) && !COUNTRY_NAMES.has(code)) {
        return ok('Please select a valid nationality from the list');
    }
    return ok();
}

export function validateGender(value) {
    if (!value) return ok('Gender is required');
    if (!GENDER_VALUES.includes(String(value).toLowerCase())) {
        return ok('Gender must be Male, Female, or Other');
    }
    return ok();
}

export function validateFatherName(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok("Father's Name is required");
    if (!EMPLOYEE_ADD_PATTERNS.FATHER_NAME.test(cleaned)) {
        return ok("Father's Name must be 2–100 characters; letters, spaces, apostrophe, period and hyphen only");
    }
    return ok();
}

export function validateAddress(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok('Address is required');
    if (!EMPLOYEE_ADD_PATTERNS.ADDRESS.test(cleaned)) {
        return ok('Address must be 5–255 characters using letters, numbers and common address symbols');
    }
    return ok();
}

export function validateApartment(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok('Apartment / Villa / Flat is required');
    if (!EMPLOYEE_ADD_PATTERNS.APARTMENT.test(cleaned)) {
        return ok('Apartment / Villa / Flat must be 1–50 characters');
    }
    return ok();
}

export function validateCountryIso(isoCode) {
    if (!isoCode) return ok('Country is required');
    if (!COUNTRY_ISO_CODES.has(isoCode)) {
        return ok('Please select a valid country from the list');
    }
    return ok();
}

export function validateStateForCountry(stateIso, countryIso) {
    if (!stateIso) return ok('State is required');
    if (!countryIso) return ok('Please select a country first');
    const states = State.getStatesOfCountry(countryIso);
    if (!states.some((s) => s.isoCode === stateIso)) {
        return ok('State must belong to the selected country');
    }
    return ok();
}

export function validateCity(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok('City is required');
    if (!EMPLOYEE_ADD_PATTERNS.CITY.test(cleaned)) {
        return ok('City must be 2–100 characters; letters, spaces, apostrophe and hyphen only');
    }
    return ok();
}

export function validatePostalCode(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok();
    if (!EMPLOYEE_ADD_PATTERNS.POSTAL_CODE.test(cleaned)) {
        return ok('Postal code must be 3–20 characters (letters, numbers and hyphens)');
    }
    return ok();
}

export function validateMonthlySalary(value) {
    const str = String(value ?? '').trim();
    if (!str) return ok('Monthly salary is required');
    if (!EMPLOYEE_ADD_PATTERNS.SALARY_AMOUNT.test(str)) {
        return ok('Monthly salary must be a positive number with up to 2 decimal places');
    }
    const num = parseFloat(str);
    if (num <= 0) return ok('Monthly salary must be greater than 0');
    return ok();
}

function validateAllowanceAmount(value, label, monthly) {
    const str = String(value ?? '').trim();
    if (!str) return ok(`${label} is required`);
    if (!EMPLOYEE_ADD_PATTERNS.SALARY_AMOUNT.test(str)) {
        return ok(`${label} must be a valid number with up to 2 decimal places`);
    }
    const num = parseFloat(str);
    if (num < 0) return ok(`${label} cannot be negative`);
    if (num > monthly) return ok(`${label} cannot exceed monthly salary`);
    return ok();
}

function validateAllowancePercent(value, label) {
    const str = String(value ?? '').trim();
    if (str === '') return ok(`${label} percentage is required`);
    const num = parseFloat(str);
    if (Number.isNaN(num) || num < 0 || num > 100) {
        return ok(`${label} percentage must be between 0 and 100`);
    }
    return ok();
}

export function validateSalaryBreakup(salaryDetails, visibleAllowances = {}) {
    const errors = {};
    const monthlyResult = validateMonthlySalary(salaryDetails.monthlySalary);
    if (!monthlyResult.isValid) errors.monthlySalary = monthlyResult.error;

    const monthly = parseFloat(salaryDetails.monthlySalary) || 0;
    if (monthlyResult.isValid) {
        const basicR = validateAllowanceAmount(salaryDetails.basic, 'Basic salary', monthly);
        if (!basicR.isValid) errors.basic = basicR.error;

        const basicPctR = validateAllowancePercent(salaryDetails.basicPercentage, 'Basic');
        if (!basicPctR.isValid) errors.basicPercentage = basicPctR.error;

        if (visibleAllowances.other) {
            const otherR = validateAllowanceAmount(salaryDetails.otherAllowance, 'Other allowance', monthly);
            if (!otherR.isValid) errors.otherAllowance = otherR.error;
            const otherPctR = validateAllowancePercent(salaryDetails.otherPercentage, 'Other allowance');
            if (!otherPctR.isValid) errors.otherPercentage = otherPctR.error;
        }

        const optionalAllowances = [
            ['houseRent', 'houseRentAllowance', 'houseRentPercentage', 'House rent allowance'],
            ['vehicle', 'vehicleAllowance', 'vehiclePercentage', 'Vehicle allowance'],
            ['fuel', 'fuelAllowance', 'fuelPercentage', 'Fuel allowance'],
        ];
        optionalAllowances.forEach(([key, amountField, pctField, label]) => {
            if (!visibleAllowances[key]) return;
            const amt = salaryDetails[amountField];
            if (amt !== '' && amt !== undefined && amt !== null) {
                const r = validateAllowanceAmount(amt, label, monthly);
                if (!r.isValid) errors[amountField] = r.error;
            }
            const pct = salaryDetails[pctField];
            if (pct !== '' && pct !== undefined && pct !== null) {
                const r = validateAllowancePercent(pct, label);
                if (!r.isValid) errors[pctField] = r.error;
            }
        });

        let totalAmount = parseFloat(salaryDetails.basic) || 0;
        if (visibleAllowances.houseRent) totalAmount += parseFloat(salaryDetails.houseRentAllowance) || 0;
        if (visibleAllowances.vehicle) totalAmount += parseFloat(salaryDetails.vehicleAllowance) || 0;
        if (visibleAllowances.fuel) totalAmount += parseFloat(salaryDetails.fuelAllowance) || 0;
        if (visibleAllowances.other) totalAmount += parseFloat(salaryDetails.otherAllowance) || 0;
        (salaryDetails.additionalAllowances || []).forEach((item, i) => {
            totalAmount += parseFloat(item.amount) || 0;
        });

        if (Math.abs(totalAmount - monthly) > 0.01) {
            errors.monthlySalary = `Salary components (AED ${totalAmount.toFixed(2)}) must equal monthly salary (AED ${monthly.toFixed(2)})`;
        }

        let totalPct = parseFloat(salaryDetails.basicPercentage) || 0;
        if (visibleAllowances.houseRent) totalPct += parseFloat(salaryDetails.houseRentPercentage) || 0;
        if (visibleAllowances.vehicle) totalPct += parseFloat(salaryDetails.vehiclePercentage) || 0;
        if (visibleAllowances.fuel) totalPct += parseFloat(salaryDetails.fuelPercentage) || 0;
        if (visibleAllowances.other) totalPct += parseFloat(salaryDetails.otherPercentage) || 0;

        if (Math.abs(totalPct - 100) > 0.05) {
            errors.basicPercentage = `Salary percentages must total 100% (currently ${totalPct.toFixed(2)}%)`;
        }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Full form validation for Add Employee wizard.
 */
export function validateEmployeeAddForm({
    basicDetails,
    personalDetails,
    salaryDetails,
    visibleAllowances,
    companies,
    selectedCountryCode,
}) {
    const errors = { basic: {}, salary: {}, personal: {} };

    const set = (section, field, result) => {
        if (!result.isValid) errors[section][field] = result.error;
    };

    set('basic', 'company', validateCompany(basicDetails.company, companies));
    set('basic', 'firstName', validatePersonName(basicDetails.firstName, 'First name'));
    set('basic', 'lastName', validatePersonName(basicDetails.lastName, 'Last name'));
    set('basic', 'employeeId', validateEmployeeId(basicDetails.employeeId));
    set('basic', 'email', validateEmployeeEmail(basicDetails.email));
    set(
        'basic',
        'contactNumber',
        validateInternationalPhone(basicDetails.contactNumber, selectedCountryCode),
    );
    set(
        'basic',
        'dateOfJoining',
        validateDateOfJoining(basicDetails.dateOfJoining, {
            dateOfBirth: personalDetails.dateOfBirth,
        }),
    );
    set(
        'basic',
        'contractJoiningDate',
        validateContractJoiningDate(basicDetails.contractJoiningDate, {
            dateOfJoining: basicDetails.dateOfJoining,
        }),
    );

    const salaryResult = validateSalaryBreakup(salaryDetails, visibleAllowances);
    if (!salaryResult.isValid) errors.salary = salaryResult.errors;

    set('personal', 'dateOfBirth', validateDateOfBirth(personalDetails.dateOfBirth));
    set('personal', 'nationality', validateNationality(personalDetails.nationality));
    set('personal', 'gender', validateGender(personalDetails.gender));
    set('personal', 'fathersName', validateFatherName(personalDetails.fathersName));
    set('personal', 'addressLine1', validateAddress(personalDetails.addressLine1));
    set('personal', 'addressLine2', validateApartment(personalDetails.addressLine2));
    set('personal', 'country', validateCountryIso(personalDetails.country));
    set('personal', 'state', validateStateForCountry(personalDetails.state, personalDetails.country));
    set('personal', 'city', validateCity(personalDetails.city));
    set('personal', 'postalCode', validatePostalCode(personalDetails.postalCode));

    const hasBasic = Object.keys(errors.basic).length > 0;
    const hasSalary = Object.keys(errors.salary).length > 0;
    const hasPersonal = Object.keys(errors.personal).length > 0;

    let firstErrorStep = 1;
    if (hasBasic) firstErrorStep = 1;
    else if (hasSalary) firstErrorStep = 2;
    else if (hasPersonal) firstErrorStep = 3;

    return {
        isValid: !hasBasic && !hasSalary && !hasPersonal,
        errors,
        firstErrorStep,
    };
}

export function validateBasicStep({
    basicDetails,
    personalDetails,
    companies,
    selectedCountryCode,
}) {
    const errors = {};
    const checks = [
        ['company', validateCompany(basicDetails.company, companies)],
        ['firstName', validatePersonName(basicDetails.firstName, 'First name')],
        ['lastName', validatePersonName(basicDetails.lastName, 'Last name')],
        ['employeeId', validateEmployeeId(basicDetails.employeeId)],
        ['email', validateEmployeeEmail(basicDetails.email)],
        ['contactNumber', validateInternationalPhone(basicDetails.contactNumber, selectedCountryCode)],
        [
            'dateOfJoining',
            validateDateOfJoining(basicDetails.dateOfJoining, {
                dateOfBirth: personalDetails?.dateOfBirth,
            }),
        ],
        [
            'contractJoiningDate',
            validateContractJoiningDate(basicDetails.contractJoiningDate, {
                dateOfJoining: basicDetails.dateOfJoining,
            }),
        ],
    ];
    checks.forEach(([field, r]) => {
        if (!r.isValid) errors[field] = r.error;
    });
    return { isValid: Object.keys(errors).length === 0, errors };
}
