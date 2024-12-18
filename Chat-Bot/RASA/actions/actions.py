from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os
import random

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

class ActionProcessMessage(Action):
    def name(self) -> Text:
        return "action_process_message"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
    
        # Always get the latest first name from the message
        first_name = tracker.latest_message.get('metadata', {}).get('first_name', 'User')
    
        # Always update the slot with the latest first name
        return [SlotSet('first_name', first_name)]


class ActionRespondToEmotion(Action):
    def name(self) -> Text:
        return "action_respond_to_emotion"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get the current emotion and first name
        emotion = tracker.get_slot('emotion')
        first_name = tracker.get_slot('first_name') or 'User'

        # Define the responses for each emotion
        responses_dict = {
            "admiration": [
                "I understand how you're feeling, {first_name}. It's completely normal to experience admiration.",
                "Thank you for sharing, {first_name}. Admiration can be really uplifting, and I'm glad you're feeling that.",
                "I hear you, {first_name}. Admiration can be a positive and fulfilling feeling. Let's embrace it together."
            ],
            "amusement": [
                "I understand how you're feeling, {first_name}. Amusement can bring a lightness to the heart.",
                "Thank you for sharing, {first_name}. Amusement often brings a smile. It's great to see you feeling that way.",
                "I hear you, {first_name}. Amusement is such a joyful emotion, and it's good to feel that way."
            ],
            "anger": [
                "I understand how you're feeling, {first_name}. It's okay to feel anger—it's a natural response.",
                "Thank you for sharing, {first_name}. Anger can be overwhelming, but acknowledging it is the first step to managing it.",
                "I hear you, {first_name}. Anger can be tough, but I'm here to help you work through it."
            ],
            "annoyance": [
                "I understand how you're feeling, {first_name}. Annoyance can be frustrating, but it's something everyone experiences.",
                "Thank you for sharing, {first_name}. Annoyance is natural, but I'm here to support you as you move past it.",
                "I hear you, {first_name}. Annoyance can be tough, but you're not alone in feeling that way."
            ],
            "approval": [
                "I understand how you're feeling, {first_name}. Approval can feel reassuring, like you're on the right track.",
                "Thank you for sharing, {first_name}. Feeling approved can boost your confidence and self-worth.",
                "I hear you, {first_name}. It's wonderful to feel approval, and I'm happy to support you."
            ],
            "caring": [
                "I understand how you're feeling, {first_name}. Caring is such a beautiful and empathetic emotion.",
                "Thank you for sharing, {first_name}. Caring shows your deep compassion for others and yourself.",
                "I hear you, {first_name}. Caring is a kind emotion, and it's great that you're feeling it."
            ],
            "confusion": [
                "I understand how you're feeling, {first_name}. Confusion can be disorienting, but I'm here to help you find clarity.",
                "Thank you for sharing, {first_name}. Confusion is a common feeling, and we can work through it together.",
                "I hear you, {first_name}. Confusion can be overwhelming, but you're not alone in it."
            ],
            "curiosity": [
                "I understand how you're feeling, {first_name}. Curiosity is a wonderful emotion—it drives us to learn more.",
                "Thank you for sharing, {first_name}. Curiosity can lead to new discoveries, and I'm here to explore with you.",
                "I hear you, {first_name}. Curiosity is exciting—it's great that you're open to learning and exploring."
            ],
            "desire": [
                "I understand how you're feeling, {first_name}. Desire is a powerful emotion that often pushes us toward our goals.",
                "Thank you for sharing, {first_name}. Desire can motivate us, and I'm here to support you in chasing what you want.",
                "I hear you, {first_name}. Desire can be intense, but it's also the drive that fuels change."
            ],
            "disappointment": [
                "I understand how you're feeling, {first_name}. Disappointment can be hard, but it's also part of the learning process.",
                "Thank you for sharing, {first_name}. Disappointment can sting, but it doesn't define you—it's just a moment.",
                "I hear you, {first_name}. Disappointment is tough, but it's okay to feel it and work through it."
            ],
            "joy": [
                "I understand how you're feeling, {first_name}. Joy is such a bright and uplifting emotion.",
                "Thank you for sharing, {first_name}. Joy fills us with energy and happiness, and it's wonderful to see you feeling it.",
                "I hear you, {first_name}. Joy is contagious, and I'm happy to see you embracing it."
            ],
            "sadness": [
                "I understand how you're feeling, {first_name}. Sadness is a heavy emotion, and it's okay to feel it.",
                "Thank you for sharing, {first_name}. Sadness can feel deep, but it's a part of the emotional experience.",
                "I hear you, {first_name}. Sadness can be overwhelming, but it's something we can work through together."
            ],
            "neutral": [
                "I understand how you're feeling, {first_name}. Feeling neutral can sometimes feel like you're in the middle of everything.",
                "Thank you for sharing, {first_name}. Neutral feelings are natural and can help you recharge.",
                "I hear you, {first_name}. Feeling neutral is a valid emotion—it's okay to just be in the moment."
            ],
            "default": [
                "I understand how you're feeling, {first_name}. Your emotions are important.",
                "Thank you for sharing, {first_name}. I'm here to listen and support you.",
                "I hear you, {first_name}. Every emotion is valid and meaningful."
            ]
        }

        # Choose the appropriate response set
        emotion_responses = responses_dict.get(emotion, responses_dict["default"])

        # Select a random response and format it with the first name
        response = random.choice(emotion_responses).format(first_name=first_name, emotion=emotion)

        # Send the response
        dispatcher.utter_message(text=response)

        return []
