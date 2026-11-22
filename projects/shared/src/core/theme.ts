import { environment } from '../environments/environment';
import { PublicSiteSettings } from './models';

// Fonts the dashboard offers (all free Google Fonts, plus the system font)
export const FONT_OPTIONS: { value: string; label: string; arabic: boolean }[] = [
  { value: 'system', label: 'System (Segoe UI)', arabic: true },
  { value: 'Readex Pro', label: 'Readex Pro (Arabic + English)', arabic: true },
  { value: 'Rubik', label: 'Rubik (Arabic + English)', arabic: true },
  { value: 'Alexandria', label: 'Alexandria (Arabic + English)', arabic: true },
  { value: 'Noto Kufi Arabic', label: 'Noto Kufi Arabic', arabic: true },
  { value: 'Cairo', label: 'Cairo', arabic: true },
  { value: 'Tajawal', label: 'Tajawal', arabic: true },
  { value: 'Almarai', label: 'Almarai', arabic: true },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic', arabic: true },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic', arabic: true },
  { value: 'El Messiri', label: 'El Messiri', arabic: true },
  { value: 'Amiri', label: 'Amiri (serif)', arabic: true },
  { value: 'Inter', label: 'Inter', arabic: false },
  { value: 'Poppins', label: 'Poppins', arabic: false },
  { value: 'Roboto', label: 'Roboto', arabic: false },
  { value: 'Montserrat', label: 'Montserrat', arabic: false },
  { value: 'Open Sans', label: 'Open Sans', arabic: false },
  { value: 'Lato', label: 'Lato', arabic: false },
  { value: 'Playfair Display', label: 'Playfair Display (serif)', arabic: false },
];

export interface ThemePreset {
  id: string;
  label: string;
  primaryColor: string;
  darkColor: string;
  backgroundColor: string;
  textColor: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'orange', label: 'Electric Orange', primaryColor: '#ea580c', darkColor: '#1c1917', backgroundColor: '#fafaf9', textColor: '#1c1917' },
  { id: 'blue', label: 'Ocean Blue', primaryColor: '#2563eb', darkColor: '#0f172a', backgroundColor: '#f8fafc', textColor: '#0f172a' },
  { id: 'green', label: 'Fresh Green', primaryColor: '#16a34a', darkColor: '#14281d', backgroundColor: '#f6faf7', textColor: '#14281d' },
  { id: 'teal', label: 'Teal', primaryColor: '#0d9488', darkColor: '#10252a', backgroundColor: '#f5fafa', textColor: '#10252a' },
  { id: 'purple', label: 'Royal Purple', primaryColor: '#7c3aed', darkColor: '#1e1033', backgroundColor: '#faf8ff', textColor: '#1e1033' },
  { id: 'red', label: 'Bold Red', primaryColor: '#dc2626', darkColor: '#1f1111', backgroundColor: '#fdf9f9', textColor: '#1f1111' },
];

const SYSTEM_STACK = '"Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif';

// The font used when the dashboard says "System": the website sets its own (one family that draws Arabic and English)
let defaultFont = 'system';

export function setDefaultFont(name: string): void {
  defaultFont = name || 'system';
}

function resolveFont(name: string): string {
  return !name || name === 'system' ? defaultFont : name;
}

export function fontStack(name: string): string {
  const font = resolveFont(name);

  return font === 'system' ? SYSTEM_STACK : `"${font}", ${SYSTEM_STACK}`;
}

function parse(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '000000';

  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Mixes `a` with `b` (amount = share of b, 0..1) and returns "#rrggbb"
export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const part = (x: number, y: number) => Math.round(x + (y - x) * amount).toString(16).padStart(2, '0');

  return `#${part(r1, r2)}${part(g1, g2)}${part(b1, b2)}`;
}

export function loadFonts(names: string[], id = 'voltara-fonts'): void {
  const families = [...new Set(names.map(resolveFont).filter((n) => n && n !== 'system'))];
  let link = document.getElementById(id) as HTMLLinkElement | null;

  if (families.length === 0) {
    link?.remove();
    return;
  }

  const query = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700`).join('&');
  const href = `https://fonts.googleapis.com/css2?${query}&display=swap`;

  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  if (link.href !== href) link.href = href;
}

function hueOf(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  if (d === 0) return 0;

  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;

  return (h * 60 + 360) % 360;
}

// The built-in illustrations are drawn in orange; they are turned to the chosen main color
const ILLUSTRATION_BASE_HUE = hueOf('#ea580c');

// Pushes the dashboard's theme settings into CSS variables (the whole stylesheet uses them)
const THEME_CACHE_KEY = 'voltara.theme';

// Called before the app starts: paints the last known theme at once (the API answer arrives later),
// so a reload never shows the built-in colors for a moment.
export function restoreCachedTheme(): void {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);

    if (raw) applyTheme(JSON.parse(raw) as PublicSiteSettings, false, false);
  } catch {
    // no cache (private mode, bad data): the CSS defaults are used
  }
}

export function applyTheme(s: PublicSiteSettings, favicon = true, remember = true): void {
  const root = document.documentElement.style;

  if (remember) {
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(s));
    } catch {
      // storage full / blocked: not critical
    }
  }

  root.setProperty('--primary', s.primaryColor);
  root.setProperty('--primary-dark', mix(s.primaryColor, '#000000', 0.2));
  root.setProperty('--primary-soft', mix(s.primaryColor, '#ffffff', 0.88));
  root.setProperty('--primary-glow', mix(s.primaryColor, '#ffffff', 0.55));
  root.setProperty('--dark', s.darkColor);
  // Secondary: soft surfaces and borders. Accent: offers, tags, highlights. (An old cached theme has none: the defaults are used.)
  const secondary = s.secondaryColor || '#64748b';
  root.setProperty('--secondary', secondary);
  root.setProperty('--accent', s.accentColor || '#f59e0b');

  // "Request a quote" and "Shop now" buttons are switched on / off from the dashboard (they carry the classes quote-btn / shopnow-btn)

  // The text on a colored surface: white or dark, whichever is readable (a light accent cannot carry white text)
  const on = (hex: string): string => (relativeLuminance(hex) > 0.4 ? '#1c1917' : '#ffffff');
  root.setProperty('--on-primary', on(s.primaryColor));
  // The highlight ON DARK surfaces (the black header, dark bars): the main colour when it can be seen there, else the offer colour, else white.
  // (With a black main colour a black hover would simply disappear.)
  const seen = (hex: string): boolean => /^#[0-9a-fA-F]{6}$/.test(hex) && relativeLuminance(hex) > 0.12;
  const hl = seen(s.primaryColor) ? s.primaryColor : seen(s.accentColor || '') ? (s.accentColor as string) : '#ffffff';
  root.setProperty('--hl', hl);
  root.setProperty('--on-hl', on(hl));
  root.setProperty('--on-accent', on(s.accentColor || '#f59e0b'));
  // The color of offers and discounts (badges, the offers section): the accent of the theme
  root.setProperty('--offer', s.accentColor || '#dc2626');
  root.setProperty('--on-offer', on(s.accentColor || '#dc2626'));
  root.setProperty('--dark-2', mix(s.darkColor, '#ffffff', 0.1));
  root.setProperty('--bg', s.backgroundColor);
  root.setProperty('--alt', s.secondaryColor ? mix(s.backgroundColor, secondary, 0.14) : mix(s.backgroundColor, '#000000', 0.035));
  root.setProperty('--border', s.secondaryColor ? mix(s.backgroundColor, secondary, 0.35) : mix(s.backgroundColor, '#000000', 0.1));
  root.setProperty('--text', s.textColor);
  root.setProperty('--muted', mix(s.textColor, s.backgroundColor, 0.55));
  root.setProperty('--radius', `${s.borderRadius}px`);
  root.setProperty('--radius-sm', `${Math.round(s.borderRadius * 0.7)}px`);
  root.setProperty('--hero-overlay', String(Math.min(100, Math.max(0, s.heroOverlay)) / 100));
  root.setProperty('--illus-hue', `${Math.round(hueOf(s.primaryColor) - ILLUSTRATION_BASE_HUE)}deg`);
  root.setProperty('--font-heading', fontStack(s.headingFont));
  root.setProperty('--font-body', fontStack(s.bodyFont));

  loadFonts([s.headingFont, s.bodyFont]);

  // Base font size and the "motion" switch
  root.setProperty('--font-scale', String((s.fontScale || 100) / 100));
  document.documentElement.style.fontSize = `${(16 * (s.fontScale || 100)) / 100}px`;
  document.documentElement.classList.toggle('no-anim', !s.enableAnimations);

  if (favicon) setFavicon(s.faviconUrl);
}

// "/uploads/x.png" is served by the API, so it needs the API address in front of it
function absoluteUrl(url: string): string {
  return /^(https?:|data:)/i.test(url) ? url : `${environment.apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function setFavicon(url: string | null | undefined): void {
  if (!url) return;

  // Replace the <link> (changing href of an existing one is ignored by some browsers)
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((l) => l.remove());

  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = absoluteUrl(url) + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
  document.head.appendChild(link);
}

// WCAG relative luminance of a #rrggbb color
function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;

    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
