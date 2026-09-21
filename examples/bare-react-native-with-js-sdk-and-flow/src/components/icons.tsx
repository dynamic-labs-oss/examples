/**
 * Small glyph icons shared across the header (back chevron) and the flow
 * status screen (FlowStatusView.tsx) — two filled step-state glyphs
 * (check/alert) plus the back chevron. All paths use `currentColor` via the
 * `color` prop so callers can theme them with existing theme.ts tokens
 * instead of hardcoding hex here.
 */
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = {
  size?: number;
  color: string;
};

/**
 * Filled circle + white checkmark — a "this step is done" glyph for
 * FlowStatusScreen's step list. Unlike the outline icons above, `color`
 * fills the circle rather than strokes a path, since the glyph inside is
 * always white for contrast regardless of what's underneath.
 */
export function CheckCircleIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={12} fill={color} />
      <Path
        d="M7 12.5l3 3 7-7"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Filled circle + white exclamation mark — a "this step failed" glyph. */
export function AlertCircleIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={12} fill={color} />
      <Path
        d="M12 7v6"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16.5} r={1.15} fill="#FFFFFF" />
    </Svg>
  );
}

/** Back-navigation chevron - Header.tsx's back button, in place of relying
 * on native-stack's own header (this app renders its own Header per screen
 * instead, for full control over the full-bleed redesign's look). */
export function ChevronLeftIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6l-6 6 6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
