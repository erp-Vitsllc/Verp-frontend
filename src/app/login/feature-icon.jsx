const iconMap = {
    settings: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6m-3.78 7.78l4.24-4.24m2.12-2.12l4.24-4.24"></path>
        </svg>
    ),
    building: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
            <line x1="9" y1="12" x2="9" y2="5"></line>
            <line x1="15" y1="12" x2="15" y2="5"></line>
        </svg>
    ),
    clipboard: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            <line x1="9" y1="14" x2="15" y2="14"></line>
            <line x1="9" y1="10" x2="15" y2="10"></line>
        </svg>
    ),
    users: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    ),
    shopping: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            <line x1="16" y1="5" x2="16" y2="17"></line>
            <line x1="20" y1="5" x2="20" y2="17"></line>
        </svg>
    ),
};

export default function FeatureIcon({ icon, color, position }) {
    return (
        <div
            className={`absolute ${position} w-24 h-24 ${color} rounded-3xl flex items-center justify-center text-white shadow-lg transform rotate-45 transition-transform hover:scale-105`}
        >
            <div className="transform -rotate-45">{iconMap[icon]}</div>
        </div>
    );
}
