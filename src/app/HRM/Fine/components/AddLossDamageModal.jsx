'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import ApprovedFineScheduleEditShell from './ApprovedFineScheduleEditShell';
import { submitApprovedFineScheduleEdit } from '../utils/fineApprovedEdit';
import {
    shouldValidateFineDeductionSchedule,
    validateApprovedFineScheduleEdit,
    validateFineDeductionVsVisa,
} from '../utils/validateFineDeductionVsVisa';
import { isEndOfServiceFineSource } from '../utils/fineScheduleUtils';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';

function isAttachedAccessory(acc) {
    const st = String(acc?.status || '').trim().toLowerCase();
    return !['unattached', 'lost', 'end of life', 'rejected'].includes(st);
}

function accessoriesFromBreakdownItems(breakdownItems) {
    if (!Array.isArray(breakdownItems)) return [];
    return breakdownItems
        .filter((item) => item?.kind === 'accessory')
        .map((item) => ({
            _id: item.accessoryObjectId || item.accessoryId || item.name,
            accessoryId: item.accessoryId || '',
            name: item.name || 'Accessory',
            amount: item.amount ?? 0,
            status: 'Attached',
        }));
}

/** Match add-form accessories: live asset list, else fine breakdown snapshot. */
function resolveEditAccessories(initialData, mainAsset) {
    const breakdownAccs = accessoriesFromBreakdownItems(initialData?.breakdownItems);
    if (breakdownAccs.length > 0) {
        const live = (mainAsset?.accessories || []).filter(isAttachedAccessory);
        return breakdownAccs.map((b) => {
            const match = live.find(
                (l) =>
                    (b._id && l._id && String(l._id) === String(b._id)) ||
                    (b.accessoryId && l.accessoryId && l.accessoryId === b.accessoryId),
            );
            return match ? { ...match, amount: b.amount ?? match.amount } : b;
        });
    }

    const fromAsset = (mainAsset?.accessories || []).filter(isAttachedAccessory);
    if (fromAsset.length) return fromAsset;
    return (initialData?.accessories || []).filter(isAttachedAccessory);
}

function mapAssetForPicker(a) {
    return {
        id: a.assetId,
        _id: a._id,
        name: a.name,
        assetValue: a.assetValue,
        purchaseDate: a.purchaseDate,
        assignedTo: a.assignedTo,
        companyId: a.companyId || (a.company?._id || a.company) || a.assignedCompany,
        accessories: a.accessories || [],
        status: a.status,
    };
}

export default function AddLossDamageModal({ isOpen, onClose, onSuccess, employees = [], onBack, initialData, isResubmitting = false, isAssetFlow = false, onAssetRequest = null, isInitialRequest = false, isApprovalFlow = false, scheduleOnlyEdit = false, assetControllerOnlyEdit = false }) {
    const { toast } = useToast();
    const [assets, setAssets] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [selectedAssetName, setSelectedAssetName] = useState('');
    const [selectedAssetObjectId, setSelectedAssetObjectId] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [companies, setCompanies] = useState([]);

    const [accessories, setAccessories] = useState([]);
    const [selectedAccessoryId, setSelectedAccessoryId] = useState('');
    const [selectedAccessoryName, setSelectedAccessoryName] = useState('');
    const [selectedAccessoryObjectId, setSelectedAccessoryObjectId] = useState('');

    const [formData, setFormData] = useState({
        fineAmount: '',
        responsibleFor: 'Employee',
        employeeAmount: '',
        companyAmount: '',
        payableDuration: '1',
        monthStart: new Date().toISOString().split('T')[0].slice(0, 7),
        description: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: '',
        companyDescription: '',
        serviceCharge: '',
        depreciationAmount: '',
        sourceOfIncome: 'Salary',
        assetPurchaseDate: '',
        fineSource: '',
    });

    const [assetControllerFallback, setAssetControllerFallback] = useState({ name: '', employeeId: '' });

    const [submitting, setSubmitting] = useState(false);
    const [removedAccessoryIds, setRemovedAccessoryIds] = useState(() => new Set());
    const fileInputRef = useRef(null);
    const fetchedEditAssetRef = useRef(null);

    const formatPurchaseDate = (value) => {
        if (!value) return '—';
        try {
            return new Date(value).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return String(value);
        }
    };

    const resolveAssigneeForAsset = (asset, acFallback = assetControllerFallback) => {
        if (asset?.assignedTo?.employeeId || asset?.assignedTo?.firstName) {
            return {
                employeeId: asset.assignedTo.employeeId || '',
                employeeName: `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim(),
            };
        }
        if (acFallback?.name || acFallback?.employeeId) {
            return {
                employeeId: acFallback.employeeId || '',
                employeeName: acFallback.name || acFallback.employeeId || 'Asset Controller',
            };
        }
        return { employeeId: '', employeeName: '—' };
    };

    const computeFineTotals = (asset, accList = billableAccessories, fd = formData) => {
        const assetVal = getMainAssetFineBase(asset);
        const accSum = (accList || [])
            .filter(isAttachedAccessory)
            .reduce((sum, a) => sum + (parseFloat(a.amount || 0) || 0), 0);
        const sc = parseFloat(fd.serviceCharge || 0) || 0;
        const dep = parseFloat(fd.depreciationAmount || 0) || 0;
        const grand = Math.max(0, assetVal + accSum + sc - dep);
        return { assetVal, accSum, sc, dep, grand };
    };

    const syncTotalsToForm = (asset, accList = billableAccessories, fdPatch = {}) => {
        setFormData((prev) => {
            const nextFd = { ...prev, ...fdPatch };
            const { grand } = computeFineTotals(asset, accList, nextFd);
            const grandStr = grand > 0 ? String(grand) : '';
            const totalLimit = parseFloat(grandStr) || 0;
            const sc = parseFloat(nextFd.serviceCharge || 0) || 0;
            const baseFine = Math.max(0, totalLimit - sc);
            const currentResponsible = nextFd.responsibleFor || 'Employee';

            if (currentResponsible === 'Employee & Company') {
                const half = baseFine / 2;
                return {
                    ...nextFd,
                    fineAmount: grandStr,
                    employeeAmount: String(half),
                    companyAmount: String(baseFine - half),
                };
            }
            if (currentResponsible === 'Employee') {
                return { ...nextFd, fineAmount: grandStr, employeeAmount: String(baseFine), companyAmount: '0' };
            }
            if (currentResponsible === 'Company') {
                return { ...nextFd, fineAmount: grandStr, employeeAmount: '0', companyAmount: String(baseFine) };
            }
            return { ...nextFd, fineAmount: grandStr };
        });
    };

    const [errors, setErrors] = useState({});

    const billableAccessories = useMemo(
        () => (accessories || [])
            .filter(isAttachedAccessory)
            .filter((a) => !removedAccessoryIds.has(String(a._id))),
        [accessories, removedAccessoryIds],
    );

    const computeBreakdownFineTotal = (mainAsset, _includedIds, accList = billableAccessories) => {
        const asset = mainAsset || resolveBreakdownAsset();
        if (!asset) return 0;
        return computeFineTotals(asset, accList, formData).grand;
    };

    const syncFineFromBreakdown = (asset, _includedIds, accList = billableAccessories) => {
        if (!asset) return;
        syncTotalsToForm(asset, accList);
    };

    const resolveBreakdownAsset = () => {
        const fromList = assets.find(
            (a) => a._id === selectedAssetObjectId || a.id === selectedAssetId,
        );
        if (fromList) return fromList;
        if (!selectedAssetObjectId && !selectedAssetId) return null;
        return {
            _id: selectedAssetObjectId,
            id: selectedAssetId,
            name: selectedAssetName,
            assetValue:
                initialData?.assetValue ??
                initialData?.fineAmount ??
                0,
            accessories,
        };
    };

    const isMainAssetBreakdownMode = () => {
        if (isInitialRequest) return false;
        if (selectedAccessoryId && selectedAccessoryId !== 'main') return false;
        if (!selectedAccessoryId && initialData && isAccessoryFineData(initialData)) return false;
        return !!(selectedAssetObjectId || selectedAssetId);
    };


    // Fetch assigned assets only when the modal is open (avoids heavy API call on every page load).
    useEffect(() => {
        if (!isOpen) return;
        if (typeof window !== 'undefined' && !localStorage.getItem('token')) return;

        const fetchAssignedAssets = async () => {
            try {
                setLoadingAssets(true);
                const response = await axiosInstance.get('/AssetItem/assigned/all');
                const assetData = response.data;
                if (Array.isArray(assetData)) {
                    setAssets(assetData.map(mapAssetForPicker));
                } else setAssets([]);
            } catch (error) {
                setAssets([]);
            } finally {
                setLoadingAssets(false);
            }
        };
        fetchAssignedAssets();
    }, [isOpen]);

    // Approved / edit: asset may no longer appear in assigned/all — load detail by object id.
    useEffect(() => {
        if (!isOpen || !initialData) return;

        const targetId = initialData.assetObjectId || initialData.mainAssetObjectId;
        if (!targetId) return;

        const key = String(targetId);
        if (assets.some((a) => String(a._id) === key)) {
            fetchedEditAssetRef.current = key;
            return;
        }
        if (fetchedEditAssetRef.current === key) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get(`/AssetItem/detail/${targetId}`, { skipToast: true });
                if (cancelled || !res.data?._id) return;
                fetchedEditAssetRef.current = key;
                const mapped = mapAssetForPicker(res.data);
                setAssets((prev) =>
                    prev.some((a) => String(a._id) === String(mapped._id)) ? prev : [...prev, mapped],
                );
            } catch {
                fetchedEditAssetRef.current = key;
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, initialData, assets]);

    useEffect(() => {
        if (!isOpen) {
            fetchedEditAssetRef.current = null;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (initialData?.assetControllerName || initialData?.assetControllerEmployeeId) {
            setAssetControllerFallback({
                name: initialData.assetControllerName || '',
                employeeId: initialData.assetControllerEmployeeId || '',
            });
        }
    }, [isOpen, initialData]);

    const filteredAssets = useMemo(() => assets, [assets]);

    const isAccessoryFineData = (data) =>
        !!(data?.accessoryObjectId || data?.accessoryId || data?.accessoryName || data?.isAccessoryFlow || data?.useAccessoryWorkflow);

    const getMainAssetFineBase = (asset) => parseFloat(asset?.assetValue || 0) || 0;

    const findAccessoryInAsset = (asset, data) => {
        const list = asset?.accessories || data?.accessories || [];
        return list.find(
            (ac) =>
                (data?.accessoryObjectId && ac._id === data.accessoryObjectId) ||
                (data?.accessoryId && ac.accessoryId === data.accessoryId) ||
                (data?.accessoryName && ac.name === data.accessoryName)
        );
    };

    const getAccessoryFineBase = (asset, data) => {
        const acc = findAccessoryInAsset(asset, data);
        if (acc?.amount != null && acc.amount !== '') {
            return parseFloat(acc.amount) || 0;
        }
        const sc = parseFloat(data?.serviceCharge || 0) || 0;
        const emp = parseFloat(data?.employeeAmount || 0) || 0;
        const comp = parseFloat(data?.companyAmount || 0) || 0;
        const stored = parseFloat(data?.fineAmount || data?.totalFineAmount || 0) || 0;
        return emp + comp > 0 ? emp + comp : Math.max(0, stored - sc);
    };

    const getLegacyFullAssetTotal = (asset) => {
        const mainOnly = getMainAssetFineBase(asset);
        const accessoriesVal = (asset?.accessories || []).reduce(
            (sum, curr) => sum + (parseFloat(curr.amount || 0) || 0),
            0
        );
        return mainOnly + accessoriesVal;
    };

    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            setSelectedAssetId(initialData.assetId || '');
            setSelectedAssetName(initialData.assetName || '');
            setSelectedAssetObjectId(initialData.assetObjectId || initialData.mainAssetObjectId || '');

            const excluded = Array.isArray(initialData.excludedAccessoryIds)
                ? initialData.excludedAccessoryIds.map(String)
                : [];
            setRemovedAccessoryIds(new Set(excluded));

            const empId = initialData.assignedEmployees?.[0]?.employeeId || initialData.employeeId || '';
            setSelectedEmployeeId(empId);
            setEmployeeName(initialData.assignedEmployees?.[0]?.employeeName || initialData.employeeName || '');

            // Handle accessory pre-selection
            if (isAccessoryFineData(initialData)) {
                setSelectedAccessoryObjectId(initialData.accessoryObjectId || '');
                setSelectedAccessoryId(initialData.accessoryId || '');
                setSelectedAccessoryName(initialData.accessoryName || initialData.assetName || '');
            } else {
                setSelectedAccessoryId('main');
                setSelectedAccessoryObjectId('');
                setSelectedAccessoryName('');
            }

            const existingAttachment = initialData.attachment;
            const existingAttachmentName =
                typeof existingAttachment === 'string'
                    ? (existingAttachment.split('/').pop() || 'Existing Attachment')
                    : existingAttachment?.name || 'Existing Attachment';

            // For UI purposes we mark `attachment` truthy so the dropzone shows the existing file name.
            // Payload submission still relies on `attachmentBase64`, so this does not re-upload anything.
            const attachmentForUi =
                existingAttachment ? existingAttachment : null;

            const sc = parseFloat(initialData.serviceCharge || 0) || 0;
            const storedFine = parseFloat(initialData.fineAmount || initialData.totalFineAmount || 0) || 0;
            let baseFineAmount = Math.max(0, storedFine - sc);

            const matchedAsset = assets.find(a => 
                a.id === initialData.assetId || 
                a._id === (initialData.mainAssetObjectId || initialData.assetObjectId)
            );
            const isEditingExistingFine = !!(initialData._id || initialData.fineId);
            const isAccessory = isAccessoryFineData(initialData);

            // New fines only: auto-fill from asset/accessory value. Edit keeps stored fine base.
            if (!isEditingExistingFine && !initialData.fromDraft) {
                if (isAccessory) {
                    if (matchedAsset) {
                        baseFineAmount = getAccessoryFineBase(matchedAsset, initialData);
                    }
                } else {
                    const accList = (matchedAsset?.accessories || initialData.accessories || [])
                        .filter(isAttachedAccessory);
                    const breakdownAsset = matchedAsset || {
                        assetValue: initialData.assetValue ?? initialData.fineAmount ?? 0,
                    };
                    baseFineAmount = computeBreakdownFineTotal(breakdownAsset, null, accList);
                }
            } else if (isEditingExistingFine && matchedAsset) {
                const legacyFull = getLegacyFullAssetTotal(matchedAsset);
                const mainOnly = getMainAssetFineBase(matchedAsset);
                if (isAccessory) {
                    if (Math.abs(baseFineAmount - legacyFull) < 0.01 || Math.abs(baseFineAmount - mainOnly) < 0.01) {
                        baseFineAmount = getAccessoryFineBase(matchedAsset, initialData);
                    }
                } else if (Math.abs(baseFineAmount - legacyFull) < 0.01) {
                    baseFineAmount = mainOnly;
                }
            }

            const isBoth = (initialData.responsibleFor || 'Employee') === 'Employee & Company';
            const grandForUi = parseFloat(String(baseFineAmount || 0)) || 0;

            let uiEmployeeAmount = '';
            let uiCompanyAmount = '';

            if (isBoth) {
                uiEmployeeAmount = initialData.employeeAmount != null && initialData.employeeAmount !== ''
                    ? String(initialData.employeeAmount)
                    : (grandForUi > 0 ? String(grandForUi / 2) : '');
                uiCompanyAmount = initialData.companyAmount != null && initialData.companyAmount !== ''
                    ? String(initialData.companyAmount)
                    : (grandForUi > 0 ? String(grandForUi / 2) : '');
            } else if ((initialData.responsibleFor || 'Employee') === 'Employee') {
                uiEmployeeAmount = grandForUi > 0 ? String(grandForUi) : '';
                uiCompanyAmount = '0';
            } else if (initialData.responsibleFor === 'Company') {
                uiEmployeeAmount = '0';
                uiCompanyAmount = grandForUi > 0 ? String(grandForUi) : '';
            }

            setFormData({
                fineAmount: String(storedFine || ''),
                responsibleFor: initialData.responsibleFor || 'Employee',
                employeeAmount: uiEmployeeAmount,
                companyAmount: uiCompanyAmount,
                payableDuration: String(initialData.payableDuration || '1'),
                monthStart: initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7),
                description: initialData.description || '',
                attachment: attachmentForUi,
                attachmentBase64: '',
                attachmentName: existingAttachmentName,
                attachmentMime: typeof existingAttachment === 'string' ? 'application/pdf' : (existingAttachment?.mimeType || ''),
                companyDescription: initialData.companyDescription || '',
                serviceCharge: String(initialData.serviceCharge || ''),
                depreciationAmount: String(initialData.assetDepreciationAmount ?? initialData.depreciationAmount ?? ''),
                sourceOfIncome: initialData.sourceOfIncome || 'Salary',
                assetPurchaseDate: initialData.purchaseDate || initialData.assetPurchaseDate || '',
                fineSource: initialData.fineSource || '',
            });

            if (initialData.company) {
                setSelectedCompanyId(initialData.company._id || initialData.company);
            }

            // If we have a mainAssetObjectId, we should find that asset and populate its accessories
            if (initialData.mainAssetObjectId || initialData.assetObjectId) {
                const mainAsset = assets.find(a => a._id === (initialData.mainAssetObjectId || initialData.assetObjectId));
                if (mainAsset) {
                    setSelectedAssetId(mainAsset.id);
                    setSelectedAssetName(mainAsset.name);
                    setSelectedAssetObjectId(mainAsset._id);
                    const assignee = resolveAssigneeForAsset(mainAsset);
                    setSelectedEmployeeId(assignee.employeeId);
                    setEmployeeName(assignee.employeeName);
                    setAccessories(resolveEditAccessories(initialData, mainAsset));

                    // If we came from an accessory, find its name
                    if (isAccessoryFineData(initialData)) {
                        const acc = mainAsset.accessories.find(ac =>
                            ac._id === initialData.accessoryObjectId ||
                            ac.accessoryId === initialData.accessoryId
                        );
                        if (acc) {
                            setSelectedAccessoryName(acc.name);
                            setSelectedAccessoryId(acc.accessoryId);
                            setSelectedAccessoryObjectId(acc._id);
                        }
                    }
                } else {
                    // Fallback to manually injecting values if it's not in the fetched list (Unassigned or Accessory)
                    setSelectedAssetId(initialData.assetId);
                    setSelectedAssetName(initialData.assetName);
                    setSelectedAssetObjectId(initialData.mainAssetObjectId || initialData.assetObjectId || '');
                    setAccessories(resolveEditAccessories(initialData, null));

                    if (isAccessoryFineData(initialData)) {
                        const resolvedAccs = resolveEditAccessories(initialData, null);
                        const acc = resolvedAccs.find(ac =>
                            ac._id === initialData.accessoryObjectId ||
                            ac.accessoryId === initialData.accessoryId
                        ) || (initialData.accessories || []).find(ac =>
                            ac._id === initialData.accessoryObjectId ||
                            ac.accessoryId === initialData.accessoryId
                        );
                        if (acc) {
                            setSelectedAccessoryName(acc.name);
                            setSelectedAccessoryId(acc.accessoryId);
                            setSelectedAccessoryObjectId(acc._id);
                        } else {
                            setSelectedAccessoryName(initialData.accessoryName || initialData.assetName);
                            setSelectedAccessoryId(initialData.accessoryId || initialData.assetId);
                        }
                    }
                }
            } else {
                const resolved = resolveEditAccessories(initialData, matchedAsset || null);
                if (resolved.length) setAccessories(resolved);
            }

        } else if (isOpen) {
            setSelectedAssetId('');
            setSelectedAssetName('');
            setSelectedEmployeeId('');
            setEmployeeName('');
            setAccessories([]);
            setSelectedAccessoryId('');
            setSelectedAccessoryName('');
            setSelectedAccessoryObjectId('');
            setSelectedCompanyId('');
            setRemovedAccessoryIds(new Set());
            setFormData({
                fineAmount: '', responsibleFor: 'Employee', employeeAmount: '', companyAmount: '',
                payableDuration: '1', monthStart: new Date().toISOString().split('T')[0].slice(0, 7),
                description: '', attachment: null, attachmentBase64: '', attachmentName: '', attachmentMime: '',
                companyDescription: '', serviceCharge: '', depreciationAmount: '', sourceOfIncome: 'Salary',
                assetPurchaseDate: '', fineSource: '',
            });

        }
    }, [isOpen, initialData, assets]);

    // Sync total when asset or its accessories change (service charge / depreciation use their own handlers).
    useEffect(() => {
        if (!isOpen || !isMainAssetBreakdownMode()) return;

        const breakdownAsset = resolveBreakdownAsset();
        if (!breakdownAsset) return;

        const accList = billableAccessories;
        const total = computeBreakdownFineTotal(breakdownAsset, null, accList);
        const nextAmount = total > 0 ? String(total) : '';

        setFormData((prev) => {
            if (prev.fineAmount === nextAmount) return prev;
            const totalLimit = Math.max(0, parseFloat(nextAmount) || 0);
            if (prev.responsibleFor === 'Employee & Company') {
                const half = totalLimit / 2;
                return {
                    ...prev,
                    fineAmount: nextAmount,
                    employeeAmount: String(half),
                    companyAmount: String(totalLimit - half),
                };
            }
            if (prev.responsibleFor === 'Employee') {
                return { ...prev, fineAmount: nextAmount, employeeAmount: nextAmount, companyAmount: '0' };
            }
            if (prev.responsibleFor === 'Company') {
                return { ...prev, fineAmount: nextAmount, employeeAmount: '0', companyAmount: nextAmount };
            }
            return { ...prev, fineAmount: nextAmount };
        });
    }, [
        isOpen,
        isInitialRequest,
        selectedAssetObjectId,
        selectedAssetId,
        selectedAccessoryId,
        accessories,
        billableAccessories,
    ]);

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            if (typeof window !== 'undefined' && !localStorage.getItem('token')) return;
            try {
                const response = await axiosInstance.get('/Company');
                const data = response.data.companies || (Array.isArray(response.data) ? response.data : []);
                setCompanies(data);
                if (initialData?.company) {
                    setSelectedCompanyId(initialData.company._id || initialData.company);
                }
            } catch (error) {
            }
        };
        if (isOpen) fetchCompanies();
    }, [isOpen, initialData]);

    const updateFineAmountAndPortions = (newFineAmount, nextState = {}) => {
        setFormData(prev => {
            const currentResponsible = nextState.responsibleFor || prev.responsibleFor;
            const currentServiceCharge = nextState.serviceCharge !== undefined ? nextState.serviceCharge : prev.serviceCharge;
            const totalLimit = parseFloat(newFineAmount) || 0;
            const sc = parseFloat(currentServiceCharge || 0) || 0;
            const baseFine = Math.max(0, totalLimit - sc);

            if (currentResponsible === 'Employee & Company') {
                const newEmp = baseFine / 2;
                const newComp = baseFine - newEmp;
                return {
                    ...prev,
                    ...nextState,
                    fineAmount: newFineAmount,
                    employeeAmount: String(newEmp),
                    companyAmount: String(newComp),
                };
            }
            if (currentResponsible === 'Employee') {
                return {
                    ...prev,
                    ...nextState,
                    fineAmount: newFineAmount,
                    employeeAmount: String(baseFine),
                    companyAmount: '0',
                };
            }
            if (currentResponsible === 'Company') {
                return {
                    ...prev,
                    ...nextState,
                    fineAmount: newFineAmount,
                    employeeAmount: '0',
                    companyAmount: String(baseFine),
                };
            }
            return {
                ...prev,
                ...nextState,
                fineAmount: newFineAmount,
            };
        });
    };

    const handleAssetChange = (e) => {
        const assetId = e.target.value;
        setSelectedAssetId(assetId);
        setSelectedAccessoryId('');
        setSelectedAccessoryName('');
        setSelectedAccessoryObjectId('');
        setAccessories([]);

        if (assetId) {
            if (errors.assetId) setErrors(prev => ({ ...prev, assetId: '' }));
            const asset = assets.find(a => a.id === assetId);
            if (asset) {
                setSelectedAssetName(asset.name || '');
                setSelectedAssetObjectId(asset._id);
                const accList = asset.accessories || [];
                setAccessories(accList);
                setRemovedAccessoryIds(new Set());
                const assignee = resolveAssigneeForAsset(asset);
                setSelectedEmployeeId(assignee.employeeId);
                setEmployeeName(assignee.employeeName);
                syncTotalsToForm(asset, accList.filter(isAttachedAccessory), {
                    assetPurchaseDate: asset.purchaseDate || '',
                });
            }
        } else {
            setSelectedAssetName('');
            setSelectedAssetObjectId('');
            setSelectedEmployeeId('');
            setEmployeeName('');
            updateFineAmountAndPortions('', { assetPurchaseDate: '' });
        }
    };

    const handleAccessoryChange = (e) => {
        const accId = e.target.value;
        setSelectedAccessoryId(accId);
        if (accId === 'main') {
            setSelectedAccessoryName('');
            setSelectedAccessoryObjectId('');
            const asset = assets.find(a => a.id === selectedAssetId);
            if (asset) {
                syncFineFromBreakdown(asset);
            }
        } else {
            const acc = accessories.find(a => a.accessoryId === accId);
            if (acc) {
                setSelectedAccessoryName(acc.name);
                setSelectedAccessoryObjectId(acc._id);
                updateFineAmountAndPortions(acc.amount ? String(acc.amount) : '');
            }
        }
    };

    const handleFineAmountChange = (val) => {
        updateFineAmountAndPortions(val);
    };

    const handleServiceChargeChange = (val) => {
        const asset = resolveBreakdownAsset();
        syncTotalsToForm(asset, billableAccessories, { serviceCharge: val });
    };

    const handleDepreciationChange = (val) => {
        const asset = resolveBreakdownAsset();
        syncTotalsToForm(asset, billableAccessories, { depreciationAmount: val });
    };

    const handleRemoveAccessory = (acc) => {
        if (!acc?._id) return;
        const confirmed = window.confirm(
            `Remove "${acc.name || 'accessory'}" from this fine? It will be excluded from fine totals only; the accessory stays on the asset until manually detached.`,
        );
        if (!confirmed) return;

        const accKey = String(acc._id);
        const nextRemoved = new Set(removedAccessoryIds);
        nextRemoved.add(accKey);
        setRemovedAccessoryIds(nextRemoved);

        const asset = resolveBreakdownAsset();
        const nextBillable = billableAccessories.filter((a) => String(a._id) !== accKey);
        syncTotalsToForm(asset, nextBillable);
    };

    const handleEmployeeAmountChange = (val) => {
        const total = parseFloat(formData.fineAmount || 0) || 0;
        const sc = parseFloat(formData.serviceCharge || 0) || 0;
        const baseFine = Math.max(0, total - sc);

        const numVal = parseFloat(val) || 0;
        let finalEmp = numVal;
        if (finalEmp > baseFine) {
            finalEmp = baseFine;
        }
        if (finalEmp < 0) {
            finalEmp = 0;
        }

        const finalComp = Math.max(0, baseFine - finalEmp);

        setFormData(prev => ({
            ...prev,
            employeeAmount: val === '' ? '' : String(finalEmp),
            companyAmount: String(finalComp)
        }));
    };

    const handleCompanyAmountChange = (val) => {
        const total = parseFloat(formData.fineAmount || 0) || 0;
        const sc = parseFloat(formData.serviceCharge || 0) || 0;
        const baseFine = Math.max(0, total - sc);

        const numVal = parseFloat(val) || 0;
        let finalComp = numVal;
        if (finalComp > baseFine) {
            finalComp = baseFine;
        }
        if (finalComp < 0) {
            finalComp = 0;
        }

        const finalEmp = Math.max(0, baseFine - finalComp);

        setFormData(prev => ({
            ...prev,
            companyAmount: val === '' ? '' : String(finalComp),
            employeeAmount: String(finalEmp)
        }));
    };

    const handleResponsibleForChange = (e) => {
        const val = e.target.value;
        const totalLimit = parseFloat(formData.fineAmount || 0) || 0;
        const sc = parseFloat(formData.serviceCharge || 0) || 0;
        const baseFine = Math.max(0, totalLimit - sc);

        setFormData((prev) => {
            let empAmt = prev.employeeAmount;
            let compAmt = prev.companyAmount;

            if (val === 'Employee & Company') {
                const half = (baseFine / 2).toFixed(2);
                empAmt = half;
                compAmt = half;
            } else if (val === 'Employee') {
                empAmt = baseFine > 0 ? String(baseFine) : '';
                compAmt = '0';
            } else if (val === 'Company') {
                empAmt = '0';
                compAmt = baseFine > 0 ? String(baseFine) : '';
            }

            return {
                ...prev,
                responsibleFor: val,
                employeeAmount: empAmt,
                companyAmount: compAmt,
            };
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({ ...prev, attachment: file, attachmentBase64: base64, attachmentName: file.name, attachmentMime: file.type || 'application/pdf' }));
        };
        reader.readAsDataURL(file);
    };

    const validateForm = () => {
        const newErrors = {};
        // For initial request, only validate description
        if (isInitialRequest) {
            if (!formData.description) newErrors.description = 'Description is required';
            const hasAttachment = Boolean(
                formData.attachmentBase64 ||
                formData.attachmentName ||
                initialData?.attachment?.url ||
                initialData?.attachment?.publicId
            );
            if (!hasAttachment) newErrors.attachment = 'Attachment is required';
            setErrors(newErrors);
            return { ok: Object.keys(newErrors).length === 0, newErrors };
        }

        const initialCompanyContext =
            initialData?.assignedToType === 'Company' ||
            !!initialData?.company ||
            initialData?.responsibleFor === 'Company';

        // Full validation for approval flow
        // For approval flow, assetId might come from initialData
        // For accessories, we need the main asset ID, not the accessory ID
        const effectiveAssetId = selectedAssetId || initialData?.assetId;
        const effectiveAssetObjectId = selectedAssetObjectId || initialData?.assetObjectId;

        // If it's an accessory flow, we still need a main asset ID
        // For approval flow with accessories, we need either assetId or assetObjectId
        if (!isInitialRequest) {
            if (!effectiveAssetId && !effectiveAssetObjectId) {
                newErrors.assetId = 'Asset is required';
            }
        }

        const effectiveEmployeeId = selectedEmployeeId || initialData?.employeeId || initialData?.assignedEmployees?.[0]?.employeeId;

        const responsibleIsCompany =
            formData.responsibleFor === 'Company' || (isApprovalFlow && initialCompanyContext);

        if (!effectiveEmployeeId && !isInitialRequest && !responsibleIsCompany) {
            if (formData.responsibleFor === 'Employee' || formData.responsibleFor === 'Employee & Company') {
                newErrors.employeeId =
                    'Assigned employee is required (or set Responsible to Company if this is a company allocation)';
            }
        }

        if (!formData.fineAmount || parseFloat(formData.fineAmount) <= 0) {
            newErrors.fineAmount = 'Fine amount is required and must be greater than 0';
        }
        if (!formData.description || formData.description.trim() === '') {
            newErrors.description = 'Description is required';
        }

        const hasAttachment = Boolean(
            formData.attachmentBase64 ||
            formData.attachment ||
            formData.attachmentName ||
            initialData?.attachment?.url ||
            initialData?.attachment?.publicId ||
            (typeof initialData?.attachment === 'string' && initialData.attachment)
        );
        if (!hasAttachment && !assetControllerOnlyEdit && !scheduleOnlyEdit) {
            newErrors.attachment = 'Attachment is required';
        }

        if (formData.responsibleFor === 'Employee & Company') {
            const empTarget = parseFloat(formData.employeeAmount || 0);
            const compTarget = parseFloat(formData.companyAmount || 0);
            const sc = parseFloat(formData.serviceCharge || 0) || 0;
            const totalRequired = parseFloat(formData.fineAmount || 0);

            if (Math.abs(empTarget + compTarget + sc - totalRequired) > 0.01) {
                newErrors.amountMismatch = `Employee portion (AED ${empTarget.toFixed(2)}) + company portion (AED ${compTarget.toFixed(2)}) + service charge (AED ${sc.toFixed(2)}) must equal total fine value (AED ${totalRequired.toFixed(2)})`;
            }
        }

        const needsCompanyPick =
            formData.responsibleFor === 'Company' || formData.responsibleFor === 'Employee & Company';
        const hasCompanyId =
            !!(selectedCompanyId && String(selectedCompanyId).trim()) ||
            !!(initialData?.company && (initialData.company._id || initialData.company));
        if (needsCompanyPick && !hasCompanyId) {
            newErrors.company = 'Company selection is required';
        }

        const needsSalarySchedule =
            formData.sourceOfIncome === 'Salary' &&
            shouldValidateFineDeductionSchedule(formData.responsibleFor);

        if (needsSalarySchedule && effectiveEmployeeId) {
            const employee = employees.find((e) => e.employeeId === effectiveEmployeeId);
            const visaErrors = validateFineDeductionVsVisa({
                monthStart: formData.monthStart,
                payableDuration: formData.payableDuration,
                employee,
                employeeLabel: employeeName || effectiveEmployeeId,
            });
            if (visaErrors) Object.assign(newErrors, visaErrors);
        }

        setErrors(newErrors);
        const ok = Object.keys(newErrors).length === 0;
        return { ok, newErrors };
    };

    const isAssetFineFormFlow = isAssetFlow && !isApprovalFlow && !isInitialRequest && !initialData?._id;

    const buildPayload = () => {
        const effectiveAssetId = selectedAssetId || initialData?.assetId || '';
        const effectiveAssetName = selectedAssetName || initialData?.assetName || '';
        const effectiveAssetObjectId = selectedAssetObjectId || initialData?.assetObjectId || '';
        const effectiveEmployeeId = selectedEmployeeId ||
            initialData?.employeeId ||
            initialData?.assignedEmployees?.[0]?.employeeId ||
            '';
        const effectiveEmployeeName = employeeName ||
            initialData?.employeeName ||
            initialData?.assignedEmployees?.[0]?.employeeName ||
            '';

        const selectedAsset = assets.find(a => a.id === effectiveAssetId);

        let commonCompanyId = selectedCompanyId;
        if (!commonCompanyId) {
            commonCompanyId = selectedAsset?.companyId || initialData?.company?._id || initialData?.company;
        }

        const serviceChargeAmount = parseFloat(formData.serviceCharge || 0) || 0;
        const depreciationAmount = parseFloat(formData.depreciationAmount || 0) || 0;
        const grandTotalFine = parseFloat(formData.fineAmount || 0) || 0;
        const baseFineAmount = Math.max(0, grandTotalFine - serviceChargeAmount);

        const totalPartiesCount = (formData.responsibleFor === 'Employee & Company') ? 2 : 1;
        const scPerParty = serviceChargeAmount / totalPartiesCount;

        const employeesList = [];
        if (formData.responsibleFor !== 'Company' && effectiveEmployeeId) {
            const empBase = formData.responsibleFor === 'Employee'
                ? baseFineAmount
                : parseFloat(formData.employeeAmount || 0) || 0;
            employeesList.push({
                employeeId: effectiveEmployeeId,
                employeeName: effectiveEmployeeName,
                employeeAmount: empBase.toFixed(2),
                individualAmount: (empBase + scPerParty).toFixed(2),
                fineAmount: (empBase + scPerParty).toFixed(2),
                daysWorked: 0,
            });
        }
        if (formData.responsibleFor === 'Employee & Company' || formData.responsibleFor === 'Company') {
            const compBase = formData.responsibleFor === 'Company'
                ? baseFineAmount
                : parseFloat(formData.companyAmount || 0) || 0;
            employeesList.push({
                employeeId: 'VEGA-HR-0000',
                employeeName: 'Vega Digital IT Solutions',
                employeeAmount: compBase.toFixed(2),
                individualAmount: (compBase + scPerParty).toFixed(2),
                fineAmount: (compBase + scPerParty).toFixed(2),
                daysWorked: 0,
            });
        }

        const payload = {
            category: 'Damage',
            company: commonCompanyId,
            subCategory: 'Loss & Damage',
            fineType: 'Loss & Damage',
            assetId: effectiveAssetId,
            assetName: effectiveAssetName,
            assetObjectId: effectiveAssetObjectId,
            accessoryId: selectedAccessoryObjectId || initialData?.accessoryObjectId || selectedAccessoryId || null,
            accessoryName: selectedAccessoryName || initialData?.accessoryName || '',
            isBulk: true,
            employees: employeesList,
            fineAmount: grandTotalFine,
            totalFineAmount: grandTotalFine,
            responsibleFor: formData.responsibleFor,
            employeeAmount: formData.responsibleFor === 'Company'
                ? 0
                : (formData.responsibleFor === 'Employee'
                    ? baseFineAmount
                    : parseFloat(formData.employeeAmount || 0) || 0),
            companyAmount: formData.responsibleFor === 'Employee'
                ? 0
                : (formData.responsibleFor === 'Company'
                    ? baseFineAmount
                    : parseFloat(formData.companyAmount || 0) || 0),
            payableDuration:
                formData.sourceOfIncome === 'Salary'
                    ? parseInt(formData.payableDuration, 10)
                    : formData.payableDuration && parseInt(formData.payableDuration, 10) > 0
                      ? parseInt(formData.payableDuration, 10)
                      : null,
            monthStart: formData.sourceOfIncome === 'Salary' ? formData.monthStart : '',
            serviceCharge: serviceChargeAmount,
            sourceOfIncome: formData.sourceOfIncome,
            assetDepreciationAmount: depreciationAmount,
            assetPurchaseDate: formData.assetPurchaseDate || '',
            description: formData.description,
            companyDescription: formData.companyDescription,
            fineSource: formData.fineSource || '',
            fineStatus: isResubmitting ? 'Pending' : (initialData?._id ? initialData.fineStatus : 'Draft'),
            excludedAccessoryIds: [...removedAccessoryIds],
            breakdownItems: [
                {
                    kind: 'main',
                    assetId: effectiveAssetId,
                    name: effectiveAssetName,
                    amount: getMainAssetFineBase(selectedAsset),
                },
                ...billableAccessories.map((a) => ({
                    kind: 'accessory',
                    accessoryObjectId: a._id,
                    accessoryId: a.accessoryId,
                    name: a.name,
                    amount: parseFloat(a.amount || 0) || 0,
                })),
            ],
        };

        if (formData.attachmentBase64) {
            payload.attachment = {
                data: formData.attachmentBase64,
                name: formData.attachmentName,
                mimeType: formData.attachmentMime
            };
        }

        return payload;
    };

    const scrollToFirstValidationError = (validationErrors) => {
        setTimeout(() => {
            const firstErrorKey = Object.keys(validationErrors)[0];
            if (!firstErrorKey) return;
            const errorElement = document.querySelector(`[name="${firstErrorKey}"]`) ||
                document.querySelector(`#${firstErrorKey}`) ||
                document.querySelector('input[aria-invalid="true"]') ||
                document.querySelector('textarea[aria-invalid="true"]');
            if (errorElement) {
                errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                errorElement.focus();
            }
        }, 100);
    };

    const handleSubmit = async (e, mode = 'submit') => {
        e.preventDefault();
        e.stopPropagation();

        if (scheduleOnlyEdit && initialData?._id) {
            const visaErrors = validateApprovedFineScheduleEdit({
                monthStart: formData.monthStart,
                payableDuration: formData.payableDuration,
                initialData,
                employees,
            });
            if (visaErrors) {
                setErrors(visaErrors);
                toast({
                    variant: 'destructive',
                    title: 'Invalid deduction schedule',
                    description: visaErrors.deductionSchedule || visaErrors.monthStart,
                });
                return;
            }
            await submitApprovedFineScheduleEdit({
                axiosInstance,
                fineId: initialData._id,
                monthStart: formData.monthStart,
                payableDuration: formData.payableDuration,
                toast,
                onSuccess,
                onClose,
                setSubmitting,
            });
            return;
        }

        if (assetControllerOnlyEdit && initialData?._id) {
            try {
                setSubmitting(true);
                await axiosInstance.put(`/Fine/${initialData._id}`, {
                    excludedAccessoryIds: Array.from(removedAccessoryIds)
                });
                toast({ title: 'Success', description: 'Accessory configuration updated successfully.' });
                if (onSuccess) onSuccess();
                onClose();
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: error.response?.data?.message || error.message || 'Failed to update accessories.'
                });
            } finally {
                setSubmitting(false);
            }
            return;
        }

        const isDraftSave = mode === 'draft';

        if (!isDraftSave) {
            const { ok: validationResult, newErrors: validationErrors } = validateForm();
            if (!validationResult) {
                scrollToFirstValidationError(validationErrors);
                return;
            }
        }

        try {
            setSubmitting(true);
            const payload = buildPayload();

            if (isAssetFlow && onAssetRequest) {
                if (isDraftSave && isAssetFineFormFlow) {
                    await onAssetRequest(payload, { mode: 'draft' });
                    toast({ title: 'Success', description: 'Loss & Damage form saved as draft.' });
                    onClose();
                    return;
                }

                if (isInitialRequest) {
                    await onAssetRequest({
                        description: formData.description,
                        attachment: formData.attachmentBase64 ? {
                            data: formData.attachmentBase64,
                            name: formData.attachmentName,
                            mimeType: formData.attachmentMime
                        } : null
                    });
                    toast({ title: 'Success', description: 'Loss/Damage request sent to Asset Controller' });
                    onClose();
                    return;
                }

                if (isApprovalFlow) {
                    const requestPayload = { ...payload };

                    if (initialData?.isAccessoryFlow && initialData?.accessoryObjectId) {
                        requestPayload.assetId = initialData.assetId || selectedAssetId;
                        requestPayload.assetName = initialData.assetName || selectedAssetName;
                        requestPayload.assetObjectId = initialData.assetObjectId || selectedAssetObjectId;
                        requestPayload.accessoryId = initialData.accessoryObjectId;
                        requestPayload.accessoryName = initialData.accessoryName || '';
                    } else if (selectedAccessoryObjectId) {
                        requestPayload.assetId = selectedAssetId;
                        requestPayload.assetName = selectedAssetName;
                        requestPayload.assetObjectId = selectedAssetObjectId;
                        requestPayload.accessoryId = selectedAccessoryObjectId;
                        requestPayload.accessoryName = selectedAccessoryName || '';
                    }

                    try {
                        await onAssetRequest(requestPayload);
                        toast({ title: 'Success', description: 'Loss/Damage approved. Fine created with status Pending HR.' });
                        onClose();
                        return;
                    } catch (callbackError) {
                        toast({
                            variant: 'destructive',
                            title: 'Error',
                            description: callbackError?.response?.data?.message || callbackError?.message || 'Failed to approve Loss/Damage request'
                        });
                        setSubmitting(false);
                        return;
                    }
                }

                const requestPayload = { ...payload };
                if (selectedAccessoryObjectId) {
                    requestPayload.assetId = selectedAccessoryId;
                    requestPayload.assetName = selectedAccessoryName;
                    requestPayload.accessoryId = selectedAccessoryObjectId;
                }
                await onAssetRequest(requestPayload);
                if (!isAssetFineFormFlow) {
                    toast({ title: 'Success', description: 'Loss/Damage submitted for approval.' });
                }
                onClose();
                return;
            }

            if (initialData?._id) {
                if (isResubmitting) {
                    payload.fineStatus = 'Pending';
                    payload.resubmit = true;
                }
                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({ title: 'Success', description: 'Fine updated successfully' });
            } else {
                await axiosInstance.post('/Fine', payload);
                toast({ title: 'Success', description: 'Loss/Damage fine submitted for approval' });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || error.message || 'Submission failed. Please check all required fields.'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const isAccessorySelection =
        (!!selectedAccessoryId && selectedAccessoryId !== 'main') ||
        (!selectedAccessoryId && isAccessoryFineData(initialData));

    const showBreakdownList =
        !isInitialRequest &&
        !isAccessorySelection &&
        !!selectedAssetObjectId &&
        billableAccessories.length > 0 &&
        (selectedAccessoryId === 'main' || !selectedAccessoryId);

    const selectedAssetForBreakdown = assets.find(
        (a) => a._id === selectedAssetObjectId || a.id === selectedAssetId,
    );
    const mainAssetBreakdownValue = getMainAssetFineBase(selectedAssetForBreakdown);

    const fineAmountReadOnly = !isAccessorySelection && !!(selectedAssetObjectId || selectedAssetId);

    const breakdownTotals = computeFineTotals(
        selectedAssetForBreakdown || resolveBreakdownAsset(),
        billableAccessories,
        formData,
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" aria-hidden />
            <div className="relative z-[60] bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[90vh] p-6 md:p-8 flex flex-col pointer-events-auto">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">
                            {isInitialRequest
                                ? 'Request Loss & Damage'
                                : isResubmitting
                                  ? 'Resubmit Loss & Damage'
                                  : initialData?._id
                                    ? (scheduleOnlyEdit ? 'Edit Deduction Schedule' : 'Edit Loss & Damage')
                                    : 'Add Loss & Damage'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5 text-gray-700">
                    <ApprovedFineScheduleEditShell scheduleOnlyEdit={scheduleOnlyEdit} assetControllerOnlyEdit={assetControllerOnlyEdit}>

                    {isInitialRequest && (selectedAssetId || initialData?.assetId) && (
                        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Asset</p>
                            <p className="text-sm font-bold text-gray-900">
                                {selectedAssetName || initialData?.assetName || 'Selected asset'}
                                <span className="ml-2 font-mono text-xs font-semibold text-gray-500">
                                    {selectedAssetId || initialData?.assetId}
                                </span>
                            </p>
                            <p className="text-xs text-amber-800">
                                Describe the loss or damage below. Asset Controller will review your request and set the fine amount.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Only show asset selection if NOT initial request */}
                        {!isInitialRequest && (
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-sm font-medium text-gray-700">Select Asset <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedAssetId}
                                    onChange={handleAssetChange}
                                    className={`w-full h-11 px-4 rounded-xl border ${errors.assetId ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-red-500/20 transition-all`}
                                >
                                    <option value="">Select Asset</option>
                                    {filteredAssets.map(a => <option key={a.id} value={a.id}>{a.id} - {a.name}</option>)}
                                    {selectedAssetId && !filteredAssets.find(a => a.id === selectedAssetId) && (
                                        <option value={selectedAssetId}>{selectedAssetId} - {selectedAssetName}</option>
                                    )}
                                </select>
                                {errors.assetId && <p className="text-xs text-red-500 ml-1">{errors.assetId}</p>}
                            </div>
                        )}

                        {/* Only show fine form fields if NOT initial request */}
                        {!isInitialRequest && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Assigned Employee</label>
                                    <input type="text" value={employeeName || '—'} readOnly className={`w-full h-11 px-4 rounded-xl border bg-gray-100 outline-none ${errors.employeeId ? 'border-red-400 text-red-900' : 'border-gray-200 text-gray-500'}`} />
                                    {errors.employeeId && <p className="text-xs text-red-500 ml-1">{errors.employeeId}</p>}
                                    <p className="text-xs text-gray-500">Asset owner if assigned; otherwise Asset Controller.</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Asset Value (AED)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={mainAssetBreakdownValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-700 outline-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Asset Purchased Date</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatPurchaseDate(formData.assetPurchaseDate)}
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-700 outline-none"
                                    />
                                </div>

                                {showBreakdownList && (
                                    <div className="space-y-2 col-span-full">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Accessories</label>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Remove excludes an accessory from the fine totals only. Kept items are marked Lost on the asset; detached only via Unattach on the asset page.
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    <tr>
                                                        <th className="text-left px-3 py-2">Name</th>
                                                        <th className="text-right px-3 py-2">Amount (AED)</th>
                                                        <th className="text-right px-3 py-2 w-24">Remove</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {billableAccessories.length === 0 ? (
                                                        <tr className="border-t border-gray-100 bg-white">
                                                            <td colSpan={3} className="px-3 py-4 text-center text-gray-400 text-xs">
                                                                No accessories in this fine
                                                            </td>
                                                        </tr>
                                                    ) : billableAccessories.map((acc) => {
                                                        const accKey = String(acc._id);
                                                        const price = parseFloat(acc.amount || 0) || 0;
                                                        return (
                                                            <tr key={accKey} className="border-t border-gray-100 bg-white">
                                                                <td className="px-3 py-2.5 text-gray-800">{acc.name || 'Accessory'}</td>
                                                                <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                                                                    {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right">
                                                                    <button
                                                                        type="button"
                                                                        data-accessory-remove-field
                                                                        disabled={submitting}
                                                                        onClick={() => handleRemoveAccessory(acc)}
                                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        Remove
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Service Charge (AED)</label>
                                    <input
                                        type="number"
                                        value={formData.serviceCharge}
                                        onChange={(e) => handleServiceChargeChange(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Asset Depreciation Amount (AED)</label>
                                    <input
                                        type="number"
                                        value={formData.depreciationAmount}
                                        onChange={(e) => handleDepreciationChange(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                </div>

                                <div className="space-y-1.5 col-span-full md:col-span-1">
                                    <label className="text-sm font-medium text-gray-700">
                                        Total Fine Value (AED) <span className="text-red-500">*</span>
                                        <span className="block text-xs font-normal text-gray-500 mt-0.5">
                                            {billableAccessories.length > 0
                                                ? '(Asset + accessories + service charge) − depreciation'
                                                : '(Asset value + service charge) − depreciation'}
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        name="fineAmount"
                                        value={formData.fineAmount}
                                        onChange={(e) => handleFineAmountChange(e.target.value)}
                                        readOnly={fineAmountReadOnly && !isAccessorySelection}
                                        placeholder="0.00"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.fineAmount ? 'border-red-400' : 'border-gray-200'} ${fineAmountReadOnly && !isAccessorySelection ? 'bg-gray-100 text-gray-700 cursor-default' : 'bg-gray-50'} outline-none`}
                                    />
                                    {errors.fineAmount && <p className="text-xs text-red-500 ml-1">{errors.fineAmount}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Responsible For</label>
                                    <select value={formData.responsibleFor} onChange={handleResponsibleForChange} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none">
                                        <option value="Employee">Employee</option>
                                        <option value="Company">Company</option>
                                        <option value="Employee & Company">Employee & Company</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Source of Income</label>
                                    <select
                                        value={formData.sourceOfIncome}
                                        onChange={(e) => {
                                            const nextSource = e.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                sourceOfIncome: nextSource,
                                                monthStart:
                                                    nextSource === 'End of Service' ? '' : prev.monthStart,
                                            }));
                                            if (nextSource === 'End of Service') {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    monthStart: '',
                                                    payableDuration: '',
                                                    deductionSchedule: '',
                                                }));
                                            }
                                        }}
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                                    >
                                        <option value="Salary">Salary</option>
                                        <option value="End of Service">End of Service</option>
                                    </select>
                                </div>

                                {formData.responsibleFor === 'Employee & Company' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Employee Portion (AED)</label>
                                            <input type="number" value={formData.employeeAmount} onChange={(e) => handleEmployeeAmountChange(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Company Portion (AED)</label>
                                            <input type="number" value={formData.companyAmount} onChange={(e) => handleCompanyAmountChange(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" />
                                        </div>
                                        {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full">{errors.amountMismatch}</p>}
                                    </>
                                )}

                                {(formData.responsibleFor === 'Company' || formData.responsibleFor === 'Employee & Company') && (
                                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">Select Company <span className="text-red-500">*</span></label>
                                        <select
                                            value={selectedCompanyId}
                                            onChange={(e) => {
                                                setSelectedCompanyId(e.target.value);
                                                if (errors.company) setErrors(prev => ({ ...prev, company: '' }));
                                            }}
                                            className={`w-full h-11 px-4 rounded-xl border ${errors.company ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                        >
                                            <option value="">Select Company</option>
                                            {companies.map(comp => (
                                                <option key={comp._id} value={comp._id}>{comp.name}</option>
                                            ))}
                                        </select>
                                        {errors.company && <p className="text-xs text-red-500 ml-1">{errors.company}</p>}
                                    </div>
                                )}

                                {formData.sourceOfIncome === 'Salary' && (
                                    <>
                                        {errors.deductionSchedule ? (
                                            <p className="text-xs text-red-500 md:col-span-2">{errors.deductionSchedule}</p>
                                        ) : null}
                                        <div className="space-y-1.5" data-schedule-field>
                                            <label className="text-sm font-medium text-gray-700">Payable From</label>
                                            <MonthYearPicker
                                                value={formData.monthStart ? `${formData.monthStart}-01` : undefined}
                                                onChange={(d) => {
                                                    if (d) {
                                                        setFormData(prev => ({ ...prev, monthStart: d.slice(0, 7) }));
                                                        if (errors.monthStart || errors.deductionSchedule) {
                                                            setErrors(prev => ({ ...prev, monthStart: '', deductionSchedule: '' }));
                                                        }
                                                    }
                                                }}
                                                className={`w-full bg-gray-50 ${errors.monthStart ? 'border-red-400' : 'border-gray-200'}`}
                                                disabled={false}
                                            />
                                            {errors.monthStart ? (
                                                <p className="text-xs text-red-500">{errors.monthStart}</p>
                                            ) : null}
                                        </div>

                                        <div className="space-y-1.5" data-schedule-field>
                                            <label className="text-sm font-medium text-gray-700">Duration</label>
                                            <select
                                                data-schedule-field
                                                value={formData.payableDuration}
                                                onChange={(e) => {
                                                    setFormData(prev => ({ ...prev, payableDuration: e.target.value }));
                                                    if (errors.payableDuration || errors.deductionSchedule) {
                                                        setErrors(prev => ({ ...prev, payableDuration: '', deductionSchedule: '' }));
                                                    }
                                                }}
                                                className={`w-full h-11 px-4 rounded-xl border ${errors.payableDuration ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                            >
                                                {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                                            </select>
                                            {errors.payableDuration ? (
                                                <p className="text-xs text-red-500">{errors.payableDuration}</p>
                                            ) : null}
                                        </div>
                                    </>
                                )}

                                {isEndOfServiceFineSource(formData.sourceOfIncome) && (
                                    <div className="space-y-1.5" data-schedule-field>
                                        <label className="text-sm font-medium text-gray-700">
                                            Duration <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <select
                                            data-schedule-field
                                            value={formData.payableDuration}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, payableDuration: e.target.value }));
                                                if (errors.payableDuration || errors.deductionSchedule) {
                                                    setErrors(prev => ({ ...prev, payableDuration: '', deductionSchedule: '' }));
                                                }
                                            }}
                                            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                                        >
                                            <option value="">Not set (1 month)</option>
                                            {[1, 2, 3, 4, 5, 6].map(m => (
                                                <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Fine Source</label>
                        <ZohoVendorSelect
                            value={formData.fineSource}
                            onChange={(nextValue) => setFormData((prev) => ({ ...prev, fineSource: nextValue }))}
                            placeholder="Select vendor..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
                        <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none resize-none`} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Attachment <span className="text-red-500">*</span></label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full p-4 rounded-xl border-2 border-dashed ${errors.attachment ? 'border-red-400' : 'border-gray-200'} bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100`}
                        >
                            <Upload className="text-gray-400 mb-2" size={24} />
                            <span className="text-sm text-gray-500">
                                {formData.attachment || formData.attachmentName ? formData.attachmentName : 'Click to upload'}
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                    handleFileChange(e);
                                    if (errors.attachment) setErrors((prev) => ({ ...prev, attachment: '' }));
                                }}
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                        </div>
                        {errors.attachment ? <p className="text-xs text-red-500 ml-1">{errors.attachment}</p> : null}
                    </div>

                    {/* Total Summary — Asset Controller fine form only */}
                    {!isInitialRequest && (
                    <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-100 shadow-sm mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-0.5">Summary</span>
                            <span className="text-xs text-red-600 font-medium italic">
                                {breakdownTotals.accSum > 0
                                    ? `Asset ${breakdownTotals.assetVal.toFixed(2)} + accessories ${breakdownTotals.accSum.toFixed(2)} + service ${breakdownTotals.sc.toFixed(2)} − depreciation ${breakdownTotals.dep.toFixed(2)}`
                                    : `Asset ${breakdownTotals.assetVal.toFixed(2)} + service ${breakdownTotals.sc.toFixed(2)} − depreciation ${breakdownTotals.dep.toFixed(2)}`}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-red-900">
                                {(parseFloat(formData.fineAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[11px] font-bold text-red-700 uppercase">AED</span>
                        </div>
                    </div>
                    )}
                    </ApprovedFineScheduleEditShell>

                    <div className={`flex ${isAssetFineFormFlow ? 'justify-between' : 'justify-end'} gap-3 pt-6 border-t border-gray-100`}>
                        {isAssetFineFormFlow && !scheduleOnlyEdit && (
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'draft')}
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : 'Save as Draft'}
                            </button>
                        )}
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-medium shadow-sm transition-all hover:bg-red-700 hover:shadow-md disabled:opacity-50"
                            >
                                {submitting
                                    ? 'Saving...'
                                    : (isApprovalFlow
                                        ? 'Approve & Create Fine'
                                        : (initialData?._id
                                            ? (scheduleOnlyEdit ? 'Save Schedule' : (assetControllerOnlyEdit ? 'Save Accessory Exclusion' : 'Save Changes'))
                                            : (isResubmitting
                                                ? 'Resubmit'
                                                : (isInitialRequest
                                                    ? 'Send Request'
                                                    : (isAssetFineFormFlow ? 'Submit for Approval' : 'Save as Draft')))))}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
