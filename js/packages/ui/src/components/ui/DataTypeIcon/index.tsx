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
  IntegerIcon,
  JsonIcon,
  NumberIcon,
  TextTypeIcon,
  TimeIcon,
  UnknownIcon,
} from "./icons";

export { classifyType };
export type { TypeCategory };

const ICON_MAP: Record<
  TypeCategory,
  React.ComponentType<{
    size?: number;
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
  unknown: UnknownIcon,
};

interface DataTypeIconProps {
  type: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export function DataTypeIcon({
  type,
  size = 24,
  style,
  className,
}: DataTypeIconProps) {
  const category = classifyType(type);
  const IconComponent = ICON_MAP[category];

  return (
    <Tooltip title={type} placement="top" arrow>
      <span
        data-testid="data-type-icon"
        style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}
      >
        <IconComponent size={size} style={style} className={className} />
      </span>
    </Tooltip>
  );
}
