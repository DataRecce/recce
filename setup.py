#!/usr/bin/env python
import os
from distutils.core import setup

from setuptools import find_packages  # type: ignore

setup(name='piti',
      version='0.1.0-dev',
      description='Piti',
      long_description=open('README.md').read(),
      long_description_content_type='text/markdown',
      author='InfuseAI Dev Team',
      author_email='dev@infuseai.io',
      url='https://github.com/InfuseAI/piti',
      entry_points={
          'console_scripts': ['piti = piti.cli:cli']
      },
      python_requires=">=3.8",
      packages=find_packages(),
      install_requires=[
          'sqlalchemy>=1.4',
          'click>=7.1',
      ],
      tests_require=['pytest'],
      extras_require={
          'snowflake': [
              'snowflake-sqlalchemy>=1.4.6',
              'snowflake-connector-python>=2.9'
          ],
          'postgres': [
              # you need a postgres for m1 to install psycopg2
              'psycopg2-binary'
          ],
          'bigquery': [
              'sqlalchemy-bigquery>=1.6',
          ],
          'redshift': [
              'sqlalchemy-redshift',
              'redshift-connector',
              'psycopg2-binary',
              'boto3>=1.24.11',
          ],
          'athena': [
              'PyAthena[SQLAlchemy]'
          ],
          'databricks': [
              'databricks-sql-connector'
          ],
          'duckdb': [
              'duckdb>=0.4.0',
              'duckdb-engine>=0.6.1',
              'chardet>=5.0.0',
          ],
          'dev': [
              'pytest>=4.6',
              'pytest-flake8',
              'flake8==3.9.2',
              'pytest-mypy',
              'pytest-cov',
              'twine',
              'jsonschema',
          ],
      },
      project_urls={
          "Bug Tracker": "https://github.com/InfuseAI/piti/issues",
      },
      classifiers=[
          "Programming Language :: Python :: 3.8",
          "Programming Language :: Python :: 3.9",
          "Programming Language :: Python :: 3.10",
          "Programming Language :: Python :: 3.11",
          "License :: OSI Approved :: Apache Software License",
          "Operating System :: OS Independent",
          "Development Status :: 4 - Beta"
      ])
