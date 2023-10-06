from piti.dbt import DBTContext
from dbt.contracts.graph.manifest import ModelNode
from dbt.adapters.base import BaseRelation

def inspect_model_summary(dbtContext:DBTContext, model:ModelNode):
    adapter = dbtContext.adapter
    relation = BaseRelation.create(identifier=model.identifier, schema=model.schema)
    output = ''

    with dbtContext.adapter.connection_named('test'):
        columns = dbtContext.adapter.execute_macro(
            'get_columns_in_relation',
            kwargs={"relation": relation},
            manifest=dbtContext.manifest)


        stmt = f"select count(*) from {adapter.quote(model.schema)}.{adapter.quote(model.identifier)}"
        response, result = adapter.execute(stmt, fetch=True, auto_begin=True)
        row_count = result[0][0]

        output += f"identity: {model.identifier}\n"
        output += f"schema: {model.schema}\n"
        output += f"rows: {row_count}\n"
        output += f"columns:\n"
        for column in columns:
            output += f"  {column.name} {column.dtype}\n"

    return output
