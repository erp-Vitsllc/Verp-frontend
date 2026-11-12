'use client';

import { useState } from 'react';
import CatalogModal, { fieldClass, labelClass } from './CatalogModal';
import { apiMessage, createBrand, createCategory, createSubcategory, readImageFile } from './itemMasterApi';

function FormError({ message }) {
    if (!message) return null;
    return <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>;
}

export function AddCategoryModal({ onClose, onSaved }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const saved = await createCategory(name);
            onSaved(saved);
            onClose();
        } catch (err) {
            setError(apiMessage(err, 'Could not save the category.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Category" onClose={onClose}>
            <form onSubmit={submit}>
                <FormError message={error} />
                <label className={labelClass} htmlFor="category-type">Category type</label>
                <input id="category-type" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'OK'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}

export function AddSubcategoryModal({ onClose, onSaved }) {
    const [name, setName] = useState('');
    const [image, setImage] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const file = event.target.elements.subcategoryImage.files?.[0];
            const uploaded = await readImageFile(file, { required: true });
            const saved = await createSubcategory({ name, image: uploaded });
            onSaved(saved);
            onClose();
        } catch (err) {
            setError(apiMessage(err, 'Could not save the subcategory.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Sub Category" onClose={onClose}>
            <form onSubmit={submit}>
                <FormError message={error} />
                <label className={labelClass} htmlFor="subcategory-name">Subcategory</label>
                <input id="subcategory-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
                <label className={`${labelClass} mt-3`} htmlFor="subcategoryImage">Image</label>
                <input
                    id="subcategoryImage"
                    name="subcategoryImage"
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-slate-600"
                    onChange={(event) => setImage(event.target.files?.[0] || null)}
                />
                {image ? <p className="mt-1 text-xs text-slate-500">{image.name}</p> : null}
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'Submit'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}

export function AddBrandModal({ onClose, onSaved }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const file = event.target.elements.brandImage.files?.[0];
            const image = await readImageFile(file, { required: false });
            const saved = await createBrand({ name, image });
            onSaved(saved);
            onClose();
        } catch (err) {
            setError(apiMessage(err, 'Could not save the brand.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Brand" onClose={onClose}>
            <form onSubmit={submit}>
                <FormError message={error} />
                <label className={labelClass} htmlFor="brand-name">Brand</label>
                <input id="brand-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
                <label className={`${labelClass} mt-3`} htmlFor="brandImage">Image (optional)</label>
                <input id="brandImage" name="brandImage" type="file" accept="image/*" className="block w-full text-sm text-slate-600" />
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'Submit'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
