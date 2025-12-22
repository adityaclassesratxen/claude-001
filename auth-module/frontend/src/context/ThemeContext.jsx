import React, { createContext, useContext, useState, useEffect } from 'react';
import { colorThemes, getTheme } from '../styles/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [colorTheme, setColorTheme] = useState(
    localStorage.getItem('colorTheme') || 'blue'
  );
  const [mode, setMode] = useState(
    localStorage.getItem('themeMode') || 'light'
  );

  const currentTheme = getTheme(colorTheme, mode);

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(currentTheme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    localStorage.setItem('colorTheme', colorTheme);
    localStorage.setItem('themeMode', mode);
  }, [colorTheme, mode, currentTheme]);

  const toggleMode = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const changeColorTheme = (newTheme) => {
    setColorTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{
      colorTheme,
      mode,
      currentTheme,
      toggleMode,
      changeColorTheme,
      availableThemes: Object.keys(colorThemes)
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export default ThemeContext;
import React, { createContext, useState, useContext } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
