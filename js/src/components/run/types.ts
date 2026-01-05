import { ViewOptionTypes } from "@/components/run/registry";
// Import Run from OSS types for proper discriminated union support
import type { Run } from "@/lib/api/types";

export interface RunFormProps<PT> {
  params: Partial<PT>;
  onParamsChanged: (params: Partial<PT>) => void;
  setIsReadyToExecute: (isReadyToExecute: boolean) => void;
}

export interface RunResultViewProps<VO = ViewOptionTypes> {
  run: Run;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
}
