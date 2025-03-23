from recce.models.types import Cll


class CllDAO:
    """
    Data Access Object for CLL. Currently, we store a CLL in memory, in the future, we can store them in a database.
    """

    @property
    def _clls(self):
        from recce.core import default_context
        return default_context().clls

    def create(self, cll: Cll):
        self._clls.append(cll)

    def find_cll_by_id(self, cll_id):
        for cll in self._clls:
            if str(cll_id) == str(cll.cll_id):
                return cll

        return None

    def find_cll_by_node(self, node_id: str):
        for cll in self._clls:
            if str(node_id) == str(cll.params.get('node_id')):
                return cll

        return None

    def clear(self):
        self._clls.clear()
