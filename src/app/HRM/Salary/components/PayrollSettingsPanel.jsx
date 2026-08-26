'use client';

import { useEffect, useState } from 'react';
import { Loader2, Settings, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { PAYROLL_MONTH_DAYS, toPayrollMonthDay } from '../utils/payrollMonthDay';

const RULE_OPTIONS = [
    { key: 'allAttendanceMarked', label: 'All attendance marked' },
    { key: 'allPendingApprovalsCompleted', label: 'All pending approval completed' },
    { key: 'overtimeApprovedByHr', label: 'Overtime approval by HR' },
    { key: 'overtimeApprovedByHod', label: 'Overtime approved by HOD' },
    { key: 'allSickLeaveApproval', label: 'All sick leave approval' },
    { key: 'allAuthorizedLeaves', label: 'All authorized leaves' },
    { key: 'allUnauthorizedLeave', label: 'All unauthorized leave' },
];

const MODULE_CHECK_OPTIONS = [
    { key: 'fine', label: 'Fine' },
    { key: 'reward', label: 'Reward' },
    { key: 'ncr', label: 'NCR' },
    { key: 'loan', label: 'Loan' },
    { key: 'advance', label: 'Advance' },
    { key: 'utilityBillExcess', label: 'Utility bill excess' },
    { key: 'salaryProcessReminderToAccounts', label: 'Salary process remainder to Accounts' },
    { key: 'otherDeptHodsPendingApproval', label: 'Other dept HODs for pending approval' },
];

const EMPTY_RULES = [...RULE_OPTIONS, ...MODULE_CHECK_OPTIONS].reduce((acc, row) => {
    acc[row.key] = false;
    return acc;
}, {});

const EMPTY_FORM = {
    salaryProcessingDate: '',
    salaryProcessStartMonth: '',
    salaryCutoffDate: '',
    processingRules: { ...EMPTY_RULES },
    workingDaysRequiredToEligible: '',
    leaveSalaryWorkingDays: '',
    workingDaysRequiredForAirTicket: '',
};

function Checks({ options, form, onToggle }) {
    return (
        <div className="space-y-2 rounded-xl border border-[#EEF0F4] bg-[#F8FAFC] p-3">
            {options.map((row) => (
                <label key={row.key} className="flex items-center gap-2.5 text-sm text-[#334155] cursor-pointer">
                    <input type="checkbox" checked={Boolean(form.processingRules[row.key])} onChange={() => onToggle(row.key)} className="h-4 w-4 rounded border-slate-300 text-[#1D5FDB] focus:ring-[#1D5FDB]" />
                    <span>{row.label}</span>
                </label>
            ))}
        </div>
    );
}

export default function PayrollSettingsPanel({ open, onClose }) {
    const { toast } = useToast();
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErrors({});
            try {
                const res = await axiosInstance.get('/Employee/payroll-settings', { skipToast: true });
                if (!cancelled) {
                    setForm({
                        salaryProcessingDate: toPayrollMonthDay(res.data?.salaryProcessingDate),
                        salaryProcessStartMonth: res.data?.salaryProcessStartMonth || '',
                        salaryCutoffDate: toPayrollMonthDay(res.data?.salaryCutoffDate),
                        processingRules: { ...EMPTY_RULES, ...(res.data?.processingRules || {}) },
                        workingDaysRequiredToEligible: res.data?.workingDaysRequiredToEligible ?? '',
                        leaveSalaryWorkingDays: res.data?.leaveSalaryWorkingDays ?? '',
                        workingDaysRequiredForAirTicket: res.data?.workingDaysRequiredForAirTicket ?? '',
                    });
                }
            } catch {
                if (!cancelled) setForm(EMPTY_FORM);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    function toggleRule(key) {
        setForm((prev) => ({ ...prev, processingRules: { ...prev.processingRules, [key]: !prev.processingRules[key] } }));
    }

    function validate() {
        const next = {};
        if (!form.salaryProcessingDate) next.salaryProcessingDate = 'Required';
        if (!form.salaryProcessStartMonth) next.salaryProcessStartMonth = 'Required';
        if (!form.salaryCutoffDate) next.salaryCutoffDate = 'Required';
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            await axiosInstance.put('/Employee/payroll-settings', form);
            toast({ title: 'Settings saved', description: 'Payroll processing settings updated.' });
            onClose?.();
        } catch (err) {
            toast({ title: 'Could not save settings', description: err?.response?.data?.message || 'Please try again.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;
    const fieldClass = 'h-10 w-full rounded-xl border border-[#E8EDF3] bg-white px-3 text-sm font-medium text-[#1E293B] outline-none focus:ring-2 focus:ring-[#4C8EF5]/20';

    return (
        <div className="fixed inset-0 z-[80] flex justify-end">
            <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Close payroll settings" onClick={onClose} />
            <aside className="relative h-full w-full max-w-[420px] bg-white shadow-2xl border-l border-[#EEF0F4] flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEF0F4]">
                    <div className="flex items-center gap-2">
                        <Settings size={18} className="text-[#1D5FDB]" />
                        <h2 className="text-lg font-bold text-[#0F172A]">Payroll Settings</h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-slate-50 hover:text-slate-700" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                {loading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-[#1D5FDB]" /></div>
                ) : (
                    <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-semibold text-[#334155]">Salary processing date <span className="text-red-500">*</span></span>
                                <select
                                    required
                                    value={form.salaryProcessingDate}
                                    onChange={(e) => setForm((p) => ({ ...p, salaryProcessingDate: e.target.value }))}
                                    className={fieldClass}
                                >
                                    <option value="">Select day</option>
                                    {PAYROLL_MONTH_DAYS.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                                <span className="text-xs text-[#64748B]">Same day every month (1–28)</span>
                                {errors.salaryProcessingDate ? <span className="text-xs text-red-500">{errors.salaryProcessingDate}</span> : null}
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-semibold text-[#334155]">Salary process start month <span className="text-red-500">*</span></span>
                                <input type="month" required value={form.salaryProcessStartMonth} onChange={(e) => setForm((p) => ({ ...p, salaryProcessStartMonth: e.target.value }))} className={fieldClass} />
                                {errors.salaryProcessStartMonth ? <span className="text-xs text-red-500">{errors.salaryProcessStartMonth}</span> : null}
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-semibold text-[#334155]">Attendance cutoff date <span className="text-red-500">*</span></span>
                                <select
                                    required
                                    value={form.salaryCutoffDate}
                                    onChange={(e) => setForm((p) => ({ ...p, salaryCutoffDate: e.target.value }))}
                                    className={fieldClass}
                                >
                                    <option value="">Select day</option>
                                    {PAYROLL_MONTH_DAYS.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                                <span className="text-xs text-[#64748B]">Same day every month (1–28)</span>
                                {errors.salaryCutoffDate ? <span className="text-xs text-red-500">{errors.salaryCutoffDate}</span> : null}
                            </label>
                            <div>
                                <p className="text-[13px] font-semibold text-[#334155] mb-2">Salary processing rules <span className="text-red-500">*</span></p>
                                <Checks options={RULE_OPTIONS} form={form} onToggle={toggleRule} />
                            </div>
                            <div>
                                <p className="text-[13px] font-semibold text-[#334155] mb-2">Module checks</p>
                                <Checks options={MODULE_CHECK_OPTIONS} form={form} onToggle={toggleRule} />
                            </div>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-semibold text-[#334155]">Number of working days required to eligible</span>
                                <input type="number" min="0" step="1" value={form.workingDaysRequiredToEligible} onChange={(e) => setForm((p) => ({ ...p, workingDaysRequiredToEligible: e.target.value }))} className={fieldClass} placeholder="e.g. 240" />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-semibold text-[#334155]">Leave salary</span>
                                <input type="number" min="0" step="1" value={form.leaveSalaryWorkingDays} onChange={(e) => setForm((p) => ({ ...p, leaveSalaryWorkingDays: e.target.value }))} className={fieldClass} placeholder="Working days" />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-semibold text-[#334155]">Number of working days required for air ticket</span>
                                <input type="number" min="0" step="1" value={form.workingDaysRequiredForAirTicket} onChange={(e) => setForm((p) => ({ ...p, workingDaysRequiredForAirTicket: e.target.value }))} className={fieldClass} placeholder="e.g. 240" />
                            </label>
                        </div>
                        <div className="px-5 py-4 border-t border-[#EEF0F4] flex items-center justify-end gap-2">
                            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-[#E8EDF3] text-sm font-semibold text-[#475569] hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={saving} className="h-10 px-4 rounded-xl bg-[#1D5FDB] text-white text-sm font-semibold hover:bg-[#184fc0] disabled:opacity-60 inline-flex items-center gap-2">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : null} Save
                            </button>
                        </div>
                    </form>
                )}
            </aside>
        </div>
    );
}
