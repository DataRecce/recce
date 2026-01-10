# Adapter Patterns

This document describes adapter patterns used in the @datarecce/ui library architecture to separate presentation concerns from integration/application concerns.

---

## Lineage Components

The lineage visualization follows the adapter pattern, separating presentation from integration.

### Architecture

```
@datarecce/ui (Presentation)          OSS (Integration)
─────────────────────────────         ─────────────────────
LineageNode                    <───   GraphNode.tsx
  - Accepts props                       - Reads LineageViewContext
  - Pure rendering                      - Computes derived state
  - No context deps                     - Passes props to LineageNode

LineageColumnNode              <───   GraphColumnNode.tsx
LineageEdge                    <───   GraphEdge.tsx
```

### Why This Pattern?

1. **Library stays context-free:** @datarecce/ui components don't depend on React context
2. **OSS handles integration:** Context reading, state management, event handling
3. **Thin adapters:** GraphNode/GraphColumnNode/GraphEdge are thin (~50-200 lines)
4. **Testability:** Library components easily unit tested with props
5. **Reusability:** Cloud consumers can use LineageNode directly with their own context

### Files

| @datarecce/ui Component | OSS Adapter | Lines | Purpose |
|-------------------------|-------------|-------|---------|
| `LineageNode` | `GraphNode.tsx` | ~445 | Model/table node |
| `LineageColumnNode` | `GraphColumnNode.tsx` | ~190 | Column-level node |
| `LineageEdge` | `GraphEdge.tsx` | ~60 | Edge connector |

### Data Flow

1. `LineageView.tsx` creates `LineageViewContext` with all state
2. Adapter components (`GraphNode`, etc.) read from context
3. Adapters compute props and pass to @datarecce/ui components
4. Library components render based on props only

### Adding New Lineage Components

When adding new lineage visualization components:

1. **Create presentation component in @datarecce/ui:**
   - Accept all data via props
   - No React context dependencies
   - Add comprehensive tests

2. **Create adapter in OSS:**
   - Import presentation component from @datarecce/ui
   - Read from `LineageViewContext`
   - Transform context data to props
   - Handle OSS-specific callbacks

### Example: GraphNode Adapter

```typescript
// OSS Adapter (simplified)
export function GraphNode({ id, data }: NodeProps<LineageGraphNode>) {
  const ctx = useLineageViewContext();

  // Read from context
  const isSelected = ctx?.isNodeSelected(id);
  const isHighlighted = ctx?.isNodeHighlighted(id);
  const action = ctx?.getNodeAction(id);

  // Pass to library component
  return (
    <LineageNode
      id={id}
      data={data}
      isSelected={isSelected}
      isHighlighted={isHighlighted}
      actionTag={action ? <ActionTag {...action} /> : undefined}
      onContextMenu={(e) => ctx?.showContextMenu(data, e)}
    />
  );
}
```
