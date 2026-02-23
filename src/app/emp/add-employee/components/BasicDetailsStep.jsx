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
    defaultPhoneCountry,
    companies
}) {
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
                        First Name
                    </label>
                    <input
                        type="text"
                        value={basicDetails.firstName}
                        onChange={(e) => handleNameInput('firstName', e.target.value)}
                        onBlur={() => validateBasicDetailField('firstName', basicDetails.firstName)}
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
                        Last Name
                    </label>
                    <input
                        type="text"
                        value={basicDetails.lastName}
                        onChange={(e) => handleNameInput('lastName', e.target.value)}
                        onBlur={() => validateBasicDetailField('lastName', basicDetails.lastName)}
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
                        Employee ID
                    </label>
                    <input
                        type="text"
                        value={basicDetails.employeeId}
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Auto-generated"
                        title="Employee ID is generated automatically"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Joining <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                        value={basicDetails.dateOfJoining || ''}
                        onChange={(date) => handleDateChange('basic', 'dateOfJoining', date)}
                        className={`w-full ${fieldErrors?.dateOfJoining ? 'border-red-500 bg-red-50' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
                        disabled={false}
                        disabledDays={{ after: new Date() }}
                    />
                    {fieldErrors?.dateOfJoining && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfJoining}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Joining Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                        value={basicDetails.contractJoiningDate || ''}
                        onChange={(date) => handleDateChange('basic', 'contractJoiningDate', date)}
                        className={`w-full ${fieldErrors?.contractJoiningDate ? 'border-red-500 bg-red-50' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
                        disabled={false}
                        disabledDays={{ after: new Date() }}
                    />
                    {fieldErrors?.contractJoiningDate && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.contractJoiningDate}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                    </label>
                    <input
                        type="email"
                        value={basicDetails.email}
                        onChange={(e) => handleBasicDetailsChange('email', e.target.value)}
                        onBlur={() => validateBasicDetailField('email', basicDetails.email)}
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
                        Contact Number
                    </label>
                    <PhoneInputField
                        defaultCountry={defaultPhoneCountry}
                        value={basicDetails.contactNumber}
                        onChange={(value, country) => handlePhoneChange(value, country)}
                        placeholder="Contact Number"
                        disabled={false}
                        error={fieldErrors?.contactNumber}
                    />
                    {fieldErrors?.contactNumber && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.contactNumber}</p>
                    )}
                </div>
            </div>
            <div className="mt-6 space-y-4">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={basicDetails.enablePortalAccess}
                        onChange={(e) => handleBasicDetailsChange('enablePortalAccess', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Portal Access</span>
                </label>
            </div>
        </div>
    );
}







