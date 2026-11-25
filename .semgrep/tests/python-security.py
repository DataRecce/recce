import tarfile

import requests
import yaml


def test_generate_sql(dbt_adapter, sql_template):
    # ruleid: recce-unsafe-generate-sql
    dbt_adapter.generate_sql(sql_template, False, safe_template=False)

    # ruleid: recce-unsafe-generate-sql
    dbt_adapter.generate_sql(sql_template, False)

    # ok: recce-unsafe-generate-sql
    dbt_adapter.generate_sql(sql_template, False, safe_template=True)


def test_requests(url, headers, kwargs):
    # ruleid: recce-requests-missing-timeout
    requests.get(url)

    # ruleid: recce-requests-missing-timeout
    requests.post(url, headers=headers)

    # ok: recce-requests-missing-timeout
    requests.get(url, timeout=30)

    # ok: recce-requests-missing-timeout
    requests.request("GET", url, headers=headers, **kwargs)


def test_tarfile(path, dest, member):
    with tarfile.open(path, "r:*") as tar:
        # ruleid: recce-tarfile-unsafe-extract
        tar.extractall(dest)

        # ruleid: recce-tarfile-unsafe-extract
        tar.extract(member, dest)

        # ok: recce-tarfile-unsafe-extract
        tar.extractall(dest, filter="data")

        # ok: recce-tarfile-unsafe-extract
        tar.extract(member, dest, filter="data")


def test_yaml(raw):
    # ruleid: recce-yaml-unsafe-load
    yaml.load(raw)

    # ruleid: recce-yaml-unsafe-load
    yaml.unsafe_load(raw)

    # ok: recce-yaml-unsafe-load
    yaml.safe_load(raw)

    # ok: recce-yaml-unsafe-load
    yaml.load(raw, Loader=yaml.SafeLoader)
