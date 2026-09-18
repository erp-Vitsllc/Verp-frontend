export const WHATSAPP_NOT_REGISTERED_ERROR = 'This number is not registered on WhatsApp';

/**
 * Ask the backend whether a number is registered on WhatsApp.
 * This never sends a WhatsApp message. Empty numbers are skipped.
 */
export async function checkWhatsAppNumberRegistered(phone, axiosInstance) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) {
        return { ok: true, skipped: true, onWhatsApp: null };
    }

    try {
        const res = await axiosInstance.post(
            '/whatsapp/check-number',
            { phone: digits },
            { skipToast: true },
        );
        if (res.data?.skipped) {
            return { ok: true, skipped: true, onWhatsApp: null };
        }
        if (res.data?.onWhatsApp === true) {
            return { ok: true, onWhatsApp: true };
        }
        if (res.data?.onWhatsApp === false) {
            return {
                ok: false,
                onWhatsApp: false,
                error: res.data?.error || res.data?.message || WHATSAPP_NOT_REGISTERED_ERROR,
            };
        }
        return { ok: true, onWhatsApp: null, checkUnavailable: true };
    } catch (error) {
        const data = error?.response?.data;
        if (error?.response?.status === 400 && data?.onWhatsApp === false) {
            return {
                ok: false,
                onWhatsApp: false,
                error: data?.error || data?.message || WHATSAPP_NOT_REGISTERED_ERROR,
            };
        }
        return { ok: true, onWhatsApp: null, checkUnavailable: true };
    }
}
