'use client';

import PhoneInputField from '@/components/ui/phone-input';
import { DatePicker } from "@/components/ui/date-picker";

export default function PersonalDetailsModal({
    isOpen,
    onClose,
    personalForm,
    setPersonalForm,
    personalFormErrors,
    setPersonalFormErrors,
    savingPersonal,
    activeTab,
    allCountriesOptions,
    DEFAULT_PHONE_COUNTRY,
    onPersonalChange,
    onSavePersonalDetails
}) {
    if (!isOpen || activeTab !== 'personal') return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Personal Details</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={savingPersonal}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    {[
                        { label: 'Email Address', field: 'email', type: 'email', required: true },
                        { label: 'Contact Number', field: 'contactNumber', type: 'phone', required: true },
                        { label: 'Date of Birth', field: 'dateOfBirth', type: 'date', required: true, placeholder: 'yyyy-mm-dd' },
                        {
                            label: 'Marital Status',
                            field: 'maritalStatus',
                            type: 'select',
                            required: true,
                            options: [
                                { value: '', label: 'Select Marital Status' },
                                { value: 'single', label: 'Single' },
                                { value: 'married', label: 'Married' },
                                { value: 'divorced', label: 'Divorced' },
                                { value: 'widowed', label: 'Widowed' }
                            ]
                        },
                        ...(personalForm.maritalStatus === 'married' ? [{ label: 'Number of Dependents', field: 'numberOfDependents', type: 'number', required: false, placeholder: 'Enter number of dependents' }] : []),
                        { label: 'Father\'s Name', field: 'fathersName', type: 'text', required: true },
                        {
                            label: 'Gender',
                            field: 'gender',
                            type: 'select',
                            required: true,
                            options: [
                                { value: '', label: 'Select Gender' },
                                { value: 'male', label: 'Male' },
                                { value: 'female', label: 'Female' },
                                { value: 'other', label: 'Other' }
                            ]
                        },
                        {
                            label: 'Nationality',
                            field: 'nationality',
                            type: 'select',
                            required: true,
                            options: [
                                { value: '', label: 'Select Nationality' },
                                ...allCountriesOptions
                            ]
                        }
                    ].map((input) => (
                        <div key={input.field} className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                {input.label} {input.required && <span className="text-red-500">*</span>}
                            </label>
                            {input.type === 'phone' ? (
                                <div>
                                    <PhoneInputField
                                        defaultCountry={DEFAULT_PHONE_COUNTRY}
                                        value={personalForm.contactNumber}
                                        onChange={(value, country) => onPersonalChange('contactNumber', value, country)}
                                        placeholder="Enter contact number"
                                        disabled={savingPersonal}
                                        error={personalFormErrors.contactNumber}
                                    />
                                    {personalFormErrors.contactNumber && (
                                        <p className="text-xs text-red-500 mt-1">{personalFormErrors.contactNumber}</p>
                                    )}
                                </div>
                            ) : input.type === 'select' ? (
                                <div className="w-full flex-1 flex flex-col gap-1">
                                    <select
                                        value={personalForm[input.field]}
                                        onChange={(e) => onPersonalChange(input.field, e.target.value)}
                                        className={`w-full h-10 px-3 rounded-xl border ${personalFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                        disabled={savingPersonal}
                                    >
                                        {input.options.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {personalFormErrors[input.field] && (
                                        <p className="text-xs text-red-500 mt-1">{personalFormErrors[input.field]}</p>
                                    )}
                                </div>
                            ) : input.type === 'date' ? (
                                <div className="w-full flex-1 flex flex-col gap-1">
                                    <DatePicker
                                        value={personalForm[input.field]}
                                        onChange={(val) => onPersonalChange(input.field, val)}
                                        className={`w-full ${personalFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                        disabled={savingPersonal}
                                    />
                                    {personalFormErrors[input.field] && (
                                        <p className="text-xs text-red-500 mt-1">{personalFormErrors[input.field]}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full flex-1 flex flex-col gap-1">
                                    <input
                                        type={input.type}
                                        value={personalForm[input.field]}
                                        onChange={(e) => onPersonalChange(input.field, e.target.value)}
                                        className={`w-full h-10 px-3 rounded-xl border ${personalFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                        placeholder={input.placeholder || `Enter ${input.label.toLowerCase()}`}
                                        disabled={savingPersonal}
                                    />
                                    {personalFormErrors[input.field] && (
                                        <p className="text-xs text-red-500 mt-1">{personalFormErrors[input.field]}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm"
                        disabled={savingPersonal}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSavePersonalDetails}
                        disabled={savingPersonal}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        {savingPersonal ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}




