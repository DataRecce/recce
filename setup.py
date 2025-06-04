#!/usr/bin/env python
import os
from distutils.core import setup

from setuptools import find_packages  # type: ignore


def _get_version():
    version_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "recce", "VERSION"))
    with open(version_file) as fh:
        version = fh.read().strip()
        return version


setup(
    name="recce",
    version=_get_version(),
    description="Environment diff tool for dbt",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="InfuseAI Dev Team",
    author_email="dev@infuseai.io",
    url="https://github.com/InfuseAI/recce",
    entry_points={"console_scripts": ["recce = recce.cli:cli"]},
    python_requires=">=3.9",
    packages=find_packages(),
    install_requires=[
        "boto3",
        "requests>=2.28.1",
        "ruamel.yaml>=0.18.6",
        "click>=7.1",
        "deepdiff>=7.0,<8.0",
        "portalocker",
        "fastapi",
        "itsdangerous",
        "uvicorn",
        "pydantic",
        "jinja2",
        "requests>=2.28.1",
        "rich>=12.0.0",
        "sentry-sdk",
        "watchdog",
        "websockets",
        "py-markdown-table",
        "python-dateutil",
        "python-multipart",
        "GitPython",
        "PyGithub",
        "sqlglot",
    ],
    tests_require=["pytest"],
    extras_require={
        "dev": [
            "pytest>=4.6",
            "pytest-flake8",
            "black>=25.1.0",
            "isort>=6.0.1",
            "flake8>=7.2.0",
            "pre-commit>=4.2.0",
            "pytest-mypy",
            "pytest-cov",
            "twine",
            "tox",
            "pandas",
            "httpx",
        ],
    },
    project_urls={
        "Bug Tracker": "https://github.com/InfuseAI/recce/issues",
    },
    classifiers=[
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Development Status :: 4 - Beta",
    ],
    package_data={"recce": ["VERSION", "data/**", "event/SENTRY_DNS", "event/CONFIG"]},
)
