# Step 1: Import necessary libraries
from datasets import load_dataset
from transformers import DistilBertTokenizer
import torch
from sklearn.model_selection import train_test_split
import pandas as pd

# Step 2: Load the GO Emotions dataset
ds = load_dataset("google-research-datasets/go_emotions", "simplified")

# Step 3: Tokenizer initialization (DistilBERT)
tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')

# Step 4: Preprocessing the dataset

def preprocess_function(examples):
    # Tokenize the text
    return tokenizer(examples['text'], truncation=True, padding='max_length', max_length=128)

# Apply the preprocessing function to all datasets (train, validation, test)
encoded_ds = ds.map(preprocess_function, batched=True)

# Step 5: Convert the labels into a format that the model can use
# The labels are in a multi-label format, so we need to use them in a suitable way
def convert_labels(example):
    # Convert list of labels into tensor (1 for present, 0 for not)
    example['labels'] = torch.tensor(example['labels'])
    return example

encoded_ds = encoded_ds.map(convert_labels)

# Step 6: Split the data into train, validation, and test datasets
train_dataset = encoded_ds['train']
validation_dataset = encoded_ds['validation']
test_dataset = encoded_ds['test']

# Step 7: Save the processed data into CSV or JSON for future use in training
train_df = pd.DataFrame(train_dataset)
validation_df = pd.DataFrame(validation_dataset)
test_df = pd.DataFrame(test_dataset)

# Save the dataframes as CSV files
train_df.to_csv('train_data.csv', index=False)
validation_df.to_csv('validation_data.csv', index=False)
test_df.to_csv('test_data.csv', index=False)

# Alternatively, you can also save them as JSON if needed
train_df.to_json('train_data.json', orient='records', lines=True)
validation_df.to_json('validation_data.json', orient='records', lines=True)
test_df.to_json('test_data.json', orient='records', lines=True)

print("Dataset preparation complete!")
