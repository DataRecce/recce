from recce.dbt import _fake_node


def test_fake_node():
    # we must fake a node without exception
    _fake_node('foobar_package', 'select 1', [])
