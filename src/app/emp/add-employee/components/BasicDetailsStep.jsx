'use client';

import dynamic from 'next/dynamic';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), {
    ssr: false,
    loading: () => <div className="h-11 w-full bg-gray-50 border border-gray-300 rounded-lg animate-pulse" />
});

import { DatePicker } from "@/components/ui/date-picker";

export default function BasicDetailsStep({
    basicDetails,
    fieldErrors,
    handleNameInput,
    validateBasicDetailField,
    handleDateChange,
    handleBasicDetailsChange,
    handlePhoneChange,
    handleWhatsappPhoneChange,
    defaultPhoneCountry,
    companies,
    checkingWhatsApp = false,
    whatsappRegistered = false,
    whatsappInvalid = false,
    onValidateWhatsApp,
}) {
    const fieldsLocked = Boolean(checkingWhatsApp);
    return (
        <div>
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company <span className="text-red-500">*</span>
                </label>
                <select
                    value={basicDetails.company}
                    onChange={(e) => handleBasicDetailsChange('company', e.target.value)}
                    onBlur={() => validateBasicDetailField('company', basicDetails.company)}
                    disabled={fieldsLocked}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors?.company ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                        }`}
                >
                    <option value="">Select Company</option>
                    {companies.map((company) => (
                        <option key={company._id} value={company._id}>
                            {company.name}
                        </option>
                    ))}
                </select>
                {fieldErrors?.company && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.company}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={basicDetails.firstName}
                        onChange={(e) => handleNameInput('firstName', e.target.value)}
                        onBlur={() => validateBasicDetailField('firstName', basicDetails.firstName)}
                        disabled={fieldsLocked}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors?.firstName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                            }`}
                        placeholder="First Name"
                    />
                    {fieldErrors?.firstName && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={basicDetails.lastName}
                        onChange={(e) => handleNameInput('lastName', e.target.value)}
                        onBlur={() => validateBasicDetailField('lastName', basicDetails.lastName)}
                        disabled={fieldsLocked}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors?.lastName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                            }`}
                        placeholder="Last Name"
                    />
                    {fieldErrors?.lastName && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employee ID (Serial)
                    </label>
                    <input
                        type="text"
                        value={basicDetails.employeeId}
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Auto-generated serial"
                        title="Serial continues globally (…00010 → …00011); only VEGA-HR / NNIT-HR changes with company"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Serial continues from the last VEGA/NNIT ID; prefix follows company (e.g. NNIT-HR-00011).
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Joining <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                        value={basicDetails.dateOfJoining || ''}
                        onChange={(date) => handleDateChange('basic', 'dateOfJoining', date)}
                        className={`w-full ${fieldErrors?.dateOfJoining ? 'border-red-500 bg-red-50' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
                        disabled={fieldsLocked}
                        disabledDays={{ after: new Date() }}
                    />
                    {fieldErrors?.dateOfJoining && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfJoining}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Joining Date
                    </label>
                    <DatePicker
                        value={basicDetails.contractJoiningDate || ''}
                        onChange={() => {}}
                        className="w-full border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed opacity-90"
                        disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Auto-filled from the first Employment or Spouse visa issue date. Only flowchart HR can edit this date on Work Details. Visit visa and renewals do not change this date.
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        value={basicDetails.email}
                        onChange={(e) => handleBasicDetailsChange('email', e.target.value.trimStart())}
                        onBlur={() => validateBasicDetailField('email', basicDetails.email.trim())}
                        disabled={fieldsLocked}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors?.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                            }`}
                        placeholder="Email"
                    />
                    {fieldErrors?.email && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Number <span className="text-red-500">*</span>
                    </label>
                    <PhoneInputField
                        defaultCountry={defaultPhoneCountry}
                        value={basicDetails.contactNumber}
                        onChange={(value, country) => handlePhoneChange(value, country)}
                        placeholder="Contact Number"
                        disabled={fieldsLocked}
                        error={fieldErrors?.contactNumber}
                    />
                    {fieldErrors?.contactNumber && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.contactNumber}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        WhatsApp Number
                    </label>
                    <div className="flex flex-wrap items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <PhoneInputField
                                defaultCountry={defaultPhoneCountry}
                                value={basicDetails.whatsappNumber}
                                onChange={(value, country) => handleWhatsappPhoneChange(value, country)}
                                placeholder="WhatsApp Number"
                                disabled={fieldsLocked}
                                error=""
                                showValidatedBadge={false}
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                            <button
                                type="button"
                                onClick={onValidateWhatsApp}
                                disabled={fieldsLocked || !String(basicDetails.whatsappNumber || '').trim()}
                                className="h-11 px-4 rounded-xl bg-[#4C6FFF] text-white text-sm font-semibold hover:bg-[#3A54D4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                                {checkingWhatsApp ? (
                                    <>
                                        <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : 'Validate'}
                            </button>
                            {whatsappRegistered && !checkingWhatsApp && (
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600" title="Valid WhatsApp number">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </span>
                            )}
                            {whatsappInvalid && !checkingWhatsApp && (
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600" title="Not a valid WhatsApp number">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </span>
                            )}
                        </div>
                    </div>
                    {checkingWhatsApp && (
                        <p className="text-xs text-blue-600 mt-1">Sending welcome message to this number…</p>
                    )}
                    {whatsappRegistered && !checkingWhatsApp && (
                        <p className="text-xs text-green-600 mt-1">Valid WhatsApp number</p>
                    )}
                    {fieldErrors?.whatsappNumber && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.whatsappNumber}</p>
                    )}
                </div>
            </div>
            <div className="mt-6 space-y-4">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={basicDetails.enablePortalAccess}
                        onChange={(e) => handleBasicDetailsChange('enablePortalAccess', e.target.checked)}
                        disabled={fieldsLocked}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Portal Access</span>
                </label>
            </div>
        </div>
    );
}







