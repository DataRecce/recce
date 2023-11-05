import csv
import io
import agate
import pandas as pd

from piti.dbt import DBTContext
from dbt.contracts.graph.nodes import ModelNode, AnalysisNode


def _dump_result(result: agate.Table):
    csv_output = io.StringIO()
    csv_writer = csv.writer(csv_output)
    csv_writer.writerow(result.column_names)
    for row in result.rows:
        csv_writer.writerow(row)
    output = csv_output.getvalue()
    csv_output.close()
    return output


def inspect_model_summary(dbtContext: DBTContext, model: ModelNode):
    adapter = dbtContext.adapter
    relation = adapter.Relation.create_from(dbtContext.project, model)
    output = ''

    with dbtContext.adapter.connection_named('test'):
        columns = dbtContext.adapter.execute_macro(
            'get_columns_in_relation',
            kwargs={"relation": relation},
            manifest=dbtContext.manifest)

        stmt = f"select count(*) from {relation}"
        response, result = adapter.execute(stmt, fetch=True, auto_begin=True)
        row_count = result[0][0]

        output += f"identity: {model.identifier}\n"
        output += f"rows: {row_count}\n"
        output += f"columns:\n"
        for column in columns:
            output += f"  {column.name} {column.dtype}\n"

    return output


def inspect_model_preview(dbtContext: DBTContext, model: ModelNode):
    adapter = dbtContext.adapter
    relation = adapter.Relation.create_from(dbtContext.project, model)

    with dbtContext.adapter.connection_named('test'):
        stmt = f"select * from {relation} limit 100"
        response, result = adapter.execute(stmt, fetch=True, auto_begin=True)
        return _dump_result(result)


def inspect_analysis_summary(dbtContext: DBTContext, analysis: AnalysisNode):
    adapter = dbtContext.adapter

    if analysis.compiled_code is None:
        raise Exception("compiled_code is None. Please  run `dbt compile`")

    with dbtContext.adapter.connection_named('test'):
        response, result = adapter.execute(analysis.compiled_code, fetch=True, auto_begin=True)
        return _dump_result(result)


def inspect_sql(dbtContext: DBTContext, sqlTemplate: str, base=False) -> pd.DataFrame:
    from jinja2 import Template

    config_settings = {}

    def config(primary_key=None):
        if primary_key is not None:
            config_settings['primary_key'] = primary_key
        return ''

    def ref(model_name):
        node = dbtContext.find_resource_by_name(model_name, base)
        if node is None:
            raise Exception(f"model not found: {model_name}")

        relation = dbtContext.adapter.Relation.create_from(dbtContext.project, node)
        return str(relation)

    template = Template(sqlTemplate)
    sql = template.render(ref=ref, config=config)

    adapter = dbtContext.adapter
    with dbtContext.adapter.connection_named('test'):
        response, result = adapter.execute(sql, fetch=True, auto_begin=True)
        table: agate.Table = result
        df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
        if 'primary_key' in config_settings:
            df.set_index(config_settings['primary_key'], inplace=True)
        return df


def get_inspector(resource_type: str, method: str):
    if resource_type == 'model':
        if method == 'summary':
            return inspect_model_summary
        elif method == 'preview':
            return inspect_model_preview
    elif resource_type == 'analysis':
        return inspect_analysis_summary
    else:
        raise Exception(f"Not implemented resource type: {resource_type} with method: {method}")
