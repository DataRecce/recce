import Tooltip from "@mui/material/Tooltip";
import type { CSSProperties } from "react";
import type { TypeCategory } from "./classifyType";
import { classifyType } from "./classifyType";
import {
  ArrayIcon,
  BinaryIcon,
  BooleanIcon,
  DateIcon,
  DatetimeIcon,
  GeographyIcon,
  IntegerIcon,
  JsonIcon,
  NumberIcon,
  TextTypeIcon,
  TimeIcon,
  UnknownIcon,
} from "./icons";

export { classifyType };
export type { TypeCategory };
export type { ColumnTooltipInput } from "./tooltipText";
export { buildColumnTooltip } from "./tooltipText";

const ICON_MAP: Record<
  TypeCategory,
  React.ComponentType<{
    size?: number | string;
    style?: CSSProperties;
    className?: string;
  }>
> = {
  integer: IntegerIcon,
  number: NumberIcon,
  text: TextTypeIcon,
  boolean: BooleanIcon,
  date: DateIcon,
  datetime: DatetimeIcon,
  time: TimeIcon,
  binary: BinaryIcon,
  json: JsonIcon,
  array: ArrayIcon,
  geography: GeographyIcon,
  unknown: UnknownIcon,
};

export interface DataTypeIconProps {
  type: string;
  size?: number | string;
  style?: CSSProperties;
  className?: string;
  disableTooltip?: boolean;
}

export function DataTypeIcon({
  type,
  size,
  style,
  className,
  disableTooltip,
}: DataTypeIconProps) {
  const category = classifyType(type);
  const IconComponent = ICON_MAP[category];

  const icon = (
    <span
      data-testid="data-type-icon"
      style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}
    >
      <IconComponent size={size} style={style} className={className} />
    </span>
  );

  if (disableTooltip) {
    return icon;
  }

  return (
    <Tooltip title={type} placement="top" arrow>
      {icon}
    </Tooltip>
  );
}
