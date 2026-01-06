'use client';

import PhoneInputField from '@/components/ui/phone-input';

export default function ContactModal({
    isOpen,
    onClose,
    contactForms,
    setContactForms,
    contactFormErrors,
    setContactFormErrors,
    savingContact,
    activeContactForm,
    DEFAULT_PHONE_COUNTRY,
    onContactChange,
    onSaveContactDetails
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Emergency Contact Details</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={savingContact}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    <div className="border border-gray-100 rounded-2xl p-4 bg-white space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-500">Name</span>
                                <input
                                    type="text"
                                    value={activeContactForm.name}
                                    onChange={(e) => onContactChange(0, 'name', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border ${contactFormErrors['0_name'] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    placeholder="Enter contact name"
                                    disabled={savingContact}
                                />
                                {contactFormErrors['0_name'] && (
                                    <p className="text-xs text-red-500 mt-1">{contactFormErrors['0_name']}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-500">Relation</span>
                                <select
                                    value={activeContactForm.relation}
                                    onChange={(e) => onContactChange(0, 'relation', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border ${contactFormErrors['0_relation'] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    disabled={savingContact}
                                >
                                    {['Self', 'Father', 'Mother', 'Friend', 'Spouse', 'Other'].map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                                {contactFormErrors['0_relation'] && (
                                    <p className="text-xs text-red-500 mt-1">{contactFormErrors['0_relation']}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <span className="text-xs font-semibold text-gray-500">Phone Number</span>
                                <PhoneInputField
                                    defaultCountry={DEFAULT_PHONE_COUNTRY}
                                    value={activeContactForm.number}
                                    onChange={(value, country) => onContactChange(0, 'number', value, country)}
                                    placeholder="Enter contact number"
                                    disabled={savingContact}
                                    error={contactFormErrors['0_number']}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm"
                        disabled={savingContact}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveContactDetails}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        disabled={savingContact}
                    >
                        {savingContact ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}




