export const WHATSAPP_NOT_REGISTERED_ERROR = 'Not a valid WhatsApp number';

/**
 * Send the welcome template to the number and wait until WhatsApp reports delivery.
 */
export async function checkWhatsAppNumberRegistered(phone, axiosInstance, extras = {}) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) {
        return { ok: false, onWhatsApp: false, error: 'Please enter a WhatsApp number' };
    }

    try {
        const res = await axiosInstance.post(
            '/whatsapp/check-number',
            {
                phone: digits,
                firstName: String(extras.firstName || '').trim(),
                employeeId: String(extras.employeeId || '').trim(),
            },
            { skipToast: true },
        );
        if (res.data?.onWhatsApp === true) {
            return { ok: true, onWhatsApp: true, delivered: Boolean(res.data?.delivered) };
        }
        if (res.data?.onWhatsApp === false) {
            return {
                ok: false,
                onWhatsApp: false,
                error: res.data?.error || res.data?.message || WHATSAPP_NOT_REGISTERED_ERROR,
            };
        }
        return {
            ok: false,
            onWhatsApp: false,
            error: res.data?.error || WHATSAPP_NOT_REGISTERED_ERROR,
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
