import base64
import os.path
import random
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Tuple
from urllib.parse import parse_qs, urlparse

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey
from rich.console import Console

from recce.event import update_recce_api_token
from recce.exceptions import RecceConfigException
from recce.util.onboarding_state import update_onboarding_state
from recce.util.recce_cloud import RECCE_CLOUD_BASE_URL, RecceCloud

console = Console()

static_folder_path = Path(__file__).parent / "data"
_server_lock = threading.Lock()
_connection_url = None


def decrypt_code(private_key: RSAPrivateKey, code: str) -> str:
    ciphertext = base64.b64decode(code)
    plaintext = private_key.decrypt(
        ciphertext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA1()),  # Node.js uses SHA1 by default
            algorithm=hashes.SHA1(),
            label=None,
        ),
    )
    return plaintext.decode("utf-8")


def handle_callback_request(query_string: str, private_key: RSAPrivateKey):
    query_params = parse_qs(query_string)
    code = query_params.get("code", [None])[0]
    if not code:
        raise RecceConfigException("Missing `code` in query")

    api_token = decrypt_code(private_key, code)
    if not RecceCloud(api_token).verify_token():
        raise RecceConfigException("Invalid Recce Cloud API token")

    update_recce_api_token(api_token)
    update_onboarding_state(api_token, False)

    return api_token  # for testability/debugging


def make_callback_handler(private_key: RSAPrivateKey):
    class OneTimeHTTPRequestHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                with open(os.path.join(static_folder_path, "auth_callback.html"), "r") as f:
                    callback_html_content = f.read()

                # Parse query parameters
                parsed_url = urlparse(self.path)

                handle_callback_request(parsed_url.query, private_key)

                # Construct HTML content
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.send_header("Content-Length", str(len(callback_html_content.encode())))
                self.end_headers()
                self.wfile.write(callback_html_content.encode())

            except Exception:
                console.print_exception()
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"<h1>Internal Server Error</h1>")
            finally:
                # Shut down the server after handling the first request
                # Shutdown in a new thread to avoid deadlock
                self.server.server_close()
                threading.Thread(target=self.server.shutdown, daemon=True).start()

        def log_message(self, format, *args):
            # Suppress default logging
            return

    return OneTimeHTTPRequestHandler


def is_callback_server_running():
    return _server_lock.locked()


def get_connection_url():
    return _connection_url


def run_one_time_http_server(private_key: RSAPrivateKey, port=8080):
    handler = make_callback_handler(private_key)
    server = HTTPServer(("localhost", port), handler)
    server.serve_forever()


def prepare_connection_url(public_key: RSAPublicKey):
    public_key_pem_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    public_key_pem_str = base64.b64encode(public_key_pem_bytes).decode("utf-8")
    callback_port = random.randint(10000, 15000)
    connect_url = f"{RECCE_CLOUD_BASE_URL}/connect?_key={public_key_pem_str}&_port={callback_port}"
    return connect_url, callback_port


def generate_key_pair() -> Tuple[RSAPrivateKey, RSAPublicKey]:
    key_size = 2048  # Should be at least 2048

    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=key_size, backend=default_backend()  # Do not change
    )

    public_key = private_key.public_key()
    return private_key, public_key


def connect_to_cloud_background_task(private_key: RSAPrivateKey, callback_port, connection_url):
    if is_callback_server_running():
        return

    with _server_lock:
        global _connection_url
        _connection_url = connection_url
        run_one_time_http_server(private_key, callback_port)
        _connection_url = None
