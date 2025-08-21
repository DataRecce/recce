from recce.util.lineage import find_downstream, find_upstream


class TestFindUpstreamDownstream:
    """Test cases that use both functions together with complementary data"""

    def setup_method(self):
        """Setup complementary parent and child maps for testing"""
        # Tree structure:
        #     d
        #    / \
        #   b   c
        #    \ /
        #     a
        self.parent_map = {"a": ["b", "c"], "b": ["d"], "c": ["d"]}

        self.child_map = {"d": ["b", "c"], "b": ["a"], "c": ["a"]}

    def test_empty_input(self):
        """Test with empty node_ids"""
        result = find_upstream([], {})
        assert result == set()

        result = find_downstream([], {})
        assert result == set()

        result = find_upstream([], {"a": ["b"]})
        assert result == set()

        result = find_downstream([], {"a": ["b"]})
        assert result == set()

    def test_complementary_maps_single_node(self):
        """Test that parent and child maps give complementary results"""
        # From 'a', upstream should be b, c, d
        upstream = find_upstream(["a"], self.parent_map)
        assert upstream == {"b", "c", "d"}

        # From 'd', downstream should be b, c, a
        downstream = find_downstream(["d"], self.child_map)
        assert downstream == {"b", "c", "a"}

    def test_middle_node_both_directions(self):
        """Test finding both upstream and downstream from middle node"""
        # From 'b': upstream is 'd', downstream is 'a'
        upstream = find_upstream(["b"], self.parent_map)
        downstream = find_downstream(["b"], self.child_map)

        assert upstream == {"d"}
        assert downstream == {"a"}

        # Combined should give us all nodes except 'b' itself
        all_related = upstream | downstream
        assert all_related == {"a", "d"}

    def test_root_and_leaf_nodes(self):
        """Test root node (no parents) and leaf node (no children)"""
        # 'd' is root (no parents), 'a' is leaf (no children)
        root_upstream = find_upstream(["d"], self.parent_map)
        leaf_downstream = find_downstream(["a"], self.child_map)

        assert root_upstream == set()  # No parents
        assert leaf_downstream == set()  # No children

    def test_complex_graph_both_directions(self):
        """Test more complex graph structure"""
        parent_map = {"a": ["b"], "b": ["d", "e"], "c": ["e", "f"], "d": ["g"], "e": ["g"], "f": ["h"]}

        child_map = {"g": ["d", "e"], "d": ["b"], "e": ["b", "c"], "b": ["a"], "f": ["c"], "h": ["f"]}

        # From 'a'
        upstream_from_a = find_upstream(["a"], parent_map)
        assert upstream_from_a == {"b", "d", "e", "g"}

        # From 'g'
        downstream_from_g = find_downstream(["g"], child_map)
        assert downstream_from_g == {"d", "e", "b", "c", "a"}

    def test_multiple_start_nodes_both_functions(self):
        """Test both functions with multiple starting nodes"""
        parent_map = {"a1": ["b1"], "a2": ["b2"], "b1": ["c"], "b2": ["c"], "c": ["d"]}

        child_map = {"d": ["c"], "c": ["b1", "b2"], "b1": ["a1"], "b2": ["a2"]}

        # Starting from leaf nodes
        upstream_multi = find_upstream(["a1", "a2"], parent_map)
        assert upstream_multi == {"b1", "b2", "c", "d"}

        # Starting from root node
        downstream_root = find_downstream(["d"], child_map)
        assert downstream_root == {"c", "b1", "b2", "a1", "a2"}

    def test_disconnected_components(self):
        """Test graphs with disconnected components"""
        parent_map = {
            # Component 1: a1 <- b1 <- c1
            "a1": ["b1"],
            "b1": ["c1"],
            # Component 2: a2 <- b2 <- c2
            "a2": ["b2"],
            "b2": ["c2"],
        }

        child_map = {
            # Component 1: c1 -> b1 -> a1
            "c1": ["b1"],
            "b1": ["a1"],
            # Component 2: c2 -> b2 -> a2
            "c2": ["b2"],
            "b2": ["a2"],
        }

        # Should only find nodes in same component
        upstream1 = find_upstream(["a1"], parent_map)
        downstream1 = find_downstream(["c1"], child_map)

        assert upstream1 == {"b1", "c1"}
        assert downstream1 == {"b1", "a1"}

        # Cross-component queries should find nothing
        upstream_cross = find_upstream(["a1"], {"a2": ["b2"]})
        assert upstream_cross == set()
