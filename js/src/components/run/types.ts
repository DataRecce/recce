import { Run } from "@/lib/api/types";

export interface RunEditViewProps<PT> {
  params: PT;
  onParamsChanged: (params: PT) => void;
}

export interface RunResultViewProps<PT, RT, VO = any> {
  run: Run<PT, RT>;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
}
