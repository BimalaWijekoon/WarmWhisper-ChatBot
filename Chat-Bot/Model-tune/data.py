from datasets import load_dataset
import pandas as pd
import os

# Directory to save the processed files
OUTPUT_DIR = "goemotions_simplified"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load the GoEmotions dataset
print("Loading GoEmotions dataset...")
dataset = load_dataset("google-research-datasets/go_emotions", "simplified")

# Convert each split to CSV and JSON
for split_name, split_data in dataset.items():
    # Convert to Pandas DataFrame
    df = split_data.to_pandas()

    # Save as CSV
    csv_path = os.path.join(OUTPUT_DIR, f"{split_name}.csv")
    df.to_csv(csv_path, index=False)
    print(f"{split_name} dataset saved as CSV: {csv_path}")

    # Save as JSON
    json_path = os.path.join(OUTPUT_DIR, f"{split_name}.json")
    df.to_json(json_path, orient="records", lines=True)
    print(f"{split_name} dataset saved as JSON: {json_path}")
