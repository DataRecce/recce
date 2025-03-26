def find_upstream(node, parent_map):
    visited = set()
    upstream = set()

    def dfs(current):
        if current in visited:
            return
        visited.add(current)

        parents = parent_map.get(current, [])
        for parent in parents:
            upstream.add(parent)
            dfs(parent)

    dfs(node)
    return upstream


def find_downstream(node, child_map):
    visited = set()
    downstream = set()

    def dfs(current):
        if current in visited:
            return
        visited.add(current)

        children = child_map.get(current, [])
        for child in children:
            downstream.add(child)
            dfs(child)

    dfs(node)
    return downstream
