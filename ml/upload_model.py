#!/usr/bin/env python3
"""
upload_model.py — programmatically uploads the model directory to Hugging Face Hub.
Bypasses the deprecated/unreliable CLI.
"""

import os
import sys
from pathlib import Path
from huggingface_hub import HfApi, login, get_token
from huggingface_hub.errors import RepositoryNotFoundError

MODELS_DIR = Path("models")
MODEL_FILE = MODELS_DIR / "stress_pipeline.joblib"
REPO_ID = "RishiAP/stress-detection-pipeline"


def main():
    # 1. Verify files exist
    if not MODELS_DIR.exists():
        print(f"[ERROR] Models directory not found at {MODELS_DIR}. Run training first.")
        sys.exit(1)

    if not MODEL_FILE.exists():
        print(f"[ERROR] Model file {MODEL_FILE} not found. Run training first.")
        sys.exit(1)

    print(f"[INFO] Verified model exists at: {MODEL_FILE}")

    # 2. Handle Authentication
    token = get_token()

    if not token:
        print("\n=== Hugging Face Authentication ===")
        print("Go to: https://huggingface.co/settings/tokens")
        print("Create a token with 'Write' access, then paste it below.")
        try:
            token = input("HF Access Token: ").strip()
        except KeyboardInterrupt:
            print("\n[INFO] Upload cancelled by user.")
            sys.exit(0)

        if not token:
            print("[ERROR] Token cannot be empty.")
            sys.exit(1)

    # Login to Hugging Face
    try:
        login(token=token, add_to_git_credential=True)
    except Exception as e:
        print(f"[ERROR] Authentication failed: {e}")
        sys.exit(1)

    # 3. Upload Folder
    api = HfApi()
    print(f"[INFO] Uploading contents of {MODELS_DIR} to HF Repository: {REPO_ID}...")

    try:
        # Create repo if it doesn't exist
        api.create_repo(repo_id=REPO_ID, repo_type="model", exist_ok=True)

        # Upload the whole folder to root of the repo
        api.upload_folder(
            folder_path=str(MODELS_DIR),
            repo_id=REPO_ID,
            repo_type="model",
        )
        print("\n[DONE] Upload completed successfully!")
        print(f"Model card & pipeline page: https://huggingface.co/{REPO_ID}\n")

    except RepositoryNotFoundError:
        print(f"[ERROR] Repository {REPO_ID} not found. Make sure you typed the correct repo name and have permissions.")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Upload failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
