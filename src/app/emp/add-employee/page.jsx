'use client';

import { useState, useEffect, useMemo } from 'react';
import { DatePicker } from "@/components/ui/date-picker";
import { Country, State, City } from 'country-state-city';
import Select from 'react-select';
import BasicDetailsStep from './components/BasicDetailsStep';

const NAME_REGEX = /^[A-Za-z\s]+$/;
const normalizeForSort = (value = '') => (value || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
// const generateEmployeeId = () => Math.floor(10000 + Math.random() * 90000).toString();
const DEFAULT_PHONE_COUNTRY = 'AE';
const calculateAgeFromDate = (value) => {
    if (!value) return '';
    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age.toString() : '';
};

// Transform countries for react-select
const countryOptions = Country.getAllCountries().map(country => ({
    label: country.name,
    value: country.isoCode
}));

const selectStyles = {
    control: (provided, state) => ({
        ...provided,
        borderRadius: '0.5rem',
        borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
        boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
        paddingLeft: '0.25rem',
        minHeight: '44px'
    }),
    valueContainer: (provided) => ({
        ...provided,
        paddingLeft: '0.25rem'
    })
};
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axios from '@/utils/axios';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    validateRequired,
    validateEmail,
    validatePhoneNumber,
    validateName,
    validateNumber,
    validateInteger,
    validateDate,
    validateTextLength,
    extractCountryCode
} from '@/utils/validation';

export default function AddEmployee() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [showAddMoreModal, setShowAddMoreModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Track visibility of salary components - Basic and Other visible by default, others in Add More
    const [visibleAllowances, setVisibleAllowances] = useState({
        houseRent: false,
        vehicle: false,
        fuel: false,
        other: true // Other allowance visible by default
    });
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({
        basic: {},
        salary: {},
        personal: {}
    });
    const [selectedCountryCode, setSelectedCountryCode] = useState('ae'); // Default to UAE (ISO code)

    // Step 1: Basic Details
    const [basicDetails, setBasicDetails] = useState({
        firstName: '',
        lastName: '',
        employeeId: '',
        dateOfJoining: '',
        email: '',
        contactNumber: '',
        enablePortalAccess: false,
    });

    useEffect(() => {
        const fetchNextId = async () => {
            if (basicDetails.employeeId) return;

            try {
                const response = await axios.get('/Employee/next-id');
                if (response.data && response.data.nextEmployeeId) {
                    setBasicDetails(prev => ({ ...prev, employeeId: response.data.nextEmployeeId }));
                }
            } catch (error) {
                console.error('Failed to fetch next employee ID:', error);
                // Fallback or leave empty for manual entry
            }
        };

        fetchNextId();
    }, []);


    // Step 2: Salary Details
    const [salaryDetails, setSalaryDetails] = useState({
        monthlySalary: '', // This equals total salary
        basic: '',
        basicPercentage: 50, // Default 50%
        houseRentAllowance: '',
        houseRentPercentage: '',
        vehicleAllowance: '',
        vehiclePercentage: '',
        fuelAllowance: '',
        fuelPercentage: '',
        otherAllowance: '',
        otherPercentage: 50, // By default: Basic 50% + Other 50% = 100%
        additionalAllowances: [] // Array of { type, amount, percentage }
    });

    // Dynamic State Options
    const [stateOptions, setStateOptions] = useState([]);

    const [personalDetails, setPersonalDetails] = useState({
        dateOfBirth: '',
        age: '', // For display only, not sent to backend
        gender: '', // Moved from basicDetails
        nationality: '', // Added nationality
        fathersName: '',
        addressLine1: '',
        addressLine2: '',
        country: '',
        state: '',
        city: '',
        postalCode: ''
    });

    const steps = [
        { number: 1, title: 'Basic Details', description: 'Employee Details & Role Assignment' },
        { number: 2, title: 'Salary Details', description: 'Compensation & Benefits Setup' },
        { number: 3, title: 'Personal Details', description: 'Compensation & Benefits Setup' }
    ];

    const handleBasicDetailsChange = (field, value) => {
        setBasicDetails(prev => ({ ...prev, [field]: value }));

        // Clear error when user starts typing
        if (fieldErrors.basic[field]) {
            setFieldErrors(prev => ({
                ...prev,
                basic: {
                    ...prev.basic,
                    [field]: ''
                }
            }));
        }
    };

    const validateBasicDetailField = (field, value) => {
        let validation;

        switch (field) {
            case 'firstName':
            case 'lastName':
                validation = validateName(value, true);
                break;
            case 'contactNumber': {
                const countryCode = extractCountryCode(value) || selectedCountryCode;
                validation = validatePhoneNumber(value, countryCode, true);
                break;
            }
            case 'email':
                validation = validateEmail(value, true);
                break;
            case 'dateOfJoining':
                validation = validateDate(value, true);
                break;
            case 'employeeId':
                validation = validateRequired(value, 'Employee ID');
                break;
            default:
                validation = { isValid: true, error: '' };
        }

        if (!validation.isValid) {
            setFieldErrors(prev => ({
                ...prev,
                basic: {
                    ...prev.basic,
                    [field]: validation.error
                }
            }));
        }

        return validation.isValid;
    };

    const handleNameInput = (field, value) => {
        const sanitized = value.replace(/[^A-Za-z\s]/g, '');
        handleBasicDetailsChange(field, sanitized);

        // Validate name on change
        const validation = validateName(sanitized, true);
        setFieldErrors(prev => ({
            ...prev,
            basic: {
                ...prev.basic,
                [field]: validation.isValid ? '' : validation.error
            }
        }));
    };

    const handlePhoneChange = (value, country) => {
        // Remove all spaces from phone number
        const cleanedValue = value.replace(/\s/g, '');

        handleBasicDetailsChange('contactNumber', cleanedValue);

        // Extract country code - use ISO country code for libphonenumber-js
        // PhoneInputField provides country.countryCode (ISO code like 'ae') and country.dialCode (numeric like '971')
        let countryCode = selectedCountryCode; // default
        if (country) {
            // Prefer ISO country code (e.g., 'ae', 'in') for libphonenumber-js
            if (country.countryCode) {
                countryCode = country.countryCode; // ISO code (e.g., 'ae')
                setSelectedCountryCode(country.countryCode);
            } else if (country.dialCode) {
                // Fallback to dial code if countryCode not available
                countryCode = country.dialCode;
                setSelectedCountryCode(country.dialCode);
            }
        } else {
            // Try to extract from value if country object not provided
            const extracted = extractCountryCode(cleanedValue);
            if (extracted) {
                countryCode = extracted;
                setSelectedCountryCode(extracted);
            }
        }

        // Validate phone number using libphonenumber-js
        const validation = validatePhoneNumber(cleanedValue, countryCode, true);
        setFieldErrors(prev => ({
            ...prev,
            basic: {
                ...prev.basic,
                contactNumber: validation.isValid ? '' : validation.error
            }
        }));
    };

    const handleDateChange = (target, field, date) => {
        // DatePicker now returns "yyyy-MM-dd" string directly or empty string
        const formatted = date || '';
        if (target === 'basic') {
            handleBasicDetailsChange(field, formatted);
        } else {
            handlePersonalDetailsChange(field, formatted);
        }
    };

    // Helper function to round to nearest whole number (natural number)
    const roundToNatural = (num) => {
        return Math.round(parseFloat(num) || 0);
    };

    // Helper function to round percentage to 2 decimal places
    const roundPercentage = (num) => {
        return Math.round((parseFloat(num) || 0) * 100) / 100;
    };

    // Helper function to check if only Basic + Other Allowance exist
    const hasOnlyBasicAndOther = (prev) => {
        return !visibleAllowances.houseRent && !visibleAllowances.vehicle && !visibleAllowances.fuel;
    };

    // Helper function to ensure total consistency
    const ensureTotalConsistency = (updated, monthly) => {
        // Calculate current total
        let currentTotal = roundToNatural(updated.basic || 0);
        if (visibleAllowances.houseRent) currentTotal += roundToNatural(updated.houseRentAllowance || 0);
        if (visibleAllowances.vehicle) currentTotal += roundToNatural(updated.vehicleAllowance || 0);
        if (visibleAllowances.fuel) currentTotal += roundToNatural(updated.fuelAllowance || 0);
        if (visibleAllowances.other) currentTotal += roundToNatural(updated.otherAllowance || 0);

        // Calculate difference and adjust Other Allowance
        const monthlyRounded = roundToNatural(monthly);
        const difference = monthlyRounded - currentTotal;

        if (Math.abs(difference) > 0 && visibleAllowances.other) {
            const currentOther = roundToNatural(updated.otherAllowance || 0);
            updated.otherAllowance = Math.max(0, currentOther + difference).toString();
            // Recalculate percentage
            if (monthlyRounded > 0) {
                updated.otherPercentage = roundPercentage((parseFloat(updated.otherAllowance) / monthlyRounded) * 100).toFixed(2);
            }
        }
    };

    const handleSalaryChange = (field, value) => {
        // Allow empty string to clear the field
        if (value === '') {
            setSalaryDetails(prev => ({ ...prev, [field]: '' }));
            setFieldErrors(prev => ({
                ...prev,
                salary: { ...prev.salary, [field]: '' }
            }));
            return;
        }

        // Validate number input
        if (value !== null && value !== undefined) {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;

            if (isNaN(numValue)) {
                setFieldErrors(prev => ({
                    ...prev,
                    salary: {
                        ...prev.salary,
                        [field]: 'Please enter a valid number'
                    }
                }));
                return;
            }

            // Validate positive numbers
            if (numValue < 0) {
                setFieldErrors(prev => ({
                    ...prev,
                    salary: {
                        ...prev.salary,
                        [field]: 'Value cannot be negative'
                    }
                }));
                return;
            }
        }

        // Clear error if validation passes
        setFieldErrors(prev => ({
            ...prev,
            salary: {
                ...prev.salary,
                [field]: ''
            }
        }));

        setSalaryDetails(prev => {
            const updated = { ...prev };
            const monthly = parseFloat(prev.monthlySalary) || 0;
            const monthlyRounded = roundToNatural(monthly);

            // Handle Monthly Salary change
            if (field === 'monthlySalary') {
                const numValue = parseFloat(value) || 0;
                const rounded = roundToNatural(numValue);
                updated.monthlySalary = rounded.toString();

                if (rounded > 0) {
                    // Recalculate all amounts based on current percentages
                    const basicPercent = parseFloat(prev.basicPercentage) || 50;
                    updated.basic = roundToNatural((rounded * basicPercent / 100)).toString();
                    updated.basicPercentage = roundPercentage(basicPercent).toFixed(2);

                    if (visibleAllowances.houseRent && prev.houseRentPercentage) {
                        const percent = parseFloat(prev.houseRentPercentage);
                        updated.houseRentAllowance = roundToNatural((rounded * percent / 100)).toString();
                        updated.houseRentPercentage = roundPercentage(percent).toFixed(2);
                    }
                    if (visibleAllowances.vehicle && prev.vehiclePercentage) {
                        const percent = parseFloat(prev.vehiclePercentage);
                        updated.vehicleAllowance = roundToNatural((rounded * percent / 100)).toString();
                        updated.vehiclePercentage = roundPercentage(percent).toFixed(2);
                    }
                    if (visibleAllowances.fuel && prev.fuelPercentage) {
                        const percent = parseFloat(prev.fuelPercentage);
                        updated.fuelAllowance = roundToNatural((rounded * percent / 100)).toString();
                        updated.fuelPercentage = roundPercentage(percent).toFixed(2);
                    }
                    if (visibleAllowances.other) {
                        // Calculate Other as remaining
                        let used = roundToNatural(updated.basic || 0);
                        if (visibleAllowances.houseRent) used += roundToNatural(updated.houseRentAllowance || 0);
                        if (visibleAllowances.vehicle) used += roundToNatural(updated.vehicleAllowance || 0);
                        if (visibleAllowances.fuel) used += roundToNatural(updated.fuelAllowance || 0);
                        const otherAmount = Math.max(0, rounded - used);
                        updated.otherAllowance = otherAmount.toString();
                        updated.otherPercentage = rounded > 0 ? roundPercentage((otherAmount / rounded) * 100).toFixed(2) : '0.00';
                    }
                }
                ensureTotalConsistency(updated, rounded);
                return updated;
            }

            // Handle Basic Percentage change
            if (field === 'basicPercentage' && monthlyRounded > 0) {
                const percent = roundPercentage(parseFloat(value) || 0);
                updated.basicPercentage = percent.toFixed(2);
                updated.basic = roundToNatural((monthlyRounded * percent / 100)).toString();

                if (hasOnlyBasicAndOther(prev)) {
                    // Only Basic + Other: adjust Other opposite to Basic
                    const otherAmount = Math.max(0, monthlyRounded - roundToNatural(updated.basic));
                    updated.otherAllowance = otherAmount.toString();
                    updated.otherPercentage = monthlyRounded > 0 ? roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2) : '0.00';
                } else {
                    // Multiple allowances: adjust Other only
                    let used = roundToNatural(updated.basic);
                    if (visibleAllowances.houseRent) used += roundToNatural(prev.houseRentAllowance || 0);
                    if (visibleAllowances.vehicle) used += roundToNatural(prev.vehicleAllowance || 0);
                    if (visibleAllowances.fuel) used += roundToNatural(prev.fuelAllowance || 0);
                    const otherAmount = Math.max(0, monthlyRounded - used);
                    updated.otherAllowance = otherAmount.toString();
                    updated.otherPercentage = monthlyRounded > 0 ? roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2) : '0.00';
                }
                ensureTotalConsistency(updated, monthlyRounded);
                return updated;
            }

            // Handle Basic Amount change
            if (field === 'basic' && monthlyRounded > 0) {
                const basicAmount = roundToNatural(parseFloat(value) || 0);
                updated.basic = basicAmount.toString();
                updated.basicPercentage = roundPercentage((basicAmount / monthlyRounded) * 100).toFixed(2);

                if (hasOnlyBasicAndOther(prev)) {
                    // Only Basic + Other: adjust Other opposite to Basic
                    const otherAmount = Math.max(0, monthlyRounded - basicAmount);
                    updated.otherAllowance = otherAmount.toString();
                    updated.otherPercentage = monthlyRounded > 0 ? roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2) : '0.00';
                } else {
                    // Multiple allowances: adjust Other only
                    let used = basicAmount;
                    if (visibleAllowances.houseRent) used += roundToNatural(prev.houseRentAllowance || 0);
                    if (visibleAllowances.vehicle) used += roundToNatural(prev.vehicleAllowance || 0);
                    if (visibleAllowances.fuel) used += roundToNatural(prev.fuelAllowance || 0);
                    const otherAmount = Math.max(0, monthlyRounded - used);
                    updated.otherAllowance = otherAmount.toString();
                    updated.otherPercentage = monthlyRounded > 0 ? roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2) : '0.00';
                }
                ensureTotalConsistency(updated, monthlyRounded);
                return updated;
            }

            // Handle Other Allowance Percentage change
            if (field === 'otherPercentage' && monthlyRounded > 0) {
                const percent = roundPercentage(parseFloat(value) || 0);
                updated.otherPercentage = percent.toFixed(2);
                updated.otherAllowance = roundToNatural((monthlyRounded * percent / 100)).toString();

                if (hasOnlyBasicAndOther(prev)) {
                    // Only Basic + Other: adjust Basic opposite to Other
                    const otherAmount = roundToNatural(updated.otherAllowance);
                    const basicAmount = Math.max(0, monthlyRounded - otherAmount);
                    updated.basic = basicAmount.toString();
                    updated.basicPercentage = monthlyRounded > 0 ? roundPercentage((basicAmount / monthlyRounded) * 100).toFixed(2) : '0.00';
                } else {
                    // Multiple allowances: redistribute across existing allowances (except Basic)
                    const otherAmount = roundToNatural(updated.otherAllowance);
                    let used = roundToNatural(prev.basic || 0);
                    if (visibleAllowances.houseRent) used += roundToNatural(prev.houseRentAllowance || 0);
                    if (visibleAllowances.vehicle) used += roundToNatural(prev.vehicleAllowance || 0);
                    if (visibleAllowances.fuel) used += roundToNatural(prev.fuelAllowance || 0);
                    const remaining = monthlyRounded - used - otherAmount;

                    // Redistribute difference proportionally across house/vehicle/fuel
                    if (remaining !== 0 && (visibleAllowances.houseRent || visibleAllowances.vehicle || visibleAllowances.fuel)) {
                        let totalOtherAllowances = 0;
                        if (visibleAllowances.houseRent) totalOtherAllowances += roundToNatural(prev.houseRentAllowance || 0);
                        if (visibleAllowances.vehicle) totalOtherAllowances += roundToNatural(prev.vehicleAllowance || 0);
                        if (visibleAllowances.fuel) totalOtherAllowances += roundToNatural(prev.fuelAllowance || 0);

                        if (totalOtherAllowances > 0) {
                            if (visibleAllowances.houseRent) {
                                const current = roundToNatural(prev.houseRentAllowance || 0);
                                const adjustment = roundToNatural((remaining * current / totalOtherAllowances));
                                updated.houseRentAllowance = Math.max(0, current + adjustment).toString();
                                updated.houseRentPercentage = monthlyRounded > 0 ? roundPercentage((parseFloat(updated.houseRentAllowance) / monthlyRounded) * 100).toFixed(2) : '0.00';
                            }
                            if (visibleAllowances.vehicle) {
                                const current = roundToNatural(prev.vehicleAllowance || 0);
                                const adjustment = roundToNatural((remaining * current / totalOtherAllowances));
                                updated.vehicleAllowance = Math.max(0, current + adjustment).toString();
                                updated.vehiclePercentage = monthlyRounded > 0 ? roundPercentage((parseFloat(updated.vehicleAllowance) / monthlyRounded) * 100).toFixed(2) : '0.00';
                            }
                            if (visibleAllowances.fuel) {
                                const current = roundToNatural(prev.fuelAllowance || 0);
                                const adjustment = roundToNatural((remaining * current / totalOtherAllowances));
                                updated.fuelAllowance = Math.max(0, current + adjustment).toString();
                                updated.fuelPercentage = monthlyRounded > 0 ? roundPercentage((parseFloat(updated.fuelAllowance) / monthlyRounded) * 100).toFixed(2) : '0.00';
                            }
                        }
                    }
                }
                ensureTotalConsistency(updated, monthlyRounded);
                return updated;
            }

            // Handle Other Allowance Amount change
            if (field === 'otherAllowance' && monthlyRounded > 0) {
                const otherAmount = roundToNatural(parseFloat(value) || 0);
                updated.otherAllowance = otherAmount.toString();
                updated.otherPercentage = roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2);

                if (hasOnlyBasicAndOther(prev)) {
                    // Only Basic + Other: adjust Basic opposite to Other
                    const basicAmount = Math.max(0, monthlyRounded - otherAmount);
                    updated.basic = basicAmount.toString();
                    updated.basicPercentage = monthlyRounded > 0 ? roundPercentage((basicAmount / monthlyRounded) * 100).toFixed(2) : '0.00';
                } else {
                    // Multiple allowances: redistribute across existing allowances (except Basic)
                    let used = roundToNatural(prev.basic || 0);
                    if (visibleAllowances.houseRent) used += roundToNatural(prev.houseRentAllowance || 0);
                    if (visibleAllowances.vehicle) used += roundToNatural(prev.vehicleAllowance || 0);
                    if (visibleAllowances.fuel) used += roundToNatural(prev.fuelAllowance || 0);
                    const remaining = monthlyRounded - used - otherAmount;

                    // Redistribute difference proportionally
                    if (remaining !== 0 && (visibleAllowances.houseRent || visibleAllowances.vehicle || visibleAllowances.fuel)) {
                        let totalOtherAllowances = 0;
                        if (visibleAllowances.houseRent) totalOtherAllowances += roundToNatural(prev.houseRentAllowance || 0);
                        if (visibleAllowances.vehicle) totalOtherAllowances += roundToNatural(prev.vehicleAllowance || 0);
                        if (visibleAllowances.fuel) totalOtherAllowances += roundToNatural(prev.fuelAllowance || 0);

                        if (totalOtherAllowances > 0) {
                            if (visibleAllowances.houseRent) {
                                const current = roundToNatural(prev.houseRentAllowance || 0);
                                const adjustment = roundToNatural((remaining * current / totalOtherAllowances));
                                updated.houseRentAllowance = Math.max(0, current + adjustment).toString();
                                updated.houseRentPercentage = monthlyRounded > 0 ? roundPercentage((parseFloat(updated.houseRentAllowance) / monthlyRounded) * 100).toFixed(2) : '0.00';
                            }
                            if (visibleAllowances.vehicle) {
                                const current = roundToNatural(prev.vehicleAllowance || 0);
                                const adjustment = roundToNatural((remaining * current / totalOtherAllowances));
                                updated.vehicleAllowance = Math.max(0, current + adjustment).toString();
                                updated.vehiclePercentage = monthlyRounded > 0 ? roundPercentage((parseFloat(updated.vehicleAllowance) / monthlyRounded) * 100).toFixed(2) : '0.00';
                            }
                            if (visibleAllowances.fuel) {
                                const current = roundToNatural(prev.fuelAllowance || 0);
                                const adjustment = roundToNatural((remaining * current / totalOtherAllowances));
                                updated.fuelAllowance = Math.max(0, current + adjustment).toString();
                                updated.fuelPercentage = monthlyRounded > 0 ? roundPercentage((parseFloat(updated.fuelAllowance) / monthlyRounded) * 100).toFixed(2) : '0.00';
                            }
                        }
                    }
                }
                ensureTotalConsistency(updated, monthlyRounded);
                return updated;
            }

            // Handle House/Vehicle/Fuel Percentage changes
            if ((field === 'houseRentPercentage' || field === 'vehiclePercentage' || field === 'fuelPercentage') && monthlyRounded > 0) {
                const percent = roundPercentage(parseFloat(value) || 0);
                const allowanceField = field.replace('Percentage', 'Allowance');
                updated[field] = percent.toFixed(2);
                updated[allowanceField] = roundToNatural((monthlyRounded * percent / 100)).toString();

                // Adjust Other Allowance (Basic never auto-reduces)
                let used = roundToNatural(prev.basic || 0);
                if (visibleAllowances.houseRent) used += roundToNatural(updated.houseRentAllowance || 0);
                if (visibleAllowances.vehicle) used += roundToNatural(updated.vehicleAllowance || 0);
                if (visibleAllowances.fuel) used += roundToNatural(updated.fuelAllowance || 0);
                const otherAmount = Math.max(0, monthlyRounded - used);
                updated.otherAllowance = otherAmount.toString();
                updated.otherPercentage = monthlyRounded > 0 ? roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2) : '0.00';

                ensureTotalConsistency(updated, monthlyRounded);
                return updated;
            }

            // Handle House/Vehicle/Fuel Amount changes
            if ((field === 'houseRentAllowance' || field === 'vehicleAllowance' || field === 'fuelAllowance') && monthlyRounded > 0) {
                const amount = roundToNatural(parseFloat(value) || 0);
                const percentageField = field.replace('Allowance', 'Percentage');
                updated[field] = amount.toString();
                updated[percentageField] = roundPercentage((amount / monthlyRounded) * 100).toFixed(2);

                // Adjust Other Allowance (Basic never auto-reduces)
                let used = roundToNatural(prev.basic || 0);
                if (visibleAllowances.houseRent) used += roundToNatural(updated.houseRentAllowance || 0);
                if (visibleAllowances.vehicle) used += roundToNatural(updated.vehicleAllowance || 0);
                if (visibleAllowances.fuel) used += roundToNatural(updated.fuelAllowance || 0);
                const otherAmount = Math.max(0, monthlyRounded - used);
                updated.otherAllowance = otherAmount.toString();
                updated.otherPercentage = monthlyRounded > 0 ? roundPercentage((otherAmount / monthlyRounded) * 100).toFixed(2) : '0.00';

                ensureTotalConsistency(updated, monthlyRounded);
                return updated;
            }

            // Default: just update the field
            updated[field] = value;
            return updated;
        });
    };

    const handlePersonalDetailsChange = (field, value) => {
        if (field === 'country') {
            // Reset state and city when country changes
            setPersonalDetails(prev => ({
                ...prev,
                country: value,
                state: '',
                city: ''
            }));

            // Load states for selected country
            if (value) {
                const states = State.getStatesOfCountry(value).map(state => ({
                    label: state.name,
                    value: state.isoCode
                }));
                setStateOptions(states);
            } else {
                setStateOptions([]);
            }
            return;
        }

        if (fieldErrors.personal[field]) {
            setFieldErrors(prev => ({
                ...prev,
                personal: {
                    ...prev.personal,
                    [field]: ''
                }
            }));
        }

        setPersonalDetails(prev => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate age from date of birth
            if (field === 'dateOfBirth') {
                updated.age = value ? calculateAgeFromDate(value) : '';
            }

            return updated;
        });
    };

    // Fathers name: letters and spaces only
    const handleFatherNameChange = (value) => {
        const sanitized = value.replace(/[^A-Za-z\s]/g, '');
        handlePersonalDetailsChange('fathersName', sanitized);

        const validation = validateName(sanitized, false);
        setFieldErrors(prev => ({
            ...prev,
            personal: {
                ...prev.personal,
                fathersName: validation.isValid ? '' : validation.error
            }
        }));
    };


    const calculateTotal = () => {
        // Total = Basic + All Allowances (all as whole numbers)
        let total = Math.round(parseFloat(salaryDetails.basic) || 0);

        // Add visible allowances
        if (visibleAllowances.houseRent) {
            total += Math.round(parseFloat(salaryDetails.houseRentAllowance) || 0);
        }
        if (visibleAllowances.vehicle) {
            total += Math.round(parseFloat(salaryDetails.vehicleAllowance) || 0);
        }
        if (visibleAllowances.fuel) {
            total += Math.round(parseFloat(salaryDetails.fuelAllowance) || 0);
        }
        if (visibleAllowances.other) {
            total += Math.round(parseFloat(salaryDetails.otherAllowance) || 0);
        }

        // Add additional allowances from "Add More"
        const additionalTotal = salaryDetails.additionalAllowances.reduce((sum, item) => sum + Math.round(parseFloat(item.amount) || 0), 0);
        total += additionalTotal;

        return total;
    };

    // Monthly salary is manually editable only - no auto-updates
    // Total will be calculated and validated on "Save and Continue"

    // Helper function to calculate balance amount and percentage for new allowances
    const calculateBalanceForAllowance = (allowanceType) => {
        const monthly = parseFloat(salaryDetails.monthlySalary) || 0;
        if (monthly <= 0) {
            return { amount: '0.00', percentage: '0' };
        }

        // Calculate used amount (basic + other visible allowances)
        let usedAmount = parseFloat(salaryDetails.basic) || 0;
        if (visibleAllowances.houseRent && allowanceType !== 'houseRent') {
            usedAmount += parseFloat(salaryDetails.houseRentAllowance) || 0;
        }
        if (visibleAllowances.vehicle && allowanceType !== 'vehicle') {
            usedAmount += parseFloat(salaryDetails.vehicleAllowance) || 0;
        }
        if (visibleAllowances.fuel && allowanceType !== 'fuel') {
            usedAmount += parseFloat(salaryDetails.fuelAllowance) || 0;
        }
        if (visibleAllowances.other && allowanceType !== 'other') {
            usedAmount += parseFloat(salaryDetails.otherAllowance) || 0;
        }

        const balance = Math.max(0, monthly - usedAmount);
        const percentage = balance > 0 ? ((balance / monthly) * 100).toFixed(2) : '0';

        return { amount: balance.toFixed(2), percentage };
    };

    const handleNext = () => {
        if (currentStep < 3) {
            // If moving from step 2 (Salary Details), validate that total == monthly salary
            if (currentStep === 2) {
                const total = calculateTotal();
                const monthly = parseFloat(salaryDetails.monthlySalary) || 0;

                // Validate monthly salary is entered
                if (!salaryDetails.monthlySalary || monthly <= 0) {
                    setFieldErrors(prev => ({
                        ...prev,
                        salary: {
                            ...prev.salary,
                            monthlySalary: 'Monthly salary is required'
                        }
                    }));
                    return;
                }

                // Validate that total equals monthly salary
                if (Math.abs(total - monthly) > 0.01) {
                    setFieldErrors(prev => ({
                        ...prev,
                        salary: {
                            ...prev.salary,
                            monthlySalary: `Monthly salary (AED ${monthly.toFixed(2)}) must equal total (AED ${total.toFixed(2)})`
                        }
                    }));
                    return;
                }

                // Clear any previous errors
                setFieldErrors(prev => ({
                    ...prev,
                    salary: {
                        ...prev.salary,
                        monthlySalary: ''
                    }
                }));
            }

            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const validateAllFields = () => {
        const errors = { basic: {}, salary: {}, personal: {} };
        let hasErrors = false;
        let firstErrorStep = 1;

        // Field label mapping for error messages
        const fieldLabels = {
            basic: {
                firstName: 'First Name',
                lastName: 'Last Name',
                email: 'Email',
                dateOfJoining: 'Date of Joining',
                employeeId: 'Employee ID',
                contactNumber: 'Contact Number',
                gender: 'Gender'
            },
            salary: {
                basic: 'Basic Salary',
                monthlySalary: 'Monthly Salary'
            },
            personal: {
                dateOfBirth: 'Date of Birth',
                nationality: 'Nationality',
                gender: 'Gender',
                fathersName: "Father's Name",
                addressLine1: 'Address',
                addressLine2: 'Apartment / Villa / Flat',
                country: 'Country',
                state: 'State',
                city: 'City',
                postalCode: 'Postal Code'
            }
        };

        // Validate Basic Details
        const firstNameValidation = validateName(basicDetails.firstName, true);
        if (!firstNameValidation.isValid) {
            errors.basic.firstName = firstNameValidation.error;
            hasErrors = true;
        }

        const lastNameValidation = validateName(basicDetails.lastName, true);
        if (!lastNameValidation.isValid) {
            errors.basic.lastName = lastNameValidation.error;
            hasErrors = true;
        }

        const emailValidation = validateEmail(basicDetails.email, true);
        if (!emailValidation.isValid) {
            errors.basic.email = emailValidation.error;
            hasErrors = true;
        }

        const dateValidation = validateDate(basicDetails.dateOfJoining, true);
        if (!dateValidation.isValid) {
            errors.basic.dateOfJoining = dateValidation.error;
            hasErrors = true;
        }

        const employeeIdValidation = validateRequired(basicDetails.employeeId, 'Employee ID');
        if (!employeeIdValidation.isValid) {
            errors.basic.employeeId = employeeIdValidation.error;
            hasErrors = true;
        }

        const countryCode = extractCountryCode(basicDetails.contactNumber) || selectedCountryCode;
        const phoneValidation = validatePhoneNumber(basicDetails.contactNumber, countryCode, true);
        if (!phoneValidation.isValid) {
            errors.basic.contactNumber = phoneValidation.error;
            hasErrors = true;
        }

        // Validate Salary Details
        const basicValidation = validateNumber(salaryDetails.basic, true, 1);
        if (!basicValidation.isValid) {
            errors.salary.basic = basicValidation.error;
            hasErrors = true;
            if (firstErrorStep > 2) firstErrorStep = 2;
        }

        // Validate monthly salary
        const monthlySalaryValidation = validateNumber(salaryDetails.monthlySalary, true, 1);
        if (!monthlySalaryValidation.isValid) {
            errors.salary.monthlySalary = monthlySalaryValidation.error;
            hasErrors = true;
            if (firstErrorStep > 2) firstErrorStep = 2;
        }

        // Validate that total equals monthly salary
        const total = calculateTotal();
        const monthly = parseFloat(salaryDetails.monthlySalary) || 0;
        if (Math.abs(total - monthly) > 0.01) {
            errors.salary.monthlySalary = `Monthly salary (AED ${monthly.toFixed(2)}) must equal total (AED ${total.toFixed(2)})`;
            hasErrors = true;
            if (firstErrorStep > 2) firstErrorStep = 2;
        }

        // Validate Personal Details
        const dobValidation = validateDate(personalDetails.dateOfBirth, true);
        if (!dobValidation.isValid) {
            errors.personal.dateOfBirth = dobValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        } else {
            // Check Age > 18
            const age = parseInt(calculateAgeFromDate(personalDetails.dateOfBirth));
            if (age < 18) {
                errors.personal.dateOfBirth = 'Employee must be at least 18 years old';
                hasErrors = true;
                firstErrorStep = 3;
            }
        }

        // Joined Date Check
        if (basicDetails.dateOfJoining && personalDetails.dateOfBirth) {
            const joining = new Date(basicDetails.dateOfJoining);
            const dob = new Date(personalDetails.dateOfBirth);

            // Check if joining is after DOB
            if (joining <= dob) {
                errors.basic.dateOfJoining = 'Joining Date must be after Date of Birth';
                hasErrors = true;
                firstErrorStep = 1;
            } else {
                // Check if employee is 18+ at time of joining
                const eighteenYearsAfterDob = new Date(dob);
                eighteenYearsAfterDob.setFullYear(dob.getFullYear() + 18);
                // Reset time part for accurate date comparison
                eighteenYearsAfterDob.setHours(0, 0, 0, 0);
                joining.setHours(0, 0, 0, 0);

                if (joining < eighteenYearsAfterDob) {
                    errors.basic.dateOfJoining = 'Employee must be at least 18 years old at the time of joining';
                    hasErrors = true;
                    firstErrorStep = 1;
                }
            }
        }

        const nationalityValidation = validateRequired(personalDetails.nationality, 'Nationality');
        if (!nationalityValidation.isValid) {
            errors.personal.nationality = nationalityValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const genderValidation = validateRequired(personalDetails.gender, 'Gender');
        if (!genderValidation.isValid) {
            errors.personal.gender = genderValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const fathersNameValidation = validateName(personalDetails.fathersName, false);
        if (!fathersNameValidation.isValid) {
            errors.personal.fathersName = fathersNameValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const addressLine1Validation = validateRequired(personalDetails.addressLine1, 'Address');
        if (!addressLine1Validation.isValid) {
            errors.personal.addressLine1 = addressLine1Validation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const addressLine2Validation = validateRequired(personalDetails.addressLine2, 'Apartment / Villa / Flat');
        if (!addressLine2Validation.isValid) {
            errors.personal.addressLine2 = addressLine2Validation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const countryValidation = validateRequired(personalDetails.country, 'Country');
        if (!countryValidation.isValid) {
            errors.personal.country = countryValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const stateValidation = validateRequired(personalDetails.state, 'State');
        if (!stateValidation.isValid) {
            errors.personal.state = stateValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }

        const cityValidation = validateRequired(personalDetails.city, 'City');
        if (!cityValidation.isValid) {
            errors.personal.city = cityValidation.error;
            hasErrors = true;
            firstErrorStep = 3;
        }



        setFieldErrors(errors);

        if (hasErrors) {
            setCurrentStep(firstErrorStep);

            // Build detailed error message
            const errorMessages = [];

            // Basic Details errors
            const basicErrors = Object.keys(errors.basic).filter(key => errors.basic[key]);
            if (basicErrors.length > 0) {
                errorMessages.push('Step 1 - Basic Details:');
                basicErrors.forEach(field => {
                    const label = fieldLabels.basic[field] || field;
                    errorMessages.push(`  • ${label}: ${errors.basic[field]}`);
                });
            }

            // Salary Details errors
            const salaryErrors = Object.keys(errors.salary).filter(key => errors.salary[key]);
            if (salaryErrors.length > 0) {
                errorMessages.push('Step 2 - Salary Details:');
                salaryErrors.forEach(field => {
                    const label = fieldLabels.salary[field] || field;
                    errorMessages.push(`  • ${label}: ${errors.salary[field]}`);
                });
            }

            // Personal Details errors
            const personalErrors = Object.keys(errors.personal).filter(key => errors.personal[key]);
            if (personalErrors.length > 0) {
                errorMessages.push('Step 3 - Personal Details:');
                personalErrors.forEach(field => {
                    const label = fieldLabels.personal[field] || field;
                    errorMessages.push(`  • ${label}: ${errors.personal[field]}`);
                });
            }

            setError(errorMessages.join('\n'));
        }

        return !hasErrors;
    };

    const handleSaveAndContinue = async () => {
        if (currentStep < 3) {
            handleNext();
        } else {
            // Final save - submit all data to backend
            try {
                setLoading(true);
                setError('');

                // Comprehensive validation
                if (!validateAllFields()) {
                    setLoading(false);
                    return;
                }

                // Remove age from personalDetails - backend will calculate it from dateOfBirth
                const { age, ...personalDetailsWithoutAge } = personalDetails;

                // Clean up data: ensure no null values, set defaults for optional fields
                const cleanData = (obj) => {
                    const cleaned = {};
                    for (const [key, value] of Object.entries(obj)) {
                        // Skip age - backend calculates it
                        if (key === 'age') {
                            continue;
                        }

                        if (value === '' || value === null || value === undefined) {
                            // For date fields, set to null if empty (optional dates)
                            if (key.includes('date') || key.includes('Date') || key.includes('Exp')) {
                                cleaned[key] = null;
                            }
                            // For string fields, set to empty string (not null)
                            else if (typeof value === 'string') {
                                cleaned[key] = '';
                            }
                            // For number fields, set to 0
                            else if (typeof value === 'number') {
                                cleaned[key] = 0;
                            }
                            // For boolean fields, set to false
                            else if (typeof value === 'boolean') {
                                cleaned[key] = false;
                            }
                            // For arrays, set to empty array
                            else if (Array.isArray(value)) {
                                cleaned[key] = [];
                            }
                            else {
                                cleaned[key] = value;
                            }
                        } else {
                            cleaned[key] = value;
                        }
                    }
                    return cleaned;
                };

                const formattedContactNumber = basicDetails.contactNumber
                    ? (basicDetails.contactNumber.startsWith('+')
                        ? basicDetails.contactNumber
                        : `+${basicDetails.contactNumber}`)
                    : '';

                // Build additionalAllowances array - always include vehicle and fuel (even if 0)
                const finalAdditionalAllowances = [...(salaryDetails.additionalAllowances || [])];

                // Add vehicle allowance if it exists (even if 0)
                const vehicleAmount = parseFloat(salaryDetails.vehicleAllowance) || 0;
                const existingVehicleIndex = finalAdditionalAllowances.findIndex(a => a.type?.toLowerCase().includes('vehicle'));
                if (existingVehicleIndex >= 0) {
                    finalAdditionalAllowances[existingVehicleIndex].amount = vehicleAmount;
                } else if (vehicleAmount > 0 || visibleAllowances.vehicle) {
                    finalAdditionalAllowances.push({
                        type: 'Vehicle',
                        amount: vehicleAmount,
                        percentage: parseFloat(salaryDetails.vehiclePercentage) || 0
                    });
                }

                // Add fuel allowance if it exists (even if 0)
                const fuelAmount = parseFloat(salaryDetails.fuelAllowance) || 0;
                const existingFuelIndex = finalAdditionalAllowances.findIndex(a => a.type?.toLowerCase().includes('fuel'));
                if (existingFuelIndex >= 0) {
                    finalAdditionalAllowances[existingFuelIndex].amount = fuelAmount;
                } else if (fuelAmount > 0 || visibleAllowances.fuel) {
                    finalAdditionalAllowances.push({
                        type: 'Fuel',
                        amount: fuelAmount,
                        percentage: parseFloat(salaryDetails.fuelPercentage) || 0
                    });
                }

                // Calculate initial status based on joining date
                const referenceDate = basicDetails.dateOfJoining;
                let initialStatus = 'Probation';

                if (referenceDate) {
                    const joiningDateObj = new Date(referenceDate);
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    if (joiningDateObj <= sixMonthsAgo) {
                        initialStatus = 'Permanent';
                    }
                }

                const employeeData = cleanData({
                    ...basicDetails,
                    status: initialStatus,
                    contactNumber: formattedContactNumber,
                    ...salaryDetails,
                    additionalAllowances: finalAdditionalAllowances, // Use the built array with vehicle and fuel
                    ...personalDetailsWithoutAge, // Don't send age, backend calculates it
                });

                console.log('Sending employee data:', employeeData);

                const response = await axios.post('/Employee', employeeData);

                console.log('Employee added successfully:', response.data);

                // Success - redirect to employee list
                router.push('/emp');
            } catch (err) {
                console.error('Full error object:', err);
                let errorMessage = 'Error connecting to server.';

                // Check for network errors
                if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('CONNECTION_REFUSED')) {
                    errorMessage = 'Backend server is not running. Please start the server:\n1. Open terminal\n2. cd server\n3. npm start';
                } else if (err.message) {
                    errorMessage = err.message;
                } else if (err.response?.data?.message) {
                    errorMessage = err.response.data.message;
                    // Show missing fields if provided
                    if (err.response.data.missingFields) {
                        const missing = Object.entries(err.response.data.missingFields)
                            .filter(([_, isMissing]) => isMissing)
                            .map(([field]) => field);
                        if (missing.length > 0) {
                            errorMessage += `\nMissing fields: ${missing.join(', ')}`;
                        }
                    }
                } else if (err.response?.data) {
                    errorMessage = JSON.stringify(err.response.data);
                }

                setError(errorMessage);
                console.error('Error adding employee:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                    <h1 className="text-3xl font-bold text-gray-800 mb-8">Add Employee</h1>

                    <div className="flex gap-8">
                        {/* Progress Steps */}
                        <div className="w-64 flex-shrink-0">
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                {steps.map((step, index) => (
                                    <div key={step.number} className="relative">
                                        {index < steps.length - 1 && (
                                            <div className={`absolute left-4 top-12 w-0.5 h-16 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                                                }`}></div>
                                        )}
                                        <div className="flex items-start gap-4 pb-8">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${currentStep === step.number
                                                ? 'bg-blue-500 text-white'
                                                : currentStep > step.number
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-200 text-gray-500'
                                                }`}>
                                                {step.number}
                                            </div>
                                            <div className="flex-1">
                                                <div className={`font-semibold ${currentStep === step.number ? 'text-blue-600' : 'text-gray-700'
                                                    }`}>
                                                    {step.number} {step.title}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">{step.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form Content */}
                        <div className="flex-1 bg-white rounded-lg shadow-sm p-8">
                            {/* Step 1: Basic Details */}
                            {currentStep === 1 && (
                                <BasicDetailsStep
                                    basicDetails={basicDetails}
                                    fieldErrors={fieldErrors.basic}
                                    handleNameInput={handleNameInput}
                                    validateBasicDetailField={validateBasicDetailField}
                                    handleDateChange={handleDateChange}
                                    handleBasicDetailsChange={handleBasicDetailsChange}
                                    handlePhoneChange={handlePhoneChange}
                                    defaultPhoneCountry={DEFAULT_PHONE_COUNTRY}
                                />
                            )}

                            {/* Step 2: Salary Details */}
                            {currentStep === 2 && (
                                <div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Salary (Monthly)
                                        </label>
                                        <div className="relative flex items-center">
                                            <span className="absolute left-4 text-gray-500 text-sm pointer-events-none" style={{ lineHeight: '2.5rem' }}>AED</span>
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                value={salaryDetails.monthlySalary}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    // Only allow whole numbers
                                                    if (value === '' || /^\d+$/.test(value)) {
                                                        handleSalaryChange('monthlySalary', value);
                                                    }
                                                    // Clear error when user starts typing
                                                    if (fieldErrors.salary.monthlySalary) {
                                                        setFieldErrors(prev => ({
                                                            ...prev,
                                                            salary: {
                                                                ...prev.salary,
                                                                monthlySalary: ''
                                                            }
                                                        }));
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    // Round to nearest whole number on blur
                                                    const value = e.target.value;
                                                    if (value) {
                                                        const rounded = Math.round(parseFloat(value) || 0);
                                                        if (rounded.toString() !== value) {
                                                            handleSalaryChange('monthlySalary', rounded.toString());
                                                        }
                                                    }
                                                }}
                                                className={`w-full pl-16 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.salary.monthlySalary
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : 'border-gray-300 focus:ring-blue-500'
                                                    }`}
                                                placeholder="0"
                                            />
                                            <div className="min-h-[20px] mt-1">
                                                {fieldErrors.salary.monthlySalary && (
                                                    <p className="text-xs text-red-500">{fieldErrors.salary.monthlySalary}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Earnings</h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Basic (50%)
                                                </label>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                            value={salaryDetails.basicPercentage || 50}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                                                    handleSalaryChange('basicPercentage', value);
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                // Format to 2 decimal places on blur
                                                                const value = e.target.value;
                                                                if (value) {
                                                                    const numValue = parseFloat(value) || 0;
                                                                    const formatted = roundPercentage(numValue).toFixed(2);
                                                                    if (formatted !== value) {
                                                                        handleSalaryChange('basicPercentage', formatted);
                                                                    }
                                                                }
                                                            }}
                                                            className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            placeholder="50"
                                                        />
                                                        <div className="absolute right-1 top-0 bottom-0 flex flex-col">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const current = parseFloat(salaryDetails.basicPercentage) || 50;
                                                                    // Round to nearest integer, then add 1 (no fractional changes)
                                                                    const roundedCurrent = Math.round(current);
                                                                    const newValue = Math.min(100, roundedCurrent + 1);
                                                                    handleSalaryChange('basicPercentage', newValue.toString());
                                                                }}
                                                                className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t text-xs"
                                                                title="Increase"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const current = parseFloat(salaryDetails.basicPercentage) || 50;
                                                                    // Round to nearest integer, then subtract 1 (no fractional changes)
                                                                    const roundedCurrent = Math.round(current);
                                                                    const newValue = Math.max(0, roundedCurrent - 1);
                                                                    handleSalaryChange('basicPercentage', newValue.toString());
                                                                }}
                                                                className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b text-xs"
                                                                title="Decrease"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                        <span className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            min="0"
                                                            value={salaryDetails.basic}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                // Only allow whole numbers
                                                                if (value === '' || /^\d+$/.test(value)) {
                                                                    handleSalaryChange('basic', value);
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                // Round to nearest whole number on blur
                                                                const value = e.target.value;
                                                                if (value) {
                                                                    const rounded = Math.round(parseFloat(value) || 0);
                                                                    if (rounded.toString() !== value) {
                                                                        handleSalaryChange('basic', rounded.toString());
                                                                    }
                                                                }
                                                            }}
                                                            className="w-full pl-16 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                                {fieldErrors.salary.basic && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.salary.basic}</p>
                                                )}
                                            </div>

                                            {/* Other Allowance - Always visible by default */}
                                            {visibleAllowances.other && (
                                                <div className="relative group">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Other Allowance
                                                    </label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={salaryDetails.otherPercentage || ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                                                        handleSalaryChange('otherPercentage', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Format to 2 decimal places on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const numValue = parseFloat(value) || 0;
                                                                        const formatted = roundPercentage(numValue).toFixed(2);
                                                                        if (formatted !== value) {
                                                                            handleSalaryChange('otherPercentage', formatted);
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                placeholder="0"
                                                            />
                                                            <div className="absolute right-1 top-0 bottom-0 flex flex-col">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.otherPercentage) || 0;
                                                                        // Round to nearest integer, then add 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.min(100, roundedCurrent + 1);
                                                                        handleSalaryChange('otherPercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t text-xs"
                                                                    title="Increase"
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.otherPercentage) || 0;
                                                                        // Round to nearest integer, then subtract 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.max(0, roundedCurrent - 1);
                                                                        handleSalaryChange('otherPercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b text-xs"
                                                                    title="Decrease"
                                                                >
                                                                    ▼
                                                                </button>
                                                            </div>
                                                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={salaryDetails.otherAllowance}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    // Only allow whole numbers
                                                                    if (value === '' || /^\d+$/.test(value)) {
                                                                        handleSalaryChange('otherAllowance', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Round to nearest whole number on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const rounded = Math.round(parseFloat(value) || 0);
                                                                        if (rounded.toString() !== value) {
                                                                            handleSalaryChange('otherAllowance', rounded.toString());
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full pl-16 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Dynamic Fields - Shown when added via Add More */}
                                            {visibleAllowances.houseRent && (
                                                <div className="relative group">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        House Rent Allowance
                                                    </label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={salaryDetails.houseRentPercentage || ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                                                        handleSalaryChange('houseRentPercentage', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Format to 2 decimal places on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const numValue = parseFloat(value) || 0;
                                                                        const formatted = roundPercentage(numValue).toFixed(2);
                                                                        if (formatted !== value) {
                                                                            handleSalaryChange('houseRentPercentage', formatted);
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                placeholder="0"
                                                            />
                                                            <div className="absolute right-1 top-0 bottom-0 flex flex-col">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.houseRentPercentage) || 0;
                                                                        // Round to nearest integer, then add 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.min(100, roundedCurrent + 1);
                                                                        handleSalaryChange('houseRentPercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t text-xs"
                                                                    title="Increase"
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.houseRentPercentage) || 0;
                                                                        // Round to nearest integer, then subtract 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.max(0, roundedCurrent - 1);
                                                                        handleSalaryChange('houseRentPercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b text-xs"
                                                                    title="Decrease"
                                                                >
                                                                    ▼
                                                                </button>
                                                            </div>
                                                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={salaryDetails.houseRentAllowance}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    // Only allow whole numbers
                                                                    if (value === '' || /^\d+$/.test(value)) {
                                                                        handleSalaryChange('houseRentAllowance', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Round to nearest whole number on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const rounded = Math.round(parseFloat(value) || 0);
                                                                        if (rounded.toString() !== value) {
                                                                            handleSalaryChange('houseRentAllowance', rounded.toString());
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setVisibleAllowances(prev => ({ ...prev, houseRent: false }));
                                                                    setSalaryDetails(prev => ({ ...prev, houseRentAllowance: '', houseRentPercentage: '' }));
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 p-1"
                                                                title="Remove"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {visibleAllowances.vehicle && (
                                                <div className="relative group">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Vehicle Allowance
                                                    </label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={salaryDetails.vehiclePercentage || ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                                                        handleSalaryChange('vehiclePercentage', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Format to 2 decimal places on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const numValue = parseFloat(value) || 0;
                                                                        const formatted = roundPercentage(numValue).toFixed(2);
                                                                        if (formatted !== value) {
                                                                            handleSalaryChange('vehiclePercentage', formatted);
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                placeholder="0"
                                                            />
                                                            <div className="absolute right-1 top-0 bottom-0 flex flex-col">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.vehiclePercentage) || 0;
                                                                        // Round to nearest integer, then add 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.min(100, roundedCurrent + 1);
                                                                        handleSalaryChange('vehiclePercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t text-xs"
                                                                    title="Increase"
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.vehiclePercentage) || 0;
                                                                        // Round to nearest integer, then subtract 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.max(0, roundedCurrent - 1);
                                                                        handleSalaryChange('vehiclePercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b text-xs"
                                                                    title="Decrease"
                                                                >
                                                                    ▼
                                                                </button>
                                                            </div>
                                                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={salaryDetails.vehicleAllowance}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    // Only allow whole numbers
                                                                    if (value === '' || /^\d+$/.test(value)) {
                                                                        handleSalaryChange('vehicleAllowance', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Round to nearest whole number on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const rounded = Math.round(parseFloat(value) || 0);
                                                                        if (rounded.toString() !== value) {
                                                                            handleSalaryChange('vehicleAllowance', rounded.toString());
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setVisibleAllowances(prev => ({ ...prev, vehicle: false }));
                                                                    setSalaryDetails(prev => ({ ...prev, vehicleAllowance: '', vehiclePercentage: '' }));
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 p-1"
                                                                title="Remove"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {visibleAllowances.fuel && (
                                                <div className="relative group">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Fuel Allowance
                                                    </label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={salaryDetails.fuelPercentage || ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                                                        handleSalaryChange('fuelPercentage', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Format to 2 decimal places on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const numValue = parseFloat(value) || 0;
                                                                        const formatted = roundPercentage(numValue).toFixed(2);
                                                                        if (formatted !== value) {
                                                                            handleSalaryChange('fuelPercentage', formatted);
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                placeholder="0"
                                                            />
                                                            <div className="absolute right-1 top-0 bottom-0 flex flex-col">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.fuelPercentage) || 0;
                                                                        // Round to nearest integer, then add 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.min(100, roundedCurrent + 1);
                                                                        handleSalaryChange('fuelPercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t text-xs"
                                                                    title="Increase"
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(salaryDetails.fuelPercentage) || 0;
                                                                        // Round to nearest integer, then subtract 1 (no fractional changes)
                                                                        const roundedCurrent = Math.round(current);
                                                                        const newValue = Math.max(0, roundedCurrent - 1);
                                                                        handleSalaryChange('fuelPercentage', newValue.toString());
                                                                    }}
                                                                    className="flex-1 px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b text-xs"
                                                                    title="Decrease"
                                                                >
                                                                    ▼
                                                                </button>
                                                            </div>
                                                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={salaryDetails.fuelAllowance}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    // Only allow whole numbers
                                                                    if (value === '' || /^\d+$/.test(value)) {
                                                                        handleSalaryChange('fuelAllowance', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // Round to nearest whole number on blur
                                                                    const value = e.target.value;
                                                                    if (value) {
                                                                        const rounded = Math.round(parseFloat(value) || 0);
                                                                        if (rounded.toString() !== value) {
                                                                            handleSalaryChange('fuelAllowance', rounded.toString());
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setVisibleAllowances(prev => ({ ...prev, fuel: false }));
                                                                    setSalaryDetails(prev => ({ ...prev, fuelAllowance: '', fuelPercentage: '' }));
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 p-1"
                                                                title="Remove"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Render Additional/Custom Allowances */}
                                            {salaryDetails.additionalAllowances.map((allowance, index) => (
                                                <div key={index} className="relative group">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        {allowance.type || 'Custom Allowance'}
                                                    </label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={allowance.percentage || ''}
                                                                onChange={(e) => {
                                                                    const newAllowances = [...salaryDetails.additionalAllowances];
                                                                    const percentage = parseFloat(e.target.value) || 0;
                                                                    // Use current monthly salary for percentage calculation
                                                                    const monthly = parseFloat(salaryDetails.monthlySalary) || 0;
                                                                    newAllowances[index].percentage = percentage;
                                                                    newAllowances[index].amount = (monthly * percentage / 100).toFixed(2);
                                                                    setSalaryDetails(prev => ({ ...prev, additionalAllowances: newAllowances }));
                                                                }}
                                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="0"
                                                            />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={allowance.amount || ''}
                                                                onChange={(e) => {
                                                                    const newAllowances = [...salaryDetails.additionalAllowances];
                                                                    const amount = parseFloat(e.target.value) || 0;
                                                                    // Use current monthly salary for percentage calculation
                                                                    const monthly = parseFloat(salaryDetails.monthlySalary) || 0;
                                                                    newAllowances[index].amount = amount;
                                                                    if (monthly > 0) {
                                                                        newAllowances[index].percentage = ((amount / monthly) * 100).toFixed(2);
                                                                    }
                                                                    setSalaryDetails(prev => ({ ...prev, additionalAllowances: newAllowances }));
                                                                }}
                                                                className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="0.00"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newAllowances = salaryDetails.additionalAllowances.filter((_, i) => i !== index);
                                                                    setSalaryDetails(prev => ({ ...prev, additionalAllowances: newAllowances }));
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 p-1"
                                                                title="Remove"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-6">
                                            <button
                                                onClick={() => setShowAddMoreModal(true)}
                                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                                                type="button"
                                            >
                                                <span className="text-lg font-bold">+</span> Add More
                                            </button>
                                        </div>

                                        {/* Add More Modal */}
                                        <AlertDialog open={showAddMoreModal} onOpenChange={setShowAddMoreModal}>
                                            <AlertDialogContent className="max-w-md">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Add Allowance</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Select an allowance type to add to the salary structure.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <div className="py-4 space-y-2">
                                                    {!visibleAllowances.houseRent && (
                                                        <button
                                                            onClick={() => {
                                                                setVisibleAllowances(prev => ({ ...prev, houseRent: true }));
                                                                const balance = calculateBalanceForAllowance('houseRent');
                                                                setSalaryDetails(prev => ({
                                                                    ...prev,
                                                                    houseRentAllowance: balance.amount,
                                                                    houseRentPercentage: balance.percentage
                                                                }));
                                                                setShowAddMoreModal(false);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm text-gray-700 rounded-lg border border-gray-200 transition-colors"
                                                        >
                                                            House Rent Allowance
                                                        </button>
                                                    )}
                                                    {!visibleAllowances.vehicle && (
                                                        <button
                                                            onClick={() => {
                                                                setVisibleAllowances(prev => ({ ...prev, vehicle: true }));
                                                                const balance = calculateBalanceForAllowance('vehicle');
                                                                setSalaryDetails(prev => ({
                                                                    ...prev,
                                                                    vehicleAllowance: balance.amount,
                                                                    vehiclePercentage: balance.percentage
                                                                }));
                                                                setShowAddMoreModal(false);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm text-gray-700 rounded-lg border border-gray-200 transition-colors"
                                                        >
                                                            Vehicle Allowance
                                                        </button>
                                                    )}
                                                    {!visibleAllowances.fuel && (
                                                        <button
                                                            onClick={() => {
                                                                setVisibleAllowances(prev => ({ ...prev, fuel: true }));
                                                                const balance = calculateBalanceForAllowance('fuel');
                                                                setSalaryDetails(prev => ({
                                                                    ...prev,
                                                                    fuelAllowance: balance.amount,
                                                                    fuelPercentage: balance.percentage
                                                                }));
                                                                setShowAddMoreModal(false);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm text-gray-700 rounded-lg border border-gray-200 transition-colors"
                                                        >
                                                            Fuel Allowance
                                                        </button>
                                                    )}
                                                    {!visibleAllowances.other && (
                                                        <button
                                                            onClick={() => {
                                                                setVisibleAllowances(prev => ({ ...prev, other: true }));
                                                                const balance = calculateBalanceForAllowance('other');
                                                                setSalaryDetails(prev => ({
                                                                    ...prev,
                                                                    otherAllowance: balance.amount,
                                                                    otherPercentage: balance.percentage
                                                                }));
                                                                setShowAddMoreModal(false);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm text-gray-700 rounded-lg border border-gray-200 transition-colors"
                                                        >
                                                            Other Allowance
                                                        </button>
                                                    )}
                                                    {visibleAllowances.houseRent && visibleAllowances.vehicle && visibleAllowances.fuel && visibleAllowances.other && (
                                                        <p className="text-sm text-gray-500 text-center py-2">All allowances have been added</p>
                                                    )}
                                                </div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Close</AlertDialogCancel>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        <div className="mt-8 pt-6 border-t">
                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-semibold text-gray-700">Total:</span>
                                                <span className="text-2xl font-bold text-gray-800">
                                                    AED {calculateTotal().toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Personal Details */}
                            {currentStep === 3 && (
                                <div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Date of Birth
                                            </label>
                                            <DatePicker
                                                value={personalDetails.dateOfBirth || ''}
                                                onChange={(date) => handleDateChange('personal', 'dateOfBirth', date)}
                                                className={`w-full ${(fieldErrors?.personal && fieldErrors.personal.dateOfBirth) ? 'border-red-500 bg-red-50' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
                                            />
                                            {fieldErrors.personal.dateOfBirth && (
                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.personal.dateOfBirth}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Age (Autofill)
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.age}
                                                readOnly
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                placeholder="Age"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nationality
                                            </label>
                                            <Select
                                                instanceId="nationality-select"
                                                inputId="nationality-select-input"
                                                value={countryOptions.find(option => option.value === personalDetails.nationality) || null}
                                                onChange={(option) => handlePersonalDetailsChange('nationality', option?.value || '')}
                                                options={countryOptions}
                                                placeholder="Select Nationality"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Gender <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={personalDetails.gender}
                                                onChange={(e) => handlePersonalDetailsChange('gender', e.target.value)}
                                                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.personal.gender ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                            {fieldErrors.personal.gender && (
                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.personal.gender}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fathers Name
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.fathersName}
                                                onChange={(e) => handleFatherNameChange(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Fathers Name"
                                            />
                                            {fieldErrors.personal.fathersName && (
                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.personal.fathersName}</p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Address
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.addressLine1}
                                                onChange={(e) => handlePersonalDetailsChange('addressLine1', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Address"
                                            />
                                            {fieldErrors.personal.addressLine1 && (
                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.personal.addressLine1}</p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Apartment / Villa / Flat
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.addressLine2}
                                                onChange={(e) => handlePersonalDetailsChange('addressLine2', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Apartment / Villa / Flat"
                                            />
                                            {fieldErrors.personal.addressLine2 && (
                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.personal.addressLine2}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Country
                                            </label>
                                            <Select
                                                instanceId="country-select"
                                                inputId="country-select-input"
                                                value={countryOptions.find(option => option.value === personalDetails.country) || null}
                                                onChange={(option) => handlePersonalDetailsChange('country', option?.value || '')}
                                                options={countryOptions}
                                                placeholder="Select Country"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                State
                                            </label>
                                            <Select
                                                instanceId="state-select"
                                                inputId="state-select-input"
                                                value={stateOptions.find(option => option.value === personalDetails.state) || null}
                                                onChange={(option) => handlePersonalDetailsChange('state', option?.value || '')}
                                                options={stateOptions}
                                                placeholder="Select State"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                City
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.city}
                                                onChange={(e) => handlePersonalDetailsChange('city', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="City"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Postal Code
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.postalCode}
                                                onChange={(e) => handlePersonalDetailsChange('postalCode', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Postal Code"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line">
                                    <div className="font-semibold mb-2">Please fix the following errors:</div>
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-8 flex items-center justify-between pt-6 border-t">
                                <div>
                                    {currentStep === 1 ? (
                                        <button
                                            onClick={() => router.push('/emp')}
                                            disabled={loading}
                                            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleBack}
                                            disabled={loading}
                                            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
                                        >
                                            Back
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleSaveAndContinue}
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Saving...' : currentStep === 3 ? 'Save' : 'Save and Continue'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

