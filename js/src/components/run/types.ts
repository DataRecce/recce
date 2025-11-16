import { ViewOptionTypes } from "@/components/run/registry";
import { Run } from "@/lib/api/types";

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
