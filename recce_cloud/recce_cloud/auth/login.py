"""
Browser-based OAuth login flow for Recce Cloud.

This module implements the RSA-encrypted OAuth flow:
1. Generate RSA-2048 key pair
2. Open browser to Recce Cloud with public key
3. Start local callback server
4. Receive encrypted token via callback
5. Decrypt and verify token
6. Save to profile
"""

import base64
import os
import random
import webbrowser
from typing import Optional, Tuple

import requests
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey
from rich.console import Console

from recce_cloud.auth.callback_server import (
    ERROR_HTML,
    SUCCESS_HTML,
    CallbackResult,
    run_callback_server,
)
from recce_cloud.auth.profile import (
    clear_api_token,
    get_api_token,
    get_profile_path,
    update_api_token,
)

# Cloud API configuration
RECCE_CLOUD_API_HOST = os.environ.get("RECCE_CLOUD_API_HOST", "https://cloud.datarecce.io")
RECCE_CLOUD_BASE_URL = os.environ.get("RECCE_CLOUD_BASE_URL", RECCE_CLOUD_API_HOST)

console = Console()


def generate_key_pair() -> Tuple[RSAPrivateKey, RSAPublicKey]:
    """
    Generate RSA-2048 key pair for secure token exchange.

    Returns:
        Tuple of (private_key, public_key).
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    public_key = private_key.public_key()
    return private_key, public_key


def decrypt_code(private_key: RSAPrivateKey, encrypted_code: str) -> str:
    """
    Decrypt the RSA-encrypted token from Recce Cloud.

    Uses RSA-OAEP-SHA1 padding to match Node.js defaults.

    Args:
        private_key: RSA private key.
        encrypted_code: Base64-encoded encrypted token.

    Returns:
        Decrypted API token string.
    """
    ciphertext = base64.b64decode(encrypted_code)
    plaintext = private_key.decrypt(
        ciphertext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA1()),  # Node.js uses SHA1 by default
            algorithm=hashes.SHA1(),
            label=None,
        ),
    )
    return plaintext.decode("utf-8")


def prepare_connection_url(public_key: RSAPublicKey) -> Tuple[str, int]:
    """
    Prepare the OAuth connection URL with public key.

    Args:
        public_key: RSA public key to include in URL.

    Returns:
        Tuple of (connection_url, callback_port).
    """
    public_key_pem_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    public_key_pem_str = base64.b64encode(public_key_pem_bytes).decode("utf-8")
    callback_port = random.randint(10000, 15000)
    connect_url = f"{RECCE_CLOUD_BASE_URL}/connect?_key={public_key_pem_str}&_port={callback_port}"
    return connect_url, callback_port


def verify_token(token: str) -> bool:
    """
    Verify the API token with Recce Cloud.

    Args:
        token: API token to verify.

    Returns:
        True if token is valid, False otherwise.
    """
    api_url = f"{RECCE_CLOUD_API_HOST}/api/v1/verify-token"
    try:
        response = requests.get(
            api_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        return response.status_code == 200
    except Exception:
        return False


def get_user_info(token: str) -> Optional[dict]:
    """
    Get user information from Recce Cloud.

    Args:
        token: API token for authentication.

    Returns:
        User info dict with email, name, etc., or None if failed.
    """
    api_url = f"{RECCE_CLOUD_API_HOST}/api/v1/users"
    try:
        response = requests.get(
            api_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if response.status_code == 200:
            return response.json().get("user")
    except Exception:
        pass
    return None


def login_with_browser() -> bool:
    """
    Perform browser-based OAuth login.

    Opens browser to Recce Cloud, waits for callback with encrypted token,
    decrypts and verifies token, then saves to profile.

    Returns:
        True if login successful, False otherwise.
    """
    console.print("Opening browser to authenticate...")
    console.print()

    # Generate key pair
    private_key, public_key = generate_key_pair()
    connect_url, callback_port = prepare_connection_url(public_key)

    # Open browser
    webbrowser.open(connect_url)

    # Always show the URL for manual access
    console.print("If the browser does not open, please visit:")
    console.print(f"  [cyan]{connect_url}[/cyan]")
    console.print()

    # Wait for callback
    console.print(f"Waiting for authentication (listening on port {callback_port})...")
    result = CallbackResult()

    if not run_callback_server(callback_port, result, SUCCESS_HTML, ERROR_HTML):
        if result.error:
            console.print(f"[red]Error:[/red] {result.error}")
        else:
            console.print("[red]Error:[/red] Authentication timed out")
        return False

    if not result.code:
        console.print("[red]Error:[/red] No authentication code received")
        return False

    # Decrypt token
    try:
        api_token = decrypt_code(private_key, result.code)
    except Exception as e:
        console.print(f"[red]Error:[/red] Failed to decrypt authentication code: {e}")
        return False

    # Verify token
    if not verify_token(api_token):
        console.print("[red]Error:[/red] Invalid token received from Recce Cloud")
        return False

    # Save token
    update_api_token(api_token)

    # Get user info for display
    user_info = get_user_info(api_token)
    if user_info:
        email = user_info.get("email", "Unknown")
        console.print(f"[green]✓[/green] Logged in as [cyan]{email}[/cyan]")
    else:
        console.print("[green]✓[/green] Logged in successfully")

    console.print(f"  Credentials saved to {get_profile_path()}")
    return True


def login_with_token(token: str) -> bool:
    """
    Login with a manually provided token.

    Args:
        token: API token to use.

    Returns:
        True if login successful, False otherwise.
    """
    # Verify token
    if not verify_token(token):
        console.print("[red]Error:[/red] Invalid API token")
        return False

    # Save token
    update_api_token(token)

    # Get user info for display
    user_info = get_user_info(token)
    if user_info:
        email = user_info.get("email", "Unknown")
        console.print(f"[green]✓[/green] Logged in as [cyan]{email}[/cyan]")
    else:
        console.print("[green]✓[/green] Logged in successfully")

    console.print(f"  Credentials saved to {get_profile_path()}")
    return True


def check_login_status() -> Tuple[bool, Optional[str]]:
    """
    Check current login status.

    Returns:
        Tuple of (is_logged_in, user_email_or_none).
    """
    token = get_api_token()
    if not token:
        return False, None

    if not verify_token(token):
        return False, None

    user_info = get_user_info(token)
    email = user_info.get("email") if user_info else None
    return True, email


def logout() -> bool:
    """
    Clear stored credentials.

    Returns:
        True if logout successful.
    """
    clear_api_token()
    return True
