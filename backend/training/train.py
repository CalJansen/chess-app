"""
Train — Supervised training of the chess value network.

Loads the prepared dataset, splits into train/validation, and trains the
ResNet model to predict game outcomes from board positions.

Key ML concepts used here:
  - MSE Loss: We treat this as regression (predicting a continuous value
    from -1 to +1). Mean Squared Error penalizes predictions that are far
    from the true outcome more than those that are close.

  - Adam Optimizer: An adaptive learning rate optimizer that works well
    out of the box. It maintains per-parameter learning rates and momentum.

  - Learning Rate Scheduling: ReduceLROnPlateau lowers the learning rate
    when validation loss stops improving, allowing finer-grained learning.

  - Early Stopping: If validation loss hasn't improved for `patience` epochs,
    we stop training to prevent overfitting.

  - Train/Val Split: We hold out 10% of data to monitor generalization.
    If training loss keeps dropping but validation loss rises, the model
    is memorizing rather than learning patterns.

Usage:
    python -m training.train --data data/training_data.pt --output models/chess_value_v1.pt
"""

import argparse
import os
import time
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split

from engines.nn_model import ChessValueNetwork

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")


def train_model(data_path: str, output_path: str, epochs: int = 30,
                batch_size: int = 256, learning_rate: float = 0.001,
                num_blocks: int = 4, num_filters: int = 64, patience: int = 5):
    """
    Train the chess value network.

    Args:
        data_path: Path to the .pt file from prepare_dataset
        output_path: Where to save the trained model
        epochs: Maximum training epochs
        batch_size: Samples per gradient update
        learning_rate: Initial learning rate for Adam
        num_blocks: Number of residual blocks in the network
        num_filters: Number of convolutional filters
        patience: Early stopping patience (epochs without improvement)
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Load data
    print(f"Loading dataset from: {data_path}")
    data = torch.load(data_path, weights_only=True)
    inputs = data["inputs"]   # (N, 18, 8, 8)
    targets = data["targets"]  # (N, 1)
    print(f"  Total positions: {len(inputs)}")

    # Train/validation split (90/10)
    dataset = TensorDataset(inputs, targets)
    val_size = max(1, len(dataset) // 10)
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    print(f"  Train: {train_size}, Validation: {val_size}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    # Create model
    model = ChessValueNetwork(num_blocks=num_blocks, num_filters=num_filters).to(device)
    param_count = sum(p.numel() for p in model.parameters())
    print(f"  Model parameters: {param_count:,}")

    # Loss, optimizer, scheduler
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=2
    )

    # Training loop
    best_val_loss = float("inf")
    epochs_without_improvement = 0
    best_state = None

    print(f"\nTraining for up to {epochs} epochs (patience={patience})...\n")

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        # ── Train ──
        model.train()
        train_loss = 0.0
        train_batches = 0

        for batch_inputs, batch_targets in train_loader:
            batch_inputs = batch_inputs.to(device)
            batch_targets = batch_targets.to(device)

            optimizer.zero_grad()
            predictions = model(batch_inputs)
            loss = criterion(predictions, batch_targets)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            train_batches += 1

        avg_train_loss = train_loss / train_batches

        # ── Validate ──
        model.eval()
        val_loss = 0.0
        val_batches = 0

        with torch.no_grad():
            for batch_inputs, batch_targets in val_loader:
                batch_inputs = batch_inputs.to(device)
                batch_targets = batch_targets.to(device)
                predictions = model(batch_inputs)
                loss = criterion(predictions, batch_targets)
                val_loss += loss.item()
                val_batches += 1

        avg_val_loss = val_loss / val_batches
        scheduler.step(avg_val_loss)

        elapsed = time.time() - epoch_start
        current_lr = optimizer.param_groups[0]["lr"]

        # Check for improvement
        improved = ""
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            epochs_without_improvement = 0
            improved = " *"
        else:
            epochs_without_improvement += 1

        print(
            f"  Epoch {epoch:3d}/{epochs} | "
            f"train_loss={avg_train_loss:.6f} | "
            f"val_loss={avg_val_loss:.6f} | "
            f"lr={current_lr:.6f} | "
            f"{elapsed:.1f}s{improved}"
        )

        # Early stopping
        if epochs_without_improvement >= patience:
            print(f"\n  Early stopping: no improvement for {patience} epochs")
            break

    # Save best model
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    save_dict = {
        "model_state_dict": best_state,
        "num_blocks": num_blocks,
        "num_filters": num_filters,
        "best_val_loss": best_val_loss,
        "train_positions": train_size,
    }
    torch.save(save_dict, output_path)

    print(f"\nModel saved to: {output_path}")
    print(f"  Best validation loss: {best_val_loss:.6f}")
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  File size: {file_size_mb:.1f} MB")


def main():
    parser = argparse.ArgumentParser(description="Train chess value network")
    parser.add_argument("--data", default=os.path.join(DATA_DIR, "training_data.pt"),
                        help="Training data .pt file")
    parser.add_argument("--output", default=os.path.join(MODELS_DIR, "chess_value_v1.pt"),
                        help="Output model file")
    parser.add_argument("--epochs", type=int, default=30, help="Max epochs")
    parser.add_argument("--batch-size", type=int, default=256, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--blocks", type=int, default=4, help="ResNet blocks")
    parser.add_argument("--filters", type=int, default=64, help="Conv filters")
    parser.add_argument("--patience", type=int, default=5, help="Early stopping patience")
    args = parser.parse_args()

    train_model(args.data, args.output, args.epochs, args.batch_size, args.lr,
                args.blocks, args.filters, args.patience)


if __name__ == "__main__":
    main()
