import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

# Define the path for the pretrained model and tokenizer
pretrained_model_dir = "./pretrained"  # Directory where the pretrained model is saved

# Load the pre-trained model and tokenizer from the saved directory
tokenizer = AutoTokenizer.from_pretrained(os.path.join(pretrained_model_dir, "tokenizer"))
model = AutoModelForSequenceClassification.from_pretrained(os.path.join(pretrained_model_dir, "model"))

# Define the emotion labels from the pretrained model
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring", 
    "confusion", "curiosity", "desire", "disappointment", "disapproval", 
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief", 
    "joy", "love", "nervousness", "optimism", "pride", "realization", "relief", 
    "remorse", "sadness", "surprise", "neutral"
]

# Function to predict emotions and display probabilities for a given text
def predict_emotion(text, threshold=0.5):
    # Tokenize the input text
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
    
    # Get the model outputs
    with torch.no_grad():  # Disable gradient calculations for inference
        outputs = model(**inputs)
    
    # Apply sigmoid activation to get probabilities for each emotion
    probabilities = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
    
    # Display emotions and their probabilities above the threshold
    predicted_emotions = [(emotion_labels[i], prob) for i, prob in enumerate(probabilities) if prob > threshold]
    
    return predicted_emotions

# Example usage
test_text = "I'm feeling very excited about the upcoming event!"
predicted_emotions = predict_emotion(test_text)

# Display the results
if predicted_emotions:
    print(f"Predicted emotions for '{test_text}':")
    for emotion, prob in predicted_emotions:
        print(f"{emotion}: {prob:.4f}")
else:
    print(f"No significant emotions detected in '{test_text}'.")
