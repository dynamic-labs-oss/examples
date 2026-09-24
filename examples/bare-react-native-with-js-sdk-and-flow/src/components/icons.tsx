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

/**
 * Chain marks for the chain picker, in each chain's own brand colour rather
 * than `currentColor` — a wallet picker that greyed them out would lose the
 * only thing that makes a chain recognisable at a glance.
 */
export function EthereumIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={12} fill="#627EEA" />
      <Path d="M12 4v5.9l5 2.2L12 4z" fill="#FFFFFF" fillOpacity={0.6} />
      <Path d="M12 4L7 12.1l5-2.2V4z" fill="#FFFFFF" />
      <Path d="M12 16.1V20l5-6.9-5 3z" fill="#FFFFFF" fillOpacity={0.6} />
      <Path d="M12 20v-3.9l-5-3L12 20z" fill="#FFFFFF" />
      <Path d="M12 15.2l5-3-5-2.2v5.2z" fill="#FFFFFF" fillOpacity={0.2} />
      <Path d="M7 12.2l5 3V10l-5 2.2z" fill="#FFFFFF" fillOpacity={0.6} />
    </Svg>
  );
}

export function SolanaIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={12} fill="#000000" />
      <Path d="M8.1 7.4h11.2l-2.9 2.9H5.2l2.9-2.9z" fill="#9945FF" />
      <Path d="M5.2 13.7h11.2l2.9 2.9H8.1l-2.9-2.9z" fill="#14F195" />
      <Path d="M8.1 10.6h11.2l-2.9 2.8H5.2l2.9-2.8z" fill="#19D3F3" />
    </Svg>
  );
}

/** Magnifier for the wallet picker's search field. */
export function SearchIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={10.5}
        cy={10.5}
        r={7}
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M15.8 15.8L21 21"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
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
