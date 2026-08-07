"""
ssl_patch.py — must be imported BEFORE any huggingface_hub or sentence_transformers import.

Disables SSL certificate verification for outbound requests made by urllib3, requests,
and httpx (used internally by huggingface_hub and sentence_transformers).
This is required in environments where the system SSL certificate store
is incomplete — common with Miniconda on Windows.
"""
import os
import ssl
import httpx

os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Disable SSL verification globally in stdlib ssl
ssl._create_default_https_context = ssl._create_unverified_context

# Patch httpx.Client.__init__ so any client (including HuggingFace Hub's client) defaults to verify=False
_original_httpx_client_init = httpx.Client.__init__


def _patched_httpx_client_init(self, *args, **kwargs):
    kwargs["verify"] = False
    _original_httpx_client_init(self, *args, **kwargs)


httpx.Client.__init__ = _patched_httpx_client_init
