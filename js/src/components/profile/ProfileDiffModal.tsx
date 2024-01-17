import { LineageGraphNode } from "../lineage/lineage";

import { RunModal } from "../run/RunModal";
import { ProfileDiffEditView } from "./ProfileDiffEditView";
import { ProfileDiffResultView } from "./ProfileDiffResultView";

interface ProfileDiffModalProp {
  node: LineageGraphNode;
}

export const ProfileDiffModal = ({ node }: ProfileDiffModalProp) => {
  return (
    <RunModal
      title="Profile Diff"
      type="profile_diff"
      params={{ model: node.name }}
      RunResultView={ProfileDiffResultView}
    ></RunModal>
  );
};
