'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('light');
    const [mounted, setMounted] = useState<boolean>(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('theme') as Theme | null;
            if (saved === 'dark' || saved === 'light') {
                setThemeState(saved);
                applyTheme(saved);
            } else {
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const initial = systemPrefersDark ? 'dark' : 'light';
                setThemeState(initial);
                applyTheme(initial);
            }
        } catch {
            // fallback
        }
        setMounted(true);
    }, []);

    const applyTheme = (t: Theme) => {
        const root = document.documentElement;
        if (t === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    };

    const setTheme = (nextTheme: Theme) => {
        setThemeState(nextTheme);
        try {
            localStorage.setItem('theme', nextTheme);
        } catch {
            // fallback
        }
        applyTheme(nextTheme);
    };

    const toggleTheme = () => {
        const nextTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(nextTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        // Fallback dummy for safe rendering before provider mounts
        return {
            theme: 'light' as Theme,
            toggleTheme: () => {},
            setTheme: () => {},
        };
    }
    return context;
}
