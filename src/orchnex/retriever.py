# src/orchnex/retriever.py
import os
import glob
import hashlib
from typing import List, Dict, Any, Tuple, Optional
import torch
from transformers import AutoTokenizer, AutoModel

class DocumentChunk:
    def __init__(self, text: str, source: str, chunk_index: int):
        self.text = text
        self.source = source
        self.chunk_index = chunk_index

class DocumentRetriever:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.chunks: List[DocumentChunk] = []
        self.embeddings: Optional[torch.Tensor] = None
        self._initialized = False
        # Cache: file_hash -> (chunks, embeddings tensor)
        self._file_cache: Dict[str, Tuple[List[DocumentChunk], torch.Tensor]] = {}

    def _initialize_model(self):
        """Lazy load tokenizer and model, prioritizing local cache to prevent network timeouts"""
        if self._initialized:
            return
        try:
            # Try loading from local cache first to avoid slow HuggingFace HEAD requests
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, local_files_only=True)
            self.model = AutoModel.from_pretrained(self.model_name, local_files_only=True)
            self._initialized = True
        except Exception:
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModel.from_pretrained(self.model_name)
                self._initialized = True
            except Exception as e:
                raise RuntimeError(f"Failed to load embedding model '{self.model_name}': {str(e)}")

    def _mean_pooling(self, model_output, attention_mask) -> torch.Tensor:
        """Mean Pooling - Take attention mask into account for correct averaging"""
        token_embeddings = model_output[0]  # First element of model_output contains all token embeddings
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        return sum_embeddings / sum_mask

    def _get_embeddings(self, texts: List[str], batch_size: int = 32) -> torch.Tensor:
        """Generate dense vector embeddings in mini-batches to avoid OOM on large PDFs"""
        self._initialize_model()
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            encoded_input = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors='pt'
            )
            with torch.no_grad():
                model_output = self.model(**encoded_input)

            batch_embeddings = self._mean_pooling(model_output, encoded_input['attention_mask'])
            batch_embeddings = torch.nn.functional.normalize(batch_embeddings, p=2, dim=1)
            all_embeddings.append(batch_embeddings)

        return torch.cat(all_embeddings, dim=0)

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        
        # If text is too short, return as a single chunk
        if len(text) <= chunk_size:
            return [text]

        step = chunk_size - overlap
        if step <= 0:
            step = chunk_size // 2

        # Simple character-based windowing for robust chunking
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            
            # Try to align to word boundary if not at the end
            if end < len(text):
                last_space = chunk.rfind(' ')
                if last_space != -1 and last_space > chunk_size // 2:
                    chunk = chunk[:last_space]
                    end = start + last_space + 1
            
            chunk = chunk.strip()
            if chunk:
                chunks.append(chunk)
            start += step
            
        return chunks

    def load_documents(self, directory_path: str, chunk_size: int = 500, overlap: int = 100) -> int:
        """Load, chunk, and embed all text/markdown files in a directory.
        Uses per-file SHA256 hash caching to skip re-embedding unchanged files."""
        if not os.path.isdir(directory_path):
            raise ValueError(f"Directory not found: {directory_path}")

        # Find markdown and text files
        extensions = ['*.md', '*.txt']
        files = []
        for ext in extensions:
            files.extend(glob.glob(os.path.join(directory_path, '**', ext), recursive=True))

        all_chunks: List[DocumentChunk] = []
        all_embeddings: List[torch.Tensor] = []
        total_new_chunks = 0

        for filepath in files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Compute SHA256 hash of file contents for cache key
                file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

                if file_hash in self._file_cache:
                    # Cache hit: reuse previously computed embeddings
                    cached_chunks, cached_emb = self._file_cache[file_hash]
                    all_chunks.extend(cached_chunks)
                    all_embeddings.append(cached_emb)
                    continue

                filename = os.path.basename(filepath)
                text_chunks = self.chunk_text(content, chunk_size, overlap)

                if not text_chunks:
                    continue

                chunk_objects = [DocumentChunk(t, filename, i) for i, t in enumerate(text_chunks)]
                embeddings = self._get_embeddings(text_chunks)

                # Store in cache
                self._file_cache[file_hash] = (chunk_objects, embeddings)

                all_chunks.extend(chunk_objects)
                all_embeddings.append(embeddings)
                total_new_chunks += len(chunk_objects)

            except Exception as e:
                print(f"Warning: Failed to process file {filepath}: {str(e)}")

        if not all_chunks:
            return 0

        # Rebuild retriever state from all (cached + new) chunks
        self.chunks = all_chunks
        self.embeddings = torch.cat(all_embeddings, dim=0) if all_embeddings else None

        return total_new_chunks

    def retrieve(self, query: str, top_k: int = 3) -> List[Tuple[DocumentChunk, float]]:
        """Retrieve top_k most similar chunks for the given query"""
        if not self.chunks or self.embeddings is None:
            return []

        # Get query embedding
        query_embedding = self._get_embeddings([query])

        # Compute cosine similarity
        similarities = torch.mm(self.embeddings, query_embedding.transpose(0, 1)).squeeze(1)
        
        # Get top k indices
        top_k = min(top_k, len(self.chunks))
        top_scores, top_indices = torch.topk(similarities, top_k)

        results = []
        # Handle case where top_k = 1 or top_scores is a scalar (after squeeze)
        if top_k == 1:
            results.append((self.chunks[top_indices.item()], top_scores.item()))
        else:
            for score, idx in zip(top_scores.tolist(), top_indices.tolist()):
                results.append((self.chunks[idx], score))
            
        return results
