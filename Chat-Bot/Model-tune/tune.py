import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    AutoConfig
)
import os
from torch.utils.data import Dataset
import numpy as np

# Directories for pretrained, fine-tuned model, and data
pretrained_dir = "./pretrained"
finetuned_dir = "./finetuned"
data_dir = "./data"

# Create directories if they don't exist
for directory in [pretrained_dir, finetuned_dir, data_dir]:
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"Created directory: {directory}")

# Custom dataset class
class EmotionsDataset(Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels

    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx], dtype=torch.float)  # Ensure labels are float
        return item

    def __len__(self):
        return len(self.labels)
    
# Load the GO Emotions dataset
ds = load_dataset("google-research-datasets/go_emotions", "simplified")

# Load pre-trained model and tokenizer
model_name = "SamLowe/roberta-base-go_emotions"
try:
    print("Attempting to load model from pretrained directory...")
    tokenizer = AutoTokenizer.from_pretrained(os.path.join(pretrained_dir, "tokenizer"))
    model = AutoModelForSequenceClassification.from_pretrained(os.path.join(pretrained_dir, "model"))
    print("Model loaded from pretrained directory successfully!")
except:
    print("Loading model from Hugging Face hub...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Specify the number of output labels based on the dataset
    num_labels = len(ds['train'].features['labels'].feature.names)
    config = AutoConfig.from_pretrained(model_name, num_labels=num_labels)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, config=config)
    
    # Save the initial model in the pretrained folder
    tokenizer.save_pretrained(os.path.join(pretrained_dir, "tokenizer"))
    model.save_pretrained(os.path.join(pretrained_dir, "model"))
    print("Model downloaded and saved to pretrained directory!")

# Preprocessing function
def preprocess_function(examples):
    return tokenizer(
        examples['text'],
        truncation=True,
        padding='max_length',
        max_length=128,
        return_tensors="pt"
    )

# Process datasets
def prepare_dataset(dataset):
    # Tokenize the text
    encodings = tokenizer(
        dataset['text'],
        truncation=True,
        padding='max_length',
        max_length=128,
        return_tensors="pt"
    )
    
    # Convert encodings to dict of lists
    encodings = {key: val.numpy() for key, val in encodings.items()}
    
    # Get the labels
    labels = dataset['labels']
    
    # Number of unique labels (emotions)
    num_labels = len(ds['train'].features['labels'].feature.names)
    
    # Create a binary matrix for the labels (multi-label classification)
    label_matrix = np.zeros((len(labels), num_labels), dtype=int)
    
    for i, label_list in enumerate(labels):
        for label in label_list:
            label_matrix[i, label] = 1  # Set 1 for each emotion present in the list

    return EmotionsDataset(encodings, label_matrix)

# Prepare datasets
train_dataset = prepare_dataset(ds['train'])
val_dataset = prepare_dataset(ds['validation'])
test_dataset = prepare_dataset(ds['test'])

# Create results and logs directories for fine-tuned model
results_dir = os.path.join(finetuned_dir, "results")
logs_dir = os.path.join(finetuned_dir, "logs")
os.makedirs(results_dir, exist_ok=True)
os.makedirs(logs_dir, exist_ok=True)

# Define training arguments
training_args = TrainingArguments(
    output_dir=results_dir,
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    warmup_steps=500,
    weight_decay=0.01,
    logging_dir=logs_dir,
    logging_steps=10,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
)

# Initialize trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
)

# Train the model
trainer.train()

# Save the fine-tuned model
finetuned_model_path = os.path.join(finetuned_dir, "finetuned")
os.makedirs(finetuned_model_path, exist_ok=True)
model.save_pretrained(finetuned_model_path)
tokenizer.save_pretrained(finetuned_model_path)
print(f"Fine-tuned model saved to: {finetuned_model_path}")

# Optional: Evaluate the model
eval_results = trainer.evaluate()
print(f"Evaluation Results: {eval_results}")

# Save evaluation results
eval_results_path = os.path.join(finetuned_dir, "evaluation_results.txt")
with open(eval_results_path, "w") as f:
    for key, value in eval_results.items():
        f.write(f"{key}: {value}\n")
print(f"Evaluation results saved to: {eval_results_path}")

# Example of how to use the model for prediction
def predict_emotion(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
    outputs = model(**inputs)
    predictions = torch.sigmoid(outputs.logits)  # For multi-label classification
    return predictions

# Test prediction
test_text = "I am feeling very happy today!"
prediction = predict_emotion(test_text)
print(f"Prediction for '{test_text}': {prediction}")
