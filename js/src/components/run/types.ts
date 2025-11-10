import { Run } from "@/lib/api/types";
import { ViewOptionTypes } from "@/components/run/registry";

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
