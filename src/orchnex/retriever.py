# src/orchnex/retriever.py
import os
import glob
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

    def _initialize_model(self):
        """Lazy load tokenizer and model to avoid overhead at startup"""
        if self._initialized:
            return
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

    def _get_embeddings(self, texts: List[str]) -> torch.Tensor:
        """Generate dense vector embeddings for a list of texts"""
        self._initialize_model()
        
        # Tokenize sentences
        encoded_input = self.tokenizer(
            texts, 
            padding=True, 
            truncation=True, 
            max_length=512, 
            return_tensors='pt'
        )

        # Compute token embeddings
        with torch.no_grad():
            model_output = self.model(**encoded_input)

        # Perform pooling
        sentence_embeddings = self._mean_pooling(model_output, encoded_input['attention_mask'])

        # Normalize embeddings
        sentence_embeddings = torch.nn.functional.normalize(sentence_embeddings, p=2, dim=1)
        return sentence_embeddings

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
        """Load, chunk, and embed all text/markdown files in a directory"""
        if not os.path.isdir(directory_path):
            raise ValueError(f"Directory not found: {directory_path}")

        # Find markdown and text files
        extensions = ['*.md', '*.txt']
        files = []
        for ext in extensions:
            files.extend(glob.glob(os.path.join(directory_path, '**', ext), recursive=True))

        new_chunks = []
        new_texts = []

        for filepath in files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                filename = os.path.basename(filepath)
                text_chunks = self.chunk_text(content, chunk_size, overlap)
                
                for idx, chunk_text in enumerate(text_chunks):
                    new_chunks.append(DocumentChunk(chunk_text, filename, idx))
                    new_texts.append(chunk_text)
                    
            except Exception as e:
                print(f"Warning: Failed to process file {filepath}: {str(e)}")

        if not new_chunks:
            return 0

        # Compute embeddings for new texts
        embeddings = self._get_embeddings(new_texts)

        # Update retriever state
        self.chunks.extend(new_chunks)
        if self.embeddings is None:
            self.embeddings = embeddings
        else:
            self.embeddings = torch.cat([self.embeddings, embeddings], dim=0)

        return len(new_chunks)

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
