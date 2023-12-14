from recce.dbt import DBTContext


def main():
    ctx = DBTContext.load()
    result = ctx.columns_value_mismatched_summary('customer_id', 'customers')

    # print(result.to_json(orient='table'))
    print(result)

    # print(result.to_string(max_rows=None, max_colwidth=None))

    pass


if __name__ == '__main__':
    main()
