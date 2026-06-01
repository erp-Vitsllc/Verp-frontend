/** Always render company detail by id/code (e.g. EST-006) — no static path list. */
export const dynamic = 'force-dynamic';

export default function CompanyDetailLayout({ children }) {
    return children;
}
