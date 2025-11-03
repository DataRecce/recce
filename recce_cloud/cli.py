#!/usr/bin/env python
"""
Recce Cloud CLI - Lightweight command for managing Recce Cloud operations.
"""

import click

from recce_cloud import __version__


@click.group()
@click.version_option(version=__version__)
def cloud_cli():
    """
    Recce Cloud CLI - Manage Recce Cloud sessions and state files.

    A lightweight tool for CI/CD environments to interact with Recce Cloud
    without the heavy dependencies of the full recce package.
    """
    pass


if __name__ == "__main__":
    cloud_cli()
