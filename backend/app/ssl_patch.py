"""
ssl_patch.py — imported first in app.main.

Disables SSL certificate verification for outbound httpx requests (the agent's
LLM calls, the tools' Open-Meteo calls, and the RAG calls to Supabase). Needed
in environments with an incomplete system SSL certificate store — common with
Miniconda on Windows, and harmless on Render (Supabase / Groq / Open-Meteo all
present valid certs).
"""
import ssl
import httpx

# Disable SSL verification globally in stdlib ssl.
ssl._create_default_https_context = ssl._create_unverified_context

# Patch httpx.Client so every client defaults to verify=False.
_original_httpx_client_init = httpx.Client.__init__


def _patched_httpx_client_init(self, *args, **kwargs):
    kwargs["verify"] = False
    _original_httpx_client_init(self, *args, **kwargs)


httpx.Client.__init__ = _patched_httpx_client_init
