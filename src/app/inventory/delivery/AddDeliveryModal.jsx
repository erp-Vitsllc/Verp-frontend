'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Boxes,
    Briefcase,
    Calendar,
    Check,
    ChevronDown,
    FileText,
    Phone,
    Plus,
    Pointer,
    Printer,
    RotateCcw,
    Search,
    Trash2,
    Truck,
    UserRound,
    X,
} from 'lucide-react';
import {
    createDelivery,
    deliveryApiMessage,
    getDeliveryCustomer,
    listDeliveryBrands,
    listDeliveryCategories,
    listDeliveryCustomers,
    listDeliveryItemOptions,
    listDeliveryItems,
    listDeliverySubcategories,
    listDeliveryWorkOrders,
} from './deliveryApi';

const TYPES = [
    { id: 'Project', label: 'Project', icon: Briefcase },
    { id: 'Annual', label: 'Annual', icon: Calendar },
    { id: 'Manual', label: 'Manual', icon: Pointer },
];

const controlClass = 'w-full rounded-xl border border-[#E6E2F2] bg-white text-sm outline-none transition focus:border-[#7C3AED] disabled:cursor-not-allowed disabled:bg-[#F8F7FB] disabled:text-slate-400';
const inputClass = `${controlClass} h-11 px-3 text-slate-800 placeholder:text-slate-400`;
const areaClass = `${controlClass} min-h-[88px] resize-y px-3 py-2.5 text-slate-800 placeholder:text-slate-400`;

function todayKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return value || '—';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isScheduled(type) {
    return type === 'Project' || type === 'Annual';
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function idOf(value) {
    if (!value) return '';
    if (typeof value === 'object') return String(value._id || value.id || '');
    return String(value);
}

function namedRows(rows) {
    return asArray(rows)
        .map((row) => ({ id: idOf(row._id || row.id), label: String(row.name || '').trim() }))
        .filter((row) => row.id && row.label);
}

function emptyForm() {
    return {
        deliveryType: 'Project',
        doDate: todayKey(),
        projectName: '',
        workOrderId: '',
        customerId: '',
        deliveryAddress: '',
        contactPersonName: '',
        contactNumber: '',
        lines: [],
    };
}

function emptyDraft() {
    return {
        categoryId: '',
        subcategoryId: '',
        itemOptionId: '',
        brandId: '',
        modelItemId: '',
        modelNumber: '',
    };
}

function manualDescription(itemName, extra) {
    const name = String(itemName || '').trim();
    const detail = String(extra || '').trim();
    if (!name) return detail;
    if (!detail || detail.toLowerCase() === name.toLowerCase()) return name;
    return `${name} – ${detail}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function Field({ label, required = false, hint = '', children }) {
    return (
        <div className="min-w-0">
            <span className="mb-1 block text-sm font-semibold text-slate-900">
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </span>
            {hint ? <span className="mb-1.5 block text-xs text-slate-400">{hint}</span> : null}
            {children}
        </div>
    );
}

function SelectField({ label, required, hint, value, onChange, placeholder, options, disabled }) {
    return (
        <Field label={label} required={required} hint={hint}>
            <div className="relative">
                <select
                    value={value}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    className={`${controlClass} h-11 appearance-none px-3 pr-9 ${value ? 'text-slate-800' : 'text-slate-400'}`}
                >
                    <option value="">{placeholder}</option>
                    {options.map((option) => (
                        <option key={option.id} value={option.id} className="text-slate-800">
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
        </Field>
    );
}

function Picker({
    placeholder,
    leadingIcon: LeadingIcon,
    options,
    value,
    onChange,
    disabled,
    allowCustom = false,
    emptyLabel,
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [menuBox, setMenuBox] = useState(null);
    const rootRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const selected = options.find((option) => option.id === value) || null;
    const display = selected?.label || (allowCustom ? value : '');
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) => option.label.toLowerCase().includes(needle));
    }, [options, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            if (allowCustom) onChangeRef.current(query.trim());
            setOpen(false);
        };
        const place = () => {
            const node = rootRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 180 && rect.top > spaceBelow;
            setMenuBox({
                left: rect.left,
                width: rect.width,
                maxHeight: Math.max(120, Math.min(240, openUp ? rect.top - 12 : spaceBelow - 12)),
                top: openUp ? undefined : rect.bottom + 4,
                bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
            });
        };
        const onScroll = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            place();
        };
        place();
        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [allowCustom, open, query]);

    function choose(option) {
        onChange(option.id);
        setQuery('');
        setOpen(false);
    }

    function openPicker() {
        if (disabled) return;
        setQuery(allowCustom ? display : '');
        setOpen(true);
    }

    const showCustom = allowCustom && query.trim() && !filtered.some((option) => option.label.toLowerCase() === query.trim().toLowerCase());

    return (
        <div ref={rootRef} className="relative">
            {open ? (
                <div className="relative">
                    {LeadingIcon ? <LeadingIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /> : null}
                    <input
                        autoFocus
                        value={query}
                        disabled={disabled}
                        placeholder={placeholder}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpen(false);
                                return;
                            }
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                if (filtered.length === 1) choose(filtered[0]);
                                else if (showCustom) {
                                    onChange(query.trim());
                                    setOpen(false);
                                }
                            }
                        }}
                        className={`${inputClass} ${LeadingIcon ? 'pl-9' : ''} pr-9`}
                    />
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-180 text-slate-400" />
                </div>
            ) : (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={openPicker}
                    className={`${inputClass} flex items-center gap-2 text-left`}
                >
                    {LeadingIcon ? <LeadingIcon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                    <span className={`min-w-0 flex-1 truncate ${display ? 'text-slate-800' : 'text-slate-400'}`}>
                        {display || placeholder}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
            )}
            {open && menuBox ? (
                <div
                    style={{
                        position: 'fixed',
                        left: menuBox.left,
                        width: menuBox.width,
                        top: menuBox.top,
                        bottom: menuBox.bottom,
                        maxHeight: menuBox.maxHeight,
                        zIndex: 80,
                    }}
                    className="overflow-y-auto rounded-xl border border-[#E6E2F2] bg-white py-1 shadow-lg"
                >
                    {filtered.length === 0 && !showCustom ? (
                        <p className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</p>
                    ) : filtered.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => choose(option)}
                            className={`block w-full truncate px-3 py-2 text-left text-sm ${option.id === value ? 'bg-[#F3EEFF] font-medium text-[#6D28D9]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                    {showCustom ? (
                        <button
                            type="button"
                            onClick={() => {
                                onChange(query.trim());
                                setOpen(false);
                            }}
                            className="block w-full truncate px-3 py-2 text-left text-sm text-[#6D28D9] hover:bg-[#F6F3FF]"
                        >
                            Use “{query.trim()}”
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function DateField({ value, onChange }) {
    return (
        <label className={`${inputClass} relative flex cursor-pointer items-center justify-between`}>
            <input
                type="date"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="DO Date"
            />
            <span className={value ? 'text-slate-800' : 'text-slate-400'}>{value ? formatDoDate(value) : 'Select date'}</span>
            <Calendar className="h-4 w-4 text-slate-400" />
        </label>
    );
}

function printDelivery(form, customerName, workOrderNo) {
    const scheduled = isScheduled(form.deliveryType);
    const rows = form.lines.map((line, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(line.description)}${line.detail ? `<div class="muted">${escapeHtml(line.detail)}</div>` : ''}</td>
            <td>${escapeHtml(line.quantity)}${line.unit ? ` ${escapeHtml(line.unit)}` : ''}</td>
        </tr>
    `).join('');
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!popup) return false;
    popup.document.write(`<!DOCTYPE html>
        <html><head><title>Delivery Order</title>
        <style>
            body { font-family: Arial, sans-serif; color: #1e1b2e; padding: 32px; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            .muted { color: #64748b; font-size: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; background: #f3eeff; padding: 8px; }
            td { border-top: 1px solid #eee; padding: 8px; vertical-align: top; }
        </style></head><body>
        <h1>Delivery Order</h1>
        <p class="muted">${escapeHtml(form.deliveryType)} · Auto / Delivery Number</p>
        <div class="grid">
            ${scheduled ? `<div><strong>DO Date</strong><br>${escapeHtml(formatDoDate(form.doDate))}</div>` : ''}
            ${scheduled ? `<div><strong>Project</strong><br>${escapeHtml(form.projectName || '—')}</div>` : ''}
            ${scheduled ? `<div><strong>WO No</strong><br>${escapeHtml(workOrderNo || '—')}</div>` : ''}
            <div><strong>Customer</strong><br>${escapeHtml(customerName || '—')}</div>
            <div><strong>Contact</strong><br>${escapeHtml(form.contactPersonName || '—')} ${escapeHtml(form.contactNumber || '')}</div>
            <div><strong>Address</strong><br>${escapeHtml(form.deliveryAddress || '—')}</div>
        </div>
        <table>
            <thead><tr><th>SI</th><th>Description</th><th>Qty</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="3">No items</td></tr>'}</tbody>
        </table>
        </body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 200);
    return true;
}

export default function AddDeliveryModal({ onClose, onSaved, purchasingOfficer = false }) {
    const [form, setForm] = useState(emptyForm);
    const [draft, setDraft] = useState(emptyDraft);
    const [customers, setCustomers] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [contactId, setContactId] = useState('');
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [itemOptions, setItemOptions] = useState([]);
    const [brands, setBrands] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [workOrders, setWorkOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');
    const [lineError, setLineError] = useState('');
    const customerRequest = useRef(0);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const scheduled = isScheduled(form.deliveryType);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.allSettled([
            listDeliveryCustomers(),
            listDeliveryCategories(),
            listDeliverySubcategories(),
            listDeliveryItemOptions(),
            listDeliveryBrands(),
            listDeliveryItems(),
            listDeliveryWorkOrders(),
        ]).then((results) => {
            if (cancelled) return;
            const [customerResult, categoryResult, subcategoryResult, optionResult, brandResult, itemResult, workOrderResult] = results;
            if (customerResult.status === 'fulfilled') {
                setCustomers(asArray(customerResult.value?.customers).map((row) => ({
                    id: idOf(row.id || row._id),
                    name: row.name || '',
                    address: row.address || row.location || '',
                    contact: row.contact || '',
                    phone: row.phone || '',
                })).filter((row) => row.id && row.name));
            }
            if (categoryResult.status === 'fulfilled') setCategories(namedRows(categoryResult.value));
            if (subcategoryResult.status === 'fulfilled') {
                setSubcategories(asArray(subcategoryResult.value).map((row) => ({
                    id: idOf(row._id),
                    label: row.name || '',
                    categoryId: idOf(row.categoryId),
                    categoryIds: asArray(row.categoryIds).map(idOf),
                })).filter((row) => row.id && row.label));
            }
            if (optionResult.status === 'fulfilled') {
                setItemOptions(asArray(optionResult.value).map((row) => ({
                    id: idOf(row._id),
                    label: row.name || '',
                    subcategoryId: idOf(row.subcategoryId),
                })).filter((row) => row.id && row.label));
            }
            if (brandResult.status === 'fulfilled') setBrands(namedRows(brandResult.value));
            if (itemResult.status === 'fulfilled') {
                setInventoryItems(asArray(itemResult.value?.items).map((row) => ({
                    ...row,
                    _id: idOf(row._id),
                    categoryId: idOf(row.categoryId),
                    subcategoryId: idOf(row.subcategoryId),
                    itemOptionId: idOf(row.itemOptionId),
                    brandId: idOf(row.brandId),
                })));
            }
            if (workOrderResult.status === 'fulfilled') {
                setWorkOrders(asArray(workOrderResult.value?.workOrders).map((row) => ({
                    id: idOf(row._id),
                    no: row.workOrderNo || '',
                    projectName: row.projectName || '',
                    customer: row.customer || '',
                })).filter((row) => row.id && row.no));
            }
            if (customerResult.status === 'rejected') {
                setError(deliveryApiMessage(customerResult.reason, 'Could not load customers.'));
            } else if (itemResult.status === 'rejected') {
                setError(deliveryApiMessage(itemResult.reason, 'Could not load the item catalog.'));
            }
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const customer = customers.find((row) => row.id === form.customerId) || null;
    const projectOptions = useMemo(() => {
        const names = [...new Set(workOrders.map((row) => row.projectName).filter(Boolean))];
        names.sort((left, right) => left.localeCompare(right));
        return names.map((name) => ({ id: name, label: name }));
    }, [workOrders]);
    const workOrderChoices = useMemo(() => {
        const named = workOrders.filter((row) => row.projectName && row.projectName === form.projectName);
        const source = form.projectName && named.length ? named : workOrders;
        return source.map((row) => ({ id: row.id, label: row.no }));
    }, [form.projectName, workOrders]);
    const subcategoryChoices = useMemo(() => subcategories.filter((row) => {
        if (!draft.categoryId) return false;
        return row.categoryId === draft.categoryId || row.categoryIds.includes(draft.categoryId);
    }), [draft.categoryId, subcategories]);
    const itemChoices = useMemo(
        () => itemOptions.filter((row) => row.subcategoryId === draft.subcategoryId),
        [draft.subcategoryId, itemOptions],
    );
    const modelChoices = useMemo(() => inventoryItems.filter((row) => {
        if (draft.categoryId && row.categoryId !== draft.categoryId) return false;
        if (draft.subcategoryId && row.subcategoryId !== draft.subcategoryId) return false;
        if (draft.itemOptionId && row.itemOptionId !== draft.itemOptionId) return false;
        if (draft.brandId && row.brandId !== draft.brandId) return false;
        return Boolean(row.modelNumber || row.description);
    }).map((row) => ({
        id: row._id,
        label: row.modelNumber || row.description,
    })), [draft.brandId, draft.categoryId, draft.itemOptionId, draft.subcategoryId, inventoryItems]);

    function chooseCustomer(customerId) {
        const nextCustomer = customers.find((row) => row.id === customerId) || null;
        const ticket = customerRequest.current + 1;
        customerRequest.current = ticket;
        const fallback = nextCustomer && (nextCustomer.contact || nextCustomer.phone)
            ? [{
                id: 'primary',
                name: nextCustomer.contact || 'Primary contact',
                phones: nextCustomer.phone ? [nextCustomer.phone] : [],
                isPrimary: true,
            }]
            : [];
        setContacts(fallback);
        setContactId(fallback[0]?.id || '');
        setForm((current) => ({
            ...current,
            customerId,
            deliveryAddress: nextCustomer?.address || '',
            contactPersonName: fallback[0]?.name || '',
            contactNumber: fallback[0]?.phones[0] || '',
        }));
        setError('');
        if (!customerId) return;
        getDeliveryCustomer(customerId)
            .then((detail) => {
                if (customerRequest.current !== ticket) return;
                const people = asArray(detail?.contacts).map((row, index) => ({
                    id: String(row.id || `contact-${index}`),
                    name: row.name || 'Contact',
                    phones: asArray(row.phones).map((phone) => String(phone || '')).filter(Boolean),
                    isPrimary: Boolean(row.isPrimary),
                })).filter((row) => row.name);
                const nextContacts = people.length ? people : fallback;
                const primary = nextContacts.find((row) => row.isPrimary) || nextContacts[0] || null;
                setContacts(nextContacts);
                setContactId(primary?.id || '');
                setForm((current) => ({
                    ...current,
                    customerId,
                    deliveryAddress: detail?.address || nextCustomer?.address || '',
                    contactPersonName: primary?.name || '',
                    contactNumber: primary?.phones?.[0] || detail?.phone || nextCustomer?.phone || '',
                }));
            })
            .catch(() => {
                // The customer list already supplied the address and primary contact.
            });
    }

    function chooseContact(nextId) {
        const contact = contacts.find((row) => row.id === nextId) || null;
        setContactId(nextId);
        setForm((current) => ({
            ...current,
            contactPersonName: contact?.name || '',
            contactNumber: contact?.phones?.[0] || current.contactNumber,
        }));
        setError('');
    }

    function chooseWorkOrder(workOrderId) {
        const order = workOrders.find((row) => row.id === workOrderId) || null;
        setForm((current) => ({
            ...current,
            workOrderId,
            projectName: order?.projectName || current.projectName,
        }));
        if (!order?.customer) return;
        const match = customers.find((row) => row.name.trim().toLowerCase() === order.customer.trim().toLowerCase());
        if (match && match.id !== form.customerId) chooseCustomer(match.id);
    }

    function resetForm() {
        const deliveryType = form.deliveryType;
        setForm({ ...emptyForm(), deliveryType });
        setDraft(emptyDraft());
        setContacts([]);
        setContactId('');
        setError('');
        setLineError('');
    }

    function addLine() {
        const category = categories.find((row) => row.id === draft.categoryId);
        const subcategory = subcategories.find((row) => row.id === draft.subcategoryId);
        const item = itemChoices.find((row) => row.id === draft.itemOptionId);
        const brand = brands.find((row) => row.id === draft.brandId);
        const typedModel = draft.modelNumber.trim();
        const catalogItem = scheduled
            ? inventoryItems.find((row) => row.brandId === draft.brandId && String(row.modelNumber || '').toLowerCase() === typedModel.toLowerCase()) || null
            : inventoryItems.find((row) => row._id === draft.modelItemId) || null;
        const modelNumber = scheduled ? typedModel : (catalogItem?.modelNumber || catalogItem?.description || '');
        if (!category) {
            setLineError('Select a category.');
            return;
        }
        if (!subcategory) {
            setLineError('Select a sub category.');
            return;
        }
        if (!item) {
            setLineError('Select an item.');
            return;
        }
        if (!brand) {
            setLineError('Select a brand.');
            return;
        }
        if (!modelNumber) {
            setLineError(scheduled ? 'Enter a model number.' : 'Select a model number.');
            return;
        }
        const description = scheduled
            ? [brand.label, modelNumber, item.label].filter(Boolean).join(' ')
            : manualDescription(item.label, catalogItem?.description || modelNumber);
        const detail = scheduled
            ? `${category.label} > ${subcategory.label} | Brand: ${brand.label} | Model No: ${modelNumber}`
            : '';
        const unit = scheduled ? (catalogItem?.unitOfMeasure || 'Unit') : '';
        const line = {
            categoryId: category.id,
            categoryName: category.label,
            subcategoryId: subcategory.id,
            subcategoryName: subcategory.label,
            itemOptionId: item.id,
            itemName: item.label,
            brandId: brand.id,
            brandName: brand.label,
            modelNumber,
            inventoryItemId: catalogItem?._id || '',
            description,
            detail,
            quantity: 1,
            unit,
        };
        setForm((current) => {
            const index = current.lines.findIndex((row) => row.description === description && row.detail === detail);
            if (index === -1) return { ...current, lines: [...current.lines, line] };
            return {
                ...current,
                lines: current.lines.map((row, lineIndex) => (
                    lineIndex === index ? { ...row, quantity: Number(row.quantity) + 1 } : row
                )),
            };
        });
        setDraft(emptyDraft());
        setLineError('');
        setError('');
    }

    function payload() {
        const order = workOrders.find((row) => row.id === form.workOrderId) || null;
        return {
            deliveryType: form.deliveryType,
            doDate: scheduled ? form.doDate : '',
            projectName: scheduled ? form.projectName.trim() : '',
            workOrderId: scheduled ? form.workOrderId : '',
            workOrderNo: scheduled ? (order?.no || '') : '',
            customerId: form.customerId,
            customerName: customer?.name || '',
            deliveryAddress: form.deliveryAddress.trim(),
            contactPersonName: form.contactPersonName.trim(),
            contactNumber: form.contactNumber.trim(),
            lines: form.lines.map((line) => ({
                ...line,
                quantity: Number(line.quantity) || 0,
            })),
        };
    }

    function validate(action) {
        if (!form.customerId || !customer) return 'Choose a customer.';
        if (action === 'draft') return '';
        if (scheduled && !form.doDate) return 'Choose a delivery date.';
        if (scheduled && !form.projectName.trim()) return 'Enter a project name.';
        if (!form.deliveryAddress.trim()) return 'Enter the delivery address.';
        if (!form.contactPersonName.trim()) return 'Choose a contact person.';
        if (form.contactNumber.replace(/\D/g, '').length < 6) return 'Enter a contact number.';
        if (form.lines.length === 0) return 'Add at least one delivery item.';
        if (form.lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
            return 'Enter a whole quantity of at least 1.';
        }
        return '';
    }

    async function save(action) {
        const problem = validate(action);
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(action);
        setError('');
        try {
            await createDelivery({ ...payload(), action });
            onSaved();
        } catch (saveError) {
            setError(deliveryApiMessage(saveError, 'Could not save this delivery order.'));
        } finally {
            setSaving('');
        }
    }

    const confirmLabel = purchasingOfficer ? 'OK' : 'Submit';
    const DetailsIcon = scheduled ? Truck : UserRound;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-delivery-title"
                className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-[1120px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(30,20,60,0.28)]"
            >
                <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3EEFF] text-[#7C3AED]">
                            <Boxes className="h-5 w-5" />
                        </span>
                        <h2 id="add-delivery-title" className="truncate text-xl font-bold text-slate-900">Add Delivery</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#DDD6FE] px-3 text-sm font-semibold text-[#7C3AED] hover:bg-[#F6F3FF]"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F4F2FA] px-4 py-3">
                        <span className="text-sm font-semibold text-slate-800">Delivery Type</span>
                        <div className="flex flex-wrap gap-2">
                            {TYPES.map((type) => {
                                const Icon = type.icon;
                                const active = form.deliveryType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => {
                                            setForm((current) => ({ ...current, deliveryType: type.id }));
                                            setLineError('');
                                            setError('');
                                        }}
                                        className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${active ? 'bg-[#7C3AED] text-white shadow-sm' : 'border border-[#E4E0F0] bg-white text-slate-600 hover:bg-white'}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {type.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <section className="mt-4 rounded-2xl border border-[#ECE8F6] bg-[#F7F6FC] p-4">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <DetailsIcon className="h-4 w-4 text-[#7C3AED]" />
                            Delivery Details
                        </h3>
                        {scheduled ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <Field label="DO No">
                                    <input value="" disabled placeholder="Auto / Delivery Number" className={inputClass} />
                                </Field>
                                <Field label="DO Date" required>
                                    <DateField value={form.doDate} onChange={(doDate) => setForm((current) => ({ ...current, doDate }))} />
                                </Field>
                                <Field label="Project Name" required>
                                    <Picker
                                        placeholder={loading ? 'Loading projects...' : 'Select project...'}
                                        options={projectOptions}
                                        value={form.projectName}
                                        allowCustom
                                        disabled={loading}
                                        emptyLabel="No projects yet. Type a project name."
                                        onChange={(projectName) => {
                                            setForm((current) => ({
                                                ...current,
                                                projectName,
                                                workOrderId: workOrders.some((row) => row.id === current.workOrderId && (!row.projectName || row.projectName === projectName))
                                                    ? current.workOrderId
                                                    : '',
                                            }));
                                            setError('');
                                        }}
                                    />
                                </Field>
                                <SelectField
                                    label="WO No"
                                    value={form.workOrderId}
                                    onChange={chooseWorkOrder}
                                    placeholder={workOrderChoices.length ? 'Select WO no...' : 'No work orders'}
                                    options={workOrderChoices}
                                    disabled={loading || workOrderChoices.length === 0}
                                />
                            </div>
                        ) : null}

                        <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${scheduled ? 'mt-3 xl:grid-cols-4' : ''}`}>
                            <Field label="Customer Name" required hint="(From CRM customer list)">
                                <Picker
                                    placeholder={loading ? 'Loading customers...' : 'Search customer...'}
                                    leadingIcon={Search}
                                    options={customers.map((row) => ({ id: row.id, label: row.name }))}
                                    value={form.customerId}
                                    onChange={chooseCustomer}
                                    disabled={loading}
                                    emptyLabel="No customers match that search."
                                />
                            </Field>
                            <Field label="Delivery Address" required>
                                <textarea
                                    value={form.deliveryAddress}
                                    onChange={(event) => setForm((current) => ({ ...current, deliveryAddress: event.target.value }))}
                                    placeholder="Enter delivery address..."
                                    className={areaClass}
                                />
                            </Field>
                            <Field label="Contact Person Name" required hint="(From selected customer contacts)">
                                {contacts.length > 0 ? (
                                    <div className="relative">
                                        <select
                                            value={contactId}
                                            onChange={(event) => chooseContact(event.target.value)}
                                            className={`${controlClass} h-11 appearance-none px-3 pr-9 ${contactId ? 'text-slate-800' : 'text-slate-400'}`}
                                        >
                                            <option value="">Select contact person...</option>
                                            {contacts.map((row) => (
                                                <option key={row.id} value={row.id} className="text-slate-800">{row.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                ) : (
                                    <input
                                        value={form.contactPersonName}
                                        disabled={!form.customerId}
                                        onChange={(event) => setForm((current) => ({ ...current, contactPersonName: event.target.value }))}
                                        placeholder="Select contact person..."
                                        className={inputClass}
                                    />
                                )}
                            </Field>
                            <Field label="Contact Number" required>
                                <div className="relative">
                                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={form.contactNumber}
                                        onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))}
                                        placeholder="Enter contact number..."
                                        className={`${inputClass} pl-9`}
                                    />
                                </div>
                            </Field>
                        </div>
                    </section>

                    <section className="mt-4 rounded-2xl border border-[#ECE8F6] bg-[#F7F6FC] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Boxes className="h-4 w-4 text-[#7C3AED]" />
                                Add Delivery Item
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setDraft(emptyDraft());
                                    setLineError('');
                                }}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#DDD6FE] px-3 text-xs font-semibold text-[#7C3AED] hover:bg-white"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </button>
                        </div>

                        {scheduled ? (
                            <>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <SelectField label="Category" required value={draft.categoryId} placeholder="Select category..." options={categories} disabled={loading} onChange={(categoryId) => setDraft({ ...emptyDraft(), categoryId })} />
                                    <SelectField label="Sub Category" required value={draft.subcategoryId} placeholder="Select sub category..." options={subcategoryChoices} disabled={!draft.categoryId} onChange={(subcategoryId) => setDraft((current) => ({ ...current, subcategoryId, itemOptionId: '', modelItemId: '' }))} />
                                    <SelectField label="Item" required value={draft.itemOptionId} placeholder="Select item..." options={itemChoices} disabled={!draft.subcategoryId} onChange={(itemOptionId) => setDraft((current) => ({ ...current, itemOptionId, modelItemId: '' }))} />
                                </div>
                                <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
                                    <SelectField label="Brand" required value={draft.brandId} placeholder="Select brand..." options={brands} disabled={loading} onChange={(brandId) => setDraft((current) => ({ ...current, brandId }))} />
                                    <Field label="Model No" required>
                                        <input
                                            value={draft.modelNumber}
                                            onChange={(event) => setDraft((current) => ({ ...current, modelNumber: event.target.value }))}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    addLine();
                                                }
                                            }}
                                            placeholder="Enter model no..."
                                            className={inputClass}
                                        />
                                    </Field>
                                    <button type="button" onClick={addLine} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-6 text-sm font-semibold text-white hover:bg-[#6D28D9]">
                                        <Plus className="h-4 w-4" />
                                        Add
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-6">
                                <SelectField label="Category" required value={draft.categoryId} placeholder="Select category..." options={categories} disabled={loading} onChange={(categoryId) => setDraft({ ...emptyDraft(), categoryId })} />
                                <SelectField label="Sub Category" required value={draft.subcategoryId} placeholder="Select sub category..." options={subcategoryChoices} disabled={!draft.categoryId} onChange={(subcategoryId) => setDraft((current) => ({ ...current, subcategoryId, itemOptionId: '', modelItemId: '' }))} />
                                <SelectField label="Item" required value={draft.itemOptionId} placeholder="Select item..." options={itemChoices} disabled={!draft.subcategoryId} onChange={(itemOptionId) => setDraft((current) => ({ ...current, itemOptionId, modelItemId: '' }))} />
                                <SelectField label="Brand" required value={draft.brandId} placeholder="Select brand..." options={brands} disabled={loading} onChange={(brandId) => setDraft((current) => ({ ...current, brandId, modelItemId: '' }))} />
                                <SelectField label="Model No" required value={draft.modelItemId} placeholder="Select model no..." options={modelChoices} disabled={!draft.itemOptionId || !draft.brandId} onChange={(modelItemId) => setDraft((current) => ({ ...current, modelItemId }))} />
                                <button type="button" onClick={addLine} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9]">
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>
                        )}
                        {lineError ? <p className="mt-2 text-sm text-red-600">{lineError}</p> : null}

                        <div className="mt-4 overflow-hidden rounded-xl border border-[#E7E2F4] bg-white">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-[#F3EEFF] text-slate-700">
                                    <tr>
                                        <th className="w-14 px-4 py-3 font-semibold">SI</th>
                                        <th className="px-4 py-3 font-semibold">Description</th>
                                        <th className="px-4 py-3 text-right font-semibold">Qty</th>
                                        <th className="w-24 px-4 py-3 text-right font-semibold">{scheduled ? 'Action' : ''}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.lines.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Add an item to this delivery.</td>
                                        </tr>
                                    ) : form.lines.map((line, index) => (
                                        <tr key={`${line.description}-${index}`} className="border-t border-[#F1EEF8]">
                                            <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-800">{line.description}</p>
                                                {line.detail ? <p className="mt-0.5 text-xs text-slate-400">{line.detail}</p> : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.quantity}
                                                        aria-label={`Quantity for ${line.description}`}
                                                        onChange={(event) => {
                                                            const quantity = Number(event.target.value);
                                                            if (!Number.isInteger(quantity) || quantity < 1) return;
                                                            setForm((current) => ({
                                                                ...current,
                                                                lines: current.lines.map((row, lineIndex) => (
                                                                    lineIndex === index ? { ...row, quantity } : row
                                                                )),
                                                            }));
                                                        }}
                                                        className="h-8 w-16 rounded-lg border border-transparent bg-transparent text-right text-sm text-slate-700 outline-none focus:border-[#DDD6FE] focus:bg-white"
                                                    />
                                                    {line.unit ? <span className="text-xs text-slate-400">{line.unit}</span> : null}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setForm((current) => ({
                                                        ...current,
                                                        lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
                                                    }))}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                                                    aria-label={`Remove ${line.description}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1EEF8] px-5 py-4 sm:px-6">
                    <p className="min-h-5 text-sm text-red-600">{error}</p>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const order = workOrders.find((row) => row.id === form.workOrderId);
                                const opened = printDelivery(form, customer?.name || '', order?.no || '');
                                if (!opened) setError('Allow pop-ups to print the delivery order.');
                            }}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-white px-4 text-sm font-semibold text-[#7C3AED] hover:bg-[#F6F3FF]"
                        >
                            <Printer className="h-4 w-4" />
                            Print DO
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => save('draft')}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-white px-4 text-sm font-semibold text-[#7C3AED] hover:bg-[#F6F3FF] disabled:opacity-50"
                        >
                            <FileText className="h-4 w-4" />
                            {saving === 'draft' ? 'Saving...' : 'Draft'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => save('submit')}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50"
                        >
                            <Check className="h-4 w-4" />
                            {saving === 'submit' ? 'Saving...' : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
