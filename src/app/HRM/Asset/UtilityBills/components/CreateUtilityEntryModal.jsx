'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { isAdmin } from '@/utils/permissions';
import { UTILITY_TOGGLE_FIELDS } from './AddUtilityModal';
import {
    addUtilityProviderApi,
    fetchUtilityProvidersApi,
    removeUtilityProviderApi,
} from '../utils/utilityBillsApi';

const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

/** Assignment is a row action, not an entry form field. */
const FORM_SKIP_KEYS = new Set(['assignment']);
const DESCRIPTION_KEYS = new Set(['location', 'planDetails']);
const CONTRACT_KEY = 'contractPeriod';
const PAYMENT_DATE_KEY = 'paymentDate';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function emptyValuesForFields(enabledKeys) {
    const values = {};
    enabledKeys.forEach((key) => {
        if (key === CONTRACT_KEY) {
            values.contractStart = '';
            values.contractEnd = '';
        } else if (key === PAYMENT_DATE_KEY) {
            values.paymentDay = '';
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
    const attachmentEnabled = enabledFields?.attachment === 'yes';

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

    const canManageProviders = isAdmin();
    const [values, setValues] = useState({});
    const [attachment, setAttachment] = useState(null);
    const [providers, setProviders] = useState([]);
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [providerMenuOpen, setProviderMenuOpen] = useState(false);
    const [newProviderName, setNewProviderName] = useState('');
    const [error, setError] = useState('');
    const providerMenuRef = useRef(null);

    const sortedProviders = useMemo(
        () => [...providers].sort((a, b) => a.localeCompare(b)),
        [providers],
    );

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setValues(emptyValuesForFields(enabledKeys));
        setAttachment(null);
        setShowAddProvider(false);
        setProviderMenuOpen(false);
        setNewProviderName('');
        setError('');
        (async () => {
            try {
                const list = await fetchUtilityProvidersApi();
                if (!cancelled) setProviders(list);
            } catch {
                if (!cancelled) setProviders([]);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- enabledKeysKey tracks enabledKeys
    }, [isOpen, utilityType, enabledKeysKey, attachmentEnabled]);

    useEffect(() => {
        if (!providerMenuOpen) return undefined;
        const onDocClick = (e) => {
            if (!providerMenuRef.current?.contains(e.target)) {
                setProviderMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [providerMenuOpen]);

    if (!isOpen) return null;

    const handleAddProvider = async () => {
        const name = String(newProviderName || '').trim();
        if (!name) {
            setError('Enter a provider name.');
            return;
        }
        try {
            const result = await addUtilityProviderApi(name);
            setProviders(result.providers);
            setField('provider', name);
            setNewProviderName('');
            setShowAddProvider(false);
            setError('');
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not add provider.');
        }
    };

    const handleRemoveProvider = async (name) => {
        try {
            const result = await removeUtilityProviderApi(name);
            setProviders(result.providers);
            if (String(values.provider || '').toLowerCase() === String(name).toLowerCase()) {
                setField('provider', '');
            }
            setError('');
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not remove provider.');
        }
    };

    const selectProvider = (name) => {
        setField('provider', name);
        setProviderMenuOpen(false);
        setError('');
    };

    const setField = (key, value) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const handleAttachmentFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const isPdf =
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setError('Only PDF files are allowed for bill attachment.');
            return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setError('Attachment must be 1.5 MB or smaller.');
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setAttachment({
                name: file.name,
                mime: 'application/pdf',
                dataUrl,
            });
            setError('');
        } catch {
            setError('Could not read the selected file.');
        }
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
            const day = Number(values.paymentDay);
            if (!Number.isInteger(day) || day < 1 || day > 31) {
                setError('Please select a payment day (1–31).');
                return;
            }
        }

        if (attachmentEnabled && !attachment?.name) {
            setError('Please upload an attachment.');
            return;
        }

        const payloadValues = { ...values };
        if (attachmentEnabled) {
            payloadValues.attachment = attachment;
        }

        onSave?.({
            type: utilityType,
            values: payloadValues,
        });
        onClose?.();
    };

    const renderField = (field) => {
        if (field.key === 'provider') {
            const selectedProvider = values.provider || '';
            return (
                <div key={field.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <label className="block text-sm font-semibold text-gray-700">
                            {field.label}
                        </label>
                        {canManageProviders ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddProvider((v) => !v);
                                    setNewProviderName('');
                                    setError('');
                                }}
                                className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
                            >
                                <Plus size={14} />
                                Add provider
                            </button>
                        ) : null}
                    </div>

                    <div className="relative" ref={providerMenuRef}>
                        <button
                            type="button"
                            onClick={() => setProviderMenuOpen((v) => !v)}
                            className={`${inputClass} flex items-center justify-between gap-2 text-left`}
                            aria-haspopup="listbox"
                            aria-expanded={providerMenuOpen}
                        >
                            <span
                                className={
                                    selectedProvider ? 'text-gray-800 truncate' : 'text-gray-400'
                                }
                            >
                                {selectedProvider || 'Select provider'}
                            </span>
                            <ChevronDown
                                size={16}
                                className={`shrink-0 text-gray-400 transition-transform ${
                                    providerMenuOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </button>

                        {providerMenuOpen ? (
                            <div
                                className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
                                role="listbox"
                            >
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!selectedProvider}
                                    onClick={() => selectProvider('')}
                                    className={`w-full px-3 py-2 text-left text-sm ${
                                        !selectedProvider
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    Select provider
                                </button>
                                <ul className="max-h-48 overflow-y-auto">
                                    {sortedProviders.map((opt) => {
                                        const selected = selectedProvider === opt;
                                        return (
                                            <li
                                                key={opt}
                                                className={`flex items-center gap-2 border-t border-gray-100 px-2 py-1.5 ${
                                                    selected ? 'bg-teal-50' : 'bg-white'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selected}
                                                    onClick={() => selectProvider(opt)}
                                                    className="flex-1 min-w-0 text-left text-sm text-gray-800 truncate px-1 py-1 rounded hover:bg-gray-50"
                                                >
                                                    {opt}
                                                </button>
                                                {canManageProviders ? (
                                                    <button
                                                        type="button"
                                                        title="Delete provider"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveProvider(opt);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50 shrink-0"
                                                    >
                                                        <Trash2 size={12} />
                                                        Delete
                                                    </button>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : null}
                    </div>

                    {!canManageProviders ? (
                        <p className="text-xs text-gray-500">
                            Only administrators can add providers to this list.
                        </p>
                    ) : (
                        <p className="text-xs text-gray-500">
                            Default: Etisalat, Du. Admin can remove providers from the dropdown.
                        </p>
                    )}

                    {canManageProviders && showAddProvider ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newProviderName}
                                onChange={(e) => setNewProviderName(e.target.value)}
                                placeholder="New provider name"
                                className={`${inputClass} flex-1`}
                            />
                            <button
                                type="button"
                                onClick={handleAddProvider}
                                className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium whitespace-nowrap"
                            >
                                Save
                            </button>
                        </div>
                    ) : null}
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
            return (
                <div key={field.key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Payment Day
                    </label>
                    <select
                        value={values.paymentDay || ''}
                        onChange={(e) => setField('paymentDay', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Select day of month</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                            <option key={day} value={String(day)}>
                                {day}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                        Same day every month (e.g. 10 = the 10th of each month).
                    </p>
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

                        {attachmentEnabled ? (
                            <div className="rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-3 space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Attachment
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleAttachmentFile}
                                    className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-teal-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-600"
                                />
                                {attachment?.name ? (
                                    <div className="flex items-center justify-between gap-2">
                                        <p
                                            className="text-xs text-gray-600 truncate"
                                            title={attachment.name}
                                        >
                                            Selected: {attachment.name}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setAttachment(null)}
                                            className="text-xs font-semibold text-red-600 hover:text-red-700 shrink-0"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">PDF only. Max 1.5 MB.</p>
                                )}
                            </div>
                        ) : null}

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
                            disabled={
                                enabledFieldDefs.length === 0 &&
                                !assignmentEnabled &&
                                !attachmentEnabled
                            }
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
