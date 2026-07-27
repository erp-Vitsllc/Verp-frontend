'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    ERP_ATTACHMENT_ACCEPT,
    validateErpUploadFile,
} from '@/utils/uploadFileTypes';
import ZohoPayAccountSelect from './ZohoPayAccountSelect';
import VehicleTireChangeFormFieldCell from './VehicleTireChangeFormFieldCell';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Pay Account + Amount + Attachment for garage → Zoho Bill.
 * Vendor is Garage Name (selected above).
 */
export default function VehicleGarageBillingFields({
    formData,
    setField,
    fieldsDisabled = false,
    accent,
    fieldMinHeightPx = 88,
    fieldClassName = '',
    amountReadOnly = true,
}) {
    const { toast } = useToast();
    const fileRef = useRef(null);
    const amountDisplay = formData.garageBillAmount
        ? Number(formData.garageBillAmount).toLocaleString('en-AE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })
        : '';

    const handleFile = async (fileList) => {
        const file = fileList?.[0];
        if (!file) return;
        const check = validateErpUploadFile(file);
        if (!check.ok) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: check.message,
            });
            if (fileRef.current) fileRef.current.value = '';
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const base64 = String(dataUrl).includes(',')
                ? String(dataUrl).split(',')[1]
                : String(dataUrl);
            setField('garageAttachmentName', file.name);
            setField('garageAttachmentBase64', base64);
            setField('garageAttachmentMime', file.type || 'application/pdf');
        } catch {
            toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: 'Could not read the selected file.',
            });
        } finally {
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <>
            <VehicleTireChangeFormFieldCell
                label="Pay Account"
                accentClass={accent?.(2)}
                minHeightPx={fieldMinHeightPx}
            >
                <ZohoPayAccountSelect
                    value={formData.payAccountId || ''}
                    name={formData.payAccountName || ''}
                    disabled={fieldsDisabled}
                    onChange={({ id, name }) => {
                        setField('payAccountId', id);
                        setField('payAccountName', name);
                    }}
                />
            </VehicleTireChangeFormFieldCell>

            <VehicleTireChangeFormFieldCell
                label="Amount (AED)"
                accentClass={accent?.(0)}
                minHeightPx={fieldMinHeightPx}
            >
                <input
                    className={fieldClassName}
                    type="text"
                    inputMode="decimal"
                    value={amountReadOnly ? amountDisplay : formData.garageBillAmount || ''}
                    readOnly={amountReadOnly}
                    disabled={fieldsDisabled && !amountReadOnly}
                    onChange={
                        amountReadOnly
                            ? undefined
                            : (e) => setField('garageBillAmount', e.target.value)
                    }
                    placeholder="From service approval"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                    From service company pay / approved amount
                </p>
            </VehicleTireChangeFormFieldCell>

            <VehicleTireChangeFormFieldCell
                label="Attachment"
                accentClass={accent?.(1)}
                minHeightPx={fieldMinHeightPx}
            >
                <label
                    className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-teal-400 hover:bg-teal-50/40 ${
                        fieldsDisabled ? 'pointer-events-none opacity-60' : ''
                    }`}
                >
                    <Upload size={14} />
                    <span className="truncate">
                        {formData.garageAttachmentName ||
                            (formData.existingGarageAttachmentUrl
                                ? 'Attachment on file — click to replace'
                                : 'Upload PDF or JPEG')}
                    </span>
                    <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept={ERP_ATTACHMENT_ACCEPT}
                        disabled={fieldsDisabled}
                        onChange={(e) => {
                            void handleFile(e.target.files);
                        }}
                    />
                </label>
                <p className="mt-1 text-[10px] text-slate-400">
                    PDF max 5 MB · JPEG max 2 MB — stored on Accounts approve as Zoho bill
                </p>
            </VehicleTireChangeFormFieldCell>
        </>
    );
}
