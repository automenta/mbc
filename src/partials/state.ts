import Bowser from "bowser";
import { derived, get, writable } from "svelte/store";
import { fromPairs } from "@welshman/lib";
import { synced } from "@welshman/store";
import { parseHex } from "src/util/html";

// Browser detection
export const browser = Bowser.parse(window.navigator.userAgent);

// Constants
export const appName = import.meta.env.VITE_APP_NAME;

// PWA Install Prompt
export const installPrompt = writable(null);

export const installAsPWA = async () => {
  const prompt = get(installPrompt);
  if (!prompt) return;

  await prompt.prompt();
  //const { outcome } = await prompt.userChoice;
  installPrompt.set(null);
};

// Themes
const parseTheme = (raw: string): Record<string, string> =>
  fromPairs(raw.split(",").map((x) => x.split(":")));

const DARK_THEME = parseTheme(import.meta.env.VITE_DARK_THEME);
const LIGHT_THEME = parseTheme(import.meta.env.VITE_LIGHT_THEME);

export const theme = synced<"dark" | "light">("ui/theme", "dark");

theme.subscribe((value) => {
  document.documentElement.classList.toggle("dark", value === "dark");
});

export const toggleTheme = () => theme.update((t) => (t === "dark" ? "light" : "dark"));

export const themeColors = derived(theme, ($theme) =>
  fromPairs(
    Object.entries($theme === "dark" ? DARK_THEME : LIGHT_THEME).flatMap(([key, value]) => [
      [key, value],
      [`${key}-l`, adjustBrightness(value, 10)],
      [`${key}-d`, adjustBrightness(value, -10)],
    ]),
  ),
);

export const themeVariables = derived(themeColors, ($colors) =>
  Object.entries($colors)
    .map(([key, value]) => `--${key}: ${value};`)
    .join("\n"),
);

export const themeBackgroundGradient = derived(themeColors, ($colors) => {
  const color = parseHex($colors["neutral-800"]);
  return {
    rgba: `rgba(${color.join(", ")}, 0.5)`,
    rgb: `rgb(${color.join(", ")})`,
  };
});

// Utility Functions
function adjustBrightness(hexColor: string, brightnessPercent: number): string {
  const hex = hexColor.replace("#", "");
  const rgb = {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };

  const adjust = brightnessPercent / 100;
  const clamp = (value: number) => Math.max(0, Math.min(255, value));

  const adjusted = {
    r: clamp(Math.round(rgb.r + rgb.r * adjust)),
    g: clamp(Math.round(rgb.g + rgb.g * adjust)),
    b: clamp(Math.round(rgb.b + rgb.b * adjust)),
  };

  return `#${adjusted.r.toString(16).padStart(2, "0")}${adjusted.g
    .toString(16)
    .padStart(2, "0")}${adjusted.b.toString(16).padStart(2, "0")}`;
}