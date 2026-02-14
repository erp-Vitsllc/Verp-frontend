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
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (field, option) => {
        setFormData(prev => ({
            ...prev,
            [field]: option ? option.value : '',
            ...(field === 'country' ? { state: '', city: '' } : {})
        }));
    };

    const handlePhoneChange = (value, country) => {
        const cleanedValue = value.replace(/\s/g, '');
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

        const validation = validatePhoneNumber(cleanedValue, countryCode, false); // Optional in company profile? User's call.
        setFieldErrors(prev => ({
            ...prev,
            phone: validation.isValid ? '' : validation.error
        }));
    };

    const validateField = (field, value) => {
        let validation = { isValid: true, error: '' };
        if (field === 'email') validation = validateEmail(value, true);
        if (field === 'name') validation = validateRequired(value, 'Company Name');
        if (field === 'phone') validation = validatePhoneNumber(value, selectedCountryCode, false);

        setFieldErrors(prev => ({ ...prev, [field]: validation.isValid ? '' : validation.error }));
        return validation.isValid;
    };

    const nextStep = () => {
        const isNameValid = validateField('name', formData.name);
        const isEmailValid = validateField('email', formData.email);

        if (!isNameValid || !isEmailValid) {
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

        // Final validation check
        const isNameValid = validateField('name', formData.name);
        const isEmailValid = validateField('email', formData.email);
        const isPhoneValid = validateField('phone', formData.phone);

        if (!isNameValid || !isEmailValid || !isPhoneValid) {
            toast({
                title: 'Validation Error',
                description: 'Please fix all errors before submitting',
                variant: 'destructive'
            });
            return;
        }

        try {
            setLoading(true);

            // Format country/state/city for storage (using names instead of codes for display)
            const submissionData = {
                ...formData,
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
        <div className="flex min-h-screen w-full bg-[#f8fafc]">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto">
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
                                                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                />
                                            </div>

                                            <div className="space-y-2 col-span-1">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Nick Name <span className="text-slate-400 font-normal">(Optional)</span></label>
                                                <input
                                                    name="nickName"
                                                    value={formData.nickName}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Acme"
                                                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                />
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
                                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Phone Number</label>
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
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Established Date</label>
                                                <DatePicker
                                                    value={formData.establishedDate}
                                                    onChange={(date) => setFormData({ ...formData, establishedDate: date })}
                                                    className="w-full h-[48px] bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                />
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
                                                    className="w-full px-4 py-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Country</label>
                                                <Select
                                                    styles={selectStyles}
                                                    options={countryOptions}
                                                    value={countryOptions.find(o => o.value === formData.country)}
                                                    onChange={(opt) => handleSelectChange('country', opt)}
                                                />
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
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">City</label>
                                                <input
                                                    name="city"
                                                    value={formData.city}
                                                    onChange={handleChange}
                                                    placeholder="Enter city..."
                                                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Postal Code <span className="text-slate-400 lowercase font-normal">(Optional)</span></label>
                                                <input
                                                    name="postalCode"
                                                    value={formData.postalCode}
                                                    onChange={handleChange}
                                                    placeholder="PO Box / Zip"
                                                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-sm font-semibold"
                                                />
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
    );
}
