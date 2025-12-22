import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Palette } from "lucide-react";
import styled from "styled-components";

const ThemeSelector = () => {
  const {
    colorTheme,
    mode,
    toggleMode,
    changeColorTheme,
    availableThemes,
    currentTheme,
  } = useTheme();
  const [showPalette, setShowPalette] = useState(false);

  const themeColors = {
    blue: "#2563eb",
    purple: "#7c3aed",
    green: "#059669",
    teal: "#0d9488",
  };

  return (
    <SelectorContainer>
      <ThemeButton
        onClick={toggleMode}
        title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
      >
        {mode === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </ThemeButton>

      <ThemeButton
        onClick={() => setShowPalette(!showPalette)}
        title="Change color theme"
      >
        <Palette size={20} />
      </ThemeButton>

      {showPalette && (
        <PaletteDropdown>
          <DropdownTitle>Choose Theme</DropdownTitle>
          {availableThemes.map((theme) => (
            <ColorOption
              key={theme}
              onClick={() => {
                changeColorTheme(theme);
                setShowPalette(false);
              }}
              $isActive={colorTheme === theme}
              $color={themeColors[theme]}
            >
              <ColorCircle $color={themeColors[theme]} />
              <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              {colorTheme === theme && <CheckMark>✓</CheckMark>}
            </ColorOption>
          ))}
        </PaletteDropdown>
      )}
    </SelectorContainer>
  );
};

const SelectorContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 1000;
`;

const ThemeButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const PaletteDropdown = styled.div`
  position: absolute;
  top: 50px;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 12px;
  min-width: 200px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.2s ease;

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const DropdownTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--color-textSecondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ColorOption = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${(props) =>
    props.$isActive ? "var(--color-primary)" : "transparent"};
  color: ${(props) => (props.$isActive ? "white" : "var(--color-text)")};

  &:hover {
    background: ${(props) =>
      props.$isActive ? "var(--color-primary)" : "var(--color-background)"};
  }

  span {
    flex: 1;
    font-weight: ${(props) => (props.$isActive ? "600" : "400")};
  }
`;

const ColorCircle = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${(props) => props.$color};
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const CheckMark = styled.span`
  font-weight: bold;
  font-size: 16px;
`;

export default ThemeSelector;
