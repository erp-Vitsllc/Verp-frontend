'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import CatalogModal, { fieldClass, labelClass } from '../item-master/CatalogModal';
import { listBrands, listCategories } from '../item-master/itemMasterApi';
import { emailProblem, normalizePhone, phoneProblem } from './vendorFieldValidation';
import { createVendorContact, updateVendorContact, vendorApiMessage } from './vendorManagementApi';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), { ssr: false });

function emptyGroup() {
    return { mode: '', parentId: '', childIds: [''] };
}

function groupsFromContact(contact) {
    const lines = (Array.isArray(contact?.lines) ? contact.lines : [])
        .filter((line) => line?.categoryId || line?.brandId);
    if (!lines.length) return [emptyGroup()];

    const brandCount = new Map();
    const categoryCount = new Map();
    lines.forEach((line) => {
        if (line.brandId) brandCount.set(line.brandId, (brandCount.get(line.brandId) || 0) + 1);
        if (line.categoryId) categoryCount.set(line.categoryId, (categoryCount.get(line.categoryId) || 0) + 1);
    });

    const brandGroups = new Map();
    const categoryGroups = new Map();
    lines.forEach((line) => {
        const brandTimes = line.brandId ? (brandCount.get(line.brandId) || 0) : 0;
        const categoryTimes = line.categoryId ? (categoryCount.get(line.categoryId) || 0) : 0;
        const leadWithBrand = Boolean(line.brandId) && (brandTimes > 1 || !line.categoryId || brandTimes >= categoryTimes);
        if (leadWithBrand) {
            const group = brandGroups.get(line.brandId) || { mode: 'brand', parentId: line.brandId, childIds: [] };
            if (line.categoryId && !group.childIds.includes(line.categoryId)) group.childIds.push(line.categoryId);
            brandGroups.set(line.brandId, group);
            return;
        }
        if (!line.categoryId) return;
        const group = categoryGroups.get(line.categoryId) || { mode: 'category', parentId: line.categoryId, childIds: [] };
        if (line.brandId && !group.childIds.includes(line.brandId)) group.childIds.push(line.brandId);
        categoryGroups.set(line.categoryId, group);
    });

    const groups = [...brandGroups.values(), ...categoryGroups.values()].map((group) => ({
        ...group,
        childIds: group.childIds.length ? group.childIds : [''],
    }));
    return groups.length ? groups : [emptyGroup()];
}

function pairsFromGroups(groups) {
    const pairs = [];
    groups.forEach((group) => {
        if (!group.mode || !group.parentId) return;
        const children = [...new Set(group.childIds.map((id) => String(id || '').trim()).filter(Boolean))];
        if (!children.length) {
            pairs.push(group.mode === 'brand'
                ? { brandId: group.parentId, categoryId: '' }
                : { categoryId: group.parentId, brandId: '' });
            return;
        }
        children.forEach((childId) => {
            pairs.push(group.mode === 'brand'
                ? { brandId: group.parentId, categoryId: childId }
                : { categoryId: group.parentId, brandId: childId });
        });
    });
    return pairs;
}

function optionName(options, id) {
    return options.find((option) => option._id === id)?.name || '';
}

function childOptions(options, childIds, currentId) {
    const taken = new Set(childIds.filter((id) => id && id !== currentId));
    return options.filter((option) => option._id === currentId || !taken.has(option._id));
}

function SearchSelect({ label, value, options, placeholder, disabled, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [menu, setMenu] = useState(null);
    const rootRef = useRef(null);
    const selected = options.find((option) => option._id === value) || null;
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) => String(option.name || '').toLowerCase().includes(needle));
    }, [options, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    function close() {
        setOpen(false);
        setQuery('');
    }

    function choose(id) {
        onChange(id);
        close();
    }

    function toggle(event) {
        if (disabled) return;
        if (open) {
            close();
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const openUp = window.innerHeight - rect.bottom < 280 && rect.top > 280;
        setMenu({
            top: openUp ? rect.top - 4 : rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            openUp,
        });
        setOpen(true);
    }

    return (
        <div ref={rootRef} className="relative">
            <span className={labelClass}>{label}</span>
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={toggle}
                className={`${fieldClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-slate-50`}
            >
                <span className={`min-w-0 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
                    {disabled ? 'Loading...' : selected?.name || placeholder}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && menu ? (
                <div
                    className="fixed z-[100] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-lg"
                    style={{
                        top: menu.top,
                        left: menu.left,
                        width: menu.width,
                        transform: menu.openUp ? 'translateY(-100%)' : undefined,
                    }}
                >
                    <div className="border-b border-[#E6EDF5] p-2">
                        <label className="relative block">
                            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={`Search ${label.toLowerCase()}`}
                                aria-label={`Search ${label}`}
                                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        close();
                                        return;
                                    }
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        if (filtered.length === 1) choose(filtered[0]._id);
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <ul role="listbox" aria-label={label} className="max-h-52 overflow-y-auto py-1">
                        <li>
                            <button
                                type="button"
                                role="option"
                                aria-selected={!value}
                                onClick={() => choose('')}
                                className={`block w-full truncate px-3 py-2 text-left text-sm ${!value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {placeholder}
                            </button>
                        </li>
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-500">No matches.</li>
                        ) : filtered.map((option) => (
                            <li key={option._id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={option._id === value}
                                    onClick={() => choose(option._id)}
                                    className={`block w-full truncate px-3 py-2 text-left text-sm ${option._id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800 hover:bg-slate-50'}`}
                                >
                                    {option.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

export default function AddContactModal({ vendorId, contact, onClose, onSaved }) {
    const [name, setName] = useState(contact?.name || '');
    const [designation, setDesignation] = useState(contact?.designation || '');
    const [email, setEmail] = useState(contact?.emails?.[0] || '');
    const [phone, setPhone] = useState(() => normalizePhone(contact?.phones?.[0] || ''));
    const [groups, setGroups] = useState(() => groupsFromContact(contact));
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showRequired, setShowRequired] = useState(false);
    const emailError = !email.trim()
        ? (showRequired ? 'Email is required.' : '')
        : emailProblem(email);
    const phoneError = !phone.trim()
        ? (showRequired ? 'Phone number is required.' : '')
        : phoneProblem(phone);

    useEffect(() => {
        let cancelled = false;
        Promise.all([listCategories(), listBrands()])
            .then(([categoryRows, brandRows]) => {
                if (cancelled) return;
                setCategories(Array.isArray(categoryRows) ? categoryRows : []);
                setBrands(Array.isArray(brandRows) ? brandRows : []);
            })
            .catch((loadError) => {
                if (!cancelled) setError(vendorApiMessage(loadError, 'Could not load categories.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function updateGroup(index, patch) {
        setGroups((current) => current.map((group, groupIndex) => (
            groupIndex === index ? { ...group, ...patch } : group
        )));
    }

    function chooseFirst(index, mode, id) {
        if (!id) return;
        updateGroup(index, { mode, parentId: id, childIds: [''] });
    }

    function setParent(index, id) {
        if (!id) {
            updateGroup(index, { mode: '', parentId: '', childIds: [''] });
            return;
        }
        updateGroup(index, { parentId: id });
    }

    function setChild(index, childIndex, id) {
        setGroups((current) => current.map((group, groupIndex) => {
            if (groupIndex !== index) return group;
            return {
                ...group,
                childIds: group.childIds.map((childId, currentIndex) => (currentIndex === childIndex ? id : childId)),
            };
        }));
    }

    function addChild(index) {
        setGroups((current) => current.map((group, groupIndex) => (
            groupIndex === index ? { ...group, childIds: [...group.childIds, ''] } : group
        )));
    }

    function removeChild(index, childIndex) {
        setGroups((current) => current.map((group, groupIndex) => {
            if (groupIndex !== index) return group;
            const childIds = group.childIds.filter((_, currentIndex) => currentIndex !== childIndex);
            return { ...group, childIds: childIds.length ? childIds : [''] };
        }));
    }

    async function onSubmit(event) {
        event.preventDefault();
        const missingEmail = !email.trim() ? 'Email is required.' : emailProblem(email);
        const missingPhone = !phone.trim() ? 'Phone number is required.' : phoneProblem(phone);
        if (!name.trim() || missingEmail || missingPhone) {
            setShowRequired(true);
            setError(!name.trim() ? 'Name is required.' : (missingEmail || missingPhone));
            return;
        }
        const pairs = pairsFromGroups(groups);
        const rows = pairs.length ? pairs : [{ categoryId: '', brandId: '' }];
        const entries = rows.map((row, index) => ({
            email: index === 0 ? email.trim() : '',
            phone: index === 0 ? phone.trim() : '',
            categoryId: row.categoryId,
            brandId: row.brandId,
        }));
        setSaving(true);
        setError('');
        const payload = { name: name.trim(), designation: designation.trim(), entries };
        try {
            if (contact?.id) await updateVendorContact(vendorId, contact.id, payload);
            else await createVendorContact(vendorId, payload);
            onSaved();
        } catch (saveError) {
            setError(vendorApiMessage(saveError, 'Could not save this contact.'));
            setSaving(false);
        }
    }

    return (
        <CatalogModal title={contact ? 'Edit Contact' : 'Add Contact'} onClose={onClose} wide>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                <div className="max-h-[min(40rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={labelClass}>Name</span>
                            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
                        </label>
                        <label className="block">
                            <span className={labelClass}>Designation</span>
                            <input className={fieldClass} value={designation} onChange={(event) => setDesignation(event.target.value)} />
                        </label>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#E6EDF5] p-3">
                        <p className="mb-3 text-sm font-medium text-slate-700">Contact details</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className={labelClass}>Email <span className="text-red-500">*</span></span>
                                <input
                                    className={`${fieldClass} ${emailError ? 'border-red-400' : ''}`}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                                {emailError ? <p className="mt-1 text-xs text-red-600">{emailError}</p> : null}
                            </label>
                            <div className="min-w-0">
                                <span className={labelClass}>Phone <span className="text-red-500">*</span></span>
                                <PhoneInputField
                                    label=""
                                    defaultCountry="AE"
                                    value={phone}
                                    required={false}
                                    showValidatedBadge={false}
                                    placeholder="Phone number"
                                    onChange={(value) => setPhone(value || '')}
                                />
                                {phoneError ? <p className="mt-1 text-xs text-red-600">{phoneError}</p> : null}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-700">Product handling</p>
                        <p className="mt-1 text-xs text-slate-500">Pick a brand to add categories under it, or a category to add brands under it.</p>
                        <div className="mt-3 space-y-3">
                            {groups.map((group, index) => {
                                const parentOptions = group.mode === 'category' ? categories : brands;
                                const childList = group.mode === 'brand' ? categories : brands;
                                const parentLabel = optionName(parentOptions, group.parentId);
                                const childLabel = group.mode === 'brand' ? 'Category' : 'Brand';
                                return (
                                    <div key={index} className="rounded-xl border border-[#E6EDF5] p-3">
                                        {!group.mode ? (
                                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                                <SearchSelect
                                                    label="Brand"
                                                    value=""
                                                    options={brands}
                                                    placeholder="Select a brand"
                                                    disabled={loading}
                                                    onChange={(brandId) => chooseFirst(index, 'brand', brandId)}
                                                />
                                                <SearchSelect
                                                    label="Category"
                                                    value=""
                                                    options={categories}
                                                    placeholder="Select a category"
                                                    disabled={loading}
                                                    onChange={(categoryId) => chooseFirst(index, 'category', categoryId)}
                                                />
                                                {groups.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setGroups((current) => current.filter((_, groupIndex) => groupIndex !== index))}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                        aria-label="Remove product handling"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                ) : <span className="hidden sm:block" />}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-end gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <SearchSelect
                                                            label={group.mode === 'brand' ? 'Brand' : 'Category'}
                                                            value={group.parentId}
                                                            options={parentOptions}
                                                            placeholder={group.mode === 'brand' ? 'Select a brand' : 'Select a category'}
                                                            disabled={loading}
                                                            onChange={(id) => setParent(index, id)}
                                                        />
                                                    </div>
                                                    {groups.length > 1 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setGroups((current) => current.filter((_, groupIndex) => groupIndex !== index))}
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                            aria-label="Remove product handling"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <div className="mt-3 space-y-2 border-t border-[#E6EDF5] pt-3">
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {parentLabel || (group.mode === 'brand' ? 'Brand' : 'Category')} {group.mode === 'brand' ? 'categories' : 'brands'}
                                                    </p>
                                                    {group.childIds.map((childId, childIndex) => (
                                                        <div key={`${group.mode}-${childIndex}`} className="flex items-end gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <SearchSelect
                                                                    label={childLabel}
                                                                    value={childId}
                                                                    options={childOptions(childList, group.childIds, childId)}
                                                                    placeholder={group.mode === 'brand' ? 'Select a category' : 'Select a brand'}
                                                                    disabled={loading}
                                                                    onChange={(id) => setChild(index, childIndex, id)}
                                                                />
                                                            </div>
                                                            {group.childIds.length > 1 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeChild(index, childIndex)}
                                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                                    aria-label={`Remove ${childLabel.toLowerCase()}`}
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => addChild(index)}
                                                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-sm font-medium text-slate-700"
                                                    >
                                                        <Plus size={14} />
                                                        {group.mode === 'brand' ? 'Add category' : 'Add brand'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setGroups((current) => [...current, emptyGroup()])}
                            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-sm font-medium text-slate-700"
                        >
                            <Plus size={14} />
                            Add more
                        </button>
                    </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                    <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'OK'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
