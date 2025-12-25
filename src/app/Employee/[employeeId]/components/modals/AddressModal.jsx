'use client';

export default function AddressModal({
    isOpen,
    onClose,
    addressForm,
    setAddressForm,
    addressFormErrors,
    setAddressFormErrors,
    savingAddress,
    addressModalType,
    addressStateOptions,
    allCountriesOptions,
    onAddressChange,
    onSaveAddress
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {addressModalType === 'permanent' ? 'Permanent Address' : 'Current Address'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={savingAddress}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    {[
                        { label: 'Address', field: 'line1', type: 'text', required: true },
                        { label: 'Apartment/Flat', field: 'line2', type: 'text', required: false },
                        { label: 'City', field: 'city', type: 'text', required: true },
                        {
                            label: 'Country',
                            field: 'country',
                            type: 'select',
                            required: true,
                            options: [
                                { value: '', label: 'Select Country' },
                                ...allCountriesOptions
                            ]
                        },
                        {
                            label: 'Emirates/State',
                            field: 'state',
                            type: addressStateOptions.length > 0 ? 'select' : 'text',
                            required: true,
                            options: addressStateOptions.length > 0 ? [
                                { value: '', label: addressForm.country ? 'Select Emirates/State' : 'Select Country first' },
                                ...addressStateOptions
                            ] : [],
                            disabled: !addressForm.country
                        },
                        { label: 'Postal Code', field: 'postalCode', type: 'text', required: false }
                    ].map((input) => (
                        <div key={input.field} className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                {input.label} {input.required && <span className="text-red-500">*</span>}
                            </label>
                            {input.type === 'select' ? (
                                <div className="w-full flex-1 flex flex-col gap-1">
                                    <select
                                        value={addressForm[input.field]}
                                        onChange={(e) => onAddressChange(input.field, e.target.value)}
                                        className={`w-full h-10 px-3 rounded-xl border ${addressFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${input.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={savingAddress || input.disabled}
                                    >
                                        {input.options.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {addressFormErrors[input.field] && (
                                        <p className="text-xs text-red-500 mt-1">{addressFormErrors[input.field]}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full flex-1 flex flex-col gap-1">
                                    <input
                                        type={input.type}
                                        value={addressForm[input.field]}
                                        onChange={(e) => onAddressChange(input.field, e.target.value)}
                                        className={`w-full h-10 px-3 rounded-xl border ${addressFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                        placeholder={`Enter ${input.label.toLowerCase()}`}
                                        disabled={savingAddress}
                                    />
                                    {addressFormErrors[input.field] && (
                                        <p className="text-xs text-red-500 mt-1">{addressFormErrors[input.field]}</p>
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
                        disabled={savingAddress}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveAddress}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        disabled={savingAddress}
                    >
                        {savingAddress ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
