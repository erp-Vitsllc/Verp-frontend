import axiosInstance from '@/utils/axios';

/**
 * Attach live Locator odometer onto a vehicle payload for handover UI / PDF.
 * Detail API alone often lacks locator.currentKilometer.
 */
export async function enrichVehicleWithLocatorKm(vehicleData) {
    if (!vehicleData) return vehicleData;
    const deviceId = vehicleData.locatorDeviceId ?? vehicleData.locator?.deviceId;
    if (!deviceId || vehicleData.locator?.currentKilometer != null) {
        return vehicleData;
    }
    try {
        const overlayRes = await axiosInstance.get(`/locator/device-overlay/${deviceId}`, {
            skipToast: true,
            timeout: 15000,
        });
        const overlay = overlayRes.data?.data;
        if (!overlay) return vehicleData;
        return {
            ...vehicleData,
            ...overlay,
            currentKilometer:
                overlay.currentKilometer != null
                    ? overlay.currentKilometer
                    : vehicleData.currentKilometer,
            locator: {
                ...(vehicleData.locator || {}),
                ...(overlay.locator || overlay),
                currentKilometer:
                    overlay.currentKilometer ??
                    overlay.locator?.currentKilometer ??
                    vehicleData.locator?.currentKilometer,
            },
        };
    } catch {
        return vehicleData;
    }
}
