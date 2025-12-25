# Employee Profile Page Structure Analysis

## File: `page.jsx` (7,178 lines)

### Why is this file so large?

Even though **cards** and **tabs** are in separate component files, the main `page.jsx` file contains **ALL** the business logic, state management, and handlers for the entire employee profile page.

---

## 📋 What's Inside This Page

### 1. **State Management (Lines ~70-420)**
   - **~50+ useState hooks** managing:
     - Modal visibility states (show/hide)
     - Form data for each modal
     - Form validation errors
     - Loading/saving states
     - Editing/deleting states
     - File uploads and refs

   **Examples:**
   - `showEditModal`, `showWorkDetailsModal`, `showPersonalModal`
   - `showPassportModal`, `showVisaModal`, `showBankModal`
   - `showSalaryModal`, `showAddressModal`, `showContactModal`
   - `showEducationModal`, `showExperienceModal`
   - `showEmiratesIdModal`, `showLabourCardModal`
   - `showMedicalInsuranceModal`, `showDrivingLicenseModal`
   - `showDocumentModal`, `showTrainingModal`
   - `showImageModal`, `showDocumentViewer`

   **Form States:**
   - `editForm`, `workDetailsForm`, `personalForm`
   - `passportForm`, `visaForms`, `bankForm`
   - `salaryForm`, `addressForm`, `contactForms`
   - `educationForm`, `experienceForm`
   - `emiratesIdForm`, `labourCardForm`
   - `medicalInsuranceForm`, `drivingLicenseForm`
   - `documentForm`, `trainingForm`

   **Error States:**
   - `editFormErrors`, `workDetailsErrors`, `personalFormErrors`
   - `passportErrors`, `visaErrors`, `bankFormErrors`
   - `salaryFormErrors`, `addressFormErrors`, `contactFormErrors`
   - `educationErrors`, `experienceErrors`
   - `emiratesIdErrors`, `labourCardErrors`
   - `medicalInsuranceErrors`, `drivingLicenseErrors`
   - `documentErrors`, `trainingErrors`

---

### 2. **Handler Functions (Lines ~430-6400)**
   **~100+ handler functions** for:

   #### Modal Handlers:
   - `openEditModal()`, `openWorkDetailsModal()`
   - `handleOpenPersonalModal()`, `handleClosePersonalModal()`
   - `handleOpenContactModal()`, `handleCloseContactModal()`
   - `handleOpenPassportModal()`, `handleClosePassportModal()`
   - `handleOpenVisaModal()`, `handleCloseVisaModal()`
   - `handleOpenBankModal()`, `handleCloseBankModal()`
   - `handleOpenSalaryModal()`, `handleCloseSalaryModal()`
   - `handleOpenAddressModal()`, `handleCloseAddressModal()`
   - `handleOpenEducationModal()`, `handleOpenExperienceModal()`
   - `handleOpenEmiratesIdModal()`, `handleCloseEmiratesIdModal()`
   - `handleOpenLabourCardModal()`, `handleCloseLabourCardModal()`
   - `handleOpenMedicalInsuranceModal()`, `handleCloseMedicalInsuranceModal()`
   - `handleOpenDrivingLicenseModal()`, `handleCloseDrivingLicenseModal()`
   - And more...

   #### Form Change Handlers:
   - `handleEditChange()` - Basic details form changes
   - `handlePersonalChange()` - Personal details form changes
   - `handleContactChange()` - Contact details form changes
   - `handlePassportChange()` - Passport form changes
   - `handleBankChange()` - Bank details form changes
   - `handleSalaryChange()` - Salary form changes
   - `handleAddressChange()` - Address form changes
   - `handleEducationChange()` - Education form changes
   - `handleExperienceChange()` - Experience form changes
   - And more...

   #### File Upload Handlers:
   - `handlePassportFileChange()`
   - `handleBankFileChange()`
   - `handleOfferLetterFileChange()`
   - `handleEducationFileChange()`
   - `handleExperienceFileChange()`
   - `handleDocumentFileChange()`
   - `handleTrainingFileChange()`
   - `handleEmiratesFileChange()`
   - `handleLabourCardFileChange()`
   - `handleMedicalInsuranceFileChange()`
   - `handleDrivingLicenseFileChange()`
   - And more...

   #### Save/Submit Handlers:
   - `handleUpdateWorkDetails()` - Save work details
   - `handleSavePersonalDetails()` - Save personal details
   - `handleSaveContactDetails()` - Save contact details
   - `handlePassportSubmit()` - Save passport
   - `handleSaveVisa()` - Save visa details
   - `handleSaveBank()` - Save bank details
   - `handleSaveSalary()` - Save salary details
   - `handleSaveAddress()` - Save address
   - `handleSaveEducation()` - Save education
   - `handleSaveExperience()` - Save experience
   - `handleSaveEmiratesId()` - Save Emirates ID
   - `handleSaveLabourCard()` - Save labour card
   - `handleSaveMedicalInsurance()` - Save medical insurance
   - `handleSaveDrivingLicense()` - Save driving license
   - `handleSaveDocument()` - Save document
   - `handleSaveTraining()` - Save training
   - And more...

   #### Edit/Delete Handlers:
   - `handleEditEducation()`, `handleDeleteEducation()`
   - `handleEditExperience()`, `handleDeleteExperience()`
   - `handleEditDocument()`, `handleDeleteDocument()`
   - `handleEditContact()`, `handleDeleteContact()`
   - And more...

   #### Validation Functions:
   - `validateEducationField()`, `validateEducationForm()`
   - `validateExperienceField()`, `validateExperienceForm()`
   - `validatePassportField()`, `validatePassportForm()`
   - `validateEmiratesIdDateField()`
   - `validateLabourCardDateField()`
   - `validateMedicalInsuranceField()`
   - `validateDrivingLicenseDateField()`
   - And more...

   #### Utility Functions:
   - `fileToBase64()` - Convert file to base64
   - `base64ToFile()` - Convert base64 to file
   - `calculateTotalSalary()` - Calculate salary totals
   - `formatPhoneForInput()`, `formatPhoneForSave()`
   - `normalizeText()`, `normalizeContactNumber()`
   - `getCountryName()`, `getStateName()`, `getFullLocation()`
   - `sanitizeContact()`, `contactsAreSame()`
   - `getInitials()`, `formatDate()`
   - `calculateDaysUntilExpiry()`, `calculateTenure()`
   - And more...

---

### 3. **API Calls & Data Fetching (Scattered throughout)**
   - `fetchEmployee()` - Fetch employee data
   - `fetchReportingAuthority()` - Fetch reporting authority options
   - Multiple `axiosInstance.patch()` calls for updates
   - Multiple `axiosInstance.post()` calls for creating records
   - Multiple `axiosInstance.delete()` calls for deletions

---

### 4. **useEffect Hooks**
   - Data fetching on mount
   - Form initialization when modals open
   - Dependent data loading (e.g., states based on country)

---

### 5. **useMemo Computed Values**
   - `reportingAuthorityDisplayName`
   - `reportingAuthorityEmail`
   - `allCountriesOptions`
   - `allCountryNamesList`
   - `passportFieldConfig`
   - `hasVisaData`, `hasDocument`
   - `hasSalaryDetails`, `hasEducationDetails`
   - And more...

---

### 6. **Main JSX Return (Lines ~6430-7176)**
   The return statement renders:
   - `<Sidebar />` and `<Navbar />` components
   - Loading and error states
   - `<ProfileHeader />` component
   - `<EmploymentSummary />` component
   - `<TabNavigation />` component
   - Dynamic tabs via `<DynamicTabs />`:
     - `<BasicTab />`
     - `<WorkDetailsTab />`
     - `<SalaryTab />`
     - `<PersonalTab />`
     - `<DocumentsTab />`
     - `<TrainingTab />`
   
   **All Modals (Conditionally Rendered):**
   - `<BasicDetailsModal />`
   - `<WorkDetailsModal />`
   - `<PersonalDetailsModal />`
   - `<ContactModal />`
   - `<PassportModal />`
   - `<VisaModal />`
   - `<BankDetailsModal />`
   - `<SalaryModal />`
   - `<AddressModal />`
   - `<EducationModal />`
   - `<ExperienceModal />`
   - `<EmiratesIdModal />`
   - `<LabourCardModal />`
   - `<MedicalInsuranceModal />`
   - `<DrivingLicenseModal />`
   - `<DocumentModal />`
   - `<TrainingModal />`
   - `<ImageUploadModal />`
   - `<DocumentViewerModal />`

---

## 🔍 Summary

### What's Separated (Good):
✅ **UI Components** - Cards and tabs are in separate files
✅ **Modal Components** - Modals are in separate files
✅ **Helper Functions** - Some utilities are in `utils/helpers.js`

### What's Still in Main Page (The Problem):
❌ **ALL State Management** - 50+ useState hooks
❌ **ALL Handler Functions** - 100+ handler functions
❌ **ALL Validation Logic** - Validation functions for each form
❌ **ALL API Calls** - Data fetching and mutations
❌ **ALL Business Logic** - Form processing, calculations, etc.

---

## 💡 Why This Happened

This is a classic **"God Component"** anti-pattern where:
1. The main component handles everything
2. Even though UI is separated, logic is centralized
3. Each feature (passport, visa, bank, etc.) adds more state + handlers
4. The file grows linearly with each new feature

---

## 🎯 Potential Refactoring Opportunities

1. **Custom Hooks** - Extract state + handlers into hooks:
   - `usePassportForm()`
   - `useVisaForm()`
   - `useBankForm()`
   - `useSalaryForm()`
   - etc.

2. **Context API** - Create contexts for:
   - Employee data
   - Form states
   - Modal states

3. **Reducer Pattern** - Use `useReducer` for complex state management

4. **Separate Service Files** - Move API calls to service files

5. **Form Libraries** - Use React Hook Form or Formik to reduce boilerplate

---

## 📊 Statistics

- **Total Lines**: 7,178
- **State Variables**: ~50+
- **Handler Functions**: ~100+
- **Modals**: 18+
- **Forms**: 15+
- **API Endpoints**: 20+

---

*Generated: Analysis of Employee Profile Page Structure*



