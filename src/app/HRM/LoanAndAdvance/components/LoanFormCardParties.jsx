'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { Users } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import { useToast } from '@/hooks/use-toast';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import {
    FineFormCard,
    formatMoney,
} from '../../Fine/components/FineFormCardShared';

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

function accountOptionLabel(account) {
    const name = String(account?.name || account?.label || '').trim();
    const code = String(account?.code || '').trim();
    const type = String(account?.type || '').trim();
    const base = name && code ? `${name} (${code})` : name || code || String(account?.id || '');
    return type ? `${base} · ${type}` : base;
}

function resolveCompanyId(employee, loan) {
    return String(
        employee?.company?._id ||
            employee?.company ||
            employee?.companyId ||
            loan?.companyId ||
            loan?.company?._id ||
            loan?.company ||
            '',
    ).trim();
}

/**
 * Loan / Advance Parties — VEGA/NNIT toggle + full CoA for Expense Account & Paid Through.
 * Editable only at Accounts stage after HR approval.
 */
export default function LoanFormCardParties({
    loan,
    employee,
    formatDate,
    canEditPartyPayables = false,
    onPartyPayableChange,
    onPartyPayableSaved,
}) {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState([]);
    const [listsLoading, setListsLoading] = useState(false);
    const [listsError, setListsError] = useState('');
    const [savingField, setSavingField] = useState('');
    const [localAccounts, setLocalAccounts] = useState({
        expenseAccountId: '',
        expenseAccountName: '',
        paidThroughAccountId: '',
        paidThroughAccountName: '',
    });
    const dirtyRef = useRef(false);
    const lastOrgRef = useRef('');

    const companyId = resolveCompanyId(employee, loan);
    const dropdownsEnabled = Boolean(canEditPartyPayables);
    const typeLabel = loan?.type === 'Advance' ? 'Advance' : 'Loan';
    const partyName =
        loan?.applicantName ||
        [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim() ||
        loan?.employeeId ||
        '—';

    const {
        loading: zohoOrgLoading,
        options: zohoOrgOptions,
        organizationId,
        setOrganizationId,
        active: activeZohoOrg,
        showPicker: showZohoOrgPicker,
    } = useZohoOrganizations({
        enabled: Boolean(loan),
        preferredOrganizationId: loan?.zohoOrganizationId || '',
        preferredCompanyId: companyId,
    });

    // Full Chart of Accounts for the selected VEGA / NNIT org (same endpoint as Fine / Payments Made)
    const [coaReloadKey, setCoaReloadKey] = useState(0);

    useEffect(() => {
        if (!loan || !organizationId) {
            setAccounts([]);
            setListsLoading(false);
            setListsError('');
            return undefined;
        }
        let cancelled = false;
        (async () => {
            setListsLoading(true);
            setListsError('');
            try {
                const supportRes = await axiosInstance.get('/zoho/vendorpayments/support', {
                    params: {
                        organizationId,
                        includeInactive: 'true',
                        accountsOnly: 'true',
                    },
                    skipToast: true,
                    timeout: 120000,
                    validateStatus: (s) => s < 500,
                });

                if (cancelled) return;

                if (supportRes?.status >= 400 || supportRes?.data?.success === false) {
                    setAccounts([]);
                    setListsError(
                        supportRes?.data?.message ||
                            `Could not load ${activeZohoOrg?.brand || 'Zoho'} Chart of Accounts`,
                    );
                    return;
                }

                const rows = mapZohoPaymentAccounts(supportRes?.data?.data?.accounts || []);
                setAccounts(rows);

                if (!rows.length) {
                    setListsError(
                        supportRes?.data?.message ||
                            `No Chart of Accounts for ${activeZohoOrg?.brand || 'selected'} Zoho org. Wait a minute if Zoho rate-limited, then retry.`,
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setAccounts([]);
                    setListsError(
                        err?.response?.data?.message || err.message || 'Failed to load accounts',
                    );
                }
            } finally {
                if (!cancelled) setListsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // activeZohoOrg?.brand is display-only — do not re-fetch when brand label resolves
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId, loan?._id, loan?.loanId, coaReloadKey]);

    useEffect(() => {
        if (!loan) return;
        const server = {
            expenseAccountId: String(loan.expenseAccountId || '').trim(),
            expenseAccountName: String(loan.expenseAccountName || '').trim(),
            paidThroughAccountId: String(loan.paidThroughAccountId || '').trim(),
            paidThroughAccountName: String(loan.paidThroughAccountName || '').trim(),
        };
        const localExpense = String(localAccounts.expenseAccountId || '').trim();
        const localPaid = String(localAccounts.paidThroughAccountId || '').trim();
        const keepLocal =
            dirtyRef.current &&
            ((localExpense && localExpense !== server.expenseAccountId) ||
                (localPaid && localPaid !== server.paidThroughAccountId));

        if (keepLocal) return;

        setLocalAccounts(server);
        if (
            server.expenseAccountId === localExpense &&
            server.paidThroughAccountId === localPaid
        ) {
            dirtyRef.current = false;
        }
        onPartyPayableChange?.(server);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        loan?.expenseAccountId,
        loan?.expenseAccountName,
        loan?.paidThroughAccountId,
        loan?.paidThroughAccountName,
        loan?._id,
    ]);

    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                value: String(a.id),
                label: accountOptionLabel(a),
                name: a.name || '',
                code: a.code || '',
                type: a.type || '',
                searchText: [
                    a.name,
                    a.code,
                    a.type,
                    a.label,
                    a.raw?.account_name,
                    a.raw?.account_code,
                    a.raw?.account_type,
                    a.raw?.account_type_formatted,
                    a.raw?.description,
                    a.raw?.parent_account_name,
                ]
                    .filter(Boolean)
                    .join(' '),
            })),
        [accounts],
    );

    const filterAccountOption = (candidate, inputValue) => {
        const raw = String(inputValue || '').trim().toLowerCase();
        if (!raw) return true;

        const normalize = (s) =>
            String(s || '')
                .toLowerCase()
                .replace(/&/g, ' and ')
                .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const hay = normalize(
            [
                candidate?.label,
                candidate?.data?.label,
                candidate?.data?.name,
                candidate?.data?.code,
                candidate?.data?.type,
                candidate?.data?.searchText,
            ].join(' '),
        );

        const q = normalize(raw);
        if (!q) return true;
        if (hay.includes(q)) return true;
        if (q.endsWith('s') && hay.includes(q.slice(0, -1))) return true;
        if (!q.endsWith('s') && hay.includes(`${q}s`)) return true;

        const tokens = q.split(' ').filter(Boolean);
        return (
            tokens.length > 0 &&
            tokens.every((tok) => {
                if (hay.includes(tok)) return true;
                if (tok.endsWith('s') && hay.includes(tok.slice(0, -1))) return true;
                if (!tok.endsWith('s') && hay.includes(`${tok}s`)) return true;
                return false;
            })
        );
    };

    const savePartyAccounts = async (next, fieldLabel, orgId = organizationId) => {
        const targetId = loan?._id || loan?.id;
        if (!dropdownsEnabled || !targetId) return;

        setSavingField(fieldLabel);
        try {
            await axiosInstance.put(`/Employee/loans/${targetId}/party-payable`, {
                zohoOrganizationId: orgId || '',
                expenseAccountId: next.expenseAccountId,
                expenseAccountName: next.expenseAccountName,
                paidThroughAccountId: next.paidThroughAccountId,
                paidThroughAccountName: next.paidThroughAccountName,
            });
            toast({
                title: `${fieldLabel} saved`,
                description: `${activeZohoOrg?.brand || 'Zoho'} Chart of Accounts updated for this ${typeLabel.toLowerCase()}.`,
                className: 'bg-green-50 border-green-200 text-green-800',
            });
            onPartyPayableSaved?.();
        } catch (err) {
            toast({
                title: `Could not save ${fieldLabel.toLowerCase()}`,
                description: err?.response?.data?.message || err.message || 'Update failed.',
                variant: 'destructive',
            });
        } finally {
            setSavingField('');
        }
    };

    const handleOrganizationChange = async (nextOrgId) => {
        const id = String(nextOrgId || '').trim();
        if (!id || id === organizationId) return;
        setOrganizationId(id);

        const cleared = {
            expenseAccountId: '',
            expenseAccountName: '',
            paidThroughAccountId: '',
            paidThroughAccountName: '',
        };
        dirtyRef.current = true;
        setLocalAccounts(cleared);
        setAccounts([]);
        onPartyPayableChange?.(cleared);

        if (!dropdownsEnabled) return;
        await savePartyAccounts(cleared, 'Company', id);
    };

    useEffect(() => {
        if (!loan || !organizationId || !dropdownsEnabled) return;
        if (lastOrgRef.current === organizationId) return;
        lastOrgRef.current = organizationId;

        const saved = String(loan.zohoOrganizationId || '').trim();
        if (saved === organizationId) return;

        void (async () => {
            try {
                await axiosInstance.put(`/Employee/loans/${loan._id || loan.id}/party-payable`, {
                    zohoOrganizationId: organizationId,
                    expenseAccountId: localAccounts.expenseAccountId,
                    expenseAccountName: localAccounts.expenseAccountName,
                    paidThroughAccountId: localAccounts.paidThroughAccountId,
                    paidThroughAccountName: localAccounts.paidThroughAccountName,
                });
                onPartyPayableSaved?.();
            } catch {
                /* ignore */
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId, dropdownsEnabled, loan?._id]);

    if (!loan) return null;

    const fmt = formatDate || ((d) => (d ? new Date(d).toLocaleDateString() : '—'));
    const issueDate = fmt(loan.appliedDate || loan.createdAt);
    const total = Number(loan.amount) || 0;

    const expenseId = String(localAccounts.expenseAccountId || '').trim();
    const paidThroughId = String(localAccounts.paidThroughAccountId || '').trim();
    const bothFilled = Boolean(expenseId && paidThroughId && organizationId);

    const selectedExpense =
        accountOptions.find((o) => o.value === expenseId) ||
        (expenseId
            ? {
                  value: expenseId,
                  label: localAccounts.expenseAccountName || expenseId,
              }
            : null);
    const selectedPaidThrough =
        accountOptions.find((o) => o.value === paidThroughId) ||
        (paidThroughId
            ? {
                  value: paidThroughId,
                  label: localAccounts.paidThroughAccountName || paidThroughId,
              }
            : null);

    const accountsStatus = (() => {
        const status = String(loan.approvalStatus || loan.status || '');
        const hasExpense = Boolean(String(loan.zohoExpenseId || loan.zohoJournalId || '').trim());
        const paid = Number(loan.paidAmount) || 0;

        if (hasExpense || status === 'Paid' || (total > 0 && paid >= total - 0.01)) {
            return { label: 'Paid / Posted', className: 'text-emerald-700' };
        }

        const atOrAfterAccounts = [
            'Pending Accounts',
            'Pending Authorization',
            'Approved',
            'Pending Payment to Employee',
        ].includes(status);

        if (!atOrAfterAccounts) {
            return { label: 'Locked for Accounts', className: 'text-gray-500' };
        }

        if (!bothFilled) {
            return { label: 'Not filled', className: 'text-amber-700' };
        }

        return { label: 'Ready for approval', className: 'text-blue-700' };
    })();

    const handleExpenseChange = async (accountId) => {
        const id = String(accountId || '').trim();
        const match = accounts.find((a) => String(a.id) === id);
        const option = accountOptions.find((o) => o.value === id);
        const expenseAccountName = option?.label || accountOptionLabel(match) || '';
        const next = {
            ...localAccounts,
            expenseAccountId: id,
            expenseAccountName,
        };
        dirtyRef.current = true;
        setLocalAccounts(next);
        onPartyPayableChange?.(next);
        await savePartyAccounts(next, 'Expense Account');
    };

    const handlePaidThroughChange = async (accountId) => {
        const id = String(accountId || '').trim();
        const match = accounts.find((a) => String(a.id) === id);
        const option = accountOptions.find((o) => o.value === id);
        const paidThroughAccountName = option?.label || accountOptionLabel(match) || '';
        const next = {
            ...localAccounts,
            paidThroughAccountId: id,
            paidThroughAccountName,
        };
        dirtyRef.current = true;
        setLocalAccounts(next);
        onPartyPayableChange?.(next);
        await savePartyAccounts(next, 'Paid Through');
    };

    const accountSelectStyles = (missing) => ({
        ...compactSelectStyles,
        control: (base, state) => ({
            ...compactSelectStyles.control(base, state),
            borderColor:
                missing && dropdownsEnabled && !state.isFocused
                    ? '#fcd34d'
                    : compactSelectStyles.control(base, state).borderColor,
        }),
    });

    const brandLabel = activeZohoOrg?.brand || 'Zoho';
    // Org picker may still be settling; once organizationId is known, only CoA fetch gates the dropdown
    const accountsBusy = listsLoading || (!organizationId && zohoOrgLoading);
    const accountPlaceholder = !organizationId
        ? zohoOrgLoading
            ? 'Loading Zoho companies…'
            : 'Select VEGA or NNIT first…'
        : listsLoading
          ? `Loading ${brandLabel} Chart of Accounts…`
          : accountOptions.length
            ? `Search ${accountOptions.length} ${brandLabel} accounts…`
            : listsError || `No ${brandLabel} accounts loaded`;
    const thClass =
        'bg-white text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider px-1.5 py-1.5 rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';
    const tdClass = 'px-1 py-1.5 text-[10px] text-gray-800 align-middle';
    const saving = Boolean(savingField);

    const renderAccountSelect = ({
        fieldKey,
        value,
        missing,
        onChange,
        instanceId,
    }) => (
        <div title={value?.label || ''}>
            <Select
                classNamePrefix={`loan-party-${fieldKey}`}
                instanceId={instanceId}
                styles={accountSelectStyles(missing)}
                options={accountOptions}
                value={value}
                onChange={(option) => onChange(option?.value || '')}
                filterOption={filterAccountOption}
                placeholder={accountPlaceholder}
                isSearchable
                isClearable={false}
                isDisabled={
                    !dropdownsEnabled || !organizationId || accountsBusy || saving
                }
                isLoading={accountsBusy || savingField === fieldKey}
                components={{
                    DropdownIndicator: null,
                    IndicatorSeparator: null,
                    ClearIndicator: null,
                }}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                maxMenuHeight={280}
                noOptionsMessage={() =>
                    accountsBusy
                        ? 'Loading…'
                        : accountOptions.length
                          ? 'No matching account'
                          : listsError ||
                            `Full ${brandLabel} Chart of Accounts empty — check Zoho connection`
                }
            />
        </div>
    );

    return (
        <FineFormCard
            icon={Users}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            title={`${typeLabel} Parties`}
            subtitle="Pick VEGA or NNIT → Expense Account + Paid Through from that org’s full Chart of Accounts"
            headerAction={
                showZohoOrgPicker || activeZohoOrg ? (
                    <ZohoOrganizationPicker
                        options={zohoOrgOptions}
                        value={organizationId}
                        onChange={handleOrganizationChange}
                        loading={zohoOrgLoading || listsLoading}
                        disabled={!dropdownsEnabled}
                        size="sm"
                    />
                ) : null
            }
        >
            <table className="w-full border-collapse mb-4">
                <tbody>
                    <tr>
                        <td className="py-2 pr-4 w-1/2 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Type
                            </span>
                            <span className="text-xs font-semibold text-gray-800">{typeLabel}</span>
                        </td>
                        <td className="py-2 pl-4 w-1/2 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Parties
                            </span>
                            <span className="text-xs font-semibold text-gray-800">1 Employee</span>
                        </td>
                    </tr>
                    <tr>
                        <td className="py-2 pr-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Total Payable
                            </span>
                            <span className="text-xs font-bold text-red-600">
                                {formatMoney(total)} AED
                            </span>
                        </td>
                        <td className="py-2 pl-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Issue Date
                            </span>
                            <span className="text-xs font-semibold text-gray-800">{issueDate}</span>
                        </td>
                    </tr>
                    <tr>
                        <td className="py-2 pr-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Company (Zoho)
                            </span>
                            <span
                                className={`text-xs font-bold ${
                                    activeZohoOrg?.brand === 'NNIT'
                                        ? 'text-indigo-700'
                                        : 'text-emerald-700'
                                }`}
                            >
                                {activeZohoOrg?.brand || brandLabel || '—'}
                            </span>
                        </td>
                        <td className="py-2 pl-4 align-top">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Accounts Status
                            </span>
                            <span className={`text-xs font-semibold ${accountsStatus.className}`}>
                                {accountsStatus.label}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>

            {dropdownsEnabled ? (
                <p className="mb-3 text-[10px] text-indigo-700 bg-indigo-50/80 rounded-lg px-3 py-2">
                    Toggle <strong>VEGA</strong> or <strong>NNIT</strong>, then fill{' '}
                    <strong>Expense Account</strong> (debit) and <strong>Paid Through</strong>{' '}
                    (credit) from that company’s <strong>full</strong> Zoho Chart of Accounts.
                    Paid expense posts into the same Zoho org.
                </p>
            ) : null}

            {listsError && organizationId && !listsLoading ? (
                <div className="mb-3 text-[10px] text-red-700 bg-red-50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <span>{listsError}</span>
                    <button
                        type="button"
                        onClick={() => setCoaReloadKey((k) => k + 1)}
                        className="shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-800 hover:bg-red-100"
                    >
                        Retry Chart of Accounts
                    </button>
                </div>
            ) : null}

            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Party Breakdown
            </p>

            <div className="w-full overflow-x-auto">
                <table className="w-full table-fixed border-separate border-spacing-x-1 border-spacing-y-0 min-w-[560px]">
                    <colgroup>
                        <col className="w-[26%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[26%]" />
                        <col className="w-[24%]" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th className={thClass}>
                                Expense Account
                                {dropdownsEnabled ? <span className="text-red-500"> *</span> : null}
                            </th>
                            <th className={thClass}>Amount</th>
                            <th className={thClass}>Issue</th>
                            <th className={thClass}>
                                Paid Through
                                {dropdownsEnabled ? <span className="text-red-500"> *</span> : null}
                            </th>
                            <th className={thClass}>Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={tdClass}>
                                {renderAccountSelect({
                                    fieldKey: 'Expense Account',
                                    value: selectedExpense,
                                    missing: !expenseId,
                                    onChange: handleExpenseChange,
                                    instanceId: `loan-party-expense-${loan._id || loan.loanId}`,
                                })}
                            </td>
                            <td className={`${tdClass} font-bold text-red-600`}>
                                {formatMoney(total)}
                            </td>
                            <td className={tdClass}>{issueDate}</td>
                            <td className={tdClass}>
                                {renderAccountSelect({
                                    fieldKey: 'Paid Through',
                                    value: selectedPaidThrough,
                                    missing: !paidThroughId,
                                    onChange: handlePaidThroughChange,
                                    instanceId: `loan-party-paid-through-${loan._id || loan.loanId}`,
                                })}
                            </td>
                            <td
                                className={`${tdClass} text-[9px] font-medium text-gray-700 truncate`}
                                title={partyName}
                            >
                                {partyName}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </FineFormCard>
    );
}
