'use client';

import { useRef, useState } from 'react';
import { ExternalLink, Minus, Paperclip, Plus, X } from 'lucide-react';
import { PAYROLL_MONTH_DAYS, toPayrollMonthDay } from '../utils/payrollMonthDay';
import {
    ATTENDANCE_COMPLETION_CHECKS,
    EMPTY_POLICY_ATTACHMENT,
    HR_RULE_CHECKS,
    REMINDER_DAY_OPTIONS,
    REMINDER_FOR_WHOM_OPTIONS,
    REMINDER_LABELS,
    emptyLateRule,
} from '../utils/salaryPolicyForm';
import { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT, openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { validateErpUploadFile } from '@/utils/uploadFileTypes';

const inputClass =
    'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const compactInputClass =
    'h-9 w-[4.75rem] rounded-lg border border-gray-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const compactSelectClass =
    'h-9 min-w-[7.25rem] rounded-lg border border-gray-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const forWhomSelectClass =
    'h-9 min-w-[11rem] rounded-lg border border-gray-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

const LATE_DEDUCT_OPTIONS = [
    { value: 'quarter', label: 'Quarter' },
    { value: 'half', label: 'Half' },
    { value: 'full', label: 'Full' },
];

function SectionHead({ roman, title }) {
    return (
        <div className="px-3 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-gray-800">
                {roman}. {title}
            </h2>
        </div>
    );
}

function CheckRow({ checked, label, onChange, indent, number }) {
    return (
        <label
            className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-slate-50 cursor-pointer ${
                indent ? 'px-8 sm:px-10' : 'px-3 sm:px-4'
            }`}
        >
            {number != null ? (
                <span className="w-5 shrink-0 text-sm font-semibold text-slate-600 tabular-nums">{number}.</span>
            ) : null}
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">{label}</span>
        </label>
    );
}

function LetterHead({ letter, title }) {
    return (
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 bg-[#F7F9FC] border-b border-gray-200">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-gray-800">
                {letter}. {title}
            </h3>
        </div>
    );
}

function FieldRow({ label, hint, children, indent }) {
    return (
        <div
            className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-b-0 ${
                indent ? 'px-8 sm:px-10' : 'px-3 sm:px-4'
            }`}
        >
            <span className="text-sm text-slate-700 min-w-[220px]">{label}</span>
            <div className="w-full sm:max-w-[240px]">
                {children}
                {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
            </div>
        </div>
    );
}

function NumberedFieldRow({ number, label, hint, indent = true, children }) {
    return (
        <div
            className={`flex flex-col lg:flex-row lg:items-center gap-2 py-2.5 border-b border-gray-100 ${
                indent ? 'px-8 sm:px-10' : 'px-3 sm:px-4'
            }`}
        >
            <div className="flex items-center gap-3 min-w-0 lg:min-w-[260px]">
                <span className="w-5 shrink-0 text-sm font-semibold text-slate-600 tabular-nums">
                    {number != null ? `${number}.` : ''}
                </span>
                <span className="text-sm text-slate-700">{label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {children}
                {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
            </div>
        </div>
    );
}

function LateRuleFields({ row, onChange }) {
    return (
        <>
            <label className="flex items-center gap-1.5">
                <input
                    type="number"
                    min="0"
                    value={row.minutes}
                    onChange={(e) => onChange('minutes', e.target.value)}
                    className={compactInputClass}
                    placeholder="0"
                />
                <span className="text-xs text-slate-500">minute</span>
            </label>
            <label className="flex items-center gap-1.5">
                <input
                    type="number"
                    min="0"
                    value={row.events}
                    onChange={(e) => onChange('events', e.target.value)}
                    className={compactInputClass}
                    placeholder="0"
                />
                <span className="text-xs text-slate-500">event</span>
            </label>
            <label className="flex items-center gap-1.5">
                <select
                    value={row.deduct}
                    onChange={(e) => onChange('deduct', e.target.value)}
                    className={compactSelectClass}
                >
                    <option value="">Deduct</option>
                    {LATE_DEDUCT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </label>
        </>
    );
}

function LateRulesBlock({ number, label, rows, onChange, onAdd }) {
    function updateRow(index, field, value) {
        onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    }
    function removeRow(index) {
        if (rows.length <= 1) return;
        onChange(rows.filter((_, i) => i !== index));
    }

    return (
        <div className="border-b border-gray-100">
            {rows.map((row, index) => (
                <div key={index} className="flex flex-col lg:flex-row lg:items-center gap-2 py-2.5 px-8 sm:px-10">
                    <div className="flex items-center gap-3 min-w-0 lg:min-w-[260px]">
                        {index === 0 ? (
                            <>
                                <span className="w-5 shrink-0 text-sm font-semibold text-slate-600 tabular-nums">
                                    {number}.
                                </span>
                                <span className="text-sm text-slate-700">{label}</span>
                            </>
                        ) : (
                            <span className="lg:min-w-[260px]" />
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <LateRuleFields row={row} onChange={(field, value) => updateRow(index, field, value)} />
                        {index === 0 ? (
                            <button
                                type="button"
                                onClick={onAdd}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-teal-600 hover:bg-teal-50"
                                aria-label={`Add ${label} rule`}
                            >
                                <Plus size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => removeRow(index)}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-slate-500 hover:bg-slate-50"
                                aria-label={`Remove ${label} rule`}
                            >
                                <Minus size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function DaySelect({ value, onChange }) {
    return (
        <select value={toPayrollMonthDay(value)} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">Select day</option>
            {PAYROLL_MONTH_DAYS.map((day) => (
                <option key={day} value={day}>
                    {day}
                </option>
            ))}
        </select>
    );
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export default function SalaryPolicyFields({ form, setForm }) {
    const fileRef = useRef(null);
    const [attachError, setAttachError] = useState('');
    const attachment = form.attachment || EMPTY_POLICY_ATTACHMENT;
    const hasAttachment = Boolean(attachment.name || attachment.publicId || attachment.url || attachment.data);

    function toggleRule(key) {
        setForm((prev) => ({
            ...prev,
            processingRules: { ...prev.processingRules, [key]: !prev.processingRules[key] },
        }));
    }

    async function handleAttachmentFile(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const check = validateErpUploadFile(file);
        if (!check.ok) {
            setAttachError(check.message);
            return;
        }
        setAttachError('');
        const data = await readFileAsDataUrl(file);
        setForm((p) => ({
            ...p,
            attachment: {
                name: file.name,
                mimeType: file.type || (check.kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
                url: '',
                publicId: '',
                data,
                remove: false,
            },
        }));
    }

    function clearAttachment() {
        setAttachError('');
        setForm((p) => ({ ...p, attachment: { ...EMPTY_POLICY_ATTACHMENT, remove: true } }));
    }

    async function previewAttachment() {
        if (attachment.data) {
            window.open(attachment.data, '_blank', 'noopener,noreferrer');
            return;
        }
        await openAttachmentInNewTab(attachment, {
            name: attachment.name || 'Salary policy attachment',
            mimeType: attachment.mimeType,
        });
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <SectionHead roman="I" title="General Information" />
                <FieldRow label="Salary processing date" hint="Same day every month (1–28)">
                    <DaySelect
                        value={form.salaryProcessingDate}
                        onChange={(day) => setForm((p) => ({ ...p, salaryProcessingDate: day }))}
                    />
                </FieldRow>
                <FieldRow label="Salary process start month">
                    <input
                        type="month"
                        value={form.salaryProcessStartMonth}
                        onChange={(e) => setForm((p) => ({ ...p, salaryProcessStartMonth: e.target.value }))}
                        className={inputClass}
                    />
                </FieldRow>
                <FieldRow label="Attendance cutoff date" hint="Same day every month (1–28)">
                    <DaySelect
                        value={form.salaryCutoffDate}
                        onChange={(day) => setForm((p) => ({ ...p, salaryCutoffDate: day }))}
                    />
                </FieldRow>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <SectionHead roman="II" title="Salary Processing Rules" />

                <LetterHead letter="A" title="Attendance completion" />
                {ATTENDANCE_COMPLETION_CHECKS.map((row, index) => (
                    <CheckRow
                        key={row.key}
                        indent
                        number={index + 1}
                        label={row.label}
                        checked={Boolean(form.processingRules[row.key])}
                        onChange={() => toggleRule(row.key)}
                    />
                ))}

                <LetterHead letter="B" title="Unauthorized attendance for annual leave" />

                <LetterHead letter="C" title="HR Rules" />
                {HR_RULE_CHECKS.map((row, index) => (
                    <CheckRow
                        key={row.key}
                        indent
                        number={index + 1}
                        label={row.label}
                        checked={Boolean(form.processingRules[row.key])}
                        onChange={() => toggleRule(row.key)}
                    />
                ))}
                <NumberedFieldRow
                    number={8}
                    label="Authorized leave deduction"
                    hint="Days deducted for one authorized leave"
                >
                    <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.authorizedLeaveDeductionDays}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                authorizedLeaveDeductionDays: e.target.value,
                            }))
                        }
                        className={compactInputClass}
                        placeholder="0"
                    />
                    <span className="text-xs text-slate-500">day</span>
                </NumberedFieldRow>
                <NumberedFieldRow
                    number={9}
                    label="Unauth leave deduction"
                    hint="Days deducted for one unauthorized leave"
                >
                    <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.unauthorizedLeaveDeductionDays}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                unauthorizedLeaveDeductionDays: e.target.value,
                            }))
                        }
                        className={compactInputClass}
                        placeholder="0"
                    />
                    <span className="text-xs text-slate-500">day</span>
                </NumberedFieldRow>
                <LateRulesBlock
                    number={10}
                    label="Late in"
                    rows={form.lateInRules}
                    onChange={(rows) => setForm((p) => ({ ...p, lateInRules: rows }))}
                    onAdd={() =>
                        setForm((p) => ({
                            ...p,
                            lateInRules: [...p.lateInRules, emptyLateRule()],
                            lateOutRules: [...p.lateOutRules, emptyLateRule()],
                        }))
                    }
                />
                <LateRulesBlock
                    number={11}
                    label="Late out"
                    rows={form.lateOutRules}
                    onChange={(rows) => setForm((p) => ({ ...p, lateOutRules: rows }))}
                    onAdd={() =>
                        setForm((p) => ({
                            ...p,
                            lateInRules: [...p.lateInRules, emptyLateRule()],
                            lateOutRules: [...p.lateOutRules, emptyLateRule()],
                        }))
                    }
                />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <SectionHead roman="III" title="Account Policy" />
                {form.salaryProcessReminders.map((row, index) => (
                    <NumberedFieldRow
                        key={REMINDER_LABELS[index]}
                        indent={false}
                        number={index === 0 ? 1 : null}
                        label={REMINDER_LABELS[index]}
                    >
                        <select
                            value={String(row.daysBefore || '')}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    salaryProcessReminders: p.salaryProcessReminders.map((item, i) =>
                                        i === index ? { ...item, daysBefore: e.target.value } : item,
                                    ),
                                }))
                            }
                            className={compactSelectClass}
                        >
                            <option value="">Days before</option>
                            {REMINDER_DAY_OPTIONS.map((day) => (
                                <option key={day} value={day}>
                                    {day} days
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-slate-500">for whom</span>
                        <select
                            value={row.forWhom}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    salaryProcessReminders: p.salaryProcessReminders.map((item, i) =>
                                        i === index ? { ...item, forWhom: e.target.value } : item,
                                    ),
                                }))
                            }
                            className={forWhomSelectClass}
                        >
                            <option value="">Select</option>
                            {REMINDER_FOR_WHOM_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </NumberedFieldRow>
                ))}
                <div className="flex flex-col gap-2 py-2.5 border-b border-gray-100 px-3 sm:px-4">
                    <div className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-sm font-semibold text-slate-600 tabular-nums">2.</span>
                        <span className="text-sm text-slate-700">Number of working days eligible for</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 pl-8">
                        <label className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 w-24">Leave</span>
                            <input
                                type="number"
                                min="0"
                                value={form.leaveSalaryWorkingDays}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        leaveSalaryWorkingDays: e.target.value,
                                    }))
                                }
                                className={compactInputClass}
                                placeholder="300"
                            />
                        </label>
                        <label className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 w-24">Air ticket</span>
                            <input
                                type="number"
                                min="0"
                                value={form.workingDaysRequiredForAirTicket}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        workingDaysRequiredForAirTicket: e.target.value,
                                    }))
                                }
                                className={compactInputClass}
                                placeholder="0"
                            />
                        </label>
                    </div>
                </div>
                <CheckRow
                    number={3}
                    label="Gratuity calculation required"
                    checked={Boolean(form.processingRules.gratuityCalculationRequired)}
                    onChange={() => toggleRule('gratuityCalculationRequired')}
                />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <SectionHead roman="IV" title="Attachment" />
                <div className="flex flex-col lg:flex-row lg:items-center gap-2 py-2.5 px-3 sm:px-4">
                    <div className="flex items-center gap-3 min-w-0 lg:min-w-[260px]">
                        <span className="w-5 shrink-0 text-sm font-semibold text-slate-600 tabular-nums">1.</span>
                        <span className="text-sm text-slate-700">Attachment</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ERP_ATTACHMENT_ACCEPT}
                            className="hidden"
                            onChange={handleAttachmentFile}
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                        >
                            <Paperclip size={14} className="text-slate-400" />
                            {hasAttachment ? 'Change file' : 'Choose file'}
                        </button>
                        {hasAttachment ? (
                            <>
                                <button
                                    type="button"
                                    onClick={previewAttachment}
                                    className="h-9 px-2.5 rounded-lg border border-gray-200 text-slate-500 hover:bg-slate-50 inline-flex items-center"
                                    aria-label="View attachment"
                                >
                                    <ExternalLink size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={clearAttachment}
                                    className="h-9 px-2.5 rounded-lg border border-gray-200 text-slate-500 hover:bg-slate-50 inline-flex items-center"
                                    aria-label="Remove attachment"
                                >
                                    <X size={14} />
                                </button>
                                <span className="text-xs text-slate-600 truncate max-w-[16rem]">
                                    {attachment.name || 'Attached'}
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-slate-400">Optional</span>
                        )}
                    </div>
                </div>
                <p className="px-3 sm:px-4 pb-3 pl-8 sm:pl-12 text-xs text-slate-400">
                    {attachError || ERP_ATTACHMENT_HINT}
                </p>
            </div>
        </div>
    );
}
