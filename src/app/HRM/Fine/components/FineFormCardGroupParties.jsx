'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { Users } from 'lucide-react';
import { buildGroupMembersForFine } from '@/utils/fineGroupClassification';
import axiosInstance from '@/utils/axios';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import { mapZohoVendors } from '@/utils/zohoVendors';
import { useToast } from '@/hooks/use-toast';
import {
    FineFormCard,
    formatMoney,
} from './FineFormCardShared';

const compactSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 28,
        height: 28,
        borderRadius: '0.375rem',
        borderColor: state.isFocused ? '#6366f1' : state.isDisabled ? '#e5e7eb' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
        backgroundColor: state.isDisabled ? '#f9fafb' : '#fff',
        cursor: state.isDisabled ? 'not-allowed' : 'text',
        fontSize: '10px',
        '&:hover': {
            borderColor: state.isDisabled ? '#e5e7eb' : '#a5b4fc',
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '0 6px',
        height: 26,
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        fontSize: '10px',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#94a3b8',
        fontSize: '10px',
        whiteSpace: 'nowrap',
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: '10px',
        fontWeight: 600,
        color: '#1f2937',
        maxWidth: '100%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    }),
    indicatorsContainer: () => ({ display: 'none' }),
    dropdownIndicator: () => ({ display: 'none' }),
    clearIndicator: () => ({ display: 'none' }),
    indicatorSeparator: () => ({ display: 'none' }),
    loadingIndicator: (base) => ({
        ...base,
        padding: '0 4px',
        display: 'flex',
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        fontSize: '11px',
        minWidth: 260,
        width: 300,
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 9999,
    }),
    menuList: (base) => ({
        ...base,
        maxHeight: 220,
        paddingTop: 4,
        paddingBottom: 4,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '11px',
        padding: '6px 10px',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        lineHeight: 1.3,
        backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#eef2ff' : '#fff',
        color: state.isSelected ? '#fff' : '#1f2937',
        cursor: 'pointer',
    }),
};

function partyRowKey(member, idx) {
    const record = String(member?.fineRecordId || member?.fineId || '').trim();
    const who = member?.isCompany
        ? 'company'
        : String(member?.employeeId || member?.employeeName || idx).trim();
    return `${record || 'row'}::${who}::${idx}`;
}

function accountOptionLabel(account) {
    const name = String(account?.name || account?.label || '').trim();
    const code = String(account?.code || '').trim();
    if (name && code) return `${name} (${code})`;
    return name || code || String(account?.id || '');
}

/**
 * Group Fine overview — borderless rows; Vendor + Payable as searchable Zoho selects.
 */
export default function FineFormCardGroupParties({
    fine,
    companyName,
    formatDate,
    canEditPartyPayables = false,
    onPartyPayablesChange,
}) {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [listsLoading, setListsLoading] = useState(false);
    const [savingKey, setSavingKey] = useState('');
    const [savingVendor, setSavingVendor] = useState(false);
    const [localPayables, setLocalPayables] = useState({});
    const [localConfirmed, setLocalConfirmed] = useState({});
    const [localVendor, setLocalVendor] = useState('');
    const dirtyPayableKeysRef = useRef(new Set());

    const parties = useMemo(() => {
        if (!fine) return [];
        return buildGroupMembersForFine(fine);
    }, [fine]);

    const partiesPayableSignature = useMemo(
        () =>
            parties
                .map((p, idx) => {
                    const key = partyRowKey(p, idx);
                    return `${key}:${p.expenseAccountId || ''}:${p.payableConfirmed ? 1 : 0}`;
                })
                .join('|'),
        [parties],
    );

    const organizationId = fine?.zohoOrganizationId || '';
    const dropdownsEnabled = Boolean(canEditPartyPayables);

    useEffect(() => {
        setLocalVendor(String(fine?.fineSource || fine?.zohoVendorName || '').trim());
    }, [fine?.fineSource, fine?.zohoVendorName]);

    useEffect(() => {
        if (!fine) return undefined;
        let cancelled = false;
        (async () => {
            setListsLoading(true);
            try {
                const orgParams = organizationId ? { organizationId } : {};
                const [supportRes, vendorRes] = await Promise.all([
                    axiosInstance.get('/zoho/bills/support', {
                        params: orgParams,
                        skipToast: true,
                        timeout: 45000,
                    }),
                    axiosInstance.get('/zoho/vendors', {
                        params: { ...orgParams, sync: 'true', limit: 500 },
                        skipToast: true,
                        timeout: 45000,
                    }),
                ]);
                if (cancelled) return;
                setAccounts(mapZohoPaymentAccounts(supportRes?.data?.data?.accounts));
                setVendors(mapZohoVendors(vendorRes?.data?.data));
            } catch {
                if (!cancelled) {
                    setAccounts([]);
                    setVendors([]);
                }
            } finally {
                if (!cancelled) setListsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [organizationId, fine?._id, fine?.fineId]);

    useEffect(() => {
        if (!parties.length) return;

        const nextPayables = {};
        const nextConfirmed = {};

        setLocalPayables((prev) => {
            parties.forEach((p, idx) => {
                const key = partyRowKey(p, idx);
                const serverId = String(p.expenseAccountId || '').trim();
                const serverName = String(p.expenseAccountName || '').trim();
                const localId = String(prev[key]?.expenseAccountId || '').trim();
                const keepLocal =
                    dirtyPayableKeysRef.current.has(key) && localId && localId !== serverId;

                if (keepLocal) {
                    nextPayables[key] = prev[key];
                } else {
                    nextPayables[key] = {
                        expenseAccountId: serverId,
                        expenseAccountName: serverName,
                    };
                    if (serverId && localId === serverId) {
                        dirtyPayableKeysRef.current.delete(key);
                    }
                }
            });
            return nextPayables;
        });

        setLocalConfirmed((prev) => {
            parties.forEach((p, idx) => {
                const key = partyRowKey(p, idx);
                const serverId = String(p.expenseAccountId || '').trim();
                const localId = String(nextPayables[key]?.expenseAccountId || '').trim();
                const keepLocal =
                    dirtyPayableKeysRef.current.has(key) && localId && localId !== serverId;
                nextConfirmed[key] = keepLocal
                    ? Boolean(prev[key] || localId)
                    : Boolean(serverId || p.payableConfirmed);
            });
            return nextConfirmed;
        });

        onPartyPayablesChange?.(
            parties.map((p, idx) => {
                const key = partyRowKey(p, idx);
                const expenseAccountId = nextPayables[key]?.expenseAccountId || '';
                return {
                    fineRecordId: p.fineRecordId,
                    fineId: p.fineId,
                    employeeName: p.employeeName,
                    isCompany: p.isCompany,
                    expenseAccountId,
                    expenseAccountName: nextPayables[key]?.expenseAccountName || '',
                    payableConfirmed: Boolean(expenseAccountId || nextConfirmed[key]),
                };
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partiesPayableSignature]);

    const vendorOptions = useMemo(() => {
        const seen = new Set();
        const options = [];
        vendors.forEach((v) => {
            const label = String(v.label || v.name || v.companyName || v.id || '').trim();
            if (!label || seen.has(label)) return;
            seen.add(label);
            options.push({ value: label, label });
        });
        const current = String(localVendor || '').trim();
        if (current && !seen.has(current)) {
            options.unshift({ value: current, label: current });
        }
        return options;
    }, [vendors, localVendor]);

    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                value: String(a.id),
                label: accountOptionLabel(a),
                name: a.name || '',
                code: a.code || '',
            })),
        [accounts],
    );

    if (!fine || parties.length === 0) return null;

    const total = parties.reduce((sum, p) => sum + (Number(p.fineAmount) || 0), 0);
    const empCount = parties.filter((p) => !p.isCompany).length;
    const hasCompany = parties.some((p) => p.isCompany);
    const isSingleParty = parties.length <= 1;

    const fmt = formatDate || ((d) => (d ? new Date(d).toLocaleDateString() : '—'));
    const issueDate = fmt(fine.awardedDate || fine.createdAt);

    const selectedVendorOption =
        vendorOptions.find((o) => o.value === localVendor) ||
        (localVendor ? { value: localVendor, label: localVendor } : null);

    const emitPayables = (nextMap, confirmedMap = localConfirmed) => {
        onPartyPayablesChange?.(
            parties.map((p, idx) => {
                const key = partyRowKey(p, idx);
                const expenseAccountId = nextMap[key]?.expenseAccountId || '';
                return {
                    fineRecordId: p.fineRecordId,
                    fineId: p.fineId,
                    employeeName: p.employeeName,
                    isCompany: p.isCompany,
                    expenseAccountId,
                    expenseAccountName: nextMap[key]?.expenseAccountName || '',
                    // Done column removed — selecting Payable marks the row ready
                    payableConfirmed: Boolean(expenseAccountId || confirmedMap[key]),
                };
            }),
        );
    };

    const handleVendorChange = async (nextLabel) => {
        setLocalVendor(nextLabel);
        if (!dropdownsEnabled) return;

        const match = vendors.find((v) => {
            const name = String(v.label || v.name || v.companyName || '')
                .trim()
                .toLowerCase();
            const want = String(nextLabel || '')
                .trim()
                .toLowerCase();
            return name === want || name.includes(want) || want.includes(name);
        });

        setSavingVendor(true);
        try {
            const targetId = parties[0]?.fineRecordId || fine._id;
            await axiosInstance.put(`/Fine/${targetId}`, {
                fineSource: nextLabel,
                zohoVendorId: match?.id || '',
                zohoVendorName: nextLabel,
            });
            if (!match?.id) {
                toast({
                    title: 'Vendor name saved',
                    description:
                        'Fine Source saved. Zoho vendor id was not matched — Management will resolve it by name when billing.',
                    className: 'bg-amber-50 border-amber-200 text-amber-900',
                });
            } else {
                toast({
                    title: 'Vendor saved',
                    description: 'Fine Source / Vendor updated for this group fine.',
                    className: 'bg-green-50 border-green-200 text-green-800',
                });
            }
        } catch (err) {
            toast({
                title: 'Could not save vendor',
                description: err?.response?.data?.message || err.message || 'Update failed.',
                variant: 'destructive',
            });
        } finally {
            setSavingVendor(false);
        }
    };

    const handlePayableChange = async (member, idx, accountId) => {
        const key = partyRowKey(member, idx);
        const id = String(accountId || '').trim();
        const match = accounts.find((a) => String(a.id) === id);
        const option = accountOptions.find((o) => o.value === id);
        const expenseAccountName = option?.label || accountOptionLabel(match) || '';
        const confirmed = Boolean(id);
        const nextMap = {
            ...localPayables,
            [key]: { expenseAccountId: id, expenseAccountName },
        };
        const nextConfirmed = { ...localConfirmed, [key]: confirmed };
        dirtyPayableKeysRef.current.add(key);
        setLocalPayables(nextMap);
        setLocalConfirmed(nextConfirmed);
        emitPayables(nextMap, nextConfirmed);

        if (!dropdownsEnabled || !member.fineRecordId) return;

        setSavingKey(key);
        try {
            await axiosInstance.put(`/Fine/${member.fineRecordId}`, {
                partyPayables: [
                    {
                        fineRecordId: member.fineRecordId,
                        fineId: member.fineId,
                        expenseAccountId: id,
                        expenseAccountName,
                        payableConfirmed: confirmed,
                    },
                ],
            });
            toast({
                title: confirmed ? 'Payable saved' : 'Payable cleared',
                description: confirmed
                    ? `Chart of Accounts updated for ${member.employeeName || member.fineId}.`
                    : `Payable cleared for ${member.employeeName || member.fineId}.`,
                className: 'bg-green-50 border-green-200 text-green-800',
            });
        } catch (err) {
            toast({
                title: 'Could not save payable',
                description: err?.response?.data?.message || err.message || 'Update failed.',
                variant: 'destructive',
            });
        } finally {
            setSavingKey('');
        }
    };

    const allPayablesFilled = parties.every((p, idx) => {
        const key = partyRowKey(p, idx);
        const id =
            localPayables[key] != null
                ? String(localPayables[key].expenseAccountId || '').trim()
                : String(p.expenseAccountId || '').trim();
        return Boolean(id);
    });

    const allRowsCompleted = allPayablesFilled;

    const payableStatus = (() => {
        const status = String(fine.fineStatus || '');
        const hasBill = Boolean(String(fine.zohoBillId || '').trim());

        if (hasBill) {
            return { label: 'Billed', className: 'text-emerald-700' };
        }

        const beforeAccounts =
            !status ||
            ['Draft', 'Pending', 'Pending HR', 'Rejected', 'Cancelled', 'Withdrawn'].includes(status);

        if (beforeAccounts) {
            return { label: 'Locked for Accounts', className: 'text-gray-500' };
        }

        if (!allPayablesFilled || !allRowsCompleted) {
            return { label: 'Not filled', className: 'text-amber-700' };
        }

        return { label: 'Ready for billing', className: 'text-blue-700' };
    })();

    const thClass =
        'bg-white text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider px-1.5 py-1.5 rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';
    const tdClass = 'px-1 py-1.5 text-[10px] text-gray-800 align-middle';

    return (
        <FineFormCard
            icon={Users}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            title={isSingleParty ? 'Fine Parties' : 'Group Fine Parties'}
            subtitle={
                isSingleParty
                    ? 'Accounts fills Vendor + Payable → Management creates one Zoho Bill'
                    : 'Accounts fills Vendor + Payable → Management creates one Zoho Bill (Item Table lines)'
            }
        >
            <table className="w-full border-collapse mb-4">
                <tbody>
                    <tr>
                        <td className="py-2 pr-4 w-1/2 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Fine Type</span>
                            <span className="text-xs font-semibold text-gray-800">
                                {isSingleParty ? 'Single Fine' : 'Group Fine'}
                            </span>
                        </td>
                        <td className="py-2 pl-4 w-1/2 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Parties</span>
                            <span className="text-xs font-semibold text-gray-800">
                                {empCount} Employee{empCount !== 1 ? 's' : ''}
                                {hasCompany ? ' + Company' : ''}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td className="py-2 pr-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Vendor</span>
                            <span className="text-xs font-semibold text-gray-800">{localVendor || '—'}</span>
                        </td>
                        <td className="py-2 pl-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Issue Date</span>
                            <span className="text-xs font-semibold text-gray-800">{issueDate}</span>
                        </td>
                    </tr>
                    <tr>
                        <td className="py-2 pr-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                {isSingleParty ? 'Total Payable' : 'Total Group Payable'}
                            </span>
                            <span className="text-xs font-bold text-red-600">{formatMoney(total)} AED</span>
                        </td>
                        <td className="py-2 pl-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Payable Status</span>
                            <span className={`text-xs font-semibold ${payableStatus.className}`}>
                                {payableStatus.label}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>

            {dropdownsEnabled ? (
                <p className="mb-3 text-[10px] text-indigo-700 bg-indigo-50/80 rounded-lg px-3 py-2">
                    {isSingleParty
                        ? 'Fill Vendor and Payable. When set, status is Ready for billing — Management approval creates one Zoho Bill.'
                        : 'Fill Vendor and Payable for each row. When all payables are set, status is Ready for billing — Management approval creates one Zoho Bill with these parties as Item Table lines.'}
                </p>
            ) : null}

            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Party Breakdown
            </p>

            <div className="w-full">
                <table className="w-full table-fixed border-separate border-spacing-x-1 border-spacing-y-0">
                    <colgroup>
                        <col className="w-[28%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[28%]" />
                        <col className="w-[20%]" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th className={thClass}>Vendor</th>
                            <th className={thClass}>Amount</th>
                            <th className={thClass}>Issue</th>
                            <th className={thClass}>
                                Payable{dropdownsEnabled ? <span className="text-red-500"> *</span> : null}
                            </th>
                            <th className={thClass}>Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parties.map((member, idx) => {
                            const label = member.isCompany
                                ? (companyName || fine.companyName || member.employeeName || 'Company')
                                : (member.employeeName || member.employeeId || `Party ${idx + 1}`);
                            const partyName = member.isCompany ? `Co. ${label}` : label;
                            const key = partyRowKey(member, idx);
                            const payableId =
                                localPayables[key] != null
                                    ? String(localPayables[key].expenseAccountId || '').trim()
                                    : String(member.expenseAccountId || '').trim();
                            const payableLabel =
                                localPayables[key]?.expenseAccountName ||
                                member.expenseAccountName ||
                                '';
                            const selectedPayable =
                                accountOptions.find((o) => o.value === payableId) ||
                                (payableId
                                    ? { value: payableId, label: payableLabel || payableId }
                                    : null);

                            return (
                                <tr key={key}>
                                    <td className={tdClass}>
                                        <div title={localVendor || ''}>
                                            <Select
                                                classNamePrefix="fine-party-vendor"
                                                instanceId={`fine-party-vendor-${key}`}
                                                styles={compactSelectStyles}
                                                options={vendorOptions}
                                                value={selectedVendorOption}
                                                onChange={(option) =>
                                                    handleVendorChange(option?.value || '')
                                                }
                                                placeholder={listsLoading ? 'Loading…' : 'Search vendor…'}
                                                isSearchable
                                                isClearable={false}
                                                isDisabled={
                                                    !dropdownsEnabled || listsLoading || savingVendor
                                                }
                                                isLoading={listsLoading || savingVendor}
                                                components={{
                                                    DropdownIndicator: null,
                                                    IndicatorSeparator: null,
                                                    ClearIndicator: null,
                                                }}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                                maxMenuHeight={220}
                                                noOptionsMessage={() => 'No vendors found'}
                                            />
                                        </div>
                                    </td>
                                    <td className={`${tdClass} font-bold text-red-600`}>
                                        {formatMoney(member.fineAmount)}
                                    </td>
                                    <td className={tdClass}>{issueDate}</td>
                                    <td className={tdClass}>
                                        <div title={selectedPayable?.label || ''}>
                                            <Select
                                                classNamePrefix="fine-party-payable"
                                                instanceId={`fine-party-payable-${key}`}
                                                styles={{
                                                    ...compactSelectStyles,
                                                    control: (base, state) => ({
                                                        ...compactSelectStyles.control(base, state),
                                                        borderColor:
                                                            !payableId &&
                                                            dropdownsEnabled &&
                                                            !state.isFocused
                                                                ? '#fcd34d'
                                                                : compactSelectStyles.control(base, state)
                                                                      .borderColor,
                                                    }),
                                                }}
                                                options={accountOptions}
                                                value={selectedPayable}
                                                onChange={(option) =>
                                                    handlePayableChange(
                                                        member,
                                                        idx,
                                                        option?.value || '',
                                                    )
                                                }
                                                placeholder={
                                                    listsLoading ? 'Loading…' : 'Search accounts…'
                                                }
                                                isSearchable
                                                isClearable={false}
                                                isDisabled={
                                                    !dropdownsEnabled ||
                                                    listsLoading ||
                                                    savingKey === key
                                                }
                                                isLoading={listsLoading || savingKey === key}
                                                components={{
                                                    DropdownIndicator: null,
                                                    IndicatorSeparator: null,
                                                    ClearIndicator: null,
                                                }}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                                maxMenuHeight={220}
                                                noOptionsMessage={() => 'No accounts found'}
                                            />
                                        </div>
                                    </td>
                                    <td className={`${tdClass} text-[9px] font-medium text-gray-700 truncate`} title={partyName}>
                                        {partyName}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </FineFormCard>
    );
}
