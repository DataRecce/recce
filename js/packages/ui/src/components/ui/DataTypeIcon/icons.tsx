import type { CSSProperties } from "react";

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

export function BinaryIcon(props: IconProps) {
  return <TextIcon text="01" {...props} />;
}

export function JsonIcon(props: IconProps) {
  return <TextIcon text="{ }" {...props} />;
}

export function ArrayIcon(props: IconProps) {
  return <TextIcon text="[,]" {...props} />;
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
