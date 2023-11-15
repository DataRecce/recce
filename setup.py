#!/usr/bin/env python
from distutils.core import setup

from setuptools import find_packages  # type: ignore

setup(name='recce',
      version='0.1.0-dev',
      description='Environment diff tool for dbt',
      long_description=open('README.md').read(),
      long_description_content_type='text/markdown',
      author='InfuseAI Dev Team',
      author_email='dev@infuseai.io',
      url='https://github.com/InfuseAI/recce',
      entry_points={
          'console_scripts': ['recce = recce.cli:cli']
      },
      python_requires=">=3.8",
      packages=find_packages(),
      install_requires=[
          'click>=7.1',
          'dbt-core>=1.3',
          'pandas',
          'fastapi',
          'uvicorn',
          'pydantic',
          'jinja2',
      ],
      tests_require=['pytest'],
      extras_require={
          'dev': [
              'pytest>=4.6',
              'pytest-flake8',
              'flake8==3.9.2',
              'pytest-mypy',
              'pytest-cov',
              'twine',
          ],
      },
      project_urls={
          "Bug Tracker": "https://github.com/InfuseAI/recce/issues",
      },
      classifiers=[
          "Programming Language :: Python :: 3.8",
          "Programming Language :: Python :: 3.9",
          "Programming Language :: Python :: 3.10",
          "Programming Language :: Python :: 3.11",
          "License :: OSI Approved :: Apache Software License",
          "Operating System :: OS Independent",
          "Development Status :: 4 - Beta"
      ],
      package_data={"recce": ['VERSION', 'data/**']})
