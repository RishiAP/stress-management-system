#!/usr/bin/env python3
"""
Main entry point for the ML training pipeline.

Usage:
    # Full pipeline: build features → LOSO comparison → train final model
    python -m src.main

    # Just build the feature matrix (saves to results/features.csv)
    python -m src.main --features-only

    # Skip feature extraction (load from saved CSV)
    python -m src.main --load-features results/features.csv
"""

import argparse
import logging
import sys

import pandas as pd

from src.config import RESULTS_DIR, FEATURE_NAMES
from src.feature_matrix import build_full_dataset
from src.evaluation import run_full_comparison, print_comparison_summary
from src.train import train_final_model, save_pipeline, verify_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Hybrid Stress System — ML Training Pipeline",
    )
    parser.add_argument(
        "--features-only", action="store_true",
        help="Only build the feature matrix, skip training.",
    )
    parser.add_argument(
        "--load-features", type=str, default=None,
        help="Load features from a saved CSV instead of extracting.",
    )
    parser.add_argument(
        "--skip-comparison", action="store_true",
        help="Skip the 3×3 LOSO comparison, train final model directly.",
    )
    parser.add_argument(
        "--model", type=str, default="RF", choices=["RF", "XGB", "LGBM"],
        help="Model to use for final training (default: RF).",
    )
    parser.add_argument(
        "--strategy", type=str, default="weighted",
        choices=["none", "weighted", "smote"],
        help="Imbalance strategy for final training (default: weighted).",
    )
    args = parser.parse_args()

    # ── Step 1: Feature Matrix ──────────────────────────────────────────
    if args.load_features:
        logger.info("Loading features from %s", args.load_features)
        df = pd.read_csv(args.load_features)
    else:
        logger.info("Building feature matrix from WESAD dataset...")
        df = build_full_dataset()

        # Save for reuse
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        features_path = RESULTS_DIR / "features.csv"
        df.to_csv(features_path, index=False)
        logger.info("Features saved to %s", features_path)

    logger.info("Feature matrix: %d rows × %d columns", *df.shape)

    if args.features_only:
        logger.info("--features-only: stopping after feature extraction.")
        return

    # ── Step 2: LOSO Comparison ─────────────────────────────────────────
    if not args.skip_comparison:
        logger.info("Running 3×3 LOSO model comparison...")
        comparison_df = run_full_comparison(df)
        print_comparison_summary(comparison_df)
    else:
        logger.info("Skipping LOSO comparison (--skip-comparison).")

    # ── Step 3: Final Model Training ────────────────────────────────────
    logger.info("Training final model: %s + %s", args.model, args.strategy)
    pipeline = train_final_model(df, args.model, args.strategy)

    # ── Step 4: Serialize ───────────────────────────────────────────────
    pipeline_path = save_pipeline(pipeline)

    # ── Step 5: Verify ──────────────────────────────────────────────────
    X_sample = df[FEATURE_NAMES].values[:5]
    verify_pipeline(pipeline_path, X_sample)

    logger.info("Pipeline complete. Artifact: %s", pipeline_path)


if __name__ == "__main__":
    main()
