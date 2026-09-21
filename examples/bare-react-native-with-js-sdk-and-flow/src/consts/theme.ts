/**
 * Colors/spacing lifted from flow.dynamic.dev's marketing pages (its
 * `--brand-*` CSS custom properties and DM Sans typography) so this demo's
 * UI reads as visually related to Dynamic's own Flow demo site.
 *
 * Caveat: flow.dynamic.dev's actual wallet-connect/quote/status widget is
 * rendered client-side after the page hydrates, so its exact screens
 * weren't inspectable — this is a best-effort approximation built from the
 * site's marketing-page CSS and layout, not a pixel-exact clone. We also use
 * the system sans-serif font rather than DM Sans itself: bare React Native
 * needs the font file linked as a native asset to use a custom font, which
 * felt like unnecessary weight for a demo app.
 */
export const colors = {
  pageBackground: '#F4F5F7',
  surface: '#FFFFFF',
  foreground: '#0E121B',
  foregroundSecondary: '#525866',
  muted: '#99A0AE',
  border: '#E1E4EA',
  divider: '#F2F3F5',
  accent: '#4779FF',
  accentHover: '#2F61E8',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  onAccent: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/**
 * Font sizes/weights, extracted from what was already inlined per-component
 * across the pre-redesign widgets rather than invented from scratch —
 * existing screens migrating to these tokens should be a like-for-like swap,
 * not a visual change. Precedents: `title` is the old App.tsx title
 * (28/700), `label` is the form-label size used across Deposit/Withdraw
 * (13/600).
 */
export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  headline: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyMedium: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

/**
 * iOS shadow + Android elevation for surfaces that need to visually lift off
 * pageBackground on the new full-bleed screens (e.g. a card floating over the
 * page rather than being the entire page, as it was pre-redesign). RN doesn't
 * unify the two platforms' shadow APIs, so each tier bundles both sets of
 * properties — spread the whole tier into a style object on either platform.
 */
export const shadows = {
  sm: {
    shadowColor: '#0E121B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0E121B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0E121B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
