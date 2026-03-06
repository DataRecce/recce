import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

function TextIcon({
  text,
  size = 24,
  style,
  className,
}: IconProps & { text: string }) {
  return (
    <svg
      viewBox="0 0 28 16"
      width={size}
      height={(size * 16) / 28}
      style={style}
      className={className}
      aria-hidden="true"
    >
      <text
        x={14}
        y={12.5}
        textAnchor="middle"
        fontSize={11}
        fontFamily="monospace"
        fontWeight={500}
        fill="currentColor"
      >
        {text}
      </text>
    </svg>
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

export function DateIcon({ size = 24, style, className }: IconProps) {
  const scale = size / 16;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      style={style}
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1.2 / scale || 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x={2} y={3} width={12} height={11} rx={1.5} />
        <line x1={5} y1={1.5} x2={5} y2={4.5} />
        <line x1={11} y1={1.5} x2={11} y2={4.5} />
        <line x1={2} y1={6.5} x2={14} y2={6.5} />
      </g>
    </svg>
  );
}

export function DatetimeIcon({ size = 24, style, className }: IconProps) {
  const scale = size / 20;
  return (
    <svg
      viewBox="0 0 20 16"
      width={size}
      height={(size * 16) / 20}
      style={style}
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1.2 / scale || 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x={1} y={3} width={10} height={9.5} rx={1.5} />
        <line x1={3.5} y1={1.5} x2={3.5} y2={4.5} />
        <line x1={8.5} y1={1.5} x2={8.5} y2={4.5} />
        <line x1={1} y1={6.5} x2={11} y2={6.5} />
        <circle cx={15} cy={10.5} r={3.5} />
        <line x1={15} y1={9} x2={15} y2={10.5} />
        <line x1={15} y1={10.5} x2={16.5} y2={11.5} />
      </g>
    </svg>
  );
}

export function TimeIcon({ size = 24, style, className }: IconProps) {
  const scale = size / 16;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      style={style}
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        fill="none"
        strokeWidth={1.2 / scale || 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx={8} cy={8} r={6} />
        <line x1={8} y1={4.5} x2={8} y2={8} />
        <line x1={8} y1={8} x2={10.5} y2={9.5} />
      </g>
    </svg>
  );
}
