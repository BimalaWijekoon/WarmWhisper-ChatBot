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

# Function to predict emotions
def predict_emotion(text):
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
                # Format detected emotions for output
                emotion_text = ", ".join([f"{emotion} ({prob:.2f})" for emotion, prob in predicted_emotions])
                dispatcher.utter_message(text=f"I see the following emotions in you: {emotion_text}. Are these emotions correct?")
            else:
                dispatcher.utter_message(text="I couldn't detect any emotions in your message.")
        else:
            dispatcher.utter_message(text="I couldn't understand your message.")

        # Reset the fallback slot to allow normal intents
        return [SlotSet("fallback_triggered", False)]
