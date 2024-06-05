import os
import sys
import time
import traceback
import typing as t
from hashlib import sha256

from click import Context
from click.core import Command
from rich.console import Console
from rich.markup import escape

from recce import event, get_runner
from recce.core import load_context
from recce.git import hosting_repo

console = Console()

_enable_traceback: bool = os.environ.get('RECCE_PRINT_TRACEBACK') == '1'


class TrackCommand(Command):
    def __init__(
        self,
        name: t.Optional[str],
        context_settings: t.Optional[t.Dict[str, t.Any]] = None,
        callback: t.Optional[t.Callable[..., t.Any]] = None,
        params: t.Any = None,
        help: t.Optional[str] = None,
        epilog: t.Optional[str] = None,
        short_help: t.Optional[str] = None,
        options_metavar: t.Optional[str] = "[OPTIONS]",
        add_help_option: bool = True,
        no_args_is_help: bool = False,
        hidden: bool = False,
        deprecated: bool = False,
        beta: bool = False,
    ) -> None:
        super(TrackCommand, self).__init__(name, context_settings, callback, params, help, epilog, short_help,
                                           options_metavar, add_help_option, no_args_is_help, hidden, deprecated)

    def _show_error_message(self, msg, params):
        if params.get('debug'):
            console.print_exception(show_locals=True)
        else:
            print(traceback.format_exc())
            # console.print('[bold red]Error:[/bold red] ', end='')
            # console.out(msg, highlight=False)

    def _show_hint_message(self, hint):
        console.print(f'[bold yellow]Hint[/bold yellow]:\n  {escape(hint)}')

    def invoke(self, ctx: Context) -> t.Any:
        status = False
        start_time = time.time()
        reason = 'error'
        event.set_exception_tag('command', ctx.command.name)

        try:
            ret = super(TrackCommand, self).invoke(ctx)
            if ret is None or ret == 0:
                status = True
                reason = 'ok'
            else:
                reason = 'error'
                sys.exit(ret)
            return ret
        except SystemExit as e:
            reason = 'error'
            raise e
        except KeyboardInterrupt as e:
            reason = 'aborted'
            raise e
        except Exception as e:
            self._show_error_message(str(e), ctx.params)
            event.capture_exception(e)
            reason = 'fatal'
            event.flush_exceptions()
            sys.exit(1)
        finally:
            end_time = time.time()
            duration = end_time - start_time
            runner = get_runner()
            repo = hosting_repo()
            command = ctx.command.name
            props = dict(
                command=command,
                status=status,
                reason=reason,
                duration=duration,
            )

            if runner is not None:
                props['runner_type'] = runner

            if repo is not None:
                props['repository'] = sha256(repo.encode()).hexdigest()

            try:
                recce_context = load_context()
            except Exception:
                # it's not a ready-for-use project
                recce_context = None

            if recce_context is not None:
                if recce_context.adapter_type == "dbt":
                    props['adapter_type'] = 'DBT'
                elif recce_context.adapter_type == "sqlmesh":
                    props['adapter_type'] = 'SQLMesh'

            event.log_event(props, command, params=ctx.params)
            event.flush_events()
