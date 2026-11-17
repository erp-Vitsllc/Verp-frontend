'use client';

import { useEffect, useState } from 'react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Coins,
    Gavel,
    Home,
    Info,
    Layers,
    Link2,
    Lock,
    Paperclip,
    Save,
    UserRound,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoCustomerListRows } from '@/utils/zohoCustomers';
import { dubaiDateKey, formatAed, formatWorkOrderDate, nextWorkOrderNo } from './workOrderNumber';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

const STEP1_RULES = [
    'Quotation is required to create a Work Order.',
    'Values (quotation date, amount, VAT and total) are auto-filled from Zoho.',
    'Customer must be selected.',
    'Quotation value cannot be edited manually.',
];

const STEP2_RULES = [
    'Only one LPO choice can be on at a time.',
    'Required: LPO number, date, value and attachment stay off. No LPO is added now.',
    'Not required: an attachment is required. The salesperson is emailed and notified that the LPO was not filled.',
    'LPO received: LPO number, date, value and attachment are required.',
    'One quotation and one LPO per work order.',
];

const fieldClass = `h-12 w-full rounded-xl border border-[#e5edf6] bg-white px-3.5 text-[15px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-slate-400 ${FOCUS}`;

const LPO_OPTIONS = [
    { id: 'required', label: 'Required' },
    { id: 'not_required', label: 'Not required' },
    { id: 'received', label: 'LPO received' },
];

function readLocalFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            mime: file.type || 'application/octet-stream',
            data: String(reader.result || ''),
        });
        reader.onerror = () => reject(new Error('Could not read the attachment'));
        reader.readAsDataURL(file);
    });
}

function Skyline() {
    return (
        <svg aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-[120px] w-[min(560px,58%)]" viewBox="0 0 620 150" fill="none">
            <ellipse cx="470" cy="40" rx="180" ry="48" fill="#e7f2fc" />
            <g fill="#c9ddf4">
                <rect x="230" y="84" width="26" height="66" />
                <rect x="260" y="72" width="16" height="78" />
                <path d="M318 150V58h5.5l3.2-24 3.3 24H336V150h-18z" />
                <rect x="344" y="80" width="18" height="70" />
                <rect x="366" y="62" width="11" height="88" />
                <rect x="409" y="74" width="15" height="76" />
                <rect x="454" y="86" width="13" height="64" />
                <rect x="503" y="90" width="12" height="60" />
                <rect x="547" y="96" width="18" height="54" />
            </g>
        </svg>
    );
}

function FieldLabel({ children, required }) {
    return (
        <span className="mb-2 block text-[13px] font-medium leading-5 tracking-normal text-slate-500">
            {children}
            {required ? <span className="text-rose-500"> *</span> : null}
        </span>
    );
}

function LockedInput({ id, value }) {
    return (
        <div className="relative">
            <input
                id={id}
                value={value}
                readOnly
                className="h-12 w-full cursor-default rounded-xl border border-[#e6eef6] bg-[#f4f7fb] px-3.5 pr-10 text-[15px] font-medium leading-6 text-slate-700 outline-none"
            />
            <Lock size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}

function SelectField({ id, value, onChange, placeholder, children }) {
    return (
        <select
            id={id}
            value={value}
            onChange={onChange}
            className={`h-12 w-full rounded-xl border border-[#e5edf6] bg-white px-3.5 text-[15px] leading-6 text-slate-900 outline-none ${FOCUS}`}
        >
            <option value="">{placeholder}</option>
            {children}
        </select>
    );
}

export default function CreateWorkOrderFlow({ existingNumbers, onClose, onSaved }) {
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [workOrderNo, setWorkOrderNo] = useState(() => nextWorkOrderNo(existingNumbers));
    const [createdOn, setCreatedOn] = useState(() => dubaiDateKey());
    const [customers, setCustomers] = useState([]);
    const [customerMessage, setCustomerMessage] = useState('');
    const [employees, setEmployees] = useState([]);
    const [employeeMessage, setEmployeeMessage] = useState('');
    const [quoteNumber, setQuoteNumber] = useState('');
    const [quote, setQuote] = useState(null);
    const [importing, setImporting] = useState(false);
    const [quoteMessage, setQuoteMessage] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [salespersonId, setSalespersonId] = useState('');
    const [lpoMode, setLpoMode] = useState('required');
    const [lpoNo, setLpoNo] = useState('');
    const [lpoDate, setLpoDate] = useState('');
    const [lpoValue, setLpoValue] = useState('');
    const [lpoFile, setLpoFile] = useState(null);
    const [confirmationDate, setConfirmationDate] = useState(() => dubaiDateKey());
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [stepError, setStepError] = useState('');

    useEffect(() => {
        let cancelled = false;
        axiosInstance.get('/WorkOrder/next-no', { skipToast: true }).then((response) => {
            if (cancelled) return;
            if (response.data?.workOrderNo) setWorkOrderNo(response.data.workOrderNo);
            if (response.data?.createdOn) setCreatedOn(response.data.createdOn);
        }).catch(() => {});
        const loadCustomers = async () => {
            const readRows = (response) => mapZohoCustomerListRows(response?.data?.data)
                .filter((row) => row.id && row.name && row.name !== '—')
                .sort((left, right) => left.name.localeCompare(right.name));
            let response = await axiosInstance.get('/zoho/customers', {
                skipToast: true,
                timeout: 120000,
                params: { sync: 'false' },
            });
            let rows = readRows(response);
            if (!rows.length) {
                response = await axiosInstance.get('/zoho/customers', {
                    skipToast: true,
                    timeout: 120000,
                    params: { sync: 'true' },
                });
                rows = readRows(response);
            }
            return rows;
        };
        loadCustomers()
            .then((rows) => {
                if (!cancelled) setCustomers(rows);
            })
            .catch((error) => {
                if (!cancelled) {
                    setCustomers([]);
                    setCustomerMessage(error?.response?.data?.message || 'Zoho customers could not be loaded.');
                }
            });
        axiosInstance.get('/WorkOrder/salespeople', { skipToast: true }).then((response) => {
            const rows = Array.isArray(response.data?.salespeople) ? response.data.salespeople : [];
            if (!cancelled) {
                setEmployees(rows.filter((employee) => String(employee.companyEmail || '').trim()));
            }
        }).catch((error) => {
            if (!cancelled) {
                setEmployees([]);
                setEmployeeMessage(error?.response?.data?.message || 'Employees with a company email could not be loaded.');
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const customer = customers.find((row) => row.id === customerId);
    const salesperson = employees.find((row) => row.id === salespersonId);
    const quoteLinked = Boolean(
        quote?.number && quote.number.trim().toLowerCase() === quoteNumber.trim().toLowerCase(),
    );
    const linkedQuote = quoteLinked ? quote : null;
    const lpoStatus = lpoMode === 'received' ? 'LPO received' : lpoMode === 'not_required' ? 'Not required' : 'Awaiting LPO';
    const lpoStatusClass = lpoMode === 'received'
        ? 'bg-blue-50 text-blue-600'
        : lpoMode === 'not_required'
            ? 'bg-slate-100 text-slate-600'
            : 'bg-amber-50 text-amber-600';
    const lpoLocked = lpoMode !== 'received';
    const attachmentLocked = lpoMode === 'required';

    const importQuote = async () => {
        const number = quoteNumber.trim();
        if (!number) {
            setQuote(null);
            setQuoteMessage('Enter the Zoho quotation number, then click Import.');
            return;
        }
        setImporting(true);
        setQuoteMessage('');
        try {
            const response = await axiosInstance.get('/zoho/estimates/lookup', {
                skipToast: true,
                timeout: 30000,
                params: { number },
            });
            const row = response.data?.data;
            if (!row?.number) {
                setQuote(null);
                setQuoteMessage('No Zoho quotation found for that number.');
                return;
            }
            setQuote(row);
            setQuoteNumber(row.number);
            setQuoteMessage('');
        } catch (error) {
            setQuote(null);
            setQuoteMessage(error?.response?.data?.message || 'Zoho quotation could not be imported.');
        } finally {
            setImporting(false);
        }
    };

    const payload = async (intent) => {
        const attachment = lpoMode !== 'required' && lpoFile ? await readLocalFile(lpoFile) : null;
        return {
            intent,
            customer: customer?.name || '',
            salespersonId: salesperson?.id || '',
            salespersonEmployeeId: salesperson?.employeeId || '',
            salespersonName: salesperson?.name || '',
            quotationId: linkedQuote?.id || '',
            quotationRef: linkedQuote?.number || quoteNumber.trim(),
            quotationDate: linkedQuote?.date || '',
            valueExclVat: linkedQuote?.valueExclVat || 0,
            vatAmount: linkedQuote?.vatAmount || 0,
            value: linkedQuote?.total || 0,
            lpoMode,
            lpoNo: lpoMode === 'received' ? lpoNo : '',
            lpoDate: lpoMode === 'received' ? lpoDate : '',
            lpoValue: lpoMode === 'received' ? lpoValue : '',
            attachment,
            confirmationDate,
            location,
            description,
            type: 'Standalone',
            projectName: '',
        };
    };

    const save = async (intent) => {
        if (!customer) {
            setStepError('Customer must be selected.');
            setStep(1);
            return;
        }
        if (intent === 'create') {
            if (!salesperson || !quoteNumber.trim()) {
                setStepError('Customer, salesperson and a quotation number are required.');
                setStep(1);
                return;
            }
            if (!confirmationDate || !location.trim() || !description.trim()) {
                setStepError('Confirmation date, location and description are required.');
                return;
            }
            if (lpoFile && lpoFile.size > 4 * 1024 * 1024) {
                setStepError('Attachment must be 4 MB or smaller.');
                return;
            }
            if (lpoMode === 'received' && (!lpoNo.trim() || !lpoDate || !(Number(lpoValue) > 0) || !lpoFile)) {
                setStepError('LPO number, date, value and attachment are required.');
                return;
            }
            if (lpoMode === 'not_required' && !lpoFile) {
                setStepError('Attach a file when LPO is not required.');
                return;
            }
        }
        setSaving(true);
        setStepError('');
        try {
            const response = await axiosInstance.post('/WorkOrder', await payload(intent));
            const assigned = response.data?.workOrder?.workOrderNo || workOrderNo;
            toast({
                title: intent === 'draft' ? 'Draft saved' : 'Work order created',
                description: intent === 'draft'
                    ? `${assigned} is pending for ${salesperson?.name || 'the selected employee'}.`
                    : lpoMode === 'not_required'
                        ? (response.data?.emailMessage || `${assigned} was sent to ${salesperson?.name || 'the salesperson'}. They were notified that the LPO was not filled.`)
                        : assigned,
            });
            onSaved();
        } catch (error) {
            toast({
                title: 'Could not save',
                description: error?.response?.data?.message || 'Could not save the work order',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const goNext = () => {
        if (!customer || !salesperson || !quoteNumber.trim()) {
            setStepError('Select the customer, salesperson and quotation number before the next step.');
            return;
        }
        setStepError('');
        setStep(2);
    };

    return (
        <div className="relative font-sans text-slate-800">
            <header className="relative mb-4 overflow-hidden">
                <Skyline />
                <div className="relative">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[#3b82f6]">
                        <Home size={14} />
                        <ChevronRight size={14} className="text-[#93c5fd]" />
                        <span>Sales & Operations</span>
                        <span className="text-[#93c5fd]">/</span>
                        <span>Work Orders</span>
                        <span className="text-[#93c5fd]">/</span>
                        <span>Create Work Order</span>
                    </nav>
                    <div className="mt-3 flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2f6fed] text-white shadow-[0_10px_18px_-10px_rgba(47,111,237,0.9)]">
                            <ClipboardList size={22} />
                        </span>
                        <div>
                            <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 sm:text-[30px]">Create Work Order</h1>
                            <p className="mt-0.5 text-[15px] text-slate-500">
                                {step === 1 ? 'Step 1 – Basic Information & Zoho Quotation' : 'Step 2 – LPO details'}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {step === 2 ? (
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryChip icon={UserRound} tint="bg-blue-50 text-[#2f6fed]" label="Customer" value={customer?.name || '—'} />
                    <SummaryChip icon={Layers} tint="bg-blue-50 text-[#2f6fed]" label="LPO" value={lpoStatus} pillClass={lpoStatusClass} />
                    <SummaryChip icon={ClipboardList} tint="bg-violet-50 text-violet-600" label="Type" value="Standalone" pillClass="bg-stone-100 text-stone-600" />
                    <SummaryChip icon={Coins} tint="bg-blue-50 text-[#2f6fed]" label="Total Value" value={formatAed(linkedQuote?.total || 0)} />
                </div>
            ) : null}

            <div className="mb-4 rounded-2xl border border-[#e6eef6] bg-white p-3 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.45)]">
                {step === 1 ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex flex-1 items-center gap-3 rounded-xl bg-[#e8f1ff] px-4 py-3.5 text-[#2f6fed]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6fed] text-[15px] font-semibold text-white">1</span>
                            <span className="text-[15px] font-semibold">Basic Info & Quotation</span>
                        </div>
                        <div className="flex flex-1 items-center gap-3 px-4 py-3.5 text-slate-400">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-[15px] font-semibold">2</span>
                            <span className="text-[15px] font-medium">LPO details</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-3 rounded-xl bg-[#f4fbf6] px-4 py-3.5">
                            <CheckCircle2 className="text-emerald-500" size={22} />
                            <span>
                                <span className="block text-[15px] font-semibold text-slate-800">1 Work Order Details</span>
                                <span className="text-[13px] text-slate-500">Completed</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl bg-[#e8f1ff] px-4 py-3.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6fed] text-[15px] font-semibold text-white">2</span>
                            <span>
                                <span className="block text-[15px] font-semibold text-[#2f6fed]">LPO details</span>
                                <span className="text-[13px] text-slate-500">Step 2 of 2</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {stepError ? (
                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[15px] text-rose-700">{stepError}</p>
            ) : null}

            {step === 1 ? (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="min-w-0 space-y-4">
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[15px] font-medium text-amber-700">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            Zoho quotation is mandatory
                        </div>
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f6fed]">
                                    <ClipboardList size={16} />
                                </span>
                                Work Order Information
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label htmlFor="wo-number">
                                    <FieldLabel required>Work Order Number</FieldLabel>
                                    <LockedInput id="wo-number" value={workOrderNo} />
                                </label>
                                <label htmlFor="wo-created">
                                    <FieldLabel>Created Date</FieldLabel>
                                    <LockedInput id="wo-created" value={formatWorkOrderDate(createdOn)} />
                                </label>
                            </div>
                        </section>
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f6fed]">
                                    <UserRound size={16} />
                                </span>
                                Customer & Sales Information
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label htmlFor="wo-customer">
                                    <FieldLabel required>Customer Name</FieldLabel>
                                    <SelectField id="wo-customer" value={customerId} placeholder="Select Zoho customer" onChange={(event) => setCustomerId(event.target.value)}>
                                        {customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                                    </SelectField>
                                    {customerMessage ? <p className="mt-1.5 text-sm text-amber-700">{customerMessage}</p> : null}
                                </label>
                                <label htmlFor="wo-salesperson">
                                    <FieldLabel required>Salesperson Name</FieldLabel>
                                    <SelectField id="wo-salesperson" value={salespersonId} placeholder="Select employee" onChange={(event) => setSalespersonId(event.target.value)}>
                                        {employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                                    </SelectField>
                                    {employeeMessage ? <p className="mt-1.5 text-sm text-amber-700">{employeeMessage}</p> : null}
                                </label>
                            </div>
                        </section>
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f6fed]">
                                    <Link2 size={16} />
                                </span>
                                Zoho Quotation Details
                            </h2>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <label htmlFor="wo-quote" className="min-w-0 flex-1">
                                    <FieldLabel required>Import Zoho Quotation</FieldLabel>
                                    <input
                                        id="wo-quote"
                                        value={quoteNumber}
                                        onChange={(event) => setQuoteNumber(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                importQuote();
                                            }
                                        }}
                                        placeholder="Enter quotation number"
                                        className={fieldClass}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={importQuote}
                                    disabled={importing}
                                    className={`inline-flex h-12 items-center justify-center rounded-xl bg-[#2f6fed] px-5 text-[15px] font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                >
                                    {importing ? 'Importing…' : 'Import'}
                                </button>
                                {linkedQuote ? (
                                    <span className="inline-flex h-12 items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-600">
                                        <CheckCircle2 size={16} /> Linked from Zoho
                                    </span>
                                ) : null}
                            </div>
                            {quoteMessage ? <p className="mt-2 text-sm text-amber-700">{quoteMessage}</p> : null}
                            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <label>
                                    <FieldLabel>Quotation Date</FieldLabel>
                                    <LockedInput id="wo-quote-date" value={linkedQuote ? formatWorkOrderDate(linkedQuote.date) : ''} />
                                </label>
                                <label>
                                    <FieldLabel>Work Order Value (excl. VAT)</FieldLabel>
                                    <LockedInput id="wo-excl" value={linkedQuote ? formatAed(linkedQuote.valueExclVat) : ''} />
                                </label>
                                <label>
                                    <FieldLabel>VAT (5%)</FieldLabel>
                                    <LockedInput id="wo-vat" value={linkedQuote ? formatAed(linkedQuote.vatAmount) : ''} />
                                </label>
                                <label>
                                    <FieldLabel>Total Work Order Value</FieldLabel>
                                    <input readOnly value={linkedQuote ? formatAed(linkedQuote.total) : ''} className="h-12 w-full cursor-default rounded-xl border border-[#d7e6fb] bg-[#f4f8fd] px-3.5 text-[15px] font-semibold text-[#2f6fed] outline-none" />
                                </label>
                            </div>
                            <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#f4f8fd] px-3.5 py-3 text-sm leading-6 text-slate-500">
                                <Info size={15} className="text-[#2f6fed]" />
                                Import fills the date and values when Zoho allows it. The quotation number is enough to continue.
                            </p>
                        </section>
                    </div>
                    <RulesCard title="Step 1 Rules" rules={STEP1_RULES} />
                </div>
            ) : (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="min-w-0 space-y-4">
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-5 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-6">
                            <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f6fed]">
                                    <Info size={16} />
                                </span>
                                Work Order Information
                            </h2>
                            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                                <InfoItem label="Work Order Number" value={workOrderNo} />
                                <InfoItem label="Salesperson" value={salesperson?.name || '—'} />
                                <InfoItem label="Created Date" value={formatWorkOrderDate(createdOn)} />
                                <InfoItem label="Quotation Ref" value={linkedQuote?.number || quoteNumber || '—'} />
                            </dl>
                            <div className="mt-6 grid grid-cols-1 gap-5 border-t border-[#eef3f8] pt-6 sm:grid-cols-2">
                                <label htmlFor="wo-confirm">
                                    <FieldLabel required>Order Confirmation Date</FieldLabel>
                                    <input id="wo-confirm" type="date" value={confirmationDate} onChange={(event) => setConfirmationDate(event.target.value)} className={fieldClass} />
                                </label>
                                <label htmlFor="wo-quote-date-step2">
                                    <FieldLabel>Quotation Date</FieldLabel>
                                    <LockedInput id="wo-quote-date-step2" value={linkedQuote ? formatWorkOrderDate(linkedQuote.date) : '—'} />
                                </label>
                                <label htmlFor="wo-location" className="sm:col-span-2">
                                    <FieldLabel required>Delivery Location</FieldLabel>
                                    <input id="wo-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Delivery or installation location" className={fieldClass} />
                                </label>
                                <label htmlFor="wo-description" className="sm:col-span-2">
                                    <FieldLabel required>Work Order Description</FieldLabel>
                                    <textarea id="wo-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`w-full resize-y rounded-xl border border-[#e5edf6] bg-white px-3.5 py-3 text-[15px] leading-6 text-slate-900 outline-none ${FOCUS}`} />
                                </label>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-5 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-6">
                            <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f6fed]">
                                    <Paperclip size={16} />
                                </span>
                                LPO Details
                            </h2>
                            <div role="radiogroup" aria-label="LPO details" className="grid grid-cols-1 gap-1 rounded-xl bg-[#f4f7fb] p-1 sm:grid-cols-3">
                                {LPO_OPTIONS.map((option) => {
                                    const active = lpoMode === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => setLpoMode(option.id)}
                                            className={active
                                                ? `h-12 rounded-lg bg-[#2f6fed] text-[15px] font-semibold text-white shadow-sm ${FOCUS}`
                                                : `h-12 rounded-lg text-[15px] font-medium text-slate-600 hover:bg-white ${FOCUS}`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-4 text-sm leading-6 text-slate-500">
                                {lpoMode === 'required'
                                    ? 'LPO number, date, value and attachment stay off. There is no need to add an LPO while Required is selected.'
                                    : lpoMode === 'not_required'
                                        ? 'Attachment is required. Creating the work order emails the salesperson and notifies them that the LPO was not filled.'
                                        : 'Enter the LPO number, date, value and attachment.'}
                            </p>
                            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <label htmlFor="wo-lpo">
                                    <FieldLabel required={lpoMode === 'received'}>LPO Number</FieldLabel>
                                    <input id="wo-lpo" value={lpoNo} disabled={lpoLocked} onChange={(event) => setLpoNo(event.target.value)} placeholder="LPO number" className={fieldClass} />
                                </label>
                                <label htmlFor="wo-lpo-date">
                                    <FieldLabel required={lpoMode === 'received'}>LPO Date</FieldLabel>
                                    <input id="wo-lpo-date" type="date" value={lpoDate} disabled={lpoLocked} onChange={(event) => setLpoDate(event.target.value)} className={fieldClass} />
                                </label>
                                <label htmlFor="wo-lpo-value">
                                    <FieldLabel required={lpoMode === 'received'}>LPO Value</FieldLabel>
                                    <input id="wo-lpo-value" type="number" min="0" step="0.01" value={lpoValue} disabled={lpoLocked} onChange={(event) => setLpoValue(event.target.value)} placeholder="0.00" className={fieldClass} />
                                </label>
                                <div>
                                    <FieldLabel required={lpoMode !== 'required'}>Attachment</FieldLabel>
                                    <label htmlFor="wo-lpo-file" className={`flex h-12 items-center gap-3 rounded-xl border border-[#e5edf6] px-2 ${attachmentLocked ? 'cursor-not-allowed bg-[#f4f7fb]' : 'cursor-pointer bg-white'} ${FOCUS}`}>
                                        <span className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${attachmentLocked ? 'bg-slate-200 text-slate-400' : 'bg-[#e8f1ff] text-[#2f6fed]'}`}>
                                            Choose file
                                        </span>
                                        <span className={`min-w-0 flex-1 truncate text-[15px] ${!attachmentLocked && lpoFile ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                                            {!attachmentLocked && lpoFile ? lpoFile.name : 'No file chosen'}
                                        </span>
                                        <input
                                            id="wo-lpo-file"
                                            type="file"
                                            disabled={attachmentLocked}
                                            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                            onChange={(event) => setLpoFile(event.target.files?.[0] || null)}
                                            className="sr-only"
                                        />
                                    </label>
                                </div>
                            </div>
                        </section>
                    </div>
                    <RulesCard title="Business Rules" rules={STEP2_RULES} />
                </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={step === 1 ? onClose : () => setStep(1)} className={`inline-flex h-12 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-[15px] font-semibold text-slate-600 hover:bg-slate-50 ${FOCUS}`}>
                    <ChevronLeft size={16} /> {step === 1 ? 'Back' : 'Previous Step'}
                </button>
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={saving} onClick={() => save('draft')} className={`inline-flex h-12 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}>
                        <Save size={16} /> Save as Draft
                    </button>
                    <button type="button" onClick={onClose} className={`inline-flex h-12 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 ${FOCUS}`}>
                        <X size={16} /> Cancel
                    </button>
                    {step === 1 ? (
                        <button type="button" onClick={goNext} className={`inline-flex h-12 items-center gap-2 rounded-xl bg-[#2f6fed] px-5 text-[15px] font-semibold text-white hover:bg-[#245fe0] ${FOCUS}`}>
                            Next Step <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button type="button" disabled={saving} onClick={() => save('create')} className={`inline-flex h-12 items-center gap-2 rounded-xl bg-[#2f6fed] px-5 text-[15px] font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}>
                            <CheckCircle2 size={16} /> Create Work Order
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryChip({ icon: Icon, tint, label, value, pillClass }) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e6eef6] bg-white px-4 py-3.5 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.45)]">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon size={18} /></span>
            <span className="min-w-0">
                <span className="block text-[13px] font-medium text-slate-500">{label}</span>
                {pillClass ? (
                    <span className={`mt-1 inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-sm font-semibold ${pillClass}`}>{value}</span>
                ) : (
                    <span className="mt-0.5 block truncate text-[15px] font-semibold tracking-tight text-slate-900">{value}</span>
                )}
            </span>
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div className="min-w-0">
            <dt className="text-[13px] font-medium leading-5 text-slate-500">{label}</dt>
            <dd className="mt-1 break-words text-[15px] font-semibold leading-6 tracking-tight text-slate-900">{value || '—'}</dd>
        </div>
    );
}

function RulesCard({ title, rules }) {
    return (
        <section className="min-w-0 rounded-2xl border border-[#e6eef6] bg-white p-5 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
            <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f6fed]">
                    <Gavel size={16} />
                </span>
                {title}
            </h2>
            <ul className="space-y-3 rounded-xl bg-[#f4fbf6] px-4 py-4">
                {rules.map((rule) => (
                    <li key={rule} className="flex items-start gap-2.5 text-sm leading-6 text-slate-600">
                        <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-500" />
                        <span className="min-w-0">{rule}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
