import time

from recce.dbt import DBTContext


def main():
    ctx = DBTContext.load()
    results = ctx.columns_value_mismatched_summary('customer_id', 'customers')
    # results = ctx.columns_value_mismatched_summary_v2('event_id', 'stg_oss__events')
    # for line in results:
    #     print(line)
    print("-")
    print(results)


if __name__ == '__main__':
    t1 = time.time()
    main()
    t2 = time.time()
    print(t2 - t1)
