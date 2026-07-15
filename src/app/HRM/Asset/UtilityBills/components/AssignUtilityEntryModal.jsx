'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 8,
        borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(20, 184, 166, 0.25)' : 'none',
        '&:hover': { borderColor: state.isFocused ? '#14b8a6' : '#9ca3af' },
        fontSize: 14,
    }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

/** Same “Active” as Employees list Profile Status column. */
function isActiveProfileEmployee(emp) {
    const profile = String(emp?.profileStatus || '').trim().toLowerCase();
    const approval = String(emp?.profileApprovalStatus || '').trim().toLowerCase();
    const workflow = String(emp?.profileWorkflow?.status || '').trim().toLowerCase();
    return profile === 'active' || approval === 'active' || workflow === 'active';
}

function isActiveCompany(row) {
    return String(row?.status || '').trim().toLowerCase() === 'active';
}

function employeeLabel(emp) {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
    return emp.employeeId ? `${name} (${emp.employeeId})` : name;
}

function companyLabel(comp) {
    const name = comp.name || 'Company';
    return comp.companyId ? `${name} (${comp.companyId})` : name;
}

/**
 * Assign utility entry — Employee or Company dropdown (Active status only).
 */
export default function AssignUtilityEntryModal({ isOpen, onClose, entry, onSave }) {
    const [assignedToType, setAssignedToType] = useState('Employee');
    const [assignedToId, setAssignedToId] = useState('');
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const prevType = entry?.assignedToType === 'Company' ? 'Company' : 'Employee';
        setAssignedToType(prevType);
        setAssignedToId(entry?.assignedToId || '');
        setError('');

        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [empRes, compRes] = await Promise.all([
                    axiosInstance.get('/employee', {
                        params: { profileStatus: 'active', limit: 1000 },
                        skipToast: true,
                    }),
                    axiosInstance.get('/Company', {
                        params: { status: 'Active' },
                        skipToast: true,
                    }),
                ]);
                if (cancelled) return;
                setEmployees(empRes.data?.employees || []);
                setCompanies(compRes.data?.companies || compRes.data || []);
            } catch {
                if (!cancelled) {
                    setEmployees([]);
                    setCompanies([]);
                    setError('Failed to load employees or companies.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, entry?.id, entry?.assignedToId, entry?.assignedToType]);

    const activeEmployees = useMemo(
        () => (employees || []).filter(isActiveProfileEmployee),
        [employees],
    );

    const activeCompanies = useMemo(
        () => (companies || []).filter(isActiveCompany),
        [companies],
    );

    const employeeOptions = useMemo(
        () =>
            activeEmployees.map((emp) => ({
                value: emp._id,
                label: employeeLabel(emp),
                raw: emp,
            })),
        [activeEmployees],
    );

    const companyOptions = useMemo(
        () =>
            activeCompanies.map((comp) => ({
                value: comp._id,
                label: companyLabel(comp),
                raw: comp,
            })),
        [activeCompanies],
    );

    const selectedOption = useMemo(() => {
        const opts = assignedToType === 'Employee' ? employeeOptions : companyOptions;
        return opts.find((o) => String(o.value) === String(assignedToId)) || null;
    }, [assignedToType, assignedToId, employeeOptions, companyOptions]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!assignedToId || !selectedOption) {
            setError(
                assignedToType === 'Employee'
                    ? 'Please select an active employee.'
                    : 'Please select an active company.',
            );
            return;
        }

        onSave?.({
            assignedToType,
            assignedToId: selectedOption.value,
            assignedTo: selectedOption.label,
            assignedToName: selectedOption.label,
        });
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-utility-entry-title"
            >
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
                    <h2 id="assign-utility-entry-title" className="text-lg font-bold text-gray-800">
                        Assign {entry?.type || 'Utility'}
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

                <form onSubmit={handleSubmit}>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Assign To
                            </label>
                            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAssignedToType('Employee');
                                        setAssignedToId('');
                                        setError('');
                                    }}
                                    className={`py-2 rounded-md text-xs font-semibold transition-colors ${
                                        assignedToType === 'Employee'
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Employee
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAssignedToType('Company');
                                        setAssignedToId('');
                                        setError('');
                                    }}
                                    className={`py-2 rounded-md text-xs font-semibold transition-colors ${
                                        assignedToType === 'Company'
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Company
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                {assignedToType === 'Employee' ? 'Active Employee' : 'Active Company'}
                            </label>
                            <Select
                                value={selectedOption}
                                onChange={(opt) => {
                                    setAssignedToId(opt?.value || '');
                                    setError('');
                                }}
                                options={assignedToType === 'Employee' ? employeeOptions : companyOptions}
                                placeholder={
                                    loading
                                        ? 'Loading...'
                                        : assignedToType === 'Employee'
                                          ? 'Search active employee...'
                                          : 'Search active company...'
                                }
                                isClearable
                                isSearchable
                                isDisabled={loading}
                                styles={selectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                noOptionsMessage={() =>
                                    loading
                                        ? 'Loading...'
                                        : assignedToType === 'Employee'
                                          ? 'No active employees found'
                                          : 'No active companies found'
                                }
                            />
                        </div>

                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    </div>

                    <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-medium"
                        >
                            Assign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
