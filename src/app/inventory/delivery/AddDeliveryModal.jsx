'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Boxes,
    Briefcase,
    Calendar,
    Check,
    ChevronDown,
    FileText,
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
import AddCustomerModal from '../../CRM/Customer/AddCustomerModal';
import {
    createDelivery,
    updateDelivery,
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
import { downloadDeliveryOrderPdf } from './deliveryOrderPdf';

const TYPES = [
    { id: 'Project', label: 'Project', icon: Briefcase },
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
    return type === 'Project';
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
        note: '',
        lines: [],
    };
}

function formFromDelivery(delivery) {
    if (!delivery) return emptyForm();
    return {
        deliveryType: delivery.deliveryType || 'Project',
        doDate: delivery.doDate || todayKey(),
        projectName: delivery.projectName || '',
        workOrderId: delivery.workOrderId || '',
        customerId: delivery.customerId || '',
        deliveryAddress: delivery.deliveryAddress || '',
        contactPersonName: delivery.contactPersonName || '',
        contactNumber: delivery.contactNumber || '',
        note: delivery.note || '',
        lines: Array.isArray(delivery.lines) ? delivery.lines.map((line) => ({ ...line })) : [],
    };
}

function emptyDraft() {
    return {
        categoryId: '',
        categoryText: '',
        subcategoryId: '',
        subcategoryText: '',
        itemOptionId: '',
        itemText: '',
        brandId: '',
        brandText: '',
        modelNumber: '',
        quantity: '0',
    };
}

function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function namesEqual(left, right) {
    return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
}

function inStock(row) {
    return Boolean(row) && !row.pendingStock && Number(row.availableQuantity) > 0;
}

function reservedQuantity(lines, itemId, exceptIndex = -1) {
    return lines.reduce((sum, row, index) => (
        index !== exceptIndex && row.inventoryItemId === itemId ? sum + Number(row.quantity || 0) : sum
    ), 0);
}

function matchOne(rows, text) {
    const name = cleanText(text);
    if (!name) return null;
    const matches = rows.filter((row) => namesEqual(row.label, name));
    return matches.length === 1 ? matches[0] : null;
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

function contactPeople(detail, fallbackCustomer) {
    const people = asArray(detail?.contacts).map((row, index) => ({
        id: String(row.id || `contact-${index}`),
        name: cleanText(row.name),
        phones: asArray(row.phones).map((phone) => cleanText(phone)).filter(Boolean),
        isPrimary: Boolean(row.isPrimary),
    })).filter((row) => row.name);
    if (people.length) return people;
    if (fallbackCustomer && (fallbackCustomer.contact || fallbackCustomer.phone)) {
        return [{
            id: 'primary',
            name: cleanText(fallbackCustomer.contact) || 'Primary contact',
            phones: fallbackCustomer.phone ? [cleanText(fallbackCustomer.phone)] : [],
            isPrimary: true,
        }];
    }
    return [];
}

function SuggestField({ label, required = false, hint = '', text, options, placeholder, onText, onPick, onCommit, disabled = false }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const [active, setActive] = useState(0);
    const needle = cleanText(text).toLowerCase();
    const shown = needle
        ? options.filter((option) => cleanText(option.label).toLowerCase().includes(needle))
        : options;

    useEffect(() => {
        setActive(0);
    }, [needle, shown.length]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const rect = rootRef.current?.getBoundingClientRect();
            if (!rect) return;
            setMenuStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                zIndex: 80,
            });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, text]);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            if (menuRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const pick = (option) => {
        onPick(option.value);
        setOpen(false);
    };

    const menu = open && menuStyle && shown.length ? createPortal(
        <ul
            ref={menuRef}
            style={menuStyle}
            className="max-h-56 overflow-y-auto rounded-xl border border-[#E6E2F2] bg-white py-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
        >
            {shown.map((option, index) => (
                <li key={`${option.label}:${option.value}`}>
                    <button
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => pick(option)}
                        className={`w-full px-3 py-2 text-left text-sm ${index === active ? 'bg-[#7C3AED] text-white' : 'text-slate-700'}`}
                    >
                        {option.label}
                    </button>
                </li>
            ))}
        </ul>,
        document.body,
    ) : null;

    return (
        <label ref={rootRef} className="relative block">
            <span className="mb-1 block text-sm font-semibold text-slate-900">
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </span>
            {hint ? <span className="mb-1.5 block text-xs text-slate-400">{hint}</span> : null}
            <input
                value={text}
                placeholder={placeholder}
                autoComplete="off"
                disabled={disabled}
                aria-expanded={open}
                aria-autocomplete="list"
                onChange={(event) => {
                    onText(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    if (!disabled) setOpen(true);
                }}
                onBlur={() => {
                    setOpen(false);
                    onCommit?.(text);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        setOpen(false);
                        return;
                    }
                    if (!open || shown.length === 0) return;
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActive((current) => (current + 1) % shown.length);
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((current) => (current - 1 + shown.length) % shown.length);
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        pick(shown[Math.min(active, shown.length - 1)]);
                    }
                }}
                className={inputClass}
            />
            {menu}
        </label>
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
    emptyLabel = 'No matches.',
    onAdd,
    addLabel = 'Add new',
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [menuBox, setMenuBox] = useState(null);
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const selected = options.find((option) => option.id === value) || null;
    const display = selected?.label || '';
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) => option.label.toLowerCase().includes(needle));
    }, [options, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            if (menuRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        const place = () => {
            const node = rootRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 220 && rect.top > spaceBelow;
            setMenuBox({
                left: rect.left,
                width: rect.width,
                maxHeight: Math.max(160, Math.min(280, openUp ? rect.top - 12 : spaceBelow - 12)),
                top: openUp ? undefined : rect.bottom + 4,
                bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
            });
        };
        place();
        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);

    function choose(option) {
        onChange(option.id);
        setQuery('');
        setOpen(false);
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setQuery('');
                    setOpen((current) => !current);
                }}
                className={`${inputClass} flex items-center gap-2 text-left disabled:cursor-not-allowed`}
            >
                {LeadingIcon ? <LeadingIcon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                <span className={`min-w-0 flex-1 truncate ${display ? 'text-slate-800' : 'text-slate-400'}`}>
                    {display || placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && menuBox ? (
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        left: menuBox.left,
                        width: menuBox.width,
                        top: menuBox.top,
                        bottom: menuBox.bottom,
                        maxHeight: menuBox.maxHeight,
                        zIndex: 80,
                    }}
                    className="flex flex-col overflow-hidden rounded-xl border border-[#E6E2F2] bg-white shadow-lg"
                >
                    <div className="border-b border-[#F1EEF8] p-2">
                        <input
                            autoFocus
                            value={query}
                            placeholder="Search..."
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setOpen(false);
                                    return;
                                }
                                if (event.key === 'Enter' && filtered.length === 1) {
                                    event.preventDefault();
                                    choose(filtered[0]);
                                }
                            }}
                            className="h-9 w-full rounded-lg border border-[#E6E2F2] px-3 text-sm text-slate-800 outline-none focus:border-[#7C3AED]"
                        />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
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
                    </div>
                    {onAdd ? (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setQuery('');
                                onAdd();
                            }}
                            className="border-t border-[#F1EEF8] px-3 py-2 text-center text-sm font-semibold text-[#7C3AED] hover:bg-[#F6F3FF]"
                        >
                            + {addLabel}
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


export default function AddDeliveryModal({ onClose, onSaved, purchasingOfficer = false, delivery = null, readOnly = false }) {
    const [form, setForm] = useState(() => formFromDelivery(delivery));
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
    const [customerModal, setCustomerModal] = useState(false);
    const customerRequest = useRef(0);
    const nestedOpen = useRef(false);
    nestedOpen.current = customerModal;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const scheduled = isScheduled(form.deliveryType);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape' && !nestedOpen.current) onCloseRef.current();
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

    useEffect(() => {
        const customerId = form.customerId;
        if (!customerId) return undefined;
        let cancelled = false;
        getDeliveryCustomer(customerId)
            .then((detail) => {
                if (cancelled) return;
                const known = customers.find((row) => row.id === customerId) || null;
                const people = contactPeople(detail, known);
                if (!people.length) return;
                setContacts(people);
                setContactId((current) => {
                    if (current && people.some((row) => row.id === current)) return current;
                    const named = people.find((row) => namesEqual(row.name, form.contactPersonName));
                    return named?.id || '';
                });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [form.customerId, customers]);

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
    const stockedItems = useMemo(() => inventoryItems.filter(inStock), [inventoryItems]);
    const stockedCategories = useMemo(() => {
        const ids = new Set(stockedItems.map((row) => row.categoryId));
        return categories.filter((row) => ids.has(row.id));
    }, [categories, stockedItems]);
    const stockedSubcategories = useMemo(() => {
        const ids = new Set(stockedItems.map((row) => row.subcategoryId));
        return subcategories.filter((row) => ids.has(row.id));
    }, [stockedItems, subcategories]);
    const stockedBrands = useMemo(() => {
        const ids = new Set(stockedItems.map((row) => row.brandId));
        return brands.filter((row) => ids.has(row.id));
    }, [brands, stockedItems]);
    const stockedItemOptions = useMemo(() => {
        const ids = new Set(stockedItems.map((row) => row.itemOptionId).filter(Boolean));
        const fromCatalog = itemOptions.filter((row) => ids.has(row.id));
        const extras = stockedItems.flatMap((row) => {
            if (row.itemOptionId) return [];
            const label = cleanText(row.itemName || row.description);
            if (!label) return [];
            return [{ id: row._id, label, subcategoryId: row.subcategoryId }];
        });
        return [...fromCatalog, ...extras];
    }, [itemOptions, stockedItems]);
    function narrowedItems(skip) {
        return stockedItems.filter((row) => {
            if (skip !== 'category' && draft.categoryId && row.categoryId !== draft.categoryId) return false;
            if (skip !== 'subcategory' && draft.subcategoryId && row.subcategoryId !== draft.subcategoryId) return false;
            if (skip !== 'brand' && draft.brandId && row.brandId !== draft.brandId) return false;
            if (skip !== 'item' && draft.itemOptionId && row.itemOptionId !== draft.itemOptionId && row._id !== draft.itemOptionId) return false;
            if (skip !== 'model' && cleanText(draft.modelNumber) && !namesEqual(row.modelNumber, draft.modelNumber)) return false;
            return true;
        });
    }
    const categoryChoices = useMemo(() => {
        const ids = new Set(narrowedItems('category').map((row) => row.categoryId));
        return stockedCategories.filter((row) => ids.has(row.id)).map((row) => ({ id: row.id, label: row.label }));
    }, [draft.subcategoryId, draft.brandId, draft.itemOptionId, draft.modelNumber, stockedCategories, stockedItems]);
    const subcategoryChoices = useMemo(() => {
        const ids = new Set(narrowedItems('subcategory').map((row) => row.subcategoryId));
        return stockedSubcategories.filter((row) => ids.has(row.id)).map((row) => ({ id: row.id, label: row.label }));
    }, [draft.categoryId, draft.brandId, draft.itemOptionId, draft.modelNumber, stockedItems, stockedSubcategories]);
    const itemChoices = useMemo(() => {
        const rows = narrowedItems('item');
        const seen = new Map();
        rows.forEach((row) => {
            const option = stockedItemOptions.find((item) => item.id === row.itemOptionId) || stockedItemOptions.find((item) => item.id === row._id);
            const id = option?.id || row.itemOptionId || row._id;
            const label = option?.label || cleanText(row.itemName || row.description);
            if (id && label && !seen.has(id)) seen.set(id, label);
        });
        return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
    }, [draft.categoryId, draft.subcategoryId, draft.brandId, draft.modelNumber, stockedItemOptions, stockedItems]);
    const brandChoices = useMemo(() => {
        const ids = new Set(narrowedItems('brand').map((row) => row.brandId));
        return stockedBrands.filter((row) => ids.has(row.id)).map((row) => ({ id: row.id, label: row.label }));
    }, [draft.categoryId, draft.subcategoryId, draft.itemOptionId, draft.modelNumber, stockedBrands, stockedItems]);
    const modelChoices = useMemo(() => {
        const values = new Map();
        narrowedItems('model').forEach((row) => {
            const model = cleanText(row.modelNumber);
            if (!model || values.has(model)) return;
            values.set(model, Number(row.availableQuantity) || 0);
        });
        return [...values.entries()]
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([model, quantity]) => ({ id: model, label: `${model} · ${quantity} in stock` }));
    }, [draft.brandId, draft.categoryId, draft.itemOptionId, draft.subcategoryId, stockedItems]);

    function chooseCustomer(customerId, known) {
        const nextCustomer = known || customers.find((row) => row.id === customerId) || null;
        const ticket = customerRequest.current + 1;
        customerRequest.current = ticket;
        const fallback = contactPeople(null, nextCustomer);
        const first = fallback.find((row) => row.isPrimary) || fallback[0] || null;
        setContacts(fallback);
        setContactId(first?.id || '');
        setForm((current) => ({
            ...current,
            customerId,
            deliveryAddress: nextCustomer?.address || '',
            contactPersonName: first?.name || '',
            contactNumber: first?.phones[0] || '',
        }));
        setError('');
        if (!customerId) return;
        getDeliveryCustomer(customerId)
            .then((detail) => {
                if (customerRequest.current !== ticket) return;
                const nextContacts = contactPeople(detail, nextCustomer);
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
        if (!contact) return;
        setContactId(contact.id);
        setForm((current) => ({
            ...current,
            contactPersonName: contact.name,
            contactNumber: contact.phones[0] || current.contactNumber,
        }));
        setError('');
    }

    function typeContactName(text) {
        setForm((current) => ({ ...current, contactPersonName: text }));
        const selected = contacts.find((row) => row.id === contactId);
        if (selected && !namesEqual(selected.name, text)) setContactId('');
    }

    function commitContactName(text) {
        const name = cleanText(text);
        const selected = contacts.find((row) => row.id === contactId);
        if (selected && namesEqual(selected.name, name)) {
            setForm((current) => ({ ...current, contactPersonName: selected.name }));
            return;
        }
        const matches = contacts.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseContact(matches[0].id);
        else setForm((current) => ({ ...current, contactPersonName: name }));
    }

    function typeContactNumber(text) {
        setForm((current) => ({ ...current, contactNumber: text }));
    }

    function chooseContactNumber(value) {
        const marker = String(value || '').indexOf('::');
        const id = marker === -1 ? '' : value.slice(0, marker);
        const phone = marker === -1 ? String(value || '') : value.slice(marker + 2);
        const contact = contacts.find((row) => row.id === id) || null;
        if (contact) setContactId(contact.id);
        setForm((current) => ({
            ...current,
            contactPersonName: contact?.name || current.contactPersonName,
            contactNumber: phone,
        }));
        setError('');
    }

    function commitContactNumber(text) {
        const number = cleanText(text);
        const digits = number.replace(/\D/g, '');
        const selected = contacts.find((row) => row.id === contactId);
        const pool = selected?.phones?.length
            ? selected.phones.map((phone) => ({ id: selected.id, phone }))
            : contacts.flatMap((row) => row.phones.map((phone) => ({ id: row.id, phone })));
        const matches = pool.filter((row) => row.phone.replace(/\D/g, '') === digits || namesEqual(row.phone, number));
        if (digits.length >= 6 && matches.length === 1) {
            chooseContactNumber(`${matches[0].id}::${matches[0].phone}`);
            return;
        }
        setForm((current) => ({ ...current, contactNumber: number }));
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

    function ownedItem(model) {
        const text = cleanText(model);
        if (!text) return null;
        return stockedItems.find((row) => namesEqual(row.modelNumber, text)) || null;
    }

    function fillFromItem(owner, model) {
        const category = categories.find((row) => row.id === owner.categoryId);
        const subcategory = subcategories.find((row) => row.id === owner.subcategoryId);
        const brand = brands.find((row) => row.id === owner.brandId);
        const item = itemOptions.find((row) => row.id === owner.itemOptionId);
        setDraft((current) => ({
            categoryId: category?.id || owner.categoryId || '',
            categoryText: category?.label || '',
            subcategoryId: subcategory?.id || owner.subcategoryId || '',
            subcategoryText: subcategory?.label || '',
            itemOptionId: item?.id || owner.itemOptionId || '',
            itemText: item?.label || owner.itemName || '',
            brandId: brand?.id || owner.brandId || '',
            brandText: brand?.label || '',
            modelNumber: cleanText(model || owner.modelNumber),
            quantity: current.quantity ?? '0',
        }));
        setLineError('');
    }

    function commitStock(next) {
        const matches = stockedItems.filter((row) => {
            if (next.categoryId && row.categoryId !== next.categoryId) return false;
            if (next.subcategoryId && row.subcategoryId !== next.subcategoryId) return false;
            if (next.brandId && row.brandId !== next.brandId) return false;
            if (next.itemOptionId && row.itemOptionId !== next.itemOptionId && row._id !== next.itemOptionId) return false;
            if (next.modelNumber && !namesEqual(row.modelNumber, next.modelNumber)) return false;
            return true;
        });
        if (matches.length === 1) {
            fillFromItem(matches[0], matches[0].modelNumber);
            return;
        }
        const category = categories.find((row) => row.id === next.categoryId);
        const subcategory = subcategories.find((row) => row.id === next.subcategoryId);
        const brand = brands.find((row) => row.id === next.brandId);
        const item = stockedItemOptions.find((row) => row.id === next.itemOptionId);
        setDraft((current) => ({
            ...current,
            categoryId: next.categoryId || '',
            categoryText: category?.label || '',
            subcategoryId: next.subcategoryId || '',
            subcategoryText: subcategory?.label || '',
            brandId: next.brandId || '',
            brandText: brand?.label || '',
            itemOptionId: next.itemOptionId || '',
            itemText: item?.label || '',
            modelNumber: next.modelNumber || '',
        }));
        setLineError('');
    }

    function chooseCategory(nextId) {
        commitStock({ categoryId: nextId, subcategoryId: '', brandId: '', itemOptionId: '', modelNumber: '' });
    }

    function chooseSubcategory(nextId) {
        const sub = subcategories.find((row) => row.id === nextId);
        commitStock({
            categoryId: sub?.categoryId || draft.categoryId,
            subcategoryId: nextId,
            brandId: '',
            itemOptionId: '',
            modelNumber: '',
        });
    }

    function chooseItem(nextId) {
        commitStock({
            categoryId: draft.categoryId,
            subcategoryId: draft.subcategoryId,
            brandId: draft.brandId,
            itemOptionId: nextId,
            modelNumber: '',
        });
    }

    function chooseBrand(nextId) {
        commitStock({
            categoryId: draft.categoryId,
            subcategoryId: draft.subcategoryId,
            brandId: nextId,
            itemOptionId: draft.itemOptionId,
            modelNumber: '',
        });
    }

    function chooseModel(model) {
        commitStock({
            categoryId: draft.categoryId,
            subcategoryId: draft.subcategoryId,
            brandId: draft.brandId,
            itemOptionId: draft.itemOptionId,
            modelNumber: model,
        });
    }

    function addLine() {
        const categoryText = cleanText(draft.categoryText);
        let category = (stockedCategories.find((row) => row.id === draft.categoryId && namesEqual(row.label, categoryText))
            || matchOne(stockedCategories, categoryText));
        const subPool = category
            ? stockedSubcategories.filter((row) => row.categoryId === category.id || row.categoryIds.includes(category.id))
            : stockedSubcategories;
        const subText = cleanText(draft.subcategoryText);
        let subcategory = (subPool.find((row) => row.id === draft.subcategoryId && namesEqual(row.label, subText))
            || matchOne(subPool, subText));
        if (!category && subcategory) {
            category = stockedCategories.find((row) => row.id === subcategory.categoryId) || null;
        }
        const brandText = cleanText(draft.brandText);
        let brand = (stockedBrands.find((row) => row.id === draft.brandId && namesEqual(row.label, brandText))
            || matchOne(stockedBrands, brandText));
        const optionPool = subcategory
            ? stockedItemOptions.filter((row) => row.subcategoryId === subcategory.id)
            : stockedItemOptions;
        const itemText = cleanText(draft.itemText);
        let item = (optionPool.find((row) => row.id === draft.itemOptionId && namesEqual(row.label, itemText))
            || matchOne(optionPool, itemText));
        let typedModel = cleanText(draft.modelNumber);
        const owner = ownedItem(typedModel);
        if (owner) {
            const ownerName = owner.itemName || stockedItemOptions.find((row) => row.id === owner.itemOptionId)?.label || '';
            const ownerMatches = (!category || owner.categoryId === category.id)
                && (!subcategory || owner.subcategoryId === subcategory.id)
                && (!brand || owner.brandId === brand.id)
                && (!itemText || namesEqual(ownerName, itemText) || namesEqual(owner.description, itemText));
            if (ownerMatches) {
                category = stockedCategories.find((row) => row.id === owner.categoryId) || category;
                subcategory = stockedSubcategories.find((row) => row.id === owner.subcategoryId) || subcategory;
                brand = stockedBrands.find((row) => row.id === owner.brandId) || brand;
                item = stockedItemOptions.find((row) => row.id === owner.itemOptionId) || item;
            } else {
                typedModel = '';
            }
        }
        const typedSomething = categoryText || subText || brandText || itemText || typedModel;
        if (!category || !subcategory || !brand) {
            setLineError(typedSomething ? 'Only items that are in stock can be added.' : 'Category, sub category, and brand are required.');
            return;
        }
        if (subcategory.categoryId !== category.id && !subcategory.categoryIds.includes(category.id)) {
            setLineError('Sub category does not belong to the selected category.');
            return;
        }
        const matches = stockedItems.filter((row) => {
            if (row.categoryId !== category.id || row.subcategoryId !== subcategory.id || row.brandId !== brand.id) return false;
            if (item) {
                if (row.itemOptionId) {
                    if (row.itemOptionId !== item.id) return false;
                } else if (row._id !== item.id && !namesEqual(row.itemName || row.description, item.label)) return false;
            } else if (itemText && !namesEqual(row.itemName || row.description, itemText)) return false;
            if (typedModel && !namesEqual(row.modelNumber, typedModel)) return false;
            return true;
        });
        if (!item && !itemText && matches.length !== 1) {
            setLineError('Enter an item.');
            return;
        }
        if (matches.length === 0) {
            setLineError('Only items that are in stock can be added.');
            return;
        }
        if (matches.length > 1) {
            setLineError('Select the model no of the stocked item.');
            return;
        }
        const stockItem = matches[0];
        const quantity = Number(draft.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
            setLineError('Enter a whole quantity of at least 1.');
            return;
        }
        const onHand = Number(stockItem.availableQuantity) || 0;
        const already = reservedQuantity(form.lines, stockItem._id);
        if (already + quantity > onHand) {
            setLineError(`${stockItem.itemName || stockItem.description || 'This item'} only has ${onHand} in stock.`);
            return;
        }
        const itemName = cleanText(stockItem.itemName || item?.label || stockItem.description);
        const modelNumber = cleanText(stockItem.modelNumber);
        const description = cleanText(stockItem.description)
            || [brand.label, itemName, modelNumber, subcategory.label].filter(Boolean).join(' ');
        const line = {
            lineKey: `${stockItem._id}-${Date.now()}-${form.lines.length}`,
            categoryId: category.id,
            categoryName: category.label,
            subcategoryId: subcategory.id,
            subcategoryName: subcategory.label,
            itemOptionId: stockItem.itemOptionId || '',
            itemName,
            brandId: brand.id,
            brandName: brand.label,
            modelNumber,
            inventoryItemId: stockItem._id,
            description,
            detail: '',
            quantity,
            unit: stockItem.unitOfMeasure || '',
            stockOnHand: onHand,
        };
        setForm((current) => ({ ...current, lines: [...current.lines, line] }));
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
            note: form.note.trim(),
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
        if (form.lines.some((line) => !line.inventoryItemId)) return 'Only items that are in stock can be added.';
        if (form.lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
            return 'Enter a whole quantity of at least 1.';
        }
        const totals = new Map();
        form.lines.forEach((line) => {
            totals.set(line.inventoryItemId, (totals.get(line.inventoryItemId) || 0) + Number(line.quantity));
        });
        for (const [itemId, quantity] of totals) {
            const item = inventoryItems.find((row) => row._id === itemId);
            const baseline = Array.isArray(delivery?.stockLines) ? delivery.stockLines : (delivery?.lines || []);
            const alreadyOut = delivery?.stockApplied
                ? baseline.reduce((sum, line) => (
                    line.inventoryItemId === itemId ? sum + Number(line.quantity || 0) : sum
                ), 0)
                : 0;
            const onHand = (Number(item?.availableQuantity) || 0) + alreadyOut;
            if (!item || item.pendingStock || onHand <= 0) return 'Only items that are in stock can be added.';
            if (quantity > onHand) return `${item.itemName || item.description || 'An item'} only has ${onHand} in stock.`;
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
            const body = { ...payload(), action };
            const saved = delivery?.id ? await updateDelivery(delivery.id, body) : await createDelivery(body);
            onSaved(saved);
        } catch (saveError) {
            setError(deliveryApiMessage(saveError, 'Could not save this delivery order.'));
        } finally {
            setSaving('');
        }
    }

    const confirmLabel = 'Submit';
    const DetailsIcon = scheduled ? Truck : UserRound;

    function rememberCustomer(saved) {
        const id = String(saved?.id || saved?._id || '');
        if (!id) return;
        const row = {
            id,
            name: saved?.name || '',
            address: saved?.address || saved?.location || '',
            contact: saved?.contact || saved?.primaryContact || '',
            phone: saved?.phone || '',
        };
        setCustomers((current) => [...current.filter((item) => item.id !== id), row].filter((item) => item.id && item.name));
        setCustomerModal(false);
        chooseCustomer(id, row);
    }

    return (
        <>
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
                        <h2 id="add-delivery-title" className="truncate text-xl font-bold text-slate-900">{readOnly ? 'Delivery' : delivery?.id ? 'Edit Delivery' : 'Add Delivery'}</h2>
                    </div>
                    <div className="flex items-center gap-2">
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
                    <fieldset disabled={readOnly} className="min-w-0 border-0 p-0 disabled:opacity-100">
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
                                    <input value={delivery?.deliveryNo || ''} disabled placeholder="Auto / Delivery Number" className={inputClass} />
                                </Field>
                                <Field label="DO Date" required>
                                    <DateField value={form.doDate} onChange={(doDate) => setForm((current) => ({ ...current, doDate }))} />
                                </Field>
                                <Field label="Project Name" required>
                                    <Picker
                                        placeholder={loading ? 'Loading projects...' : 'Select project...'}
                                        options={projectOptions}
                                        value={form.projectName}
                                        disabled={loading}
                                        emptyLabel="No projects match that search."
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
                                <Field label="WO No">
                                    <Picker
                                        placeholder={workOrderChoices.length ? 'Select WO no...' : 'No work orders'}
                                        options={workOrderChoices}
                                        value={form.workOrderId}
                                        disabled={loading || workOrderChoices.length === 0}
                                        emptyLabel="No work orders match that search."
                                        onChange={chooseWorkOrder}
                                    />
                                </Field>
                            </div>
                        ) : null}

                        <div className={scheduled ? 'mt-3' : ''}>
                            <Field label="Note">
                                <textarea
                                    value={form.note}
                                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                                    placeholder="Enter note..."
                                    className={areaClass}
                                />
                            </Field>
                        </div>

                        <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 ${scheduled ? 'xl:grid-cols-4' : ''}`}>
                            <Field label="Customer Name" required hint="(From CRM customer list)">
                                <Picker
                                    placeholder={loading ? 'Loading customers...' : 'Search customer...'}
                                    leadingIcon={Search}
                                    options={customers.map((row) => ({ id: row.id, label: row.name }))}
                                    value={form.customerId}
                                    onChange={(id) => chooseCustomer(id)}
                                    disabled={loading}
                                    emptyLabel="No customers match that search."
                                    onAdd={() => setCustomerModal(true)}
                                    addLabel="Add new customer"
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
                            <SuggestField
                                label="Contact Person Name"
                                required
                                hint="(From selected customer contacts)"
                                text={form.contactPersonName}
                                options={contacts.map((row) => ({ label: row.name, value: row.id }))}
                                placeholder={form.customerId ? 'Search contact person...' : 'Select a customer first'}
                                disabled={!form.customerId}
                                onText={typeContactName}
                                onPick={chooseContact}
                                onCommit={commitContactName}
                            />
                            <SuggestField
                                label="Contact Number"
                                required
                                text={form.contactNumber}
                                options={(
                                    (contacts.find((row) => row.id === contactId)?.phones?.length
                                        ? contacts.filter((row) => row.id === contactId)
                                        : contacts)
                                        .flatMap((row) => row.phones.map((phone) => ({
                                            label: phone,
                                            value: `${row.id}::${phone}`,
                                        })))
                                )}
                                placeholder={form.customerId ? 'Search contact number...' : 'Select a customer first'}
                                disabled={!form.customerId}
                                onText={typeContactNumber}
                                onPick={chooseContactNumber}
                                onCommit={commitContactNumber}
                            />
                        </div>
                    </section>

                    <section className="mt-4 rounded-2xl border border-[#ECE8F6] bg-[#F7F6FC] p-4">
                        {readOnly ? (
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Boxes className="h-4 w-4 text-[#7C3AED]" />
                                Delivery Items
                            </h3>
                        ) : (
                        <>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Boxes className="h-4 w-4 text-[#7C3AED]" />
                                    Add Delivery Item
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    Only items in stock can be added. Each item is listed on its own row.
                                    {purchasingOfficer
                                        ? ' Submitting reduces that quantity now.'
                                        : ' Quantity is reduced after the purchase officer approves.'}
                                </p>
                            </div>
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

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <Field label="Category" required>
                                <Picker placeholder="Select category..." options={categoryChoices} value={draft.categoryId} onChange={chooseCategory} emptyLabel="No categories in stock." />
                            </Field>
                            <Field label="Sub Category" required>
                                <Picker placeholder="Select sub category..." options={subcategoryChoices} value={draft.subcategoryId} onChange={chooseSubcategory} emptyLabel="No sub categories in stock." />
                            </Field>
                            <Field label="Item" required>
                                <Picker placeholder="Select item..." options={itemChoices} value={draft.itemOptionId} onChange={chooseItem} emptyLabel="No items in stock." />
                            </Field>
                            <Field label="Brand" required>
                                <Picker placeholder="Select brand..." options={brandChoices} value={draft.brandId} onChange={chooseBrand} emptyLabel="No brands in stock." />
                            </Field>
                            <Field label="Model No">
                                <Picker placeholder="Select model no..." options={modelChoices} value={draft.modelNumber} onChange={chooseModel} emptyLabel="No model numbers in stock." />
                            </Field>
                            <div className="flex items-end justify-end gap-2">
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Qty <span className="text-red-500">*</span></span>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={draft.quantity}
                                        aria-label="Quantity to add"
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            if (next === '' || /^\d+$/.test(next)) {
                                                setDraft((current) => ({ ...current, quantity: next }));
                                            }
                                        }}
                                        className={`${inputClass} w-24`}
                                    />
                                </label>
                                <button type="button" onClick={addLine} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-6 text-sm font-semibold text-white hover:bg-[#6D28D9]">
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>
                        </div>
                        {lineError ? <p className="mt-2 text-sm text-red-600">{lineError}</p> : null}
                        </>
                        )}

                        <div className={`${readOnly ? '' : 'mt-4 '}overflow-hidden rounded-xl border border-[#E7E2F4] bg-white`}>
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-[#F3EEFF] text-slate-700">
                                    <tr>
                                        <th className="w-14 px-4 py-3 font-semibold">SI</th>
                                        <th className="px-4 py-3 font-semibold">Item</th>
                                        <th className="px-4 py-3 text-right font-semibold">In stock</th>
                                        <th className="px-4 py-3 text-right font-semibold">Qty</th>
                                        {readOnly ? null : <th className="w-24 px-4 py-3 text-right font-semibold">Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.lines.length === 0 ? (
                                        <tr>
                                            <td colSpan={readOnly ? 4 : 5} className="px-4 py-8 text-center text-slate-400">{readOnly ? 'No items on this delivery.' : 'Add an item to this delivery.'}</td>
                                        </tr>
                                    ) : form.lines.map((line, index) => {
                                        const live = inventoryItems.find((row) => row._id === line.inventoryItemId);
                                        const onHand = live ? Number(live.availableQuantity) || 0 : Number(line.stockOnHand) || 0;
                                        return (
                                        <tr key={line.lineKey || `${line.inventoryItemId}-${index}`} className="border-t border-[#F1EEF8]">
                                            <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-800">{line.itemName || line.description}</p>
                                                {line.description && line.itemName && line.description !== line.itemName ? (
                                                    <p className="mt-0.5 text-xs text-slate-400">{line.description}</p>
                                                ) : null}
                                                {line.modelNumber ? <p className="mt-0.5 text-xs text-slate-400">Model {line.modelNumber}</p> : null}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-slate-500">{onHand}</td>
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
                                                            const others = reservedQuantity(form.lines, line.inventoryItemId, index);
                                                            if (others + quantity > onHand) {
                                                                setLineError(`${line.itemName || line.description} only has ${onHand} in stock.`);
                                                                return;
                                                            }
                                                            setLineError('');
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
                                            {readOnly ? null : (
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
                                            )}
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    </fieldset>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1EEF8] px-5 py-4 sm:px-6">
                    <p className="min-h-5 text-sm text-red-600">{error}</p>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                const order = workOrders.find((row) => row.id === form.workOrderId);
                                try {
                                    await downloadDeliveryOrderPdf({
                                        form,
                                        customerName: customer?.name || delivery?.customerName || '',
                                        workOrderNo: order?.no || delivery?.workOrderNo || '',
                                        deliveryNo: delivery?.deliveryNo || '',
                                        createdAt: delivery?.createdAt || '',
                                        inventoryItems,
                                    });
                                    setError('');
                                } catch (printError) {
                                    setError(printError?.message || 'Could not download the delivery order.');
                                }
                            }}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-white px-4 text-sm font-semibold text-[#7C3AED] hover:bg-[#F6F3FF]"
                        >
                            <Printer className="h-4 w-4" />
                            Print DO
                        </button>
                        {readOnly || (delivery?.id && delivery.status && delivery.status !== 'Draft') ? null : (
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => save('draft')}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-white px-4 text-sm font-semibold text-[#7C3AED] hover:bg-[#F6F3FF] disabled:opacity-50"
                        >
                            <FileText className="h-4 w-4" />
                            {saving === 'draft' ? 'Saving...' : 'Draft'}
                        </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            {readOnly ? 'Close' : 'Cancel'}
                        </button>
                        {readOnly ? null : (
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => save('submit')}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50"
                        >
                            <Check className="h-4 w-4" />
                            {saving === 'submit' ? 'Saving...' : confirmLabel}
                        </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
        {customerModal ? (
            <AddCustomerModal
                stacked
                onClose={() => setCustomerModal(false)}
                onSaved={rememberCustomer}
            />
        ) : null}
        </>
    );
}
