"""
One-time HTTP callback server for OAuth authentication.

This server receives the encrypted token from Recce Cloud after
browser-based authentication.
"""

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional
from urllib.parse import parse_qs, urlparse


class CallbackResult:
    """Container for callback result."""

    def __init__(self):
        self.code: Optional[str] = None
        self.error: Optional[str] = None


def make_callback_handler(result: CallbackResult, on_success_html: str, on_error_html: str):
    """
    Create a one-time HTTP request handler.

    Args:
        result: CallbackResult object to store the received code.
        on_success_html: HTML content to return on success.
        on_error_html: HTML content to return on error.

    Returns:
        HTTP request handler class.
    """

    class OneTimeHTTPRequestHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                parsed_url = urlparse(self.path)
                query_params = parse_qs(parsed_url.query)

                code = query_params.get("code", [None])[0]
                if not code:
                    result.error = "Missing 'code' parameter in callback"
                    self._send_response(400, on_error_html)
                    return

                result.code = code
                self._send_response(200, on_success_html)

            except Exception as e:
                result.error = str(e)
                self._send_response(500, on_error_html)
            finally:
                # Shutdown server after handling the request
                self.server.server_close()
                threading.Thread(target=self.server.shutdown, daemon=True).start()

        def _send_response(self, status_code: int, html_content: str):
            self.send_response(status_code)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(html_content.encode())))
            self.end_headers()
            self.wfile.write(html_content.encode())

        def log_message(self, format, *args):
            # Suppress default logging
            pass

    return OneTimeHTTPRequestHandler


def run_callback_server(
    port: int,
    result: CallbackResult,
    on_success_html: str,
    on_error_html: str,
    timeout: int = 300,
) -> bool:
    """
    Run a one-time HTTP server to receive the OAuth callback.

    Args:
        port: Port to listen on.
        result: CallbackResult object to store the received code.
        on_success_html: HTML content to return on success.
        on_error_html: HTML content to return on error.
        timeout: Server timeout in seconds (default 5 minutes).

    Returns:
        True if callback was received, False if timeout or error.
    """
    handler = make_callback_handler(result, on_success_html, on_error_html)
    server = HTTPServer(("localhost", port), handler)
    server.timeout = timeout

    try:
        # Handle a single request
        server.handle_request()
        return result.code is not None
    except Exception:
        return False
    finally:
        server.server_close()


# Default HTML responses
SUCCESS_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>Login Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        h1 { color: #10b981; margin-bottom: 16px; }
        p { color: #6b7280; }
        .checkmark {
            font-size: 64px;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">✓</div>
        <h1>Login Successful!</h1>
        <p>You can close this window and return to the terminal.</p>
    </div>
</body>
</html>
"""

ERROR_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>Login Failed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        h1 { color: #ef4444; margin-bottom: 16px; }
        p { color: #6b7280; }
        .error-mark {
            font-size: 64px;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-mark">✗</div>
        <h1>Login Failed</h1>
        <p>Please try again or contact support if the issue persists.</p>
    </div>
</body>
</html>
"""
