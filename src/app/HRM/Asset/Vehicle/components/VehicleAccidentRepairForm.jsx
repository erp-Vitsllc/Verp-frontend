'use client';

import { useRef } from 'react';
import { Upload, Plus } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import VehicleCarDrivenBySelect from './VehicleCarDrivenBySelect';
import { applyCarDrivenBySelection } from '../utils/vehicleCarDrivenBySelect';

const fieldInput =
    'w-full min-h-[36px] px-2.5 py-1.5 bg-white border border-black rounded text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400';
const fieldLabel = 'block text-xs font-bold text-black mb-1';
const sectionTitle = 'text-sm font-bold text-black mb-3';
const uploadBtn =
    'inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-black rounded text-sm font-medium text-slate-800 hover:bg-slate-50';

function formatDisplayDate(isoOrDate) {
    if (!isoOrDate) return '';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${day}/${month}/${year} ${weekdays[d.getDay()]}`;
}

function formatShortDate(isoOrDate) {
    if (!isoOrDate) return '—';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

function AutoFillInput({ value, placeholder = 'Auto Fill', className = '' }) {
    const display = value != null && String(value).trim() !== '' ? String(value) : '';
    return (
        <input
            type="text"
            readOnly
            value={display}
            placeholder={placeholder}
            className={`${fieldInput} ${display ? 'text-red-600 font-medium' : 'text-red-500 placeholder:text-red-500'} ${className}`}
        />
    );
}

function MoneyInput({ value, onChange, disabled, placeholder, className = '' }) {
    return (
        <input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            className={`${fieldInput} text-red-600 font-medium ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
        />
    );
}

function UploadField({ label, fileName, existingUrl, onChange, error }) {
    return (
        <div>
            <span className={fieldLabel}>{label}</span>
            {existingUrl ? (
                <a
                    href={existingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-700 font-semibold block mb-1 hover:underline"
                >
                    View saved file
                </a>
            ) : null}
            <label className={uploadBtn}>
                <Upload size={14} />
                Upload
                <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                        onChange(e);
                        e.target.value = '';
                    }}
                />
            </label>
            {fileName ? <p className="text-[10px] text-slate-600 mt-1 truncate">{fileName}</p> : null}
            {error ? <p className="text-[10px] text-red-600 font-bold mt-1">{error}</p> : null}
        </div>
    );
}

function PhotoStrip({ existingImages = [], newImages = [], onAdd, onPreview }) {
    const slots = 7;
    const cells = [];
    if (typeof onAdd === 'function') {
        cells.push(
            <button
                key="add"
                type="button"
                onClick={onAdd}
                className="w-14 h-14 shrink-0 flex items-center justify-center border border-black bg-white text-xl font-light"
                aria-label="Add photo"
            >
                +
            </button>
        );
    }
    (existingImages || []).forEach((img, idx) => {
        const src = img?.url || '';
        if (!src) return;
        cells.push(
            <button
                key={`ex-${idx}`}
                type="button"
                onClick={() => onPreview(src)}
                className="w-14 h-14 shrink-0 border border-black overflow-hidden bg-white"
            >
                <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
        );
    });
    (newImages || []).forEach((img, idx) => {
        const mime = img?.mimeType || 'image/jpeg';
        const src = img?.data ? `data:${mime};base64,${img.data}` : '';
        if (!src) return;
        cells.push(
            <button
                key={`nw-${idx}`}
                type="button"
                onClick={() => onPreview(src)}
                className="w-14 h-14 shrink-0 border border-black overflow-hidden bg-white"
            >
                <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
        );
    });
    while (cells.length < slots) {
        cells.push(
            <div key={`empty-${cells.length}`} className="w-14 h-14 shrink-0 border border-black/30 bg-white/60" />
        );
    }
    return (
        <div className="flex flex-wrap gap-2 items-center">
            {cells.slice(0, slots)}
        </div>
    );
}

export default function VehicleAccidentRepairForm({
    formData,
    set,
    errors,
    employees,
    drivenByEmployees,
    companies = [],
    assetControllerName,
    ASSET_CONTROLLER_VALUE,
    resolvedAssetControllerEmployeeId,
    hasResolvedControllerInEmployees,
    headerDateLabel,
    previousAccidentDate,
    previousAccidentDateLabel = 'Previous Accident Date',
    onViewHistory,
    handleFileChange,
    appendAccidentImagesFromFiles,
    appendNewConditionImagesFromFiles,
    accidentImagesInputRef,
    newConditionImagesInputRef,
    setLightboxSrc,
    onSaveDraft,
    onCancel,
    onCreateRequest,
    loading,
    hideSectionActions = false,
    readOnlyAccident = false,
    showGarageSection = true,
    showReturnSection = true,
    showCreatorActions = false,
    showGarageActions = false,
    showReturnActions = false,
    submitButtonLabel = 'Confirm Report',
    onSubmitForApproval,
    submitDisabled = false,
    createRequestLabel = 'Create request',
    createRequestDisabled = false,
}) {
    const localAccidentRef = useRef(null);
    const localConditionRef = useRef(null);
    const accidentRef = accidentImagesInputRef || localAccidentRef;
    const conditionRef = newConditionImagesInputRef || localConditionRef;

    const isSelfParty = formData.accidentOwnerType !== 'thirdParty';
    const insuranceExcess = isSelfParty ? Number(formData.insuranceFineAmount || 0) : 0;
    const policeFine = Number(formData.policeFineAmount || 0);
    const otherFine = Number(formData.otherFineAmount || 0);
    const totalFines = insuranceExcess + policeFine + otherFine;
    const carDrivenByEmployees = drivenByEmployees || employees;

    const employeeOptions = (employees || []).map((emp) => (
        <option key={emp._id} value={String(emp._id)}>
            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
            {emp.employeeId ? ` (${emp.employeeId})` : ''}
        </option>
    ));

    const fieldDisabled = readOnlyAccident;

    return (
        <div className="flex flex-col gap-4 -mx-2 sm:mx-0">
            <div className="text-center space-y-1 pb-1">
                <h2 className="text-lg font-bold text-black">Vehicle accident Form</h2>
                <p className="text-sm text-black">
                    Dated : <span className="font-semibold">{headerDateLabel || '—'}</span>
                </p>
                <div className="flex flex-wrap items-start justify-between gap-3 pt-2 px-1">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="w-24">
                            <span className={fieldLabel}>KM</span>
                            <input
                                type="number"
                                min={0}
                                value={formData.currentKm}
                                onChange={(e) => set('currentKm', e.target.value)}
                                disabled={fieldDisabled}
                                className={fieldInput}
                            />
                            {errors.currentKm ? (
                                <p className="text-[10px] text-red-600 font-bold">{errors.currentKm}</p>
                            ) : null}
                        </div>
                        <div className="min-w-[140px]">
                            <span className={fieldLabel}>{previousAccidentDateLabel}</span>
                            <div className={`${fieldInput} flex items-center text-sm font-medium`}>
                                {formatShortDate(previousAccidentDate)}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onViewHistory}
                        className="text-sm font-bold text-teal-700 hover:underline self-start"
                    >
                        View History
                    </button>
                </div>
            </div>

            {/* Section 1 — Accident Details */}
            <section className="rounded-lg p-4 sm:p-5" style={{ backgroundColor: '#d4e8f7' }}>
                <p className={sectionTitle}>Accident Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                        <span className={fieldLabel}>Accident Date</span>
                        <DatePicker
                            value={formData.accidentDate}
                            onChange={(v) => set('accidentDate', v || '')}
                            placeholder="dd/mm/yyyy"
                            disabled={fieldDisabled}
                            className={fieldInput}
                        />
                        {errors.accidentDate ? (
                            <p className="text-[10px] text-red-600 font-bold">{errors.accidentDate}</p>
                        ) : null}
                    </div>
                    <div>
                        <span className={fieldLabel}>Accident Time</span>
                        <input
                            type="time"
                            value={formData.accidentTime || ''}
                            onChange={(e) => set('accidentTime', e.target.value)}
                            disabled={fieldDisabled}
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <span className={fieldLabel}>Accident Location</span>
                        <input
                            type="text"
                            value={formData.accidentLocation || ''}
                            onChange={(e) => set('accidentLocation', e.target.value)}
                            disabled={fieldDisabled}
                            className={fieldInput}
                            placeholder=""
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                        <span className={fieldLabel}>Vehicle assigned</span>
                        <select
                            value={formData.vehicleOwnerEmployeeId || ''}
                            onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                            disabled={fieldDisabled}
                            className={fieldInput}
                        >
                            {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                            ) : null}
                            <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                            {employeeOptions}
                        </select>
                    </div>
                    <div>
                        <span className={fieldLabel}>Car Driven By</span>
                        <VehicleCarDrivenBySelect
                            formData={formData}
                            employees={carDrivenByEmployees}
                            companies={companies}
                            disabled={fieldDisabled}
                            className={fieldInput}
                            placeholder="Select employee with driving license"
                            onChange={(selection) => {
                                const next = applyCarDrivenBySelection(formData, selection, { companies });
                                set('carDrivenByType', next.carDrivenByType);
                                set('carDrivenByEmployeeId', next.carDrivenByEmployeeId);
                                set('carDrivenByCompanyId', next.carDrivenByCompanyId);
                                set('carDrivenByCompanyName', next.carDrivenByCompanyName);
                            }}
                        />
                    </div>
                    <div>
                        <span className={fieldLabel}>Accident Party</span>
                        <div className="flex border border-black rounded overflow-hidden bg-white">
                            <button
                                type="button"
                                disabled={fieldDisabled}
                                onClick={() => set('accidentOwnerType', 'self')}
                                className={`flex-1 py-2 text-xs font-bold uppercase ${
                                    formData.accidentOwnerType === 'self'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-white text-black'
                                }`}
                            >
                                SELF
                            </button>
                            <button
                                type="button"
                                disabled={fieldDisabled}
                                onClick={() => set('accidentOwnerType', 'thirdParty')}
                                className={`flex-1 py-2 text-xs font-bold uppercase ${
                                    formData.accidentOwnerType === 'thirdParty'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-white text-black'
                                }`}
                            >
                                OTHER PARTY DAMAGE
                            </button>
                        </div>
                        {errors.accidentOwnerType ? (
                            <p className="text-[10px] text-red-600 font-bold">{errors.accidentOwnerType}</p>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                        <span className={fieldLabel}>Insurance Company</span>
                        <AutoFillInput value={formData.insuranceCompany} />
                    </div>
                    <div>
                        <span className={fieldLabel}>Policy Number</span>
                        <AutoFillInput value={formData.policyNumber} />
                    </div>
                    <div>
                        <span className={fieldLabel}>Insurance Expiry Date</span>
                        <AutoFillInput
                            value={
                                formData.insuranceExpiryDate
                                    ? formatShortDate(formData.insuranceExpiryDate)
                                    : ''
                            }
                        />
                    </div>
                </div>

                <div className={`grid grid-cols-2 ${isSelfParty ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 mb-4`}>
                    {isSelfParty ? (
                        <div>
                            <span className={fieldLabel}>Insurance Excess</span>
                            <AutoFillInput
                                value={
                                    formData.insuranceFineAmount !== '' && formData.insuranceFineAmount != null
                                        ? `${formData.insuranceFineAmount} AED`
                                        : ''
                                }
                            />
                        </div>
                    ) : null}
                    <div>
                        <span className={fieldLabel}>Police Fine</span>
                        <MoneyInput
                            value={formData.policeFineAmount}
                            onChange={(e) => set('policeFineAmount', e.target.value)}
                            disabled={fieldDisabled || formData.accidentOwnerType !== 'self'}
                            placeholder="AED"
                        />
                        {errors.policeFineAmount ? (
                            <p className="text-[10px] text-red-600 font-bold">{errors.policeFineAmount}</p>
                        ) : null}
                    </div>
                    <div>
                        <span className={fieldLabel}>Other Fine</span>
                        <MoneyInput
                            value={formData.otherFineAmount || ''}
                            onChange={(e) => set('otherFineAmount', e.target.value)}
                            disabled={fieldDisabled}
                            placeholder="AED"
                        />
                    </div>
                    <div>
                        <span className={fieldLabel}>Total</span>
                        <input
                            type="text"
                            readOnly
                            value={totalFines ? `${totalFines} AED` : ''}
                            className={`${fieldInput} text-red-600 font-medium`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <UploadField
                        label="Police Report"
                        fileName={formData.attachmentName || formData.remarkAttachmentName}
                        existingUrl={formData.existingAttachmentUrl}
                        onChange={(e) => handleFileChange(e, 'attachment')}
                        error={errors.attachment}
                    />
                    <UploadField
                        label="Police Fine Document"
                        fileName={formData.quotation3Name}
                        existingUrl={formData.existingQuotation3Url}
                        onChange={(e) => handleFileChange(e, 'quotation3')}
                    />
                    <UploadField
                        label="Other Document"
                        fileName={formData.tireConditionName}
                        existingUrl={formData.existingTireConditionUrl}
                        onChange={(e) => handleFileChange(e, 'tireCondition')}
                    />
                </div>

                <div className="mb-3">
                    <span className={fieldLabel}>Accident Photos:-</span>
                    <PhotoStrip
                        existingImages={formData.existingAccidentImages}
                        newImages={formData.accidentImages}
                        onAdd={fieldDisabled ? undefined : () => accidentRef.current?.click()}
                        onPreview={setLightboxSrc}
                    />
                    <input
                        ref={accidentRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => {
                            appendAccidentImagesFromFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                </div>

                <div className="mb-4">
                    <span className={fieldLabel}>{showCreatorActions ? 'Note' : 'Accident Description:-'}</span>
                    <textarea
                        value={formData.serviceIssue}
                        onChange={(e) => set('serviceIssue', e.target.value)}
                        disabled={fieldDisabled}
                        rows={4}
                        placeholder={showCreatorActions ? 'Describe the accident and any details HR should know…' : ''}
                        className={`${fieldInput} resize-y min-h-[88px]`}
                    />
                    {errors.serviceIssue ? (
                        <p className="text-[10px] text-red-600 font-bold">{errors.serviceIssue}</p>
                    ) : null}
                </div>

                {showCreatorActions ? (
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-black/10">
                        <button
                            type="button"
                            onClick={onSaveDraft}
                            disabled={loading}
                            className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-2xl font-bold text-xs uppercase tracking-widest border border-slate-200 bg-white disabled:opacity-50"
                        >
                            Save draft
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="px-6 py-2.5 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={loading || createRequestDisabled}
                            onClick={() => typeof onCreateRequest === 'function' && onCreateRequest()}
                            className="px-8 py-2.5 rounded-2xl bg-[#00B5AD] hover:bg-[#00928C] text-white font-black text-[11px] uppercase tracking-widest disabled:opacity-50"
                        >
                            {createRequestLabel}
                        </button>
                    </div>
                ) : !hideSectionActions ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onSaveDraft}
                            disabled={loading}
                            className="px-5 py-2 border border-black bg-white text-sm font-bold rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Save Draft
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="px-5 py-2 border border-black bg-white text-sm font-bold rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={loading || submitDisabled}
                            onClick={() => {
                                if (typeof onSubmitForApproval === 'function') {
                                    onSubmitForApproval();
                                }
                            }}
                            className="px-5 py-2 border border-black bg-slate-800 text-white text-sm font-bold rounded hover:bg-slate-900 disabled:opacity-50"
                        >
                            {submitButtonLabel}
                        </button>
                    </div>
                ) : null}
            </section>

            {showGarageSection ? (
            <section className="rounded-lg p-4 sm:p-5" style={{ backgroundColor: '#d4efd4' }}>
                <p className={sectionTitle}>Garage/Service Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <UploadField
                        label="Claim Acknowledge"
                        fileName={formData.quotation2Name}
                        existingUrl={formData.existingQuotation2Url}
                        onChange={(e) => handleFileChange(e, 'quotation2')}
                    />
                    <div>
                        <span className={fieldLabel}>Garage Location</span>
                        <input
                            type="text"
                            value={formData.garageLocation || ''}
                            onChange={(e) => set('garageLocation', e.target.value)}
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <span className={fieldLabel}>Garage Contact</span>
                        <input
                            type="text"
                            value={formData.garageContact || ''}
                            onChange={(e) => set('garageContact', e.target.value)}
                            className={fieldInput}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                        <span className={fieldLabel}>Garage Name</span>
                        <input
                            type="text"
                            list="accident-garage-names"
                            value={formData.garageName || ''}
                            onChange={(e) => set('garageName', e.target.value)}
                            className={fieldInput}
                        />
                        <datalist id="accident-garage-names">
                            <option value="Al Futtaim Motors" />
                            <option value="AGMC" />
                            <option value="Dynatrade" />
                            <option value="FastTrack Auto" />
                        </datalist>
                    </div>
                    <div>
                        <span className={fieldLabel}>Service Start Date</span>
                        <DatePicker
                            value={formData.serviceStartDate || ''}
                            onChange={(v) => set('serviceStartDate', v || '')}
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <span className={fieldLabel}>Service End Date</span>
                        <DatePicker
                            value={formData.serviceEndDate || ''}
                            onChange={(v) => set('serviceEndDate', v || '')}
                            className={fieldInput}
                        />
                    </div>
                </div>
                {showGarageActions ? (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="px-5 py-2 border border-black bg-white text-sm font-bold rounded hover:bg-slate-50"
                            onClick={() => set('garageUpdatedAt', new Date().toISOString())}
                        >
                            Update Garage
                        </button>
                    </div>
                ) : null}
            </section>
            ) : null}

            {showReturnSection ? (
            <section className="rounded-lg p-4 sm:p-5" style={{ backgroundColor: '#f5d4e3' }}>
                <p className={sectionTitle}>Return/Completion Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <UploadField
                        label="Garage Report"
                        fileName={formData.garageReportName}
                        existingUrl={formData.existingGarageReportUrl}
                        onChange={(e) => handleFileChange(e, 'garageReport')}
                    />
                    <UploadField
                        label="Garage Invoice"
                        fileName={formData.garageInvoiceName}
                        existingUrl={formData.existingGarageInvoiceUrl}
                        onChange={(e) => handleFileChange(e, 'garageInvoice')}
                    />
                    <UploadField
                        label="Other Document"
                        fileName={formData.returnOtherDocName}
                        existingUrl={formData.existingReturnOtherDocUrl}
                        onChange={(e) => handleFileChange(e, 'returnOtherDoc')}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <span className={fieldLabel}>Return Date</span>
                        <DatePicker
                            value={formData.returnDate || ''}
                            onChange={(v) => set('returnDate', v || '')}
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <span className={fieldLabel}>Hand Over Date</span>
                        <DatePicker
                            value={formData.handOverDate || ''}
                            onChange={(v) => set('handOverDate', v || '')}
                            className={fieldInput}
                        />
                    </div>
                </div>
                <div className="mb-3">
                    <span className={fieldLabel}>New Condition Photos:-</span>
                    <PhotoStrip
                        existingImages={formData.existingNewConditionImages}
                        newImages={formData.newConditionImages}
                        onAdd={() => conditionRef.current?.click()}
                        onPreview={setLightboxSrc}
                    />
                    <input
                        ref={conditionRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => {
                            if (appendNewConditionImagesFromFiles) {
                                appendNewConditionImagesFromFiles(e.target.files);
                            }
                            e.target.value = '';
                        }}
                    />
                </div>
                <div className="mb-4">
                    <span className={fieldLabel}>Description:-</span>
                    <textarea
                        value={formData.returnDescription || ''}
                        onChange={(e) => set('returnDescription', e.target.value)}
                        rows={4}
                        className={`${fieldInput} resize-y min-h-[88px]`}
                    />
                </div>
                {showReturnActions ? (
                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="px-5 py-2 border border-black bg-white text-sm font-bold rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 border border-black bg-slate-800 text-white text-sm font-bold rounded hover:bg-slate-900 disabled:opacity-50"
                        >
                            Submit for approval
                        </button>
                    </div>
                ) : null}
            </section>
            ) : null}
        </div>
    );
}

export { formatDisplayDate, formatShortDate };
