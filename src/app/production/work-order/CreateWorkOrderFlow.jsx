'use client';

import { useEffect, useState } from 'react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FolderPlus,
    Gavel,
    Home,
    Info,
    Layers,
    Link2,
    Lock,
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
    'Project cannot be created independently.',
    'The first work order in a project becomes the Main Work Order.',
    'Standalone work orders can later be attached to a project.',
    'Only one LPO choice can be on at a time.',
];

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
        <span className="mb-1.5 block text-[12px] font-medium text-slate-500">
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
                className="h-11 w-full cursor-default rounded-xl border border-[#e6eef6] bg-[#f4f7fb] px-3 pr-10 text-sm font-medium text-slate-600 outline-none"
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
            className={`h-11 w-full rounded-xl border border-[#e5edf6] bg-white px-3 text-sm text-slate-800 outline-none ${FOCUS}`}
        >
            <option value="">{placeholder}</option>
            {children}
        </select>
    );
}

export default function CreateWorkOrderFlow({ existingNumbers, projects = [], onClose, onSaved }) {
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
    const [action, setAction] = useState('project');
    const [projectName, setProjectName] = useState('');
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
        const type = action === 'project' ? 'Main WO' : action === 'attach' ? 'Variation' : 'Standalone';
        const namedProject = action === 'project'
            ? (projectName.trim() || `${customer?.name || 'New'} Project`)
            : action === 'attach'
                ? projectName.trim()
                : '';
        const attachment = lpoMode !== 'required' && lpoFile ? await readLocalFile(lpoFile) : null;
        return {
            intent,
            customer: customer?.name || '',
            salespersonId: salesperson?.id || '',
            salespersonEmployeeId: salesperson?.employeeId || '',
            salespersonName: salesperson?.name || '',
            quotationId: linkedQuote?.id || '',
            quotationRef: linkedQuote?.number || '',
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
            type,
            projectName: namedProject,
        };
    };

    const save = async (intent) => {
        if (!customer) {
            setStepError('Customer must be selected.');
            setStep(1);
            return;
        }
        if (intent === 'create') {
            if (!salesperson || !linkedQuote) {
                setStepError('Customer, salesperson and a Zoho quotation are required.');
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
            if (action === 'attach' && !projectName.trim()) {
                setStepError('Choose the project this work order attaches to.');
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
        if (!customer || !salesperson || !linkedQuote) {
            setStepError('Select the customer and salesperson, then import a Zoho quotation before the next step.');
            return;
        }
        setStepError('');
        setStep(2);
    };

    return (
        <div className="relative text-slate-800">
            <header className="relative mb-4 overflow-hidden">
                <Skyline />
                <div className="relative">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[#3b82f6]">
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
                            <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[28px]">Create Work Order</h1>
                            <p className="text-[13px] text-slate-500">
                                {step === 1 ? 'Step 1 – Basic Information & Zoho Quotation' : 'Step 2 – Assignment, LPO & Confirmation'}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {step === 2 ? (
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryChip icon={ClipboardList} tint="bg-blue-50 text-[#2f6fed]" label="Work Order No." value={workOrderNo} />
                    <SummaryChip icon={UserRound} tint="bg-violet-50 text-violet-600" label="Customer" value={customer?.name || '—'} />
                    <SummaryChip icon={FileIcon} tint="bg-sky-50 text-sky-600" label="Quotation Ref" value={linkedQuote?.number || '—'} />
                    <SummaryChip icon={ClipboardList} tint="bg-orange-50 text-orange-500" label="Total Value" value={formatAed(linkedQuote?.total || 0)} />
                </div>
            ) : null}

            <div className="mb-4 rounded-2xl border border-[#e6eef6] bg-white p-3 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.45)]">
                {step === 1 ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex flex-1 items-center gap-3 rounded-xl bg-[#e8f1ff] px-4 py-3 text-[#2f6fed]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2f6fed] text-sm font-bold text-white">1</span>
                            <span className="text-sm font-semibold">Basic Info & Quotation</span>
                        </div>
                        <div className="flex flex-1 items-center gap-3 px-4 py-3 text-slate-400">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold">2</span>
                            <span className="text-sm font-medium">Assignment & Confirmation</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-3 rounded-xl bg-[#f4fbf6] px-4 py-3">
                            <CheckCircle2 className="text-emerald-500" size={22} />
                            <span>
                                <span className="block text-sm font-semibold text-slate-800">1 Work Order Details</span>
                                <span className="text-[12px] text-slate-400">Completed</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl bg-[#e8f1ff] px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2f6fed] text-sm font-bold text-white">2</span>
                            <span>
                                <span className="block text-sm font-semibold text-[#2f6fed]">Assignment & Confirmation</span>
                                <span className="text-[12px] text-slate-400">Step 2 of 2</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {stepError ? (
                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{stepError}</p>
            ) : null}

            {step === 1 ? (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            Zoho quotation is mandatory
                        </div>
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <ClipboardList size={16} className="text-[#2f6fed]" /> Work Order Information
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
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <UserRound size={16} className="text-[#2f6fed]" /> Customer & Sales Information
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label htmlFor="wo-customer">
                                    <FieldLabel required>Customer Name</FieldLabel>
                                    <SelectField id="wo-customer" value={customerId} placeholder="Select Zoho customer" onChange={(event) => setCustomerId(event.target.value)}>
                                        {customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                                    </SelectField>
                                    {customerMessage ? <p className="mt-1 text-[12px] text-amber-700">{customerMessage}</p> : null}
                                </label>
                                <label htmlFor="wo-salesperson">
                                    <FieldLabel required>Salesperson Name</FieldLabel>
                                    <SelectField id="wo-salesperson" value={salespersonId} placeholder="Select employee" onChange={(event) => setSalespersonId(event.target.value)}>
                                        {employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                                    </SelectField>
                                    {employeeMessage ? <p className="mt-1 text-[12px] text-amber-700">{employeeMessage}</p> : null}
                                </label>
                            </div>
                        </section>
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <Link2 size={16} className="text-[#2f6fed]" /> Zoho Quotation Details
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
                                        className={`h-11 w-full rounded-xl border border-[#e5edf6] bg-white px-3 text-sm text-slate-800 outline-none ${FOCUS}`}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={importQuote}
                                    disabled={importing}
                                    className={`inline-flex h-11 items-center justify-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                                >
                                    {importing ? 'Importing…' : 'Import'}
                                </button>
                                {linkedQuote ? (
                                    <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-600">
                                        <CheckCircle2 size={14} /> Linked from Zoho
                                    </span>
                                ) : null}
                            </div>
                            {quoteMessage ? <p className="mt-2 text-[12px] text-amber-700">{quoteMessage}</p> : null}
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
                                    <input readOnly value={linkedQuote ? formatAed(linkedQuote.total) : ''} className="h-11 w-full cursor-default rounded-xl border border-[#d7e6fb] bg-[#f4f8fd] px-3 text-sm font-bold text-[#2f6fed] outline-none" />
                                </label>
                            </div>
                            <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#f4f8fd] px-3 py-2.5 text-[13px] text-slate-500">
                                <Info size={15} className="text-[#2f6fed]" />
                                Work Order cannot be created without a valid Zoho quotation.
                            </p>
                        </section>
                    </div>
                    <RulesCard title="Step 1 Rules" rules={STEP1_RULES} />
                </div>
            ) : (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                            <ClipboardList size={16} className="text-[#2f6fed]" /> Order & Delivery Details
                        </h2>
                        <div>
                            <FieldLabel required>LPO details</FieldLabel>
                            <div role="radiogroup" aria-label="LPO details" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {LPO_OPTIONS.map((option) => {
                                    const active = lpoMode === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => setLpoMode(option.id)}
                                            className={`h-11 rounded-xl border text-sm font-semibold ${FOCUS} ${active ? 'border-[#2f6fed] bg-[#e8f1ff] text-[#2f6fed]' : 'border-[#e5edf6] bg-white text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-2 text-[12px] text-slate-500">
                                {lpoMode === 'required'
                                    ? 'LPO fields stay off. You do not add an LPO now.'
                                    : lpoMode === 'not_required'
                                        ? 'Attach a file. Creating the work order emails it to the salesperson and notifies them that the LPO was not filled.'
                                        : 'Enter the LPO number, date, value and attachment.'}
                            </p>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label htmlFor="wo-lpo">
                                <FieldLabel required={lpoMode === 'received'}>Customer LPO Number</FieldLabel>
                                <input id="wo-lpo" value={lpoNo} disabled={lpoMode !== 'received'} onChange={(event) => setLpoNo(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-slate-400 ${FOCUS}`} />
                            </label>
                            <label htmlFor="wo-lpo-date">
                                <FieldLabel required={lpoMode === 'received'}>LPO Date</FieldLabel>
                                <input id="wo-lpo-date" type="date" value={lpoDate} disabled={lpoMode !== 'received'} onChange={(event) => setLpoDate(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-slate-400 ${FOCUS}`} />
                            </label>
                            <label htmlFor="wo-lpo-value">
                                <FieldLabel required={lpoMode === 'received'}>LPO Value</FieldLabel>
                                <input id="wo-lpo-value" type="number" min="0" step="0.01" value={lpoValue} disabled={lpoMode !== 'received'} onChange={(event) => setLpoValue(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-slate-400 ${FOCUS}`} />
                            </label>
                            <label htmlFor="wo-confirm">
                                <FieldLabel required>Order Confirmation Date</FieldLabel>
                                <input id="wo-confirm" type="date" value={confirmationDate} onChange={(event) => setConfirmationDate(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                            </label>
                        </div>
                        <label htmlFor="wo-lpo-file" className="mt-4 block">
                            <FieldLabel required={lpoMode !== 'required'}>Attachment</FieldLabel>
                            <input
                                id="wo-lpo-file"
                                type="file"
                                disabled={lpoMode === 'required'}
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                onChange={(event) => setLpoFile(event.target.files?.[0] || null)}
                                className={`block w-full rounded-xl border border-[#e5edf6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f1ff] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#2f6fed] disabled:cursor-not-allowed disabled:bg-[#f4f7fb] disabled:text-slate-400 ${FOCUS}`}
                            />
                            {lpoMode !== 'required' && lpoFile ? <p className="mt-1 text-[12px] text-slate-500">{lpoFile.name}</p> : null}
                        </label>
                        <label htmlFor="wo-location" className="mt-4 block">
                            <FieldLabel required>Delivery / Installation Location</FieldLabel>
                            <input id="wo-location" value={location} onChange={(event) => setLocation(event.target.value)} className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                        </label>
                        <label htmlFor="wo-description" className="mt-4 block">
                            <FieldLabel required>Work Order Description</FieldLabel>
                            <textarea id="wo-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`w-full rounded-xl border border-[#e5edf6] px-3 py-2 text-sm outline-none ${FOCUS}`} />
                        </label>
                        {action === 'attach' ? (
                            <label htmlFor="wo-project" className="mt-4 block">
                                <FieldLabel required>Existing Project</FieldLabel>
                                {projects.length ? (
                                    <SelectField id="wo-project" value={projectName} placeholder="Select project" onChange={(event) => setProjectName(event.target.value)}>
                                        {projects.map((name) => <option key={name} value={name}>{name}</option>)}
                                    </SelectField>
                                ) : (
                                    <input id="wo-project" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" className={`h-11 w-full rounded-xl border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`} />
                                )}
                            </label>
                        ) : null}
                    </section>
                    <div className="space-y-4">
                        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
                            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                <Layers size={16} className="text-[#2f6fed]" /> Available Actions
                            </h2>
                            <div className="flex flex-col gap-2">
                                <ActionButton active={action === 'standalone'} icon={Layers} onClick={() => setAction('standalone')}>Create as Standalone</ActionButton>
                                <ActionButton active={action === 'attach'} icon={Link2} onClick={() => setAction('attach')}>Attach to Existing Project</ActionButton>
                                <ActionButton active={action === 'project'} icon={FolderPlus} onClick={() => setAction('project')}>Create New Project</ActionButton>
                                <ActionButton icon={Save} onClick={() => save('draft')} disabled={saving}>Save as Draft</ActionButton>
                                <ActionButton icon={X} onClick={onClose}>Cancel</ActionButton>
                            </div>
                        </section>
                        <RulesCard title="Validation & Rules" rules={STEP2_RULES} />
                    </div>
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={step === 1 ? onClose : () => setStep(1)} className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 ${FOCUS}`}>
                    <ChevronLeft size={16} /> {step === 1 ? 'Back' : 'Previous Step'}
                </button>
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={saving} onClick={() => save('draft')} className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}>
                        <Save size={16} /> Save as Draft
                    </button>
                    <button type="button" onClick={onClose} className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${FOCUS}`}>
                        <X size={16} /> Cancel
                    </button>
                    {step === 1 ? (
                        <button type="button" onClick={goNext} className={`inline-flex h-11 items-center gap-2 rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] ${FOCUS}`}>
                            Next Step <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button type="button" disabled={saving} onClick={() => save('create')} className={`inline-flex h-11 items-center gap-2 rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}>
                            <CheckCircle2 size={16} /> Create Work Order
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FileIcon(props) {
    return <ClipboardList {...props} />;
}

function SummaryChip({ icon: Icon, tint, label, value }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e6eef6] bg-white px-3 py-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}><Icon size={18} /></span>
            <span className="min-w-0">
                <span className="block text-[11px] text-slate-400">{label}</span>
                <span className="block truncate text-sm font-bold text-slate-800">{value}</span>
            </span>
        </div>
    );
}

function ActionButton({ active, icon: Icon, children, onClick, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={active
                ? `flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2f6fed] text-sm font-semibold text-white ${FOCUS}`
                : `flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e5edf6] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
        >
            <Icon size={16} /> {children}
        </button>
    );
}

function RulesCard({ title, rules }) {
    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                <Gavel size={16} className="text-[#2f6fed]" /> {title}
            </h2>
            <ul className="space-y-2.5 rounded-xl bg-[#f4fbf6] px-3 py-3">
                {rules.map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-[13px] leading-5 text-slate-600">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{rule}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
