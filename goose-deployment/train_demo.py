#!/usr/bin/env python3
"""
train_demo.py

Demo script for the Gated Residual Memory (GRM) variant of Memory Caching.
This version uses a synthetic random dataset, avoiding heavy external
dependencies (torchtext, datasets, etc.) and runs entirely with PyTorch,
which is already provided by the system package `python3-torch`.
"""

import argparse
import math
import torch
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

from memory_caching import LanguageModel

class RandomDataset(Dataset):
    """Simple random integer dataset for language‑modeling demo.
    Generates sequences of token IDs drawn uniformly from
    ``[0, vocab_size)``. The last token is treated as the <eos> marker.
    """
    def __init__(self, vocab_size: int, seq_len: int, total_sequences: int):
        self.vocab_size = vocab_size
        self.seq_len = seq_len
        self.total = total_sequences

    def __len__(self):
        return self.total

    def __getitem__(self, idx):
        seq = torch.randint(0, self.vocab_size, (self.seq_len,), dtype=torch.long)
        # Target is next‑token shifted by one; last position gets <eos>
        tgt = torch.empty_like(seq)
        tgt[:-1] = seq[1:]
        tgt[-1] = self.vocab_size - 1  # reserve last id as <eos>
        return seq, tgt

def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    vocab_size = args.vocab
    embed_dim = args.embed
    hidden_dim = args.hidden
    seg_len = args.seg_len
    mode = args.mode
    k = args.k

    model = LanguageModel(vocab_size, embed_dim, hidden_dim, seg_len, mode=mode, k=k).to(device)
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    train_dataset = RandomDataset(vocab_size, args.seq_len, args.num_train)
    val_dataset   = RandomDataset(vocab_size, args.seq_len, args.num_val)

    train_loader = DataLoader(train_dataset, batch_size=args.batch, shuffle=True)
    val_loader   = DataLoader(val_dataset, batch_size=args.batch, shuffle=False)

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in tqdm(train_loader, desc=f"Epoch {epoch} [train]"):
            xb, yb = xb.to(device), yb.to(device)
            h0 = model.init_hidden(xb.size(0), device)
            logits, _ = model(xb, h0)
            loss = criterion(logits.view(-1, vocab_size), yb.view(-1))
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        avg_loss = total_loss / len(train_loader)
        print(f"Epoch {epoch} | Train loss: {avg_loss:.4f} | Perplexity: {math.exp(avg_loss):.2f}")

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                h0 = model.init_hidden(xb.size(0), device)
                logits, _ = model(xb, h0)
                loss = criterion(logits.view(-1, vocab_size), yb.view(-1))
                val_loss += loss.item()
        val_avg = val_loss / len(val_loader)
        print(f"Epoch {epoch} | Val   loss: {val_avg:.4f} | Perplexity: {math.exp(val_avg):.2f}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GRM demo with synthetic data")
    parser.add_argument("--batch", type=int, default=64, help="Batch size")
    parser.add_argument("--epochs", type=int, default=3, help="Number of epochs")
    parser.add_argument("--seq_len", type=int, default=30, help="Sequence length")
    parser.add_argument("--vocab", type=int, default=1000, help="Vocabulary size (including <eos>)")
    parser.add_argument("--embed", type=int, default=128, help="Embedding dimension")
    parser.add_argument("--hidden", type=int, default=256, help="Hidden dimension")
    parser.add_argument("--seg_len", type=int, default=20, help="Cache segment length")
    parser.add_argument("--mode", type=str, default="gated", choices=["residual", "gated", "soup", "sparse"], help="Memory caching mode")
    parser.add_argument("--k", type=int, default=2, help="Top‑k segments for sparse mode")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--num_train", type=int, default=5000, help="Number of training sequences")
    parser.add_argument("--num_val", type=int, default=500, help="Number of validation sequences")
    args = parser.parse_args()
    main(args)
