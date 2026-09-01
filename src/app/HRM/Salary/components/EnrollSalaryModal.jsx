'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { PAYROLL_MONTH_DAYS, toPayrollMonthDay } from '../utils/payrollMonthDay';
import { EMPTY_POLICY_FORM, policyFormFromApi } from '../utils/salaryPolicyForm';
import SalaryPolicyFields from './SalaryPolicyFields';

function pad2(n) {
    return String(n).padStart(2, '0');
}

function todayParts() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function defaultSalaryDay(settings) {
    return toPayrollMonthDay(settings?.salaryProcessingDate) || '1';
}

function defaultFromMonth(settings) {
    const startMonth = String(settings?.salaryProcessStartMonth || '').trim();
    if (/^\d{4}-\d{2}$/.test(startMonth)) return startMonth;
    return `${todayParts().year}-${pad2(todayParts().month)}`;
}

function employeeLabel(emp) {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return name ? `${emp.employeeId} — ${name}` : emp.employeeId;
}

function EmployeeSelect({ employees, enrolledIds, value, onChange, disabled }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const enrolled = useMemo(() => new Set(enrolledIds), [enrolledIds]);
    const selected = employees.find((emp) => emp.employeeId === value);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((emp) => employeeLabel(emp).toLowerCase().includes(q));
    }, [employees, query]);

    useEffect(() => {
        const onDoc = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setOpen((v) => !v);
                    setQuery('');
                }}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-left flex items-center justify-between gap-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
            >
                <span className={selected ? 'text-slate-800 truncate' : 'text-slate-400'}>
                    {selected ? employeeLabel(selected) : 'Select employee'}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-slate-50">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search name or ID"
                            className="flex-1 bg-transparent text-sm outline-none text-slate-700"
                        />
                    </div>
                    <ul className="max-h-56 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-3 text-sm text-slate-400">No employees found</li>
                        ) : (
                            filtered.map((emp) => {
                                const already = enrolled.has(emp.employeeId);
                                return (
                                    <li key={emp.employeeId}>
                                        <button
                                            type="button"
                                            disabled={already}
                                            onClick={() => {
                                                if (already) return;
                                                onChange(emp.employeeId);
                                                setOpen(false);
                                                setQuery('');
                                            }}
                                            className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2 ${
                                                already
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : emp.employeeId === value
                                                      ? 'bg-blue-50 text-blue-700 font-medium'
                                                      : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="truncate">{employeeLabel(emp)}</span>
                                            {already ? (
                                                <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                                                    Enrolled
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

export default function EnrollSalaryModal({ open, onClose, onEnrolled, targetEmployeeId = '' }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [enrolledIds, setEnrolledIds] = useState([]);
    const [employeeId, setEmployeeId] = useState('');
    const [step, setStep] = useState('pick');
    const [salaryDay, setSalaryDay] = useState('');
    const [fromMonth, setFromMonth] = useState('');
    const [companySettings, setCompanySettings] = useState(null);
    const [policyForm, setPolicyForm] = useState(EMPTY_POLICY_FORM);

    const selectedEmployee = employees.find((emp) => emp.employeeId === employeeId);
    const isPolicyStep = step === 'policy';
    const lockedEmployee = Boolean(targetEmployeeId);

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        const presetId = String(targetEmployeeId || '').trim();
        setStep(presetId ? 'dates' : 'pick');
        setEmployeeId(presetId);
        setSalaryDay('');
        setFromMonth('');
        setCompanySettings(null);
        setPolicyForm(EMPTY_POLICY_FORM);
        setLoading(true);
        (async () => {
            try {
                const [optionsRes, settingsRes] = await Promise.all([
                    axiosInstance.get('/Employee/salary-enroll/options', { skipToast: true }),
                    axiosInstance.get('/Employee/payroll-settings', { skipToast: true }),
                ]);
                if (cancelled) return;
                const list = Array.isArray(optionsRes.data?.employees) ? optionsRes.data.employees : [];
                const enrolled = Array.isArray(optionsRes.data?.enrolledIds) ? optionsRes.data.enrolledIds : [];
                setEmployees(list);
                setEnrolledIds(enrolled);
                const settings = settingsRes.data || {};
                setCompanySettings(settings);
                setSalaryDay(defaultSalaryDay(settings));
                setFromMonth(defaultFromMonth(settings));

                if (presetId && enrolled.includes(presetId)) {
                    const policyRes = await axiosInstance.get(
                        `/Employee/salary-enroll/${encodeURIComponent(presetId)}/policy`,
                        { skipToast: true },
                    );
                    if (cancelled) return;
                    setPolicyForm(policyFormFromApi(policyRes.data));
                    setStep('policy');
                } else if (presetId) {
                    setStep('dates');
                }
            } catch (err) {
                if (!cancelled) {
                    toast({
                        title: 'Could not load enroll salary',
                        description: err?.response?.data?.message || 'Please try again.',
                        variant: 'destructive',
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, targetEmployeeId]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const canExpand = Boolean(employeeId) && !enrolledIds.includes(employeeId);
    const canEnroll = canExpand && salaryDay;

    async function handleEnroll() {
        if (!canEnroll) return;
        setSaving(true);
        try {
            const res = await axiosInstance.post('/Employee/salary-enroll', {
                employeeId,
                salaryDate: salaryDay,
                fromMonth,
            });
            const policySource = res.data?.enrollment?.policy || companySettings || {};
            setPolicyForm(
                policyFormFromApi({
                    ...policySource,
                    salaryProcessingDate: salaryDay || policySource.salaryProcessingDate,
                }),
            );
            setStep('policy');
            onEnrolled?.();
        } catch (err) {
            toast({
                title: 'Could not enroll employee',
                description: err?.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdatePolicy() {
        if (!employeeId) return;
        setSaving(true);
        try {
            await axiosInstance.put(
                `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/policy`,
                policyForm,
            );
            toast({ title: 'Employee salary policy saved' });
            onEnrolled?.();
            onClose?.();
        } catch (err) {
            toast({
                title: 'Could not save employee policy',
                description: err?.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/30"
                aria-label="Close enroll salary"
                onClick={onClose}
            />
            <div
                className={`relative w-full rounded-xl bg-white shadow-2xl border border-gray-100 flex flex-col ${
                    isPolicyStep ? 'max-w-4xl max-h-[92vh]' : 'max-w-lg'
                }`}
            >
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-slate-800">
                            {isPolicyStep ? 'Employee Salary Policy' : 'Enroll Salary'}
                        </h2>
                        {isPolicyStep && selectedEmployee ? (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                {employeeLabel(selectedEmployee)}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 size={22} className="animate-spin text-blue-600" />
                    </div>
                ) : isPolicyStep ? (
                    <>
                        <div className="px-4 sm:px-5 py-4 overflow-y-auto flex-1 min-h-0">
                            <SalaryPolicyFields form={policyForm} setForm={setPolicyForm} />
                        </div>
                        <div className="flex justify-end gap-2 px-4 sm:px-5 py-3 border-t border-gray-100 shrink-0 bg-white rounded-b-xl">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleUpdatePolicy}
                                className="h-10 px-4 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                Update
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-slate-700">Employee</span>
                            <EmployeeSelect
                                employees={employees}
                                enrolledIds={enrolledIds}
                                value={employeeId}
                                onChange={(id) => {
                                    setEmployeeId(id);
                                    setStep('pick');
                                }}
                                disabled={saving || lockedEmployee}
                            />
                        </label>

                        {step === 'dates' ? (
                            <label className="flex flex-col gap-1.5">
                                <span className="text-sm font-medium text-slate-700">Salary day</span>
                                <select
                                    value={salaryDay}
                                    onChange={(e) => setSalaryDay(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                >
                                    <option value="">Select day</option>
                                    {PAYROLL_MONTH_DAYS.map((day) => (
                                        <option key={day} value={day}>
                                            {day}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-xs text-slate-500">Same day every month (1–28)</span>
                            </label>
                        ) : null}

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            {step === 'pick' ? (
                                <button
                                    type="button"
                                    disabled={!canExpand}
                                    onClick={() => setStep('dates')}
                                    className="h-10 px-4 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    Enroll
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={!canEnroll || saving}
                                    onClick={handleEnroll}
                                    className="h-10 px-4 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Enroll
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
