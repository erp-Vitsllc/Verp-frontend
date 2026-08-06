/**
 * Prefer ERP `currentKilometer` (updated by the 30-min Locator→ERP sync).
 * Do not call live Locator APIs from vehicle pages — that caused severe lag.
 */
export async function enrichVehicleWithLocatorKm(vehicleData) {
    return vehicleData;
}
