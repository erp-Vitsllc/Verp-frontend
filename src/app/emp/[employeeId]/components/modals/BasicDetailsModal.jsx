'use client';

import dynamic from 'next/dynamic';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), {
    ssr: false,
    loading: () => <div className="h-10 w-full bg-[#F7F9FC] border border-[#E5E7EB] rounded-xl animate-pulse" />
});
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
import { DatePicker } from "@/components/ui/date-picker";

export default function BasicDetailsModal({
    isOpen,
    onClose,
    editForm,
    setEditForm,
    editFormErrors,
    setEditFormErrors,
    updating,
    editCountryCode,
    setEditCountryCode,
    allCountriesOptions,
    DEFAULT_PHONE_COUNTRY,
    onEditChange,
    onUpdate,
    confirmUpdateOpen,
    setConfirmUpdateOpen
}) {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                    <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                        <h3 className="text-[22px] font-semibold text-gray-800">Basic Details</h3>
                        <button
                            onClick={() => {
                                if (!updating) {
                                    onClose();
                                    setEditFormErrors({});
                                }
                            }}
                            className="absolute right-0 text-gray-400 hover:text-gray-600"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="space-y-3 pr-2 max-h-[70vh] overflow-y-auto modal-scroll">
                        <div className="space-y-3">
                            {[
                                { label: 'Employee ID', field: 'employeeId', type: 'text', readOnly: true },
                                { label: 'First Name', field: 'firstName', type: 'text', required: true },
                                { label: 'Last Name', field: 'lastName', type: 'text', required: true },
                                { label: 'Email', field: 'email', type: 'email', required: true },
                                { label: 'Contact Number', field: 'contactNumber', type: 'phone', required: true },

                                { label: 'Date of Birth', field: 'dateOfBirth', type: 'date', required: true, placeholder: 'mm/dd/yyyy' },
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
                                ...(editForm.maritalStatus === 'married' ? [
                                    { label: 'Number of Dependents', field: 'numberOfDependents', type: 'number', required: false, placeholder: 'Enter number of dependents' }
                                ] : []),
                                { label: 'Father\'s Name', field: 'fathersName', type: 'text', required: true },
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
                                <div key={input.field} className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-3 bg-white transition-all">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                        {input.label} {input.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        {input.type === 'phone' ? (
                                            <PhoneInputField
                                                defaultCountry={DEFAULT_PHONE_COUNTRY}
                                                value={editForm[input.field]}
                                                onChange={(value, country) => onEditChange(input.field, value, country)}
                                                placeholder="Enter contact number"
                                                disabled={updating}
                                                error={editFormErrors[input.field]}
                                            />
                                        ) : input.type === 'select' ? (
                                            <div className="flex flex-col gap-1 w-full">
                                                <select
                                                    value={editForm[input.field]}
                                                    onChange={(e) => {
                                                        onEditChange(input.field, e.target.value);
                                                        if (editFormErrors[input.field]) {
                                                            setEditFormErrors(prev => {
                                                                const updated = { ...prev };
                                                                delete updated[input.field];
                                                                return updated;
                                                            });
                                                        }
                                                    }}
                                                    className={`w-full h-10 px-3 rounded-xl border ${editFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                    disabled={updating}
                                                >
                                                    {input.options.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {editFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{editFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        ) : input.type === 'date' ? (
                                            <div className="flex flex-col gap-1 w-full">
                                                <DatePicker
                                                    value={editForm[input.field]}
                                                    onChange={(val) => {
                                                        onEditChange(input.field, val);
                                                        if (editFormErrors[input.field]) {
                                                            setEditFormErrors(prev => {
                                                                const updated = { ...prev };
                                                                delete updated[input.field];
                                                                return updated;
                                                            });
                                                        }
                                                    }}
                                                    className={`w-full ${editFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                                    disabled={updating || input.readOnly}
                                                    disabledDays={input.field === 'dateOfBirth' ? { after: new Date() } : undefined}
                                                />
                                                {editFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{editFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1 w-full">
                                                <input
                                                    type={input.type}
                                                    value={editForm[input.field]}
                                                    onChange={(e) => {
                                                        let value = e.target.value;
                                                        if (['fathersName', 'firstName', 'lastName'].includes(input.field)) {
                                                            value = value.replace(/[^A-Za-z\s]/g, '');
                                                        }
                                                        onEditChange(input.field, value);
                                                    }}
                                                    onInput={(e) => {
                                                        if (['fathersName', 'firstName', 'lastName'].includes(input.field)) {
                                                            e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                        }
                                                    }}
                                                    className={`w-full h-10 px-3 rounded-xl border ${editFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                    disabled={updating || input.readOnly}
                                                    readOnly={input.readOnly}
                                                />
                                                {editFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{editFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-4 px-4 pt-4 border-t border-gray-100">
                        <button
                            onClick={() => {
                                if (!updating) {
                                    onClose();
                                    setEditFormErrors({});
                                }
                            }}
                            className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
                            disabled={updating}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setConfirmUpdateOpen(true)}
                            className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                            disabled={updating}
                        >
                            {updating ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirm Update Dialog */}
            <AlertDialog open={confirmUpdateOpen} onOpenChange={(open) => !updating && setConfirmUpdateOpen(open)}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-300 bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-900">Update basic details?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                            Are you sure you want to save these changes to the employee&apos;s basic details?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 flex-row gap-3">
                        <AlertDialogCancel
                            disabled={updating}
                            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirmUpdateOpen(false);
                                onUpdate();
                            }}
                            disabled={updating}
                            className="px-6 py-2 rounded-lg bg-gray-800 text-white font-semibold text-sm hover:bg-gray-900 transition-colors disabled:opacity-50"
                        >
                            {updating ? 'Updating...' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
