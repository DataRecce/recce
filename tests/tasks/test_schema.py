import pytest


def test_validator():
    from recce.tasks.schema import SchemaDiffCheckValidator
    validator = SchemaDiffCheckValidator()

    def validate(params: dict):
        validator.validate({
            'name': 'test',
            'type': 'schema_diff',
            'params': params,
        })

    # Select all models
    validate({})

    # Select by node name
    validate({
        'node_id': 'abc',
    })
    validate({
        'node_id': ['abc'],
    })

    # Select by selector
    validate({
        'select': 'customers',
        'exclude': 'customers',
        'packages': ['jaffle_shop'],
        'view_mode': 'all',
    })

    # packages should be an array
    with pytest.raises(ValueError):
        validate({
            'packages': 'jaffle_shop',
        })

    # view_mode should be 'all' or 'changed_models'
    validate({
        'view_mode': None,
    })
    validate({
        'view_mode': 'all',
    })
    with pytest.raises(ValueError):
        validate({
            'view_mode': 'abc',
        })
