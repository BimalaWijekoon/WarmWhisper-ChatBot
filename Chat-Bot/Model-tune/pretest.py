import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

# Define the path for the fine-tuned model and tokenizer
finetuned_model_dir = "./pretrained"  # Directory where the fine-tuned model is saved

# Load the fine-tuned model and tokenizer from the saved directory
tokenizer = AutoTokenizer.from_pretrained(os.path.join(finetuned_model_dir, "tokenizer"))
model = AutoModelForSequenceClassification.from_pretrained(os.path.join(finetuned_model_dir, "model"))

# Define the emotion labels from the fine-tuned model
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring", 
    "confusion", "curiosity", "desire", "disappointment", "disapproval", 
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief", 
    "joy", "love", "nervousness", "optimism", "pride", "realization", "relief", 
    "remorse", "sadness", "surprise", "neutral"
]

# Function to predict emotions and display probabilities for a given text
def predict_emotion(text):
    # Tokenize the input text
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
    
    # Get the model outputs
    with torch.no_grad():  # Disable gradient calculations for inference
        outputs = model(**inputs)
    
    # Apply sigmoid activation to get probabilities for each emotion
    probabilities = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
    
    # Return all emotions sorted by probability in descending order
    predicted_emotions = sorted(
        [(emotion_labels[i], prob) for i, prob in enumerate(probabilities)], 
        key=lambda x: x[1], 
        reverse=True
    )
    
    return predicted_emotions

# Interactive loop for user input
print("Emotion Prediction using Fine-tuned Model")
print("Enter your text below, or type 'exit' to quit:")

while True:
    user_input = input("\nYour text: ")
    if user_input.lower() == 'exit':
        print("Exiting the emotion predictor. Goodbye!")
        break
    
    # Predict emotions
    predictions = predict_emotion(user_input)
    
    # Display predictions
    print(f"\nPredicted emotions for your text:")
    for emotion, prob in predictions:
        print(f"{emotion}: {prob:.4f}")
