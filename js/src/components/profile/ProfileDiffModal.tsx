import { LineageGraphNode } from "../lineage/lineage";

import { RunModal } from "../run/RunModal";
import { ProfileDiffEditView } from "./ProfileDiffEditView";
import { ProfileDiffResultView } from "./ProfileDiffResultView";

interface ProfileDiffModalProp {
  node: LineageGraphNode;
  triggerComponentType?: string;
}

export const ProfileDiffModal = ({ node , triggerComponentType }: ProfileDiffModalProp) => {
  return (
    <RunModal
      title="Profile Diff"
      triggerComponentType={triggerComponentType}
      type="profile_diff"
      params={{ model: node.name }}
      RunResultView={ProfileDiffResultView}
    />
  );
};
