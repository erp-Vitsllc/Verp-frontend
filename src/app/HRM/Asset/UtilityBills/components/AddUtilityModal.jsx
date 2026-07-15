'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { isAdmin } from '@/utils/permissions';

const UTILITY_TYPES_STORAGE_KEY = 'verp_utility_bill_types';

export const UTILITY_TOGGLE_FIELDS = [
    { key: 'provider', label: 'Provider' },
    { key: 'contractPeriod', label: 'Contract Period' },
    { key: 'monthlyRental', label: 'Monthly Rental' },
    { key: 'planDetails', label: 'Plan Details' },
    { key: 'paymentDate', label: 'Payment Day' },
    { key: 'assignment', label: 'Assignment' },
    { key: 'location', label: 'Location' },
    { key: 'accountNumber', label: 'Account Number' },
];

const TOGGLE_FIELDS = UTILITY_TOGGLE_FIELDS;

const defaultToggles = () =>
    TOGGLE_FIELDS.reduce((acc, field) => {
        acc[field.key] = 'no';
        return acc;
    }, {});

/** Only admin-added types — no static Electricity/Water/etc. list. */
function loadUtilityTypes() {
    try {
        const raw = localStorage.getItem(UTILITY_TYPES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const unique = [];
        parsed.forEach((t) => {
            const name = String(t || '').trim();
            if (name && !unique.some((x) => x.toLowerCase() === name.toLowerCase())) {
                unique.push(name);
            }
        });
        return unique;
    } catch {
        return [];
    }
}

function saveUtilityTypes(allTypes) {
    localStorage.setItem(UTILITY_TYPES_STORAGE_KEY, JSON.stringify(allTypes));
}

function YesNoToggle({ name, value, onChange, label }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
            <span className="text-sm font-medium text-gray-800">{label}</span>
            <div className="flex items-center gap-4 shrink-0">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input
                        type="radio"
                        name={name}
                        value="yes"
                        checked={value === 'yes'}
                        onChange={(e) => onChange(e.target.value)}
                        className="accent-teal-600"
                    />
                    Yes
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input
                        type="radio"
                        name={name}
                        value="no"
                        checked={value === 'no'}
                        onChange={(e) => onChange(e.target.value)}
                        className="accent-teal-600"
                    />
                    No
                </label>
            </div>
        </div>
    );
}

/**
 * Add Utility modal:
 * - Type dropdown (admin can add types; types stay permanently)
 * - Used types are disabled in the dropdown
 * - Admin can delete unused custom types only
 * - Include fields Yes/No toggles
 */
export default function AddUtilityModal({
    isOpen,
    onClose,
    onSave,
    utilityType = '',
    initialFields = null,
    usedTypes = [],
}) {
    const canManageTypes = isAdmin();
    const [types, setTypes] = useState([]);
    const [type, setType] = useState('');
    const [toggles, setToggles] = useState(defaultToggles);
    const [attachmentEnabled, setAttachmentEnabled] = useState('no');
    const [newTypeName, setNewTypeName] = useState('');
    const [showAddType, setShowAddType] = useState(false);
    const [error, setError] = useState('');

    const lockedType = String(utilityType || '').trim();
    const isEditMode = Boolean(lockedType);

    const usedSet = useMemo(
        () => new Set((usedTypes || []).map((t) => String(t || '').toLowerCase())),
        [usedTypes],
    );

    const sortedTypes = useMemo(
        () => [...types].sort((a, b) => a.localeCompare(b)),
        [types],
    );

    useEffect(() => {
        if (!isOpen) return;
        const loaded = loadUtilityTypes();
        setTypes(loaded);
        const fieldSource =
            initialFields && typeof initialFields === 'object'
                ? { ...defaultToggles(), ...initialFields }
                : defaultToggles();
        const nextAttachmentEnabled = fieldSource.attachment === 'yes' ? 'yes' : 'no';
        const { attachment: _ignoredAttachmentToggle, ...fieldToggles } = fieldSource;
        setToggles({ ...defaultToggles(), ...fieldToggles });
        setAttachmentEnabled(nextAttachmentEnabled);
        setNewTypeName('');
        setShowAddType(false);
        setError('');

        if (lockedType) {
            setType(lockedType);
            if (!loaded.some((t) => t.toLowerCase() === lockedType.toLowerCase())) {
                const next = [...loaded, lockedType];
                setTypes(next);
                saveUtilityTypes(next);
            }
        } else {
            const firstAvailable = loaded.find((t) => !usedSet.has(t.toLowerCase()));
            setType(firstAvailable || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens / edit target changes
    }, [isOpen, lockedType]);

    if (!isOpen) return null;

    const isTypeUsed = (name) => usedSet.has(String(name || '').toLowerCase());

    const handleAddType = () => {
        const name = newTypeName.trim();
        if (!name) {
            setError('Enter a type name.');
            return;
        }
        if (types.some((t) => t.toLowerCase() === name.toLowerCase())) {
            setError('That type already exists in the dropdown.');
            return;
        }
        const next = [...types, name];
        setTypes(next);
        saveUtilityTypes(next);
        if (!isEditMode && !isTypeUsed(name)) {
            setType(name);
        }
        setNewTypeName('');
        setShowAddType(false);
        setError('');
    };

    const handleRemoveType = (name) => {
        if (isTypeUsed(name)) {
            setError(`“${name}” is in use and cannot be removed from the dropdown.`);
            return;
        }
        const next = types.filter((t) => t.toLowerCase() !== String(name).toLowerCase());
        setTypes(next);
        saveUtilityTypes(next);
        if (type.toLowerCase() === String(name).toLowerCase()) {
            const firstAvailable = next.find((t) => !isTypeUsed(t));
            setType(firstAvailable || '');
        }
        setError('');
    };

    const handleToggle = (key, value) => {
        setToggles((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const selected = isEditMode ? lockedType : type;
        if (!selected) {
            setError('Select a utility type.');
            return;
        }
        if (!isEditMode && isTypeUsed(selected)) {
            setError(`“${selected}” is already used. Choose another type.`);
            return;
        }
        onSave?.({
            type: selected,
            fields: {
                ...toggles,
                attachment: attachmentEnabled,
            },
            attachment: null,
        });
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-utility-title"
            >
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
                    <h2 id="add-utility-title" className="text-lg sm:text-xl font-bold text-gray-800">
                        {isEditMode ? `Edit Utility — ${lockedType}` : 'Add Utility'}
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
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <label className="text-sm font-semibold text-gray-700">
                                    Type <span className="text-red-500">*</span>
                                </label>
                                {canManageTypes && !isEditMode ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddType((v) => !v);
                                            setError('');
                                        }}
                                        className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Add type
                                    </button>
                                ) : null}
                            </div>

                            {isEditMode ? (
                                <input
                                    type="text"
                                    value={lockedType}
                                    readOnly
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                />
                            ) : (
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    required
                                >
                                    <option value="" disabled>
                                        Select type
                                    </option>
                                    {sortedTypes.map((t) => {
                                        const used = isTypeUsed(t);
                                        return (
                                            <option key={t} value={t} disabled={used}>
                                                {used ? `${t} (in use)` : t}
                                            </option>
                                        );
                                    })}
                                </select>
                            )}

                            {!canManageTypes ? (
                                <p className="mt-1 text-xs text-gray-500">
                                    Only administrators can add types. There are no fixed/static options.
                                </p>
                            ) : (
                                <p className="mt-1 text-xs text-gray-500">
                                    No static types — use Add type. Used types stay listed but are disabled.
                                </p>
                            )}

                            {canManageTypes && showAddType && !isEditMode ? (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={newTypeName}
                                        onChange={(e) => setNewTypeName(e.target.value)}
                                        placeholder="New type name"
                                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddType}
                                        className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium whitespace-nowrap"
                                    >
                                        Save type
                                    </button>
                                </div>
                            ) : null}

                            {canManageTypes && !isEditMode && sortedTypes.length > 0 ? (
                                <ul className="mt-3 space-y-1.5 max-h-36 overflow-y-auto">
                                    {sortedTypes.map((t) => {
                                        const used = isTypeUsed(t);
                                        return (
                                            <li
                                                key={`manage-${t}`}
                                                className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/80 px-2.5 py-1.5"
                                            >
                                                <span className="text-xs text-gray-700 truncate">
                                                    {t}
                                                    {used ? (
                                                        <span className="ml-1 text-amber-600">(in use)</span>
                                                    ) : null}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={used}
                                                    title={
                                                        used
                                                            ? 'In use — delete disabled'
                                                            : 'Remove from dropdown'
                                                    }
                                                    onClick={() => handleRemoveType(t)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                                >
                                                    <Trash2 size={12} />
                                                    Delete
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Include fields</p>
                            {TOGGLE_FIELDS.map((field) => (
                                <YesNoToggle
                                    key={field.key}
                                    name={`utility-${field.key}`}
                                    label={field.label}
                                    value={toggles[field.key]}
                                    onChange={(value) => handleToggle(field.key, value)}
                                />
                            ))}
                            <YesNoToggle
                                name="utility-attachment"
                                label="Attachment"
                                value={attachmentEnabled}
                                onChange={(value) => {
                                    setAttachmentEnabled(value);
                                    setError('');
                                }}
                            />
                        </div>

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
                            className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium"
                        >
                            {isEditMode ? 'Update Utility' : 'Save Utility'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
