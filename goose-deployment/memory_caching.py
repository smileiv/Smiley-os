#!/usr/bin/env python3
"""memory_caching.py

Minimal implementation of the Gated Residual Memory (GRM) variant of
Memory Caching as described in "Memory Caching: RNNs with Growing Memory"
(Behrouz et al., 2026).

The module defines a ``MemoryCachingLSTM`` class that wraps a standard
LSTM with a segment‑based cache of the *last* hidden hidden state of
each segment.  The cache is then aggregated in a gated residual fashion
and added to the output of the underlying LSTM.

This code is deliberately lightweight – no external dependencies beyond
PyTorch are required.  It can be used as a drop‑in component in a language
model or any seq2seq form where an LSTM (or other recurrent module)
is employed.

Example usage
-------------
>>> from memory_caching import MemoryCachingLSTM
>>> base = torch.nn.LSTM(embedding_dim, hidden_dim, batch_first=True)
>>> mc_lstm = MemoryCachingLSTM(base, seg_len=50, hidden_dim=hidden_dim)
>>> inputs = torch.randint(0, vocab_size, (batch, seq_len))
>>> logits, _ = mc_lstm(inputs, h0)

"""

from __future__ import annotations
import torch
import torch.nn as nn
from typing import Tuple, Optional


class MemoryCachingLSTM(nn.Module):
    """A wrapper that augments an LSTM with various Memory‑Caching strategies.

    Parameters
    ----------
    lstm : nn.LSTM
        The underlying LSTM module to be wrapped.
    seg_len : int
        Number of tokens per *segment*. The hidden state of the last token in each
        segment is stored in a cache.
    mode : str, optional
        One of ``"residual"`` (simple sum), ``"gated"`` (GRM), ``"soup"`` (average
        cached states), or ``"sparse"`` (SSC). Default is ``"gated"``.
    gating_dim : int, optional
        Dimension of the gating vector when ``mode`` requires a gate (gated or sparse).
        Defaults to the hidden size.
    k : int, optional
        Number of cached memories to attend to in ``"sparse"`` mode. Default ``2``.
    device : str or torch.device, optional
        Default device for internal tensors.
    """

    def __init__(
        self,
        lstm: nn.LSTM,
        seg_len: int,
        mode: str = "gated",
        gating_dim: Optional[int] = None,
        k: int = 2,
        device: Optional[torch.device] = None,
    ) -> None:
        super().__init__()
        self.lstm = lstm
        self.seg_len = seg_len
        self.hidden_dim = lstm.hidden_size
        self.mode = mode.lower()
        if self.mode not in {"residual", "gated", "soup", "sparse"}:
            raise ValueError(f"Unsupported mode '{mode}'. Choose from residual, gated, soup, sparse.")
        self.gating_dim = gating_dim or self.hidden_dim
        self.k = k
        self.device = device or torch.device("cpu")
        # Gate parameter used for gated and sparse modes (scalar per segment)
        self.gate_layer = nn.Linear(self.hidden_dim * 2, 1)

    def forward(
        self, x: torch.Tensor, h: Tuple[torch.Tensor, torch.Tensor]
    ) -> Tuple[torch.Tensor, Tuple[torch.Tensor, torch.Tensor]]:
        """Forward pass.

        Parameters
        ----------
        x : (batch, seq_len)
            Token indices or arbitrary embeddings.
        h : tuple of (h_0, c_0) shape (num_layers, batch, hidden_dim)

        Returns
        -------
        logits : (batch, seq_len, vocab)
            Output from the underlying LSTM.
        h_next : tuple of hidden states
        """
        # Allow both embedded inputs (batch, seq_len, embed_dim) and token indices (batch, seq_len)
        if x.dim() == 3:
            batch, seq_len = x.shape[0], x.shape[1]
        else:
            batch, seq_len = x.shape
        device = x.device
        # Compute base LSTM output
        lstm_out, h_next = self.lstm(x, h)   # (batch, seq_len, hidden_dim)

        # Gather cached hidden state (last hidden of each segment)
        cache = []          # list of (batch, hidden_dim)
        seg_starts = []     # start indices for each segment
        seg_ends = []       # end indices for each segment
        for start in range(0, seq_len, self.seg_len):
            end = min(start + self.seg_len, seq_len)
            seg_starts.append(start)
            seg_ends.append(end)
            seg_hidden = lstm_out[:, end-1:end, :].squeeze(1)   # (batch, hidden_dim)
            cache.append(seg_hidden)

        # Prepare an aggregation tensor
        agg = torch.zeros_like(lstm_out, device=device)

        if self.mode == "residual":
            # Simple sum of cached states broadcast over their segments
            for start, end, h_state in zip(seg_starts, seg_ends, cache):
                agg[:, start:end, :] += h_state.unsqueeze(1).expand(-1, end-start, -1)

        elif self.mode == "gated":
            # Gated residual memory (GRM) as originally implemented
            for start, end, h_state in zip(seg_starts, seg_ends, cache):
                seg_hidden_all = lstm_out[:, start:end, :]               # (batch, Ls, hidden_dim)
                seg_repr = seg_hidden_all.mean(dim=1)                    # (batch, hidden_dim)
                gate_input = torch.cat([h_state, seg_repr], dim=1)       # (batch, 2*hidden_dim)
                gate = torch.sigmoid(self.gate_layer(gate_input))        # (batch, 1)
                gate_exp = gate.view(batch, 1, 1).expand(-1, end-start, -1)
                agg[:, start:end, :] += h_state.unsqueeze(1) * gate_exp

        elif self.mode == "soup":
            # Memory Soup: average of cached hidden states
            N = len(cache)
            for start, end, h_state in zip(seg_starts, seg_ends, cache):
                agg[:, start:end, :] += h_state.unsqueeze(1).expand(-1, end-start, -1)
            agg = agg / max(N, 1)

        elif self.mode == "sparse":
            # Sparse Selective Caching (SSC) – select top‑k cached segments per batch
            # Compute a relevance score for each cached segment (using same gate_input as proxy)
            scores = []
            for h_state, start, end in zip(cache, seg_starts, seg_ends):
                seg_hidden_all = lstm_out[:, start:end, :]
                seg_repr = seg_hidden_all.mean(dim=1)
                gate_input = torch.cat([h_state, seg_repr], dim=1)
                score = torch.sigmoid(self.gate_layer(gate_input))   # (batch,1) as relevance proxy
                scores.append(score.squeeze(1))                     # (batch,)
            scores_tensor = torch.stack(scores, dim=1)               # (batch, num_segments)

            # Pick top‑k segments for each batch element
            k = min(self.k, scores_tensor.size(1))
            topk_vals, topk_idx = torch.topk(scores_tensor, k, dim=1)

            # Build a mask of shape (batch, num_segments)
            mask = torch.zeros_like(scores_tensor, dtype=torch.bool)
            batch_idx = torch.arange(batch, device=device).unsqueeze(1).expand(-1, k)
            mask[batch_idx, topk_idx] = True

            # Add contributions only from selected segments
            for i, (start, end, h_state) in enumerate(zip(seg_starts, seg_ends, cache)):
                seg_mask = mask[:, i].unsqueeze(1).unsqueeze(2).float()   # (batch,1,1)
                contrib = h_state.unsqueeze(1).expand(-1, end-start, -1) * seg_mask
                agg[:, start:end, :] += contrib

        else:
            raise ValueError(f"Unsupported mode {self.mode}")

        # Final output combines base LSTM output with the aggregated memory
        out = lstm_out + agg
        return out, h_next

    def init_hidden(self, batch_size: int, device: Optional[torch.device] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """Convenience method to initialise hidden states to zeros."""
        if device is None:
            device = self.device
        h = torch.zeros(self.lstm.num_layers, batch_size, self.hidden_dim, device=device)
        c = torch.zeros(self.lstm.num_layers, batch_size, self.hidden_dim, device=device)
        return h, c

# ---------------------------------------------------------------------
# Helper for a simple language modeling head
# ---------------------------------------------------------------------
class LanguageModel(nn.Module):
    """A tiny language model that uses MemoryCachingLSTM as the backbone.

    Parameters
    ----------
    vocab_size : int
        Number of vocabulary tokens.
    embed_dim : int
        Size of the embedding matrix.
    hidden_dim : int
        Hidden size of the LSTM.
    seg_len : int
        Cache segment length.
    """

    def __init__(self, vocab_size: int, embed_dim: int, hidden_dim: int, seg_len: int,
                 mode: str = "gated", k: int = 2):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        base_lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        # Pass mode and k to the underlying MemoryCachingLSTM
        self.model = MemoryCachingLSTM(base_lstm, seg_len=seg_len, mode=mode, k=k, device=None)
        self.decoder = nn.Linear(hidden_dim, vocab_size)

    def forward(
        self, x: torch.Tensor, h: Tuple[torch.Tensor, torch.Tensor]
    ) -> Tuple[torch.Tensor, Tuple[torch.Tensor, torch.Tensor]]:
        embeds = self.embed(x)  # (batch, seq_len, embed_dim)
        out, h_next = self.model(embeds, h)
        logits = self.decoder(out)  # (batch, seq_len, vocab_size)
        return logits, h_next

    def init_hidden(self, batch_size: int, device: torch.device) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.model.init_hidden(batch_size, device)

# ---------------------------------------------------------------------
# Simple test
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Quick sanity‑check on CPU
    vocab_size = 100
    embed_dim = 32
    hidden_dim = 64
    seg_len = 20
    model = LanguageModel(vocab_size, embed_dim, hidden_dim, seg_len)
    batch = 4
    seq_len = 30
    dummy_input = torch.randint(0, vocab_size, (batch, seq_len), dtype=torch.long)
    h0 = model.init_hidden(batch, torch.device("cpu"))
    logits, h = model(dummy_input, h0)
    print("logits shape:", logits.shape)
    assert logits.shape == (batch, seq_len, vocab_size)
    print("MemoryC caching example run succeeded.")
