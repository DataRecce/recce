import logging
import sys
import traceback
import typing as t

from click import Context
from click.core import Command
from rich.console import Console

from recce_cloud import event
from recce_cloud.api.exceptions import RecceCloudException

console = Console()
logger = logging.getLogger(__name__)


class TrackCommand(Command):
    def invoke(self, ctx: Context) -> t.Any:
        event.set_exception_tag("command", ctx.command.name)

        try:
            return super(TrackCommand, self).invoke(ctx)
        except RecceCloudException as e:
            logger.debug(traceback.format_exc())
            console.print(f"[red]Error:[/red] {e}")
            sys.exit(1)
        except SystemExit:
            raise
        except KeyboardInterrupt:
            raise
        except Exception as e:
            print(traceback.format_exc())
            event.capture_exception(e)
            event.flush_exceptions()
            sys.exit(1)
