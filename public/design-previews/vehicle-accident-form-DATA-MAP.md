# Vehicle accident Form — design ↔ dynamic data map

Preview file: open `vehicle-accident-form.html` in a browser (no ERP build required).

Exact labels and spelling match your mockup (`Accident Discription`, `Clime Acknowedge`, `Discription`).

---

## Header (orange)

| UI label | Dynamic source (ERP) |
|----------|-------------------|
| Dated | Service request `date` → `formatDate` + weekday |
| KM | `asset.currentKilometer` or form `currentKm` |
| Previous Accident Date | Last completed **Accident Repair** service `date` on same asset |
| View History | Link to asset service history / fleet service requests |

---

## Section 1 — blue (accident)

| UI label | Dynamic source | Notes |
|----------|----------------|-------|
| Accident Date | `remark.accidentDate` / form `accidentDate` | Required today |
| Accident Time | **Add** `remark.accidentTime` | Not in current payload |
| Accident Location | **Add** `remark.accidentLocation` | Not in current payload |
| Vehicle assigned | `remark.vehicleOwnerEmployeeId` → employee name | Dropdown |
| Car Driven By | `remark.assignedByEmployeeId` → employee name | Dropdown |
| Accident Party | `remark.accidentOwnerType` (`self` / `thirdParty`) | SELF / Third party |
| Insurance Company | Vehicle **Insurance** document on asset | Auto-fill read-only (red) |
| Policy Number | Insurance document `issueAuthority` or policy field | Auto-fill |
| Insurance Expiry Date | Insurance document `expiryDate` | Auto-fill |
| Insurance Excess | `remark.insuranceFineAmount` or new `insuranceExcess` | Auto-fill or manual |
| Police Fine | `remark.policeFineAmount` | AED; disabled if Third party |
| Other Fine | **Add** `remark.otherFineAmount` | Sum into Total |
| Total | `policeFine + otherFine + excess` (or stored total) | Red text |
| Police Report | `service.attachment` | PDF upload |
| Police Fine Document | `service.quotation3` | Map in UI |
| Other Document | New slot or `remark.otherDocument` | Upload |
| Accident Photos | `remark.accidentImages[]` | Max 6–8 slots + add |
| Accident Discription | `service.description` / `serviceIssue` | Textarea |
| Save Draft | Local draft / partial save | Optional API |
| Cancel | Close modal | |
| Confirm Request | POST service + start workflow | Replaces current save |

---

## Section 2 — green (garage)

| UI label | Dynamic source | Notes |
|----------|----------------|-------|
| Clime Acknowedge | `service.quotation2` | Claim acknowledge upload |
| Garage Location | `remark.garageLocation` | Workflow admin form today |
| Garage Contact | **Add** `remark.garageContact` | New field |
| Garage Name | `remark.vendorName` / workflow `garageName` | |
| Service Start Date | `remark.adminScheduledServiceDate` | |
| Service End Date | Computed: start + `accidentRepairDurationDays` | |
| Update Garage | PATCH workflow / service remark | Admin step |

---

## Section 3 — pink (completion)

| UI label | Dynamic source | Notes |
|----------|----------------|-------|
| Garage Report | `service.serviceCompletionReport` | Return-to-live |
| Garage Invoice | `service.shopInvoice` | |
| Other Document | Optional extra file | |
| Return Date | `remark.accidentReturnDate` | Workflow |
| Hand Over Date | **Add** `remark.handOverDate` | New field |
| New Condition Photos | `remark.bodyWorkImages` or post-repair photos | After repair |
| Discription | Completion notes / `service.description` | |
| Submit for approval | Workflow approve | |

---

## Insurance auto-fill logic

When vehicle has `documents[]` type **Insurance**:

- Insurance Company → insurer name / `issueAuthority`
- Policy Number → from description or dedicated field
- Insurance Expiry Date → `expiryDate`
- Show **Auto Fill** in red until loaded; then show real values

---

## Total calculation

```
Total (AED) = Insurance Excess + Police Fine + Other Fine
```

(Adjust if business rules differ.)

---

## Integration note (when you allow code changes)

Today your app splits this mockup across:

1. `VehicleServiceModal.jsx` — accident request (blue section mostly)
2. `VehicleServiceWorkflowCards.jsx` — garage (green) + return (pink)

To match the image **exactly in one screen**, merge those into one component or one scrollable form with three colored blocks.

New remark fields to add in `vehicleServicePayload.js` / backend `remark` JSON:

- `accidentTime`, `accidentLocation`, `otherFineAmount`, `garageContact`, `handOverDate`
