'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import AddVendorPaymentModal from '../components/AddVendorPaymentModal';

function splitCsv(value) {
    return String(value || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function buildFinePrefillFromSearchParams(searchParams) {
    if (searchParams.get('addFinePay') !== '1') return null;

    const billIds = splitCsv(searchParams.get('billIds'));
    const fineMongoId = String(searchParams.get('fineMongoId') || '').trim();
    const organizationId = String(searchParams.get('organizationId') || '').trim();
    const companyId = String(searchParams.get('companyId') || '').trim();

    return {
        mode: 'fine_bills',
        billsOnly: true,
        fineMongoId,
        fineMongoIds: fineMongoId ? [fineMongoId] : [],
        organizationId,
        companyId,
        selectedBillIds: billIds,
        zohoBillIds: billIds,
        fromQuery: true,
    };
}

function buildPrefillFromSearchParams(searchParams) {
    if (searchParams.get('addUtilityPay') !== '1') return null;

    const billIds = splitCsv(searchParams.get('billIds'));
    const utilityBillIds = splitCsv(searchParams.get('utilityBillIds'));
    const vendorId = String(searchParams.get('vendorId') || '').trim();
    const vendorName = String(searchParams.get('vendorName') || '').trim();
    const amount = String(searchParams.get('amount') || '').trim();
    const date = String(searchParams.get('date') || '').trim();
    const batchId = String(searchParams.get('batchId') || '').trim();
    const mode = String(searchParams.get('mode') || '').trim() || 'bills';
    const utilityType = String(searchParams.get('utilityType') || '').trim();
    const billMonth = String(searchParams.get('billMonth') || '').trim();
    const organizationId = String(searchParams.get('organizationId') || '').trim();
    const companyId = String(searchParams.get('companyId') || '').trim();

    const utilityBillLinks = utilityBillIds.map((utilityBillId, index) => ({
        utilityBillId,
        zohoBillId: billIds[index] || '',
        billNumber: '',
    }));

    return {
        vendorId,
        vendorName,
        amount,
        date,
        referenceNumber: batchId,
        notes: `Utility ${mode === 'difference' ? 'difference' : 'bill'} payment · ${utilityType} ${billMonth}`.trim(),
        utilityType,
        billMonth,
        mode,
        billsOnly: true,
        selectedBillIds: billIds,
        zohoBillIds: billIds,
        utilityBatchId: batchId,
        utilityBillIds,
        utilityBillLinks,
        organizationId,
        companyId,
        fromQuery: true,
    };
}

function mergeUtilityPrefill(fromQuery, fromStorage) {
    if (!fromQuery && !fromStorage) return null;
    if (!fromStorage) return fromQuery;
    if (!fromQuery) return fromStorage;

    const zohoBillIds =
        (Array.isArray(fromStorage.zohoBillIds) && fromStorage.zohoBillIds.length
            ? fromStorage.zohoBillIds
            : fromQuery.zohoBillIds) || [];
    const selectedBillIds =
        (Array.isArray(fromStorage.selectedBillIds) && fromStorage.selectedBillIds.length
            ? fromStorage.selectedBillIds
            : fromQuery.selectedBillIds) || zohoBillIds;

    return {
        ...fromQuery,
        ...fromStorage,
        vendorId: fromStorage.vendorId || fromQuery.vendorId || '',
        vendorName: fromStorage.vendorName || fromQuery.vendorName || '',
        amount: fromStorage.amount || fromQuery.amount || '',
        date: fromStorage.date || fromQuery.date || '',
        referenceNumber: fromStorage.referenceNumber || fromQuery.referenceNumber || '',
        notes: fromStorage.notes || fromQuery.notes || '',
        selectedBillIds,
        zohoBillIds,
        utilityBatchId: fromStorage.utilityBatchId || fromQuery.utilityBatchId || '',
        utilityBillIds:
            (Array.isArray(fromStorage.utilityBillIds) && fromStorage.utilityBillIds.length
                ? fromStorage.utilityBillIds
                : fromQuery.utilityBillIds) || [],
        utilityBillLinks:
            (Array.isArray(fromStorage.utilityBillLinks) && fromStorage.utilityBillLinks.length
                ? fromStorage.utilityBillLinks
                : fromQuery.utilityBillLinks) || [],
        organizationId: fromStorage.organizationId || fromQuery.organizationId || '',
        companyId: fromStorage.companyId || fromQuery.companyId || '',
        billsOnly: true,
    };
}

function NewPaymentMadeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [prefill, setPrefill] = useState(null);
    const utilityPrefillLoadedRef = useRef(false);
    const finePrefillLoadedRef = useRef(false);

    useEffect(() => {
        if (searchParams.get('addFinePay') !== '1') return;
        if (finePrefillLoadedRef.current) return;
        finePrefillLoadedRef.current = true;

        let fromStorage = null;
        try {
            const raw = sessionStorage.getItem('fineVendorPaymentPrefill');
            if (raw) {
                fromStorage = JSON.parse(raw);
                sessionStorage.removeItem('fineVendorPaymentPrefill');
            }
        } catch (err) {
            console.error('Failed to load fine vendor payment prefill:', err);
        }

        const fromQuery = buildFinePrefillFromSearchParams(searchParams);
        const merged = fromStorage
            ? { ...fromQuery, ...fromStorage }
            : fromQuery || fromStorage;
        setPrefill(merged);

        const keep = new URLSearchParams();
        keep.set('addFinePay', '1');
        if (merged?.vendorId) keep.set('vendorId', String(merged.vendorId));
        if (merged?.amount) keep.set('amount', String(merged.amount));
        if (merged?.fineMongoId) keep.set('fineMongoId', String(merged.fineMongoId));
        const billIds = (merged?.zohoBillIds || []).filter(Boolean).join(',');
        if (billIds) keep.set('billIds', billIds);
        if (merged?.organizationId) keep.set('organizationId', String(merged.organizationId));
        if (merged?.companyId) keep.set('companyId', String(merged.companyId));
        const nextQs = keep.toString();
        if (searchParams.toString() !== nextQs) {
            router.replace(`/Accounts/PaymentsMade/new?${nextQs}`, { scroll: false });
        }
    }, [searchParams, router]);

    useEffect(() => {
        if (searchParams.get('addUtilityPay') !== '1') return;
        if (utilityPrefillLoadedRef.current) return;
        utilityPrefillLoadedRef.current = true;

        let fromStorage = null;
        try {
            const raw = sessionStorage.getItem('utilityVendorPaymentPrefill');
            if (raw) {
                fromStorage = JSON.parse(raw);
                sessionStorage.removeItem('utilityVendorPaymentPrefill');
            }
        } catch (err) {
            console.error('Failed to load vendor payment prefill:', err);
        }

        const fromQuery = buildPrefillFromSearchParams(searchParams);
        const merged = mergeUtilityPrefill(fromQuery, fromStorage);
        setPrefill(merged);

        // Keep key query params so refresh still resolves vendor + Zoho bills.
        const keep = new URLSearchParams();
        keep.set('addUtilityPay', '1');
        if (merged?.vendorId) keep.set('vendorId', String(merged.vendorId));
        if (merged?.vendorName) keep.set('vendorName', String(merged.vendorName));
        if (merged?.date) keep.set('date', String(merged.date));
        if (merged?.amount) keep.set('amount', String(merged.amount));
        if (merged?.utilityBatchId) keep.set('batchId', String(merged.utilityBatchId));
        if (merged?.mode) keep.set('mode', String(merged.mode));
        if (merged?.utilityType) keep.set('utilityType', String(merged.utilityType));
        if (merged?.billMonth) keep.set('billMonth', String(merged.billMonth));
        const billIds = (merged?.zohoBillIds || []).filter(Boolean).join(',');
        const utilityBillIds = (merged?.utilityBillIds || []).filter(Boolean).join(',');
        if (billIds) keep.set('billIds', billIds);
        if (utilityBillIds) keep.set('utilityBillIds', utilityBillIds);
        if (merged?.organizationId) keep.set('organizationId', String(merged.organizationId));
        if (merged?.companyId) keep.set('companyId', String(merged.companyId));

        const nextQs = keep.toString();
        if (searchParams.toString() !== nextQs) {
            router.replace(`/Accounts/PaymentsMade/new?${nextQs}`, { scroll: false });
        }
    }, [searchParams, router]);

    // Also accept organizationId when opening New Payment without utility prefill.
    const organizationIdFromQuery = String(searchParams.get('organizationId') || '').trim();
    const companyIdFromQuery = String(searchParams.get('companyId') || '').trim();
    const pagePrefill =
        prefill ||
        (organizationIdFromQuery || companyIdFromQuery
            ? {
                  organizationId: organizationIdFromQuery,
                  companyId: companyIdFromQuery,
              }
            : null);

    return (
        <AddVendorPaymentModal
            variant="page"
            prefill={pagePrefill}
            onClose={() => router.push('/Accounts/PaymentsMade')}
            onSuccess={() => router.push('/Accounts/PaymentsMade')}
        />
    );
}

export default function NewPaymentMadePage() {
    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <Suspense
                            fallback={
                                <div className="py-10 text-center text-sm text-slate-500">
                                    Loading...
                                </div>
                            }
                        >
                            <NewPaymentMadeContent />
                        </Suspense>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
