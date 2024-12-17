from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os

# Load the fine-tuned model and tokenizer
MODEL_DIR = "../Model-tune/finetuned"  # Updated path from the actions folder
tokenizer = AutoTokenizer.from_pretrained(os.path.join(MODEL_DIR, "tokenizer"))
model = AutoModelForSequenceClassification.from_pretrained(os.path.join(MODEL_DIR, "model"))

# Emotion labels
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization", "relief",
    "remorse", "sadness", "surprise", "neutral"
]

def predict_emotion(text: str) -> List[tuple]:
    """
    Predict emotions for the given text.
    
    Args:
        text (str): Input text to classify emotions for
    
    Returns:
        List[tuple]: List of (emotion, probability) tuples
    """
    try:
        # Tokenize input text
        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
        
        # Disable gradient calculation during inference
        with torch.no_grad():
            outputs = model(**inputs)
        
        # Get the probabilities of each emotion using sigmoid activation
        probabilities = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
        
        # Include only emotions with probability greater than 0.2
        predicted_emotions = [
            (emotion_labels[i], prob) for i, prob in enumerate(probabilities) if prob > 0.2
        ]
        
        return predicted_emotions
    
    except Exception as e:
        print(f"Error in emotion prediction: {e}")
        return []

class ActionDetectEmotion(Action):
    def name(self) -> Text:
        return "action_detect_emotion"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        # Get the latest user message
        user_message = tracker.latest_message.get('text')
        
        if user_message:
            # Predict emotions from the user's message
            predicted_emotions = predict_emotion(user_message)
            
            if predicted_emotions:
                # Sort emotions by probability in descending order
                sorted_emotions = sorted(predicted_emotions, key=lambda x: x[1], reverse=True)
                
                # Get the highest probability emotion
                top_emotion, top_probability = sorted_emotions[0]
                
                # Return events to set the emotion slot
                return [
                    SlotSet("emotion", top_emotion),
                    SlotSet("fallback_triggered", False)
                ]
            else:
                # If no emotions could be detected, set a default or neutral emotion
                return [
                    SlotSet("emotion", "neutral"),
                    SlotSet("fallback_triggered", False)
                ]
        
        # If no message was received, set a neutral emotion
        return [
            SlotSet("emotion", "neutral"),
            SlotSet("fallback_triggered", False)
        ]