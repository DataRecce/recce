import sqlalchemy as sa

def inspect_model_summary(conn, model: dict):
    inspector = sa.inspect(conn)
    name = model.get('name')
    schema = model.get('schema')

    output = ''
    metadata = sa.MetaData()
    table = sa.Table(name, metadata, schema=schema)
    stmt = sa.select(sa.func.count()).select_from(table)
    row = conn.execute(stmt).one()
    output += f"name: {name}\n"
    output += f"schema: {schema}\n"
    output += f"rows: {row[0]}\n"

    columns = inspector.get_columns(name, schema=schema)
    output += f"columns: {len(columns)}\n"
    for column in columns:
        output += f"  {column.get('name')} {column.get('type')}\n"

    return output