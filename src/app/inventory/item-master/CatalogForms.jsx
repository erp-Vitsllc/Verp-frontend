'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import CatalogModal, { fieldClass, labelClass } from './CatalogModal';
import { apiMessage, createBrand, createCategory, createSubcategory, readImageFile } from './itemMasterApi';

const MAX_PHOTO_BYTES = 1_500_000;

function FormError({ message }) {
    if (!message) return null;
    return <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>;
}

function ModalForm({ onSubmit, onClose, saving, disabled, children }) {
    return (
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <div className="max-h-[min(32rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">{children}</div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                    Cancel
                </button>
                <button type="submit" disabled={saving || disabled} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                    {saving ? 'Saving...' : 'Create'}
                </button>
            </div>
        </form>
    );
}

function PhotoUpload({ id, file, onFile }) {
    const inputRef = useRef(null);
    const [preview, setPreview] = useState('');
    const [message, setMessage] = useState('');
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        if (!file) {
            setPreview('');
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const acceptFile = (next) => {
        if (!next) return;
        if (!next.type.startsWith('image/')) {
            if (inputRef.current) inputRef.current.value = '';
            onFile(null);
            setMessage('Choose an image file.');
            return;
        }
        if (next.size > MAX_PHOTO_BYTES) {
            if (inputRef.current) inputRef.current.value = '';
            onFile(null);
            setMessage('Image must be under 1.5 MB.');
            return;
        }
        setMessage('');
        onFile(next);
    };

    const clear = () => {
        if (inputRef.current) inputRef.current.value = '';
        setMessage('');
        onFile(null);
    };

    return (
        <div className="mt-3">
            <span className={labelClass}>
                Photo <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <label
                htmlFor={id}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    acceptFile(event.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-blue-400'}`}
            >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
                    {preview ? (
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <ImagePlus size={20} className="text-slate-400" />
                    )}
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-700">
                        {file ? file.name : 'Drop a photo here, or browse'}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">PNG, JPG, or WEBP. Up to 1.5 MB.</span>
                </span>
            </label>
            <div className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-slate-700"
                >
                    Browse
                </button>
                {file ? (
                    <button type="button" onClick={clear} className="h-8 rounded-lg px-3 text-xs font-medium text-slate-500 hover:text-slate-800">
                        Remove
                    </button>
                ) : null}
            </div>
            {message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null}
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => acceptFile(event.target.files?.[0])}
            />
        </div>
    );
}

export function AddCategoryModal({ onClose, onSaved }) {
    const [name, setName] = useState('');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Category name is required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const image = await readImageFile(file, { required: false });
            const saved = await createCategory(image ? { name: trimmed, image } : { name: trimmed });
            onSaved(saved);
        } catch (err) {
            setError(apiMessage(err, 'Could not save the category.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Category" onClose={onClose}>
            <ModalForm onSubmit={submit} onClose={onClose} saving={saving}>
                <FormError message={error} />
                <label className={labelClass} htmlFor="category-name">
                    Category name <span className="text-red-500">*</span>
                </label>
                <input
                    id="category-name"
                    className={fieldClass}
                    value={name}
                    maxLength={120}
                    autoFocus
                    autoComplete="off"
                    onChange={(event) => setName(event.target.value)}
                />
                <PhotoUpload id="category-photo" file={file} onFile={setFile} />
            </ModalForm>
        </CatalogModal>
    );
}

export function AddSubcategoryModal({ categories = [], loadError = '', canCreateCategory = false, onClose, onSaved, onCreateCategory }) {
    const [categoryId, setCategoryId] = useState('');
    const [name, setName] = useState('');
    const [reservationMode, setReservationMode] = useState('not_applicable');
    const [reservationCount, setReservationCount] = useState('');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const hasCategories = categories.length > 0;

    const submit = async (event) => {
        event.preventDefault();
        if (!hasCategories) {
            setError(loadError ? 'Categories could not be loaded.' : 'Create a category first.');
            return;
        }
        if (!categoryId) {
            setError('Category is required.');
            return;
        }
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Subcategory name is required.');
            return;
        }
        let reservationQuantity = null;
        if (reservationMode === 'count') {
            const count = Number(reservationCount);
            if (reservationCount === '' || !Number.isInteger(count) || count < 0) {
                setError('Enter a whole reservation count of zero or more.');
                return;
            }
            reservationQuantity = count;
        }
        setSaving(true);
        setError('');
        try {
            const image = await readImageFile(file, { required: false });
            const payload = { name: trimmed, categoryId, reservationQuantity };
            if (image) payload.image = image;
            const saved = await createSubcategory(payload);
            onSaved(saved);
        } catch (err) {
            setError(apiMessage(err, 'Could not save the subcategory.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Sub Category" onClose={onClose}>
            <ModalForm onSubmit={submit} onClose={onClose} saving={saving} disabled={!hasCategories}>
                <FormError message={error} />
                <span className={labelClass}>
                    Category <span className="text-red-500">*</span>
                </span>
                {hasCategories ? (
                    <select
                        id="subcategory-category"
                        className={fieldClass}
                        value={categoryId}
                        autoFocus
                        onChange={(event) => setCategoryId(event.target.value)}
                    >
                        <option value="">Select</option>
                        {categories.map((row) => (
                            <option key={row._id} value={row._id}>{row.name}</option>
                        ))}
                    </select>
                ) : loadError ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                        Categories could not be loaded. Try again when the list is available.
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                        <p>No category. Create a category first.</p>
                        {canCreateCategory ? (
                            <button
                                type="button"
                                onClick={onCreateCategory}
                                className="mt-2 h-8 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"
                            >
                                Create category
                            </button>
                        ) : null}
                    </div>
                )}
                <label className={`${labelClass} mt-3`} htmlFor="subcategory-name">
                    Subcategory name <span className="text-red-500">*</span>
                </label>
                <input
                    id="subcategory-name"
                    className={fieldClass}
                    value={name}
                    maxLength={120}
                    autoComplete="off"
                    disabled={!hasCategories}
                    onChange={(event) => setName(event.target.value)}
                />
                <label className={`${labelClass} mt-3`} htmlFor="subcategory-reservation">
                    Reservation quantity
                </label>
                <select
                    id="subcategory-reservation"
                    className={fieldClass}
                    value={reservationMode}
                    disabled={!hasCategories}
                    onChange={(event) => {
                        const next = event.target.value;
                        setReservationMode(next);
                        if (next !== 'count') setReservationCount('');
                    }}
                >
                    <option value="not_applicable">Not Applicable</option>
                    <option value="count">Count</option>
                </select>
                {reservationMode === 'count' ? (
                    <>
                        <label className={`${labelClass} mt-3`} htmlFor="subcategory-reservation-count">
                            Count <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="subcategory-reservation-count"
                            className={fieldClass}
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={reservationCount}
                            disabled={!hasCategories}
                            autoComplete="off"
                            onChange={(event) => setReservationCount(event.target.value)}
                        />
                    </>
                ) : null}
                <PhotoUpload id="subcategory-photo" file={file} onFile={setFile} />
            </ModalForm>
        </CatalogModal>
    );
}

export function AddBrandModal({ onClose, onSaved }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Brand name is required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const saved = await createBrand({ name: trimmed });
            onSaved(saved);
        } catch (err) {
            setError(apiMessage(err, 'Could not save the brand.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Brand" onClose={onClose}>
            <ModalForm onSubmit={submit} onClose={onClose} saving={saving}>
                <FormError message={error} />
                <label className={labelClass} htmlFor="brand-name">
                    Brand name <span className="text-red-500">*</span>
                </label>
                <input
                    id="brand-name"
                    className={fieldClass}
                    value={name}
                    maxLength={120}
                    autoFocus
                    autoComplete="off"
                    onChange={(event) => setName(event.target.value)}
                />
            </ModalForm>
        </CatalogModal>
    );
}
