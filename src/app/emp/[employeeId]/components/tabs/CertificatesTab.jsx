'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FileText, Award, Shield, User, Layout, Download, X, Pencil } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { employeeProfileCardCrudAccess, EMPLOYEE_SALARY_CARD_MODULES } from '@/utils/employeeProfileCardAccess';

function parseCertificateStoredDescription(raw) {
    const text = String(raw ?? '');
    const m = text.match(/^\s*Issued By:\s*(.+?)\s*\|\s*Issued To:\s*(.+?)\s*\|\s*([\s\S]*)$/i);
    if (m) {
        return {
            issuedBy: m[1].trim() || '—',
            issuedTo: m[2].trim() || '—',
            userDescription: m[3].trim() || '—',
        };
    }
    return {
        issuedBy: '—',
        issuedTo: '—',
        userDescription: text.trim() || '—',
    };
}

function normIssuedToKey(s) {
    return String(s ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

const CERT_META_DESC_RE = /^\s*Issued By:\s*(.+?)\s*\|\s*Issued To:\s*(.+?)\s*\|\s*([\s\S]*)$/i;

const CATEGORIES = [
    { id: 'Installer', label: 'Installer', icon: <Layout size={18} className="text-blue-500" /> },
    { id: 'Safety', label: 'Safety', icon: <Shield size={18} className="text-emerald-500" /> },
    { id: 'Administration', label: 'Administration', icon: <User size={18} className="text-amber-500" /> },
    { id: 'Others', label: 'Others', icon: <Award size={18} className="text-purple-500" /> },
];

export default function CertificatesTab({
    employee,
    onOpenCertificateModal,
    onViewDocument,
    onEditCertificate,
    formatDate,
    fetchEmployee
}) {
    const { toast } = useToast();
    const certAccess = employeeProfileCardCrudAccess(EMPLOYEE_SALARY_CARD_MODULES.certificate);
    const [companyCertificates, setCompanyCertificates] = useState([]);
    const [loadingCompany, setLoadingCompany] = useState(false);

    const employeeKey = useMemo(() => {
        if (!employee) return '';
        return normIssuedToKey(`${employee.firstName || ''} ${employee.lastName || ''}`);
    }, [employee]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!employee?.company?._id) return;
            try {
                setLoadingCompany(true);
                const res = await axiosInstance.get(`/Company/${employee.company._id}`);
                const co = res.data.company;
                if (cancelled) return;

                const out = [];
                if (co.documents) {
                    co.documents.forEach((doc, idx) => {
                        if (String(doc?.context || '').toLowerCase() !== 'certificate') return;
                        const parsed = parseCertificateStoredDescription(doc.description);
                        if (normIssuedToKey(parsed.issuedTo) !== employeeKey) return;
                        out.push({
                            key: `co-${String(doc._id || doc.id || '')}-${idx}`,
                            type: doc.type || 'Certificate',
                            issuedBy: parsed.issuedBy,
                            issuedTo: parsed.issuedTo,
                            description: parsed.userDescription,
                            issueDate: doc.issueDate || doc.startDate,
                            expiryDate: doc.expiryDate,
                            hasExpiry: doc.expiryDate ? 'yes' : 'no',
                            cert: doc,
                            docIndex: idx,
                            source: 'company'
                        });
                    });
                }
                if (co.oldDocuments) {
                    co.oldDocuments.forEach((doc, idx) => {
                        if (String(doc?.context || '').toLowerCase() !== 'certificate') return;
                        const parsed = parseCertificateStoredDescription(doc.description);
                        if (normIssuedToKey(parsed.issuedTo) !== employeeKey) return;
                        out.push({
                            key: `oldco-${String(doc._id || doc.id || '')}-${idx}`,
                            type: doc.type || 'Certificate',
                            issuedBy: parsed.issuedBy,
                            issuedTo: parsed.issuedTo,
                            description: parsed.userDescription,
                            issueDate: doc.issueDate || doc.startDate,
                            expiryDate: doc.expiryDate,
                            hasExpiry: doc.expiryDate ? 'yes' : 'no',
                            cert: doc,
                            docIndex: idx,
                            source: 'company-old' // Differentiate old documents
                        });
                    });
                }
                setCompanyCertificates(out);
            } catch (e) {
                console.error('Error fetching company certificates:', e);
                if (!cancelled) setCompanyCertificates([]);
            } finally {
                if (!cancelled) setLoadingCompany(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [employee?.company?._id, employeeKey]);

    const allCertificates = useMemo(() => {
        const docs = employee?.documents || [];
        const empRows = [];
        docs.forEach((cert, docIndex) => {
            if (String(cert?.context || '') !== 'Certificate') return;
            const desc = String(cert.description || '');
            const metaMatch = CERT_META_DESC_RE.test(desc);
            const parsed = parseCertificateStoredDescription(desc);
            empRows.push({
                key: `emp-${String(cert._id || docIndex)}`,
                source: 'employee',
                docIndex,
                cert,
                type: cert.type || 'Certificate',
                issuedBy: metaMatch
                    ? parsed.issuedBy
                    : String(cert.issuedBy || '').trim() || parsed.issuedBy,
                issuedTo: metaMatch ? parsed.issuedTo : String(cert.issuedTo || '').trim() || '—',
                description: metaMatch ? parsed.userDescription : desc.trim() || '—',
                issueDate: cert.issueDate || cert.startDate,
                expiryDate: cert.expiryDate,
                hasExpiry: cert.hasExpiry,
            });
        });
        return [...empRows, ...companyCertificates];
    }, [employee?.documents, companyCertificates]);

    const groupedCertificates = useMemo(() => {
        const groups = {
            Installer: [],
            Safety: [],
            Administration: [],
            Others: []
        };

        allCertificates.forEach(cert => {
            const type = String(cert.type || '').toLowerCase();
            if (type.includes('installer')) groups.Installer.push(cert);
            else if (type.includes('safety')) groups.Safety.push(cert);
            else if (type.includes('administration')) groups.Administration.push(cert);
            else groups.Others.push(cert);
        });

        return groups;
    }, [allCertificates]);

    const viewAttachment = useCallback((row) => {
        const d = row.cert?.document || row.cert;
        const data = d?.url || d?.data;
        if (!data) {
            toast({
                variant: 'destructive',
                title: 'No attachment',
                description: 'This certificate has no file to open.',
            });
            return;
        }
        onViewDocument({
            data,
            name: d.name || 'Certificate.pdf',
            mimeType: d.mimeType || 'application/pdf',
            moduleId: 'hrm_employees_view_salary_certificate',
            allowDownload: true,
        });
    }, [onViewDocument, toast]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Certificates</h2>
                </div>
                {certAccess.create && onOpenCertificateModal && (
                    <button
                        type="button"
                        onClick={onOpenCertificateModal}
                        className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold"
                    >
                        Add Certificate
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-8">
                {CATEGORIES.map(category => {
                    const certs = groupedCertificates[category.id];
                    if (certs.length === 0 && category.id !== 'Others') return null;
                    if (certs.length === 0 && category.id === 'Others' && allCertificates.length === 0) {
                        return (
                             <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
                                    {category.icon}
                                    <h3 className="font-bold text-gray-800">{category.label}</h3>
                                    <span className="ml-auto px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold">0</span>
                                </div>
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                        <Award size={32} />
                                    </div>
                                    <p className="text-gray-400 text-sm">No certificates found in this category.</p>
                                </div>
                            </div>
                        );
                    }
                    if (certs.length === 0) return null;

                    return (
                        <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
                            <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
                                {category.icon}
                                <h3 className="font-bold text-gray-800">{category.label}</h3>
                                <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">{certs.length}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Issuer</th>
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Issued To</th>
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Issue Date</th>
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiry</th>
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="py-3 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {certs.map((row) => {
                                            const isEmployeeRow = row.source === 'employee';
                                            const showExpiry = isEmployeeRow
                                                ? row.hasExpiry === 'yes'
                                                : !!row.expiryDate && String(row.expiryDate).trim() !== '' && String(row.expiryDate).trim().toLowerCase() !== 'invalid date';
                                            
                                            const expDate = row.expiryDate ? new Date(row.expiryDate) : null;
                                            const expValid = expDate && !Number.isNaN(expDate.getTime());
                                            const isExpired = showExpiry && expValid && expDate < new Date();

                                            return (
                                                <tr key={row.key} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-800">{row.type}</span>
                                                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-tight">{row.source === 'company' ? 'Company' : 'Profile'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-gray-600">{row.issuedBy}</td>
                                                    <td className="py-4 px-6 text-sm text-gray-600">{row.issuedTo}</td>
                                                    <td className="py-4 px-6 text-sm text-gray-600 font-medium">{formatDate(row.issueDate)}</td>
                                                    <td className="py-4 px-6 text-sm">
                                                        {showExpiry ? (
                                                            <span className={isExpired ? 'text-rose-600 font-bold' : 'text-gray-600 font-medium'}>
                                                                {formatDate(row.expiryDate)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs italic">No Expiry</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        {showExpiry && isExpired ? (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100">
                                                                Expired
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {certAccess.edit && (
                                                                <>
                                                                    <button
                                                                        onClick={() => onEditCertificate(row.cert, row.docIndex, row.source)}
                                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                                        title="Edit Certificate"
                                                                    >
                                                                        <Pencil size={18} />
                                                                    </button>
                                                                    {isExpired && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onEditCertificate(row.cert, row.docIndex, row.source)}
                                                                            className="px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 rounded-lg border border-orange-200"
                                                                            title="Renew Certificate"
                                                                        >
                                                                            Renew
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => viewAttachment(row)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                                title="View Document"
                                                            >
                                                                <FileText size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
