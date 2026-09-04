import type {
  NodeDetailsOpenRequest as ContextsNodeDetailsOpenRequest,
  NodeDetailsView as ContextsNodeDetailsView,
} from "../contexts-entry";
import type {
  NodeDetailsOpenRequest as RootNodeDetailsOpenRequest,
  NodeDetailsView as RootNodeDetailsView,
} from "../index";
import type {
  NodeDetailsOpenRequest as TypesNodeDetailsOpenRequest,
  NodeDetailsView as TypesNodeDetailsView,
} from "../types";

type PublicRequest = ContextsNodeDetailsOpenRequest &
  RootNodeDetailsOpenRequest &
  TypesNodeDetailsOpenRequest;
type PublicView = ContextsNodeDetailsView &
  RootNodeDetailsView &
  TypesNodeDetailsView;

describe("public node-details contract", () => {
  it("is nameable through the contexts, root, and type entrypoints", () => {
    const view: PublicView = "analysis";
    const request: PublicRequest = {
      nodeId: "model.test.orders",
      view,
      requestToken: 1,
    };

    expect(request).toEqual({
      nodeId: "model.test.orders",
      view: "analysis",
      requestToken: 1,
    });
  });
});
