'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** Normalize Zoho account_type / account_type_formatted for matching. */
function normalizeAccountType(type) {
    return String(type || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Cash/Bank selected as Expense Account — Zoho API rejects these. */
function isInvalidExpenseAccountType(type) {
    const t = normalizeAccountType(type);
    return (
        t === 'cash' ||
        t === 'bank' ||
        t === 'credit card' ||
        t === 'undeposited funds' ||
        /\bcash\b/.test(t) ||
        /\bbank\b/.test(t) ||
        t.includes('credit card')
    );
}

function resolveCompanyId(employee, reward) {
    return String(
        employee?.company?._id ||
            employee?.company ||
            employee?.companyId ||
            reward?.companyId ||
            reward?.company?._id ||
            reward?.company ||
            '',
    ).trim();
}

/**
 * Reward Parties — VEGA/NNIT + same Expense Account / Paid Through
 * lists as Accounts → Expenses → Add Expense (`/zoho/expenses/support`).
 */
export default function RewardFormCardParties({
    reward,
    employee,
    formatDate,
    canEditPartyPayables = false,
    onPartyPayableChange,
    onPartyPayableSaved,
}) {
    const { toast } = useToast();
    const [expenseAccounts, setExpenseAccounts] = useState([]);
    const [paidThroughAccounts, setPaidThroughAccounts] = useState([]);
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

    const companyId = resolveCompanyId(employee, reward);
    const zohoSyncError = String(reward?.zohoSyncError || '').trim();
    const hasZohoPosted = Boolean(
        String(reward?.zohoExpenseId || '').trim() || String(reward?.zohoJournalId || '').trim()
    );
    const needsZohoRetry =
        ['Approved (Paid)', 'Paid'].includes(String(reward?.rewardStatus || reward?.approvalStatus || '')) &&
        !hasZohoPosted &&
        Boolean(zohoSyncError);
    const dropdownsEnabled = Boolean(canEditPartyPayables || needsZohoRetry);
    const typeLabel = String(reward?.rewardType || 'Reward').trim() || 'Reward';
    const partyName =
        reward?.employeeName ||
        [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim() ||
        reward?.employeeId ||
        '—';

    const {
        loading: zohoOrgLoading,
        options: zohoOrgOptions,
        organizationId,
        setOrganizationId,
        active: activeZohoOrg,
        showPicker: showZohoOrgPicker,
    } = useZohoOrganizations({
        enabled: Boolean(reward),
        preferredOrganizationId: reward?.zohoOrganizationId || '',
        preferredCompanyId: companyId,
    });

    // Same lists as Accounts → Expenses → Add Expense (/zoho/expenses/support)
    const [coaReloadKey, setCoaReloadKey] = useState(0);

    useEffect(() => {
        if (!reward || !organizationId) {
            setExpenseAccounts([]);
            setPaidThroughAccounts([]);
            setListsLoading(false);
            setListsError('');
            return undefined;
        }
        let cancelled = false;
        (async () => {
            setListsLoading(true);
            setListsError('');
            try {
                const supportRes = await axiosInstance.get('/zoho/expenses/support', {
                    params: { organizationId },
                    skipToast: true,
                    timeout: 120000,
                    validateStatus: (s) => s < 500,
                });

                if (cancelled) return;

                if (supportRes?.status >= 400 || supportRes?.data?.success === false) {
                    setExpenseAccounts([]);
                    setPaidThroughAccounts([]);
                    setListsError(
                        supportRes?.data?.message ||
                            `Could not load ${activeZohoOrg?.brand || 'Zoho'} expense accounts`,
                    );
                    return;
                }

                const support = supportRes?.data?.data || {};
                const expenseRows = mapZohoPaymentAccounts(support.accounts || []);
                const paidThroughRows = mapZohoPaymentAccounts(
                    support.paidThroughAccounts || support.accounts || [],
                );
                setExpenseAccounts(expenseRows);
                setPaidThroughAccounts(paidThroughRows);

                if (!expenseRows.length && !paidThroughRows.length) {
                    setListsError(
                        supportRes?.data?.message ||
                            `No expense accounts for ${activeZohoOrg?.brand || 'selected'} Zoho org. Wait a minute if Zoho rate-limited, then retry.`,
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setExpenseAccounts([]);
                    setPaidThroughAccounts([]);
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
    }, [organizationId, reward?._id, reward?.rewardId, coaReloadKey]);

    const needsZohoConnect = /not connected|re-authorize|not configured|not authorized|oauth|invalid_code|refresh_token/i.test(
        String(listsError || ''),
    );

    const connectZohoForOrg = useCallback(async () => {
        if (!organizationId) {
            toast({
                variant: 'destructive',
                title: 'Select Zoho company',
                description: 'Pick VEGA or NNIT first, then connect Zoho Books.',
            });
            return;
        }
        try {
            const response = await axiosInstance.get('/zoho/auth-url', {
                skipToast: true,
                params: { organizationId },
            });
            const authorizationUrl = response?.data?.data?.authorizationUrl;
            if (!authorizationUrl) {
                throw new Error('Authorization URL was not returned');
            }
            const popup = window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
            if (!popup) {
                window.location.assign(authorizationUrl);
            } else {
                toast({
                    title: 'Complete Zoho login',
                    description: `Authorize ${activeZohoOrg?.brand || 'this'} Zoho Books org, then click Retry expense accounts.`,
                    className: 'bg-teal-50 border-teal-200 text-teal-900',
                });
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not start Zoho connect',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Check Zoho settings in the backend .env, then restart the server.',
            });
        }
    }, [organizationId, activeZohoOrg?.brand, toast]);

    useEffect(() => {
        if (!reward) return;
        const server = {
            expenseAccountId: String(reward.expenseAccountId || '').trim(),
            expenseAccountName: String(reward.expenseAccountName || '').trim(),
            paidThroughAccountId: String(reward.paidThroughAccountId || '').trim(),
            paidThroughAccountName: String(reward.paidThroughAccountName || '').trim(),
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
        reward?.expenseAccountId,
        reward?.expenseAccountName,
        reward?.paidThroughAccountId,
        reward?.paidThroughAccountName,
        reward?._id,
    ]);

    const toSelectOptions = useCallback(
        (rows) =>
            (rows || []).map((a) => ({
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
        [],
    );

    // Same lists as Accounts → Expenses → Add Expense
    const expenseAccountOptions = useMemo(
        () => toSelectOptions(expenseAccounts),
        [expenseAccounts, toSelectOptions],
    );
    const paidThroughAccountOptions = useMemo(
        () => toSelectOptions(paidThroughAccounts),
        [paidThroughAccounts, toSelectOptions],
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
        const targetId = reward?._id || reward?.id;
        if (!dropdownsEnabled || !targetId) return;

        setSavingField(fieldLabel);
        try {
            await axiosInstance.put(`/Reward/${targetId}/party-payable`, {
                zohoOrganizationId: orgId || '',
                expenseAccountId: next.expenseAccountId,
                expenseAccountName: next.expenseAccountName,
                paidThroughAccountId: next.paidThroughAccountId,
                paidThroughAccountName: next.paidThroughAccountName,
            });
            toast({
                title: `${fieldLabel} saved`,
                description: `${activeZohoOrg?.brand || 'Zoho'} Add Expense accounts updated for this ${typeLabel.toLowerCase()}.`,
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
        setExpenseAccounts([]);
        setPaidThroughAccounts([]);
        onPartyPayableChange?.(cleared);

        if (!dropdownsEnabled) return;
        await savePartyAccounts(cleared, 'Company', id);
    };

    useEffect(() => {
        if (!reward || !organizationId || !dropdownsEnabled) return;
        if (lastOrgRef.current === organizationId) return;
        lastOrgRef.current = organizationId;

        const saved = String(reward.zohoOrganizationId || '').trim();
        if (saved === organizationId) return;

        void (async () => {
            try {
                await axiosInstance.put(`/Reward/${reward._id || reward.id}/party-payable`, {
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
    }, [organizationId, dropdownsEnabled, reward?._id]);

    if (!reward) return null;

    const fmt = formatDate || ((d) => (d ? new Date(d).toLocaleDateString() : '—'));
    const issueDate = fmt(reward.awardedDate || reward.createdAt);
    const total = Number(reward.amount) || 0;

    const expenseId = String(localAccounts.expenseAccountId || '').trim();
    const paidThroughId = String(localAccounts.paidThroughAccountId || '').trim();
    const bothFilled = Boolean(expenseId && paidThroughId && organizationId);

    const selectedExpense =
        expenseAccountOptions.find((o) => o.value === expenseId) ||
        (expenseId
            ? {
                  value: expenseId,
                  label: localAccounts.expenseAccountName || expenseId,
              }
            : null);
    const selectedPaidThrough =
        paidThroughAccountOptions.find((o) => o.value === paidThroughId) ||
        (paidThroughId
            ? {
                  value: paidThroughId,
                  label: localAccounts.paidThroughAccountName || paidThroughId,
              }
            : null);

    const accountsStatus = (() => {
        const status = String(reward.rewardStatus || reward.approvalStatus || '');
        const hasExpense = Boolean(
            String(reward.zohoExpenseId || '').trim() || String(reward.zohoJournalId || '').trim()
        );
        const paid = Number(reward.paidAmount) || 0;
        const syncErr = String(reward.zohoSyncError || '').trim();

        if (hasExpense) {
            if (status === 'Approved (Paid)' || status === 'Paid' || (total > 0 && paid >= total - 0.01)) {
                return { label: 'Paid / Posted to Zoho', className: 'text-emerald-700' };
            }
            return { label: 'Posted to Zoho (not paid)', className: 'text-emerald-700' };
        }
        if ((status === 'Approved (Paid)' || status === 'Paid' || (total > 0 && paid >= total - 0.01)) && syncErr) {
            return { label: 'Paid — Zoho failed', className: 'text-red-700' };
        }
        if (status === 'Approved (Paid)' || status === 'Paid' || (total > 0 && paid >= total - 0.01)) {
            return { label: 'Paid / Posted', className: 'text-emerald-700' };
        }

        const atOrAfterAccounts = [
            'Pending Accounts',
            'Approved',
            'Approved (Paid)',
        ].includes(status);

        if (!atOrAfterAccounts) {
            return { label: 'Locked for Accounts', className: 'text-gray-500' };
        }

        if (!bothFilled) {
            return { label: 'Not filled', className: 'text-amber-700' };
        }

        if (status === 'Pending Accounts') {
            return { label: 'Ready to approve', className: 'text-blue-700' };
        }

        return { label: 'Ready for payment', className: 'text-blue-700' };
    })();

    const handleExpenseChange = async (accountId) => {
        const id = String(accountId || '').trim();
        const match = expenseAccounts.find((a) => String(a.id) === id);
        const option = expenseAccountOptions.find((o) => o.value === id);
        if (option && isInvalidExpenseAccountType(option.type)) {
            toast({
                variant: 'destructive',
                title: 'Invalid Expense Account',
                description:
                    'Cash / Bank belong in Paid Through. Pick an account from the Expense Account list (same as Zoho Add Expense).',
            });
            return;
        }
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
        const match = paidThroughAccounts.find((a) => String(a.id) === id);
        const option = paidThroughAccountOptions.find((o) => o.value === id);
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
          ? `Loading ${brandLabel} Add Expense accounts…`
          : `Search ${brandLabel} accounts…`;
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
        options,
        emptyHint,
        searchHint,
    }) => (
        <div title={value?.label || ''}>
            <Select
                classNamePrefix={`reward-party-${fieldKey}`}
                instanceId={instanceId}
                styles={accountSelectStyles(missing)}
                options={options}
                value={value}
                onChange={(option) => onChange(option?.value || '')}
                filterOption={filterAccountOption}
                placeholder={
                    !organizationId || accountsBusy
                        ? accountPlaceholder
                        : options.length
                          ? searchHint ||
                            `Search ${options.length} ${brandLabel} accounts…`
                          : emptyHint || accountPlaceholder
                }
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
                        : options.length
                          ? 'No matching account'
                          : emptyHint ||
                            listsError ||
                            `No ${brandLabel} Add Expense accounts — check Zoho connection`
                }
            />
        </div>
    );

    return (
        <FineFormCard
            icon={Users}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            title={`Reward Parties`}
            subtitle="Same Expense Account + Paid Through lists as Accounts → Expenses → Add Expense"
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
                    Toggle <strong>VEGA</strong> or <strong>NNIT</strong>.{' '}
                    <strong>Expense Account</strong> and <strong>Paid Through</strong> use the same
                    dropdown lists as Zoho / Accounts → Expenses → Add Expense.
                </p>
            ) : null}

            {needsZohoRetry ? (
                <div className="mb-3 text-[10px] text-red-800 bg-red-50 rounded-lg px-3 py-2">
                    <strong>Zoho journal not created.</strong> {zohoSyncError} Fix Expense Account /
                    Paid Through, then record payment again from Payment Details.
                </div>
            ) : null}

            {listsError && organizationId && !listsLoading ? (
                <div className="mb-3 text-[10px] text-red-700 bg-red-50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <span>{listsError}</span>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {needsZohoConnect ? (
                            <button
                                type="button"
                                onClick={() => void connectZohoForOrg()}
                                className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-800 hover:bg-teal-100"
                            >
                                Connect Zoho Books
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setCoaReloadKey((k) => k + 1)}
                            className="rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-800 hover:bg-red-100"
                        >
                            Retry expense accounts
                        </button>
                    </div>
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
                                    instanceId: `reward-party-expense-${reward._id || reward.rewardId}`,
                                    options: expenseAccountOptions,
                                    emptyHint: `No Expense Account options for ${brandLabel}`,
                                    searchHint: `Expense Account (${expenseAccountOptions.length})…`,
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
                                    instanceId: `reward-party-paid-through-${reward._id || reward.rewardId}`,
                                    options: paidThroughAccountOptions,
                                    emptyHint: `No Paid Through options for ${brandLabel}`,
                                    searchHint: `Paid Through (${paidThroughAccountOptions.length})…`,
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
