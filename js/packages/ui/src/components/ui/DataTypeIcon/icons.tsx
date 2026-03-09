import type { CSSProperties } from "react";
import { useId } from "react";

interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * All icons share a uniform viewBox (30x18) with a rounded-rect border.
 * Content (text or line-art) is drawn inside the box.
 * The box stroke and content fill/stroke all use currentColor.
 */
const VB_W = 30;
const VB_H = 18;
const BOX_RX = 3;
const BOX_STROKE = 1.2;
const BOX_INSET = 0.6; // half stroke so border sits inside viewBox

function BoxedSvg({
  size = 24,
  style,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={size}
      height={(size * VB_H) / VB_W}
      style={style}
      className={className}
      aria-hidden="true"
    >
      <rect
        x={BOX_INSET}
        y={BOX_INSET}
        width={VB_W - BOX_INSET * 2}
        height={VB_H - BOX_INSET * 2}
        rx={BOX_RX}
        fill="none"
        stroke="currentColor"
        strokeWidth={BOX_STROKE}
      />
      {children}
    </svg>
  );
}

function TextIcon({
  text,
  size,
  style,
  className,
}: IconProps & { text: string }) {
  return (
    <BoxedSvg size={size} style={style} className={className}>
      <text
        x={VB_W / 2}
        y={VB_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10.5}
        fontFamily="monospace"
        fontWeight={500}
        fill="currentColor"
      >
        {text}
      </text>
    </BoxedSvg>
  );
}

export function IntegerIcon(props: IconProps) {
  return <TextIcon text="123" {...props} />;
}

export function NumberIcon(props: IconProps) {
  return <TextIcon text="1.2" {...props} />;
}

export function TextTypeIcon(props: IconProps) {
  return <TextIcon text="abc" {...props} />;
}

export function BooleanIcon(props: IconProps) {
  return <TextIcon text="T/F" {...props} />;
}

/**
 * Two-tone split icon — left half filled with "0", right half with "1"
 */
export function BinaryIcon({ size, style, className }: IconProps) {
  const maskId = useId();
  const x = BOX_INSET;
  const y = BOX_INSET;
  const h = VB_H - BOX_INSET * 2;
  const mid = VB_W / 2;

  return (
    <BoxedSvg size={size} style={style} className={className}>
      <mask id={maskId}>
        <rect x={x} y={y} width={mid - x} height={h} fill="white" />
        <text
          x={mid / 2}
          y={VB_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontFamily="monospace"
          fontWeight={700}
          fill="black"
        >
          0
        </text>
      </mask>
      <path
        d={`M${mid} ${y} H${x + BOX_RX} Q${x} ${y} ${x} ${y + BOX_RX} V${y + h - BOX_RX} Q${x} ${y + h} ${x + BOX_RX} ${y + h} H${mid} Z`}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
      <text
        x={mid + (VB_W - mid) / 2}
        y={VB_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontFamily="monospace"
        fontWeight={700}
        fill="currentColor"
      >
        1
      </text>
    </BoxedSvg>
  );
}

export function JsonIcon(props: IconProps) {
  return <TextIcon text="{ }" {...props} />;
}

/**
 * Square brackets with "1,2" text — for ARRAY/LIST types
 */
export function ArrayIcon({ size, style, className }: IconProps) {
  return (
    <BoxedSvg size={size} style={style} className={className}>
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1.2}
        strokeLinecap="round"
      >
        {/* Left bracket */}
        <line x1={6} y1={5} x2={4} y2={5} />
        <line x1={4} y1={5} x2={4} y2={13} />
        <line x1={4} y1={13} x2={6} y2={13} />
        {/* Right bracket */}
        <line x1={24} y1={5} x2={26} y2={5} />
        <line x1={26} y1={5} x2={26} y2={13} />
        <line x1={26} y1={13} x2={24} y2={13} />
      </g>
      <text
        x={VB_W / 2}
        y={VB_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontFamily="monospace"
        fontWeight={500}
        fill="currentColor"
      >
        1,2
      </text>
    </BoxedSvg>
  );
}

export function UnknownIcon(props: IconProps) {
  return <TextIcon text="···" {...props} />;
}

/**
 * Calendar icon inside box — for DATE type
 */
export function DateIcon({ size, style, className }: IconProps) {
  return (
    <BoxedSvg size={size} style={style} className={className}>
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(9, 2.5)"
      >
        {/* Calendar body */}
        <rect x={0} y={2} width={11} height={9.5} rx={1.2} />
        {/* Top hooks */}
        <line x1={3} y1={0.5} x2={3} y2={3.5} />
        <line x1={8} y1={0.5} x2={8} y2={3.5} />
        {/* Divider */}
        <line x1={0} y1={5.5} x2={11} y2={5.5} />
      </g>
    </BoxedSvg>
  );
}

/**
 * Calendar + clock icon inside box — for DATETIME/TIMESTAMP types
 */
export function DatetimeIcon({ size, style, className }: IconProps) {
  return (
    <BoxedSvg size={size} style={style} className={className}>
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(4, 2.5)"
      >
        {/* Calendar (smaller, left) */}
        <rect x={0} y={2} width={9.5} height={8.5} rx={1.2} />
        <line x1={2.5} y1={0.5} x2={2.5} y2={3.5} />
        <line x1={7} y1={0.5} x2={7} y2={3.5} />
        <line x1={0} y1={5} x2={9.5} y2={5} />
        {/* Clock (small, right) */}
        <circle cx={17} cy={8.5} r={3.2} />
        <line x1={17} y1={6.8} x2={17} y2={8.5} />
        <line x1={17} y1={8.5} x2={18.3} y2={9.5} />
      </g>
    </BoxedSvg>
  );
}

/**
 * Clock icon inside box — for TIME type
 */
export function TimeIcon({ size, style, className }: IconProps) {
  return (
    <BoxedSvg size={size} style={style} className={className}>
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(10, 3.5)"
      >
        <circle cx={5} cy={5.5} r={5} />
        <line x1={5} y1={3} x2={5} y2={5.5} />
        <line x1={5} y1={5.5} x2={7} y2={6.8} />
      </g>
    </BoxedSvg>
  );
}

/**
 * Map pin (teardrop) icon inside box — for GEOGRAPHY/GEOMETRY types
 */
export function GeographyIcon({ size, style, className }: IconProps) {
  return (
    <BoxedSvg size={size} style={style} className={className}>
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M15 14.5 C15 14.5 10.5 11 10.5 8 A4.5 4.5 0 0 1 19.5 8 C19.5 11 15 14.5 15 14.5 Z"
          strokeWidth={1.2}
        />
        <circle cx={15} cy={8} r={1.5} fill="currentColor" stroke="none" />
      </g>
    </BoxedSvg>
  );
}
