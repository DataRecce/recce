import { Run } from "@/lib/api/types";

export interface RunFormProps<PT> {
  params: PT;
  onParamsChanged: (params: PT) => void;
  setIsReadyToExecute: (isReadyToExecute: boolean) => void;
}

export interface RunResultViewProps<PT, RT, VO = any> {
  run: Run<PT, RT>;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
}
