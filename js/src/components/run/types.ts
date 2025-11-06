import { Run } from "@/lib/api/types";

export interface RunFormProps<PT> {
  params: Partial<PT>;
  onParamsChanged: (params: Partial<PT>) => void;
  setIsReadyToExecute: (isReadyToExecute: boolean) => void;
}

export interface RunResultViewProps<VO = unknown> {
  run: Run;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
}
