import difflib
import pandas as pd


def diff_text(before: str, after: str):
    if before is None and after is None:
        print('not found in both states')
        return
    elif before == after:
        print('no changes')
        return

    diff_output = difflib.unified_diff(
        before.splitlines(),
        after.splitlines(),
        "base",
        "current",
        lineterm=""
    )
    for line in diff_output:
        print(line)


def diff_dataframe(before: pd.DataFrame, after: pd.DataFrame):
    if before is None and after is None:
        print('not found in both states')
        return

    before.set_index(before.columns[0], inplace=True)
    after.set_index(after.columns[0], inplace=True)
    before_aligned, after_aligned = before.align(after)
    diff = before_aligned.compare(after_aligned,  result_names=('base', 'current'))
    print(diff.to_string(na_rep='-'))

    diff = before_aligned.compare(after_aligned, result_names=('base', 'current'), keep_equal=True, keep_shape=True)
    diff.to_json('diff.json', orient='split', date_format='iso')
