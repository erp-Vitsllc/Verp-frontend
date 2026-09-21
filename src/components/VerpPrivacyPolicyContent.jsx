const LAST_UPDATED = 'September 21, 2026';

const collectedItems = [
    'Employee name',
    'Employee ID',
    'Email address and/or phone number, if used',
    'Profile information',
    'Attendance and check-in/check-out records',
    'GPS/location data used during attendance check-in/check-out',
    'Camera, selfie, or employee photo used for identity or attendance verification',
    'Device information and device identifiers where required for secure login or device verification',
    'Leave, task, HR, payroll-related, asset, vehicle, utility, or other employee workplace information where those features are used',
    'Uploaded documents, photos, or files where users use those features',
];

const useItems = [
    'User authentication',
    'Employee attendance processing',
    'Location verification',
    'Employee identity verification',
    'HR and workplace management',
    'Displaying employee account, attendance, task, asset, and related information',
    'Security and fraud prevention',
    'Application support and troubleshooting',
];

function Section({ title, children }) {
    return (
        <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800 md:text-2xl">{title}</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-gray-600 md:text-base">
                {children}
            </div>
        </section>
    );
}

export default function VerpPrivacyPolicyContent() {
    return (
        <article>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800 md:text-4xl">
                VERP Employee Portal Privacy Policy
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-600 md:text-lg">
                VERP Employee Portal is an employee HR, attendance, and workplace
                management application provided by VEGA DIGITAL IT SOLUTIONS LLC.
                This policy explains how we collect, use, store, and protect
                information when you use the application.
            </p>

            <div className="mt-10 space-y-9">
                <Section title="Introduction">
                    <p>
                        This Privacy Policy describes how VERP Employee Portal collects,
                        uses, stores, and protects user information. It applies to
                        authorized employees and other authorized users of the
                        application. By using VERP Employee Portal, you acknowledge that
                        information is processed as described in this policy and as
                        required for employment, HR, and workplace operations.
                    </p>
                </Section>

                <Section title="Information We Collect">
                    <p>
                        Depending on the features your organization uses, VERP Employee
                        Portal may collect the following categories of information:
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        {collectedItems.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </Section>

                <Section title="How We Use Information">
                    <p>We use the information described above to provide and operate the application, including:</p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        {useItems.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </Section>

                <Section title="Location Information">
                    <p>
                        Location data may be collected when an employee uses attendance,
                        check-in, or check-out features. Location is used for attendance
                        verification and workplace-related records. Location is not
                        collected for advertising purposes.
                    </p>
                </Section>

                <Section title="Camera and Photos">
                    <p>
                        Camera or photo access may be used for employee identity
                        verification, attendance selfies, profile photos, or supporting
                        documents where those features are enabled. Photos and images
                        submitted through the application are processed for those
                        workplace purposes.
                    </p>
                </Section>

                <Section title="Data Sharing">
                    <p>
                        Personal information is not sold to advertisers. Information may
                        be processed by authorized service providers, hosting providers,
                        or technical infrastructure providers only as necessary to
                        operate the service. Information may also be disclosed where
                        required by applicable law.
                    </p>
                </Section>

                <Section title="Data Storage and Security">
                    <p>
                        VEGA DIGITAL IT SOLUTIONS LLC uses reasonable administrative,
                        technical, and organizational safeguards to protect employee
                        data. This includes secure authentication and restricted access
                        where applicable. No method of transmission or storage is
                        completely secure, and we work to protect information using
                        appropriate measures for this type of workplace application.
                    </p>
                </Section>

                <Section title="Data Retention">
                    <p>
                        Information is retained only as long as required for employment,
                        HR, operational, legal, contractual, or legitimate business
                        purposes. Retention periods may also follow your employer’s
                        record-keeping requirements.
                    </p>
                </Section>

                <Section title="User Rights and Data Requests">
                    <p>
                        Users may contact VEGA DIGITAL IT SOLUTIONS LLC to request
                        access, correction, or deletion of their personal information,
                        subject to applicable employment, legal, and record-retention
                        requirements. Some records may need to be kept for employment,
                        payroll, audit, or legal reasons even if a deletion request is
                        made.
                    </p>
                </Section>

                <Section title="Children’s Privacy">
                    <p>
                        VERP Employee Portal is intended for authorized employees and
                        authorized users. It is not designed for children, and it is not
                        directed at children.
                    </p>
                </Section>

                <Section title="Third-Party Services">
                    <p>
                        The application may use hosting, cloud infrastructure,
                        notification, analytics, or other technical service providers
                        where required to provide the application. These providers
                        process information only as needed to operate, host, support, or
                        secure the service.
                    </p>
                </Section>

                <Section title="Changes to This Privacy Policy">
                    <p>
                        This policy may be updated from time to time. The latest version
                        will always be available on this webpage. The “Last Updated”
                        date at the bottom of this page shows when the policy was most
                        recently revised.
                    </p>
                </Section>

                <Section title="Contact Us">
                    <p>If you have questions about this Privacy Policy or about your information, contact:</p>
                    <ul className="space-y-1.5">
                        <li>
                            <span className="font-medium text-gray-800">Company:</span>{' '}
                            VEGA DIGITAL IT SOLUTIONS LLC
                        </li>
                        <li>
                            <span className="font-medium text-gray-800">Website:</span>{' '}
                            <a
                                href="https://www.vegadigital.ae"
                                className="text-blue-600 hover:underline"
                            >
                                www.vegadigital.ae
                            </a>
                        </li>
                        <li>
                            <span className="font-medium text-gray-800">Email:</span>{' '}
                            <a
                                href="mailto:VeRP@vitsllc.com"
                                className="text-blue-600 hover:underline"
                            >
                                VeRP@vitsllc.com
                            </a>
                        </li>
                        <li>
                            <span className="font-medium text-gray-800">Phone:</span>{' '}
                            <a
                                href="tel:+971555907064"
                                className="text-blue-600 hover:underline"
                            >
                                +971 55 590 7064
                            </a>
                        </li>
                        <li>
                            <span className="font-medium text-gray-800">Location:</span>{' '}
                            Dubai, United Arab Emirates
                        </li>
                    </ul>
                </Section>
            </div>

            <p className="mt-8 text-sm text-gray-500">
                Last Updated: {LAST_UPDATED}
            </p>
        </article>
    );
}
