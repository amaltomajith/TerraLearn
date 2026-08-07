"""
RAG (Retrieval-Augmented Generation) layer for TerraLearn.

Uses LlamaIndex purely for embedding + retrieval — no LLM calls from LlamaIndex.
Generation is handled exclusively by the LangGraph agent via Groq.
"""
import os
import logging
from pathlib import Path

# ssl_patch must already be active (imported by main.py before this module loads)
from llama_index.core import (
    Settings,
    SimpleDirectoryReader,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

logger = logging.getLogger(__name__)

# Resolve paths relative to this file so they work from any cwd
_BACKEND_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = _BACKEND_DIR / "data" / "knowledge"
STORAGE_DIR = _BACKEND_DIR / "storage"

_EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# Module-level cached retriever — built once per process
_retriever = None


def _configure_settings() -> None:
    """Configure LlamaIndex to use local embeddings only. Explicitly disable
    the LlamaIndex LLM so no OpenAI / Groq key is consumed by retrieval."""
    Settings.llm = None  # type: ignore[assignment]
    Settings.embed_model = HuggingFaceEmbedding(model_name=_EMBED_MODEL_NAME)


def build_index() -> VectorStoreIndex:
    """Read all .txt files from knowledge/, build a VectorStoreIndex,
    and persist it to storage/ for fast subsequent loads."""
    _configure_settings()

    if not KNOWLEDGE_DIR.exists():
        raise FileNotFoundError(
            f"Knowledge directory not found: {KNOWLEDGE_DIR}. "
            "Ensure backend/data/knowledge/ contains .txt files."
        )

    logger.info("Building RAG index from %s …", KNOWLEDGE_DIR)
    documents = SimpleDirectoryReader(str(KNOWLEDGE_DIR)).load_data()
    logger.info("Loaded %d documents for indexing.", len(documents))

    index = VectorStoreIndex.from_documents(documents, show_progress=False)

    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    index.storage_context.persist(persist_dir=str(STORAGE_DIR))
    logger.info("Index persisted to %s", STORAGE_DIR)

    return index


def _load_index() -> VectorStoreIndex:
    """Load a previously persisted index from storage/."""
    _configure_settings()
    storage_context = StorageContext.from_defaults(persist_dir=str(STORAGE_DIR))
    return load_index_from_storage(storage_context)


def get_retriever():
    """Return a retriever backed by the knowledge vector index.

    Fast path: loads from storage/ if it exists.
    First-run path: calls build_index() to create storage/.
    Module-level caching avoids re-loading on every request.
    """
    global _retriever
    if _retriever is not None:
        return _retriever

    _configure_settings()

    storage_ready = STORAGE_DIR.exists() and any(STORAGE_DIR.iterdir())
    if storage_ready:
        logger.info("Loading RAG index from persisted storage at %s", STORAGE_DIR)
        index = _load_index()
    else:
        logger.info("No persisted index found — building from scratch.")
        index = build_index()

    _retriever = index.as_retriever(similarity_top_k=3)
    return _retriever


def ensure_index_built() -> None:
    """Call at startup to guarantee the index exists before the first request."""
    storage_ready = STORAGE_DIR.exists() and any(STORAGE_DIR.iterdir())
    if not storage_ready:
        logger.info("Startup: building RAG index for the first time …")
        build_index()
    else:
        logger.info("Startup: RAG index already present at %s", STORAGE_DIR)
