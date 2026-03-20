"""
Evaluate Model — Test a trained model's prediction quality.

Loads a trained model and runs it against a test dataset (or the validation
split of the training data) to measure how well it predicts game outcomes.

Metrics:
  - MSE: Mean squared error (lower is better, 0 = perfect)
  - Accuracy: % of positions where the sign of the prediction matches
    the actual result (win/loss only, draws excluded)
  - Correlation: How well predictions track actual outcomes

Usage:
    python -m training.evaluate_model --model models/chess_value_v1.pt --data data/training_data.pt
"""

import argparse
import os
import torch
import numpy as np

from engines.nn_model import ChessValueNetwork

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")


def evaluate_model(model_path: str, data_path: str, num_samples: int = 10000):
    """
    Evaluate a trained model on test data.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load model
    print(f"Loading model from: {model_path}")
    checkpoint = torch.load(model_path, weights_only=True, map_location=device)
    model = ChessValueNetwork(
        num_blocks=checkpoint.get("num_blocks", 4),
        num_filters=checkpoint.get("num_filters", 64),
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Load data
    print(f"Loading data from: {data_path}")
    data = torch.load(data_path, weights_only=True)
    inputs = data["inputs"]
    targets = data["targets"]

    # Use last portion as test set (wasn't used for training)
    if num_samples and num_samples < len(inputs):
        inputs = inputs[-num_samples:]
        targets = targets[-num_samples:]
    print(f"  Evaluating on {len(inputs)} positions")

    # Run predictions
    predictions_list = []
    batch_size = 512

    with torch.no_grad():
        for i in range(0, len(inputs), batch_size):
            batch = inputs[i:i + batch_size].to(device)
            preds = model(batch)
            predictions_list.append(preds.cpu())

    predictions = torch.cat(predictions_list).numpy().flatten()
    actuals = targets.numpy().flatten()

    # MSE
    mse = np.mean((predictions - actuals) ** 2)
    print(f"\n  MSE: {mse:.6f}")

    # Direction accuracy (exclude draws)
    non_draw_mask = actuals != 0.0
    if non_draw_mask.any():
        pred_signs = np.sign(predictions[non_draw_mask])
        actual_signs = np.sign(actuals[non_draw_mask])
        accuracy = np.mean(pred_signs == actual_signs) * 100
        print(f"  Direction accuracy (wins/losses only): {accuracy:.1f}%")
    else:
        print("  No decisive games in test set")

    # Prediction distribution
    print(f"\n  Prediction stats:")
    print(f"    Mean: {predictions.mean():.4f}")
    print(f"    Std:  {predictions.std():.4f}")
    print(f"    Min:  {predictions.min():.4f}")
    print(f"    Max:  {predictions.max():.4f}")

    # Correlation
    correlation = np.corrcoef(predictions, actuals)[0, 1]
    print(f"    Correlation with actual: {correlation:.4f}")

    # Sample predictions
    print(f"\n  Sample predictions (first 10):")
    print(f"    {'Predicted':>10s}  {'Actual':>8s}")
    for i in range(min(10, len(predictions))):
        print(f"    {predictions[i]:>10.4f}  {actuals[i]:>8.1f}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained chess model")
    parser.add_argument("--model", default=os.path.join(MODELS_DIR, "chess_value_v1.pt"),
                        help="Model .pt file")
    parser.add_argument("--data", default=os.path.join(DATA_DIR, "training_data.pt"),
                        help="Test data .pt file")
    parser.add_argument("--num-samples", type=int, default=10000,
                        help="Number of test positions to evaluate")
    args = parser.parse_args()

    evaluate_model(args.model, args.data, args.num_samples)


if __name__ == "__main__":
    main()
