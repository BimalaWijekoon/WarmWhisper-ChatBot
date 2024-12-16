import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Define the path for the fine-tuned model and tokenizer
finetuned_model_dir = "../Model-tune/finetuned"  # Correct path from actions folder to Model-tune/finetuned

try:
    # Load the fine-tuned model and tokenizer from the saved directory
    tokenizer = AutoTokenizer.from_pretrained(os.path.join(finetuned_model_dir, "tokenizer"))
    model = AutoModelForSequenceClassification.from_pretrained(os.path.join(finetuned_model_dir, "model"))

    # Check if the model and tokenizer are loaded successfully
    print("Model and tokenizer loaded successfully!")
    print("Model architecture:", model.config.architectures)
    print("Number of labels:", model.config.num_labels)

except Exception as e:
    print("Error loading model or tokenizer:", e)
