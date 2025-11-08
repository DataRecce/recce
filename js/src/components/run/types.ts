import { Run } from "@/lib/api/types";
import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { QueryDiffViewOptions, QueryViewOptions } from "@/lib/api/adhocQuery";
import { ProfileDiffViewOptions } from "@/lib/api/profile";
import { ValueDiffDetailViewOptions } from "@/lib/api/valuediff";
import { DiffViewOptions } from "@/components/run/RunToolbar";

export interface RunFormProps<PT> {
  params: Partial<PT>;
  onParamsChanged: (params: Partial<PT>) => void;
  setIsReadyToExecute: (isReadyToExecute: boolean) => void;
}

export type ViewOptionTypes =
  | LineageDiffViewOptions
  | DiffViewOptions
  | QueryViewOptions
  | QueryDiffViewOptions
  | ProfileDiffViewOptions
  | ValueDiffDetailViewOptions;

export interface RunResultViewProps<VO = ViewOptionTypes> {
  run: Run;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
}
