#!/usr/bin/env python
"""
Setup configuration for recce-cloud package.

A lightweight CLI for Recce Cloud operations, designed for CI/CD environments.
"""

import os
from distutils.core import setup

from setuptools import find_packages


def _get_version():
    """Get version from recce_cloud VERSION file."""
    version_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "recce_cloud", "VERSION"))
    with open(version_file) as fh:
        version = fh.read().strip()
        return version


# Get the directory containing this setup file
here = os.path.abspath(os.path.dirname(__file__))

setup(
    name="recce-cloud",
    version=_get_version(),
    description="Lightweight CLI for Recce Cloud operations",
    long_description=open(os.path.join(here, "README.md")).read(),
    long_description_content_type="text/markdown",
    author="InfuseAI Dev Team",
    author_email="dev@infuseai.io",
    url="https://github.com/InfuseAI/recce",
    entry_points={
        "console_scripts": [
            "recce-cloud = recce_cloud.cli:cloud_cli",
        ]
    },
    python_requires=">=3.9",
    packages=find_packages(include=["recce_cloud", "recce_cloud.*"]),
    install_requires=[
        "click>=7.1",
        "requests>=2.28.1",
        "rich>=12.0.0",
    ],
    tests_require=["pytest"],
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
    package_data={
        "recce_cloud": ["VERSION"],  # Include VERSION file in package
    },
)
