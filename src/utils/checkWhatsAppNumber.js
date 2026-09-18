export const WHATSAPP_NOT_REGISTERED_ERROR = 'This number is not registered on WhatsApp';

/**
 * Ask the backend whether a number is registered on WhatsApp.
 * Empty numbers are skipped. A filled number must be confirmed before save.
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
        return {
            ok: false,
            onWhatsApp: false,
            error: res.data?.error || res.data?.message || WHATSAPP_NOT_REGISTERED_ERROR,
        };
    } catch (error) {
        const data = error?.response?.data;
        return {
            ok: false,
            onWhatsApp: false,
            error: data?.error || data?.message || WHATSAPP_NOT_REGISTERED_ERROR,
        };
    }
}
