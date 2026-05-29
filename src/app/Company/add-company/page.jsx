'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Building, Mail, Phone, MapPin, Hash, Calendar, ChevronLeft, Check, ArrowRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import Select from 'react-select';
import { Country, State, City } from 'country-state-city';
import dynamic from 'next/dynamic';
import {
    validateEmail,
    validatePhoneNumber,
    extractCountryCode,
    validateRequired
} from '@/utils/validation';
import { DatePicker } from "@/components/ui/date-picker";
import PermissionGuard from '@/components/PermissionGuard';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { isAdmin, hasPermission } from '@/utils/permissions';
import { COMPANY_ADD_MODULE, notifyNoPermission } from '@/utils/companyPermissionModules';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), {
    ssr: false,
    loading: () => <div className="h-11 w-full bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
});

const DEFAULT_PHONE_COUNTRY = 'AE';

const selectStyles = {
    control: (provided, state) => ({
        ...provided,
        borderRadius: '0.75rem',
        borderColor: state.isFocused ? '#14b8a6' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 1px #14b8a6' : 'none',
        padding: '2px',
        minHeight: '48px',
        backgroundColor: '#f9fafb'
    }),
    placeholder: (provided) => ({
        ...provided,
        color: '#9ca3af',
        fontSize: '0.875rem'
    })
};

export default function AddCompanyPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        companyId: '',
        establishedDate: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: 'AE', // Default to UAE
        postalCode: '',
        nickName: ''
    });

    const [fieldErrors, setFieldErrors] = useState({});
    const [selectedCountryCode, setSelectedCountryCode] = useState('ae');

    const countryOptions = useMemo(() => Country.getAllCountries().map(c => ({
        label: c.name,
        value: c.isoCode
    })), []);

    const stateOptions = useMemo(() => {
        if (!formData.country) return [];
        return State.getStatesOfCountry(formData.country).map(s => ({
            label: s.name,
            value: s.isoCode
        }));
    }, [formData.country]);



    useEffect(() => {
        const fetchNextId = async () => {
            try {
                const response = await axiosInstance.get('/Company/next-id');
                setFormData(prev => ({ ...prev, companyId: response.data.nextCompanyId }));
            } catch (err) {
                console.error('Error fetching next ID:', err);
            }
        };
        fetchNextId();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const nextData = { ...prev, [name]: value };
            setTimeout(() => validateField(name, value), 0);
            return nextData;
        });
    };

    const handleSelectChange = (field, option) => {
        const val = option ? option.value : '';
        setFormData(prev => {
            const nextData = {
                ...prev,
                [field]: val,
                ...(field === 'country' ? { state: '', city: '' } : {})
            };
            setTimeout(() => {
                validateField(field, val);
                if (field === 'country') {
                    setFieldErrors(prevErrors => ({ ...prevErrors, state: '', city: '' }));
                }
            }, 0);
            return nextData;
        });
    };

    const handlePhoneChange = (value, country) => {
        const cleanedValue = (value || '').replace(/\s/g, '');
        setFormData(prev => ({ ...prev, phone: cleanedValue }));

        let countryCode = selectedCountryCode;
        if (country) {
            if (country.countryCode) {
                countryCode = country.countryCode;
                setSelectedCountryCode(country.countryCode);
            }
        } else {
            const extracted = extractCountryCode(cleanedValue);
            if (extracted) {
                countryCode = extracted;
                setSelectedCountryCode(extracted);
            }
        }

        setTimeout(() => validateField('phone', cleanedValue, countryCode), 0);
    };

    const validateField = (field, value, forceCountryCode = null) => {
        let validation = { isValid: true, error: '' };
        
        const sanitizeValue = (val) => {
            if (typeof val !== 'string') return val;
            return val.replace(/<[^>]*>?/gm, '').trim();
        };

        const sanitizedValue = typeof value === 'string' ? sanitizeValue(value) : value;

        if (field === 'name') {
            if (!sanitizedValue) {
                validation = { isValid: false, error: 'Company Name is required' };
            } else if (sanitizedValue.length < 3) {
                validation = { isValid: false, error: 'Company Name must be at least 3 characters' };
            } else {
                const nameRegex = /^[A-Za-z0-9&.,()\' -]{3,100}$/;
                if (!nameRegex.test(sanitizedValue)) {
                    validation = { isValid: false, error: "Special characters restricted. Allowed: A-Z, a-z, 0-9, &, ., ,, (, ), ', -, spaces" };
                }
            }
        } 
        else if (field === 'nickName') {
            if (sanitizedValue) {
                if (sanitizedValue.length > 50) {
                    validation = { isValid: false, error: 'Short Name must be no more than 50 characters' };
                } else {
                    const nickNameRegex = /^[A-Za-z0-9&.\' -]{0,50}$/;
                    if (!nickNameRegex.test(sanitizedValue)) {
                        validation = { isValid: false, error: "Allowed characters: letters, numbers, &, ., ', -, spaces" };
                    }
                }
            }
        }
        else if (field === 'email') {
            if (!value) {
                validation = { isValid: false, error: 'Company Email ID is required' };
            } else {
                const emailVal = value.trim().toLowerCase();
                if (emailVal.includes(' ')) {
                    validation = { isValid: false, error: 'No spaces allowed in email' };
                } else {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(emailVal)) {
                        validation = { isValid: false, error: 'Please enter a valid email format' };
                    }
                }
            }
        }
        else if (field === 'phone') {
            if (!value) {
                validation = { isValid: false, error: 'Phone Number is required' };
            } else {
                const activeCountry = (forceCountryCode || selectedCountryCode || 'ae').toLowerCase();
                let dialCode = '971';
                let nationalNumber = value;
                if (value.startsWith('+')) {
                    const countryCode = extractCountryCode(value);
                    if (countryCode) {
                        dialCode = countryCode;
                        nationalNumber = value.substring(countryCode.length + 1);
                    }
                }
                const phoneDigits = nationalNumber.replace(/\D/g, '');
                
                if (activeCountry === 'ae') {
                    const phoneRegex = /^5[0-9]{8}$/;
                    if (!phoneRegex.test(phoneDigits)) {
                        validation = { isValid: false, error: 'Phone number must be a valid UAE format starting with 5 (9 digits total)' };
                    }
                } else {
                    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
                        validation = { isValid: false, error: 'Phone number must be a valid format between 7 and 15 digits' };
                    }
                }
            }
        }
        else if (field === 'establishedDate') {
            if (!value) {
                validation = { isValid: false, error: 'Established Date is required' };
            } else {
                const estDate = new Date(value);
                if (isNaN(estDate.getTime())) {
                    validation = { isValid: false, error: 'Please select a valid date' };
                } else if (estDate > new Date()) {
                    validation = { isValid: false, error: 'Established Date cannot be in the future' };
                } else if (estDate.getFullYear() < 1900) {
                    validation = { isValid: false, error: 'Minimum year is 1900' };
                }
            }
        }
        else if (field === 'address') {
            if (!sanitizedValue) {
                validation = { isValid: false, error: 'Company Address is required' };
            } else if (sanitizedValue.length < 10) {
                validation = { isValid: false, error: 'Address must be at least 10 characters' };
            } else if (sanitizedValue.length > 300) {
                validation = { isValid: false, error: 'Address must be no more than 300 characters' };
            } else {
                const addressRegex = /^[A-Za-z0-9\s,./#()-]{10,300}$/;
                if (!addressRegex.test(sanitizedValue)) {
                    validation = { isValid: false, error: 'Address contains restricted special characters' };
                }
            }
        }
        else if (field === 'country') {
            if (!value) {
                validation = { isValid: false, error: 'Country is required' };
            } else {
                const isValid = countryOptions.some(opt => opt.value === value);
                if (!isValid) {
                    validation = { isValid: false, error: 'Please select a valid country from the list' };
                }
            }
        }
        else if (field === 'state') {
            if (!value) {
                validation = { isValid: false, error: 'State / Emirates is required' };
            } else {
                const isValid = stateOptions.some(opt => opt.value === value);
                if (!isValid) {
                    validation = { isValid: false, error: 'Please select a valid State / Emirate from the list' };
                }
            }
        }
        else if (field === 'city') {
            if (!sanitizedValue) {
                validation = { isValid: false, error: 'City is required' };
            } else if (sanitizedValue.length < 2) {
                validation = { isValid: false, error: 'City must be at least 2 characters' };
            } else if (sanitizedValue.length > 50) {
                validation = { isValid: false, error: 'City must be no more than 50 characters' };
            } else {
                const cityRegex = /^[A-Za-z\s-]{2,50}$/;
                if (!cityRegex.test(sanitizedValue)) {
                    validation = { isValid: false, error: 'City must contain only letters, spaces, or hyphens' };
                }
            }
        }
        else if (field === 'postalCode') {
            if (sanitizedValue) {
                if (sanitizedValue.length > 20) {
                    validation = { isValid: false, error: 'Postal Code must be no more than 20 characters' };
                } else {
                    const postalRegex = /^[A-Za-z0-9\s-]{0,20}$/;
                    if (!postalRegex.test(sanitizedValue)) {
                        validation = { isValid: false, error: 'Allowed: letters, numbers, spaces, and hyphens' };
                    }
                }
            }
        }

        setFieldErrors(prev => ({ ...prev, [field]: validation.isValid ? '' : validation.error }));
        return validation.isValid;
    };

    const nextStep = () => {
        const isNameValid = validateField('name', formData.name);
        const isNickNameValid = validateField('nickName', formData.nickName);
        const isEmailValid = validateField('email', formData.email);
        const isPhoneValid = validateField('phone', formData.phone, selectedCountryCode);
        const isEstablishedDateValid = validateField('establishedDate', formData.establishedDate);

        if (!isNameValid || !isNickNameValid || !isEmailValid || !isPhoneValid || !isEstablishedDateValid) {
            toast({
                title: 'Validation Error',
                description: 'Please fix the errors before proceeding',
                variant: 'destructive'
            });
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isAdmin() && !hasPermission(COMPANY_ADD_MODULE, 'isCreate')) {
            notifyNoPermission(toast, 'register companies');
            return;
        }

        // Final validation check for all fields
        const isNameValid = validateField('name', formData.name);
        const isNickNameValid = validateField('nickName', formData.nickName);
        const isEmailValid = validateField('email', formData.email);
        const isPhoneValid = validateField('phone', formData.phone, selectedCountryCode);
        const isEstablishedDateValid = validateField('establishedDate', formData.establishedDate);
        const isAddressValid = validateField('address', formData.address);
        const isCountryValid = validateField('country', formData.country);
        const isStateValid = validateField('state', formData.state);
        const isCityValid = validateField('city', formData.city);
        const isPostalCodeValid = validateField('postalCode', formData.postalCode);

        if (
            !isNameValid || !isNickNameValid || !isEmailValid || !isPhoneValid ||
            !isEstablishedDateValid || !isAddressValid || !isCountryValid ||
            !isStateValid || !isCityValid || !isPostalCodeValid
        ) {
            toast({
                title: 'Validation Error',
                description: 'Please fill all required fields correctly',
                variant: 'destructive'
            });
            return;
        }

        try {
            setLoading(true);

            // Extract dial code and national number for separate storage
            let dialCode = '971';
            let nationalNumber = formData.phone;
            if (formData.phone.startsWith('+')) {
                const countryCode = extractCountryCode(formData.phone);
                if (countryCode) {
                    dialCode = countryCode;
                    nationalNumber = formData.phone.substring(countryCode.length + 1);
                }
            }
            const cleanPhone = nationalNumber.replace(/\D/g, '');

            const submissionData = {
                ...formData,
                name: formData.name.trim(),
                nickName: formData.nickName.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: cleanPhone,
                phoneCountryCode: `+${dialCode}`,
                address: formData.address.trim(),
                city: formData.city.trim(),
                postalCode: formData.postalCode.trim(),
                country: Country.getCountryByCode(formData.country)?.name || formData.country,
                state: State.getStateByCodeAndCountry(formData.state, formData.country)?.name || formData.state
            };

            await axiosInstance.post('/Company', submissionData);
            toast({
                title: 'Success',
                description: 'Company registered successfully',
            });
            router.push('/Company');
        } catch (err) {
            console.error('Error adding company:', err);
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to register company',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard moduleId={COMPANY_ADD_MODULE} redirectTo="/Company">
        <div className="flex min-h-screen w-full bg-[#f8fafc]">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <ListReturnBackButton onFallback={() => router.push('/Company')} />
                        </div>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-teal-500 rounded-lg text-white shadow-lg shadow-teal-500/20">
                                        <Building size={24} />
                                    </div>
                                    <h1 className="text-3xl font-bold text-slate-800">New Company Profile</h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {[1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className={`h-2.5 w-12 rounded-full transition-all duration-500 ${step >= i ? 'bg-teal-500 shadow-sm' : 'bg-slate-200'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                            <div className="bg-slate-50/50 px-10 py-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 font-bold flex items-center justify-center border border-teal-100">
                                        {step}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-800">
                                            {step === 1 ? 'General Information' : 'Address Details'}
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {step === 1 ? 'Primary contact and identification' : 'Registered office location'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step {step} of 2</span>
                            </div>

                            <form onSubmit={handleSubmit}>
                                {step === 1 && (
                                    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
                                        <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                                            <div className="space-y-2 col-span-1">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                                    <Hash size={14} className="text-teal-500" /> Company ID Profile
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        readOnly
                                                        value={formData.companyId}
                                                        className="w-full px-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-500 font-mono font-bold text-sm cursor-not-allowed"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <div className="px-2 py-0.5 bg-teal-50 text-teal-600 text-[10px] font-black rounded uppercase tracking-tighter">Auto</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 col-span-1">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Company Name *</label>
                                                <input
                                                    required
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Acme Corporation"
                                                    className={`w-full px-4 py-3.5 bg-slate-50/50 border ${fieldErrors?.name ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                />
                                                {fieldErrors?.name && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2 col-span-1">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Short Name <span className="text-slate-400 font-normal">(Optional)</span></label>
                                                <input
                                                    name="nickName"
                                                    value={formData.nickName}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Acme"
                                                    className={`w-full px-4 py-3.5 bg-slate-50/50 border ${fieldErrors?.nickName ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                />
                                                {fieldErrors?.nickName && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.nickName}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Company Email ID *</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="email"
                                                        required
                                                        name="email"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        placeholder="office@company.com"
                                                        className={`w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border ${fieldErrors?.email ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                    />
                                                </div>
                                                {fieldErrors?.email && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Phone Number *</label>
                                                <PhoneInputField
                                                    defaultCountry={DEFAULT_PHONE_COUNTRY}
                                                    value={formData.phone}
                                                    onChange={handlePhoneChange}
                                                    placeholder="Contact Number"
                                                    disabled={false}
                                                    error={fieldErrors?.phone}
                                                />
                                                {fieldErrors?.phone && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Established Date *</label>
                                                <DatePicker
                                                    value={formData.establishedDate}
                                                    onChange={(date) => {
                                                        setFormData({ ...formData, establishedDate: date });
                                                        setTimeout(() => validateField('establishedDate', date), 0);
                                                    }}
                                                    className={`w-full h-[48px] bg-slate-50/50 border ${fieldErrors?.establishedDate ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                />
                                                {fieldErrors?.establishedDate && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.establishedDate}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-8 mt-10 border-t border-slate-50">
                                            <button
                                                type="button"
                                                onClick={nextStep}
                                                className="group bg-teal-500 hover:bg-teal-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-teal-500/20 active:scale-95"
                                            >
                                                Address Details
                                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
                                        <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Company Address</label>
                                                <textarea
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleChange}
                                                    placeholder="Building, Street, Area..."
                                                    rows="3"
                                                    className={`w-full px-4 py-4 bg-slate-50/50 border ${fieldErrors?.address ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                />
                                                {fieldErrors?.address && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Country</label>
                                                <Select
                                                    styles={selectStyles}
                                                    options={countryOptions}
                                                    value={countryOptions.find(o => o.value === formData.country)}
                                                    onChange={(opt) => handleSelectChange('country', opt)}
                                                />
                                                {fieldErrors?.country && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.country}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">State / Emirates</label>
                                                <Select
                                                    styles={selectStyles}
                                                    options={stateOptions}
                                                    value={stateOptions.find(o => o.value === formData.state)}
                                                    onChange={(opt) => handleSelectChange('state', opt)}
                                                    isDisabled={!formData.country}
                                                    placeholder="Select Emirate..."
                                                />
                                                {fieldErrors?.state && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.state}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">City</label>
                                                <input
                                                    name="city"
                                                    value={formData.city}
                                                    onChange={handleChange}
                                                    placeholder="Enter city..."
                                                    className={`w-full px-4 py-3.5 bg-slate-50/50 border ${fieldErrors?.city ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                />
                                                {fieldErrors?.city && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Postal Code <span className="text-slate-400 lowercase font-normal">(Optional)</span></label>
                                                <input
                                                    name="postalCode"
                                                    value={formData.postalCode}
                                                    onChange={handleChange}
                                                    placeholder="PO Box / Zip"
                                                    className={`w-full px-4 py-3.5 bg-slate-50/50 border ${fieldErrors?.postalCode ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'} rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold`}
                                                />
                                                {fieldErrors?.postalCode && (
                                                    <p className="text-xs text-red-500 mt-1">{fieldErrors.postalCode}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-8 mt-10 border-t border-slate-50">
                                            <button
                                                type="button"
                                                onClick={() => setStep(1)}
                                                className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800 transition-all px-4 py-2"
                                            >
                                                <ChevronLeft size={20} />
                                                Go Back
                                            </button>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="bg-teal-500 hover:bg-teal-600 text-white px-12 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-50 active:scale-95"
                                            >
                                                {loading ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : <Check size={20} />}
                                                {loading ? 'Processing...' : 'Complete Registration'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </PermissionGuard>
    );
}
