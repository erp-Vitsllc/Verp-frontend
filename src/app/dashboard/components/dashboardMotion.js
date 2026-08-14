export const DASH_EASE = [0.22, 1, 0.36, 1];

export const dashboardStagger = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.09,
            delayChildren: 0.05,
        },
    },
};

export const dashboardGrid = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.1,
        },
    },
};

export const dashboardItem = {
    hidden: { opacity: 0, y: 22 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.55, ease: DASH_EASE },
    },
};

export const dashboardHover = {
    y: -4,
    transition: { duration: 0.28, ease: DASH_EASE },
};
