import { ProfileDiffParams } from "@/lib/api/profile";
import { RunEditViewProps } from "../run/RunModal";

interface ProfileDiffEditViewProp extends RunEditViewProps<ProfileDiffParams> {}

export function ProfileDiffEditView({
  params,
  onParamsChanged,
}: ProfileDiffEditViewProp) {
  return <></>;
}
