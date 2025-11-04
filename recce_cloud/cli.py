#!/usr/bin/env python
"""
Recce Cloud CLI - Lightweight command for managing Recce Cloud operations.
"""

import click

from recce_cloud import __version__


@click.group()
def cloud_cli():
    """
    Recce Cloud CLI - Manage Recce Cloud sessions and state files.

    A lightweight tool for CI/CD environments to interact with Recce Cloud
    without the heavy dependencies of the full recce package.
    """
    pass


@cloud_cli.command()
def version():
    """Show the version of recce-cloud."""
    click.echo(__version__)


if __name__ == "__main__":
    cloud_cli()
