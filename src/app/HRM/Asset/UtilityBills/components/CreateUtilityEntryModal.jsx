'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { UTILITY_TOGGLE_FIELDS } from './AddUtilityModal';

const PROVIDER_OPTIONS = ['Etisalat', 'Du'];
const BILLING_TYPE_OPTIONS = [
    { value: 'fixed', label: 'Fixed (Package)' },
    { value: 'usage', label: 'Usage' },
];

/** Assignment is a row action, not an entry form field. */
const FORM_SKIP_KEYS = new Set(['assignment']);
const DESCRIPTION_KEYS = new Set(['location', 'planDetails']);
const CONTRACT_KEY = 'contractPeriod';
const PAYMENT_DATE_KEY = 'paymentDate';

function emptyValuesForFields(enabledKeys) {
    const values = {};
    enabledKeys.forEach((key) => {
        if (key === CONTRACT_KEY) {
            values.contractStart = '';
            values.contractEnd = '';
        } else if (key === PAYMENT_DATE_KEY) {
            values.billingType = 'fixed';
            values.paymentDate = '';
        } else if (key === 'monthlyRental') {
            values.monthlyRental = '';
        } else if (key === 'provider') {
            values.provider = '';
        } else {
            values[key] = '';
        }
    });
    return values;
}

const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white';

/**
 * Create entry modal — fields follow Yes toggles on Add Utility.
 * Assignment is excluded (Assign button appears on the table row instead).
 */
export default function CreateUtilityEntryModal({
    isOpen,
    onClose,
    utilityType = '',
    enabledFields = {},
    onSave,
}) {
    const assignmentEnabled = enabledFields?.assignment === 'yes';

    const enabledFieldDefs = useMemo(
        () =>
            UTILITY_TOGGLE_FIELDS.filter(
                (f) => enabledFields?.[f.key] === 'yes' && !FORM_SKIP_KEYS.has(f.key),
            ),
        [enabledFields],
    );

    const enabledKeys = useMemo(
        () => enabledFieldDefs.map((f) => f.key),
        [enabledFieldDefs],
    );
    const enabledKeysKey = enabledKeys.join('|');

    const [values, setValues] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setValues(emptyValuesForFields(enabledKeys));
        setError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps -- enabledKeysKey tracks enabledKeys
    }, [isOpen, utilityType, enabledKeysKey]);

    if (!isOpen) return null;

    const setField = (key, value) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (enabledKeys.includes('provider') && !values.provider) {
            setError('Please select a provider.');
            return;
        }

        if (enabledKeys.includes(CONTRACT_KEY)) {
            if (!values.contractStart || !values.contractEnd) {
                setError('Please select both contract start and end dates.');
                return;
            }
            if (new Date(values.contractStart) > new Date(values.contractEnd)) {
                setError('Contract end date must be on or after the start date.');
                return;
            }
        }

        if (enabledKeys.includes('monthlyRental')) {
            const amount = Number(values.monthlyRental);
            if (values.monthlyRental === '' || !Number.isFinite(amount) || amount < 0) {
                setError('Please enter a valid monthly rental amount.');
                return;
            }
        }

        if (enabledKeys.includes(PAYMENT_DATE_KEY)) {
            if (!values.billingType) {
                setError('Please select billing type (Fixed or Usage).');
                return;
            }
            if (values.billingType === 'fixed' && !values.paymentDate) {
                setError('Please select a payment date for Fixed (Package) billing.');
                return;
            }
        }

        const payloadValues = { ...values };
        if (enabledKeys.includes(PAYMENT_DATE_KEY) && values.billingType === 'usage') {
            payloadValues.paymentDate = '';
        }

        onSave?.({
            type: utilityType,
            values: payloadValues,
        });
        onClose?.();
    };

    const renderField = (field) => {
        if (field.key === 'provider') {
            return (
                <div key={field.key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {field.label}
                    </label>
                    <select
                        value={values.provider || ''}
                        onChange={(e) => setField('provider', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Select provider</option>
                        {PROVIDER_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        if (field.key === CONTRACT_KEY) {
            return (
                <div key={field.key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {field.label}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <span className="block text-xs text-gray-500 mb-1">Start date</span>
                            <DatePicker
                                value={values.contractStart || ''}
                                onChange={(v) => setField('contractStart', v || '')}
                                placeholder="Start date"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 mb-1">End date</span>
                            <DatePicker
                                value={values.contractEnd || ''}
                                onChange={(v) => setField('contractEnd', v || '')}
                                placeholder="End date"
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (field.key === 'monthlyRental') {
            return (
                <div key={field.key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {field.label}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={values.monthlyRental ?? ''}
                            onChange={(e) => setField('monthlyRental', e.target.value)}
                            placeholder="0.00"
                            className={`${inputClass} pr-14`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                            AED
                        </span>
                    </div>
                </div>
            );
        }

        if (field.key === PAYMENT_DATE_KEY) {
            const isFixed = values.billingType === 'fixed';
            return (
                <div key={field.key} className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Billing Type
                        </label>
                        <select
                            value={values.billingType || 'fixed'}
                            onChange={(e) => {
                                const next = e.target.value;
                                setValues((prev) => ({
                                    ...prev,
                                    billingType: next,
                                    paymentDate: next === 'usage' ? '' : prev.paymentDate,
                                }));
                            }}
                            className={inputClass}
                        >
                            {BILLING_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            Fixed (Package) uses a set payment date. Usage has no fixed date.
                        </p>
                    </div>
                    {isFixed ? (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Payment Date
                            </label>
                            <DatePicker
                                value={values.paymentDate || ''}
                                onChange={(v) => setField('paymentDate', v || '')}
                                placeholder="Payment date"
                                className="w-full"
                            />
                        </div>
                    ) : null}
                </div>
            );
        }

        if (DESCRIPTION_KEYS.has(field.key)) {
            return (
                <div key={field.key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {field.label}
                    </label>
                    <textarea
                        value={values[field.key] || ''}
                        onChange={(e) => setField(field.key, e.target.value)}
                        rows={3}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className={`${inputClass} resize-y min-h-[84px]`}
                    />
                </div>
            );
        }

        // accountNumber and any other text fields
        return (
            <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {field.label}
                </label>
                <input
                    type="text"
                    value={values[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    className={inputClass}
                />
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-utility-entry-title"
            >
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
                    <h2 id="create-utility-entry-title" className="text-lg sm:text-xl font-bold text-gray-800">
                        Create {utilityType}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto flex-1">
                        {enabledFieldDefs.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                {assignmentEnabled
                                    ? 'No data fields are enabled. You can still save a blank record — use Assign on the table row.'
                                    : 'No data fields were enabled for this utility type. Turn fields to Yes in Add Utility.'}
                            </p>
                        ) : null}

                        {enabledFieldDefs.map(renderField)}

                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    </div>

                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-100 flex justify-end gap-2 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={enabledFieldDefs.length === 0 && !assignmentEnabled}
                            className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
