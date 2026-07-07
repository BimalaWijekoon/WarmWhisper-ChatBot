"""
WarmWhisper v2 — RASA Custom Actions
-------------------------------------
Phase 1: Fixed slot-based distress detection (not brittle string-match)
Phase 3: MAG memory retrieval (feature-flagged behind MAG_ENABLED)
"""

from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os
import random
import requests

# ── Model loading ─────────────────────────────────────────────────────────────
MODEL_DIR = "../Model-tune/finetuned"
tokenizer = AutoTokenizer.from_pretrained(os.path.join(MODEL_DIR, "tokenizer"))
model = AutoModelForSequenceClassification.from_pretrained(os.path.join(MODEL_DIR, "model"))

# ── Feature flags ─────────────────────────────────────────────────────────────
MAG_ENABLED = os.environ.get("MAG_ENABLED", "false").lower() == "true"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")

# ── Emotion labels (28: 27 GoEmotions + neutral) ──────────────────────────────
EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization", "relief",
    "remorse", "sadness", "surprise", "neutral"
]

# ── Distress emotions that trigger emergency alert ────────────────────────────
# Phase 1 fix: defined centrally here so RASA slot value drives the alert,
# matching the same set in frontend/src/services/emailService.js
DISTRESS_EMOTIONS = {
    "sadness", "grief", "fear", "nervousness", "remorse",
    "disappointment", "disgust"
}
DISTRESS_CONFIDENCE_THRESHOLD = 0.60


def predict_emotion(text: str) -> List[tuple]:
    """
    Predict emotions for the given text using the fine-tuned RoBERTa model.

    Args:
        text: Input text to classify
    Returns:
        List of (emotion, probability) tuples, sorted by probability desc
    """
    try:
        inputs = tokenizer(
            text, return_tensors="pt", truncation=True,
            padding=True, max_length=128
        )
        with torch.no_grad():
            outputs = model(**inputs)

        probabilities = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()

        predicted = [
            (EMOTION_LABELS[i], float(prob))
            for i, prob in enumerate(probabilities)
            if prob > 0.2
        ]
        return sorted(predicted, key=lambda x: x[1], reverse=True)

    except Exception as e:
        print(f"[actions.py] Error in emotion prediction: {e}")
        return []


def fetch_memory_context(email: str) -> dict:
    """
    Fetch relevant memory context from the MAG memory service.
    Returns empty dict if MAG is disabled or fetch fails.
    """
    if not MAG_ENABLED or not email:
        return {}
    try:
        resp = requests.get(
            f"{BACKEND_URL}/memory/{email}/context",
            timeout=2  # never slow down chat for memory fetch
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"[actions.py] Memory fetch failed (non-blocking): {e}")
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# ACTION: Detect Emotion
# ─────────────────────────────────────────────────────────────────────────────
class ActionDetectEmotion(Action):
    def name(self) -> Text:
        return "action_detect_emotion"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:

        user_message = tracker.latest_message.get("text", "")

        if not user_message:
            return [
                SlotSet("emotion", "neutral"),
                SlotSet("fallback_triggered", False),
            ]

        predicted = predict_emotion(user_message)

        if predicted:
            top_emotion, top_prob = predicted[0]
        else:
            top_emotion, top_prob = "neutral", 0.0

        # Phase 1: distress flag via slot — frontend reads this slot to decide
        # whether to call EmailJS. This is more reliable than string matching.
        is_distress = (
            top_emotion in DISTRESS_EMOTIONS
            and top_prob >= DISTRESS_CONFIDENCE_THRESHOLD
        )

        events = [
            SlotSet("emotion", top_emotion),
            SlotSet("fallback_triggered", False),
            SlotSet("is_distress", is_distress),
        ]

        # Phase 3 MAG: fetch and inject memory context if enabled
        email = tracker.latest_message.get("metadata", {}).get("email", "")
        memory = fetch_memory_context(email)
        if memory:
            import json
            events.append(SlotSet("memory_context", json.dumps(memory)))

        return events


# ─────────────────────────────────────────────────────────────────────────────
# ACTION: Process Message (extracts user metadata → slots)
# ─────────────────────────────────────────────────────────────────────────────
class ActionProcessMessage(Action):
    def name(self) -> Text:
        return "action_process_message"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:
        metadata = tracker.latest_message.get("metadata", {})
        first_name = metadata.get("first_name", "User")
        return [SlotSet("first_name", first_name)]


# ─────────────────────────────────────────────────────────────────────────────
# ACTION: Respond To Emotion
# ─────────────────────────────────────────────────────────────────────────────
class ActionRespondToEmotion(Action):
    def name(self) -> Text:
        return "action_respond_to_emotion"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:

        emotion   = tracker.get_slot("emotion") or "neutral"
        first_name = tracker.get_slot("first_name") or "Friend"
        is_distress = tracker.get_slot("is_distress") or False

        # Phase 3 MAG: try to use memory context for personalised reply
        memory_hint = ""
        if MAG_ENABLED:
            import json
            raw_memory = tracker.get_slot("memory_context") or ""
            try:
                memory = json.loads(raw_memory) if raw_memory else {}
                semantic = memory.get("semanticMemory") or {}
                coping = semantic.get("copingStrategies", [])
                themes = semantic.get("themes", [])
                if coping:
                    memory_hint = f" Last time, {coping[0]} seemed to help you."
                elif themes:
                    memory_hint = f" I remember you mentioned {themes[0]} before."
            except Exception:
                pass

        responses_dict = {
            "admiration": [
                "I understand how you're feeling, {first_name}. It's completely normal to feel admiration.",
                "Thank you for sharing, {first_name}. Admiration can be really uplifting!",
                "I hear you, {first_name}. Admiration is a wonderful emotion to embrace.",
            ],
            "amusement": [
                "I'm glad you're feeling amused, {first_name}! It's great to have moments of lightness.",
                "Thank you for sharing, {first_name}. Amusement often brings a smile.",
                "I hear you, {first_name}. Amusement is such a joyful emotion!",
            ],
            "anger": [
                "I understand how you're feeling, {first_name}. It's okay to feel anger — it's a natural response.",
                "Thank you for sharing, {first_name}. Anger can be overwhelming, but acknowledging it is the first step.",
                "I hear you, {first_name}. Anger can be tough, but I'm here to help you work through it.",
            ],
            "annoyance": [
                "I understand how you're feeling, {first_name}. Annoyance can be frustrating.",
                "Thank you for sharing, {first_name}. Annoyance is natural — I'm here to support you.",
                "I hear you, {first_name}. You're not alone in feeling that way.",
            ],
            "approval": [
                "I understand how you're feeling, {first_name}. Feeling approved can be very reassuring.",
                "Thank you for sharing, {first_name}. That sense of approval can really boost your confidence.",
                "I hear you, {first_name}. It's wonderful to feel that kind of validation.",
            ],
            "caring": [
                "I understand how you're feeling, {first_name}. Caring is such a beautiful emotion.",
                "Thank you for sharing, {first_name}. Your compassion really shines through.",
                "I hear you, {first_name}. Caring is a kind and empathetic emotion.",
            ],
            "confusion": [
                "I understand how you're feeling, {first_name}. Confusion can be disorienting — I'm here to help you find clarity.",
                "Thank you for sharing, {first_name}. Confusion is common and we can work through it together.",
                "I hear you, {first_name}. Let's take it one step at a time.",
            ],
            "curiosity": [
                "I understand how you're feeling, {first_name}. Curiosity is a wonderful emotion that drives us forward.",
                "Thank you for sharing, {first_name}. Curiosity can lead to amazing discoveries!",
                "I hear you, {first_name}. That sense of curiosity is exciting.",
            ],
            "desire": [
                "I understand how you're feeling, {first_name}. Desire is a powerful emotion that pushes us toward our goals.",
                "Thank you for sharing, {first_name}. I'm here to support you in chasing what you want.",
                "I hear you, {first_name}. Desire can be intense but it's also what fuels change.",
            ],
            "disappointment": [
                "I understand how you're feeling, {first_name}. Disappointment can be hard, but it's part of the journey.",
                "Thank you for sharing, {first_name}. Disappointment can sting, but it doesn't define you.",
                "I hear you, {first_name}. It's okay to feel this — we can work through it.",
            ],
            "disapproval": [
                "I hear you, {first_name}. Feeling disapproval can be heavy — your feelings are valid.",
                "Thank you for sharing, {first_name}. I'm here to listen and support you.",
                "I understand, {first_name}. Let's talk through what's weighing on you.",
            ],
            "disgust": [
                "I understand, {first_name}. Disgust can feel intense and overwhelming.",
                "Thank you for sharing, {first_name}. Your feelings are completely valid.",
                "I hear you, {first_name}. Let's work through this feeling together.",
            ],
            "embarrassment": [
                "I hear you, {first_name}. Embarrassment is something everyone experiences — you're not alone.",
                "Thank you for sharing, {first_name}. It takes courage to open up about that.",
                "I understand, {first_name}. Let's work through it together.",
            ],
            "excitement": [
                "I love hearing that, {first_name}! Excitement is such an energising emotion.",
                "Thank you for sharing, {first_name}. Let that excitement carry you forward!",
                "I hear you, {first_name}. Excitement is wonderful — embrace it!",
            ],
            "fear": [
                "I understand how you're feeling, {first_name}. Fear can be overwhelming, but you're safe here.",
                "Thank you for trusting me, {first_name}. Fear is a natural response — let's face it together.",
                "I hear you, {first_name}. It's brave to acknowledge fear. I'm here with you.",
            ],
            "gratitude": [
                "That's beautiful, {first_name}. Gratitude can really shift our perspective positively.",
                "Thank you for sharing, {first_name}. Feeling grateful is such a powerful emotion.",
                "I hear you, {first_name}. Gratitude is one of the most uplifting feelings.",
            ],
            "grief": [
                "I'm so sorry you're feeling this, {first_name}. Grief is one of the heaviest emotions to carry.",
                "Thank you for trusting me, {first_name}. Grief takes time, and I'm here for you.",
                "I hear you, {first_name}. You don't have to go through this alone.",
            ],
            "joy": [
                "I understand how you're feeling, {first_name}. Joy is such a bright and uplifting emotion!",
                "Thank you for sharing, {first_name}. Joy fills us with energy — it's wonderful to see you feeling this!",
                "I hear you, {first_name}. Joy is contagious, and I'm happy for you!",
            ],
            "love": [
                "That's wonderful, {first_name}. Love is one of the most powerful and beautiful emotions.",
                "Thank you for sharing, {first_name}. Feeling love — for others or yourself — is truly special.",
                "I hear you, {first_name}. Love can be such a transformative feeling.",
            ],
            "nervousness": [
                "I understand, {first_name}. Nervousness is very normal — take a deep breath with me.",
                "Thank you for sharing, {first_name}. Feeling nervous shows you care deeply about something.",
                "I hear you, {first_name}. Let's work through that nervousness together, step by step.",
            ],
            "optimism": [
                "I love that, {first_name}! Optimism is such a powerful mindset.",
                "Thank you for sharing, {first_name}. Your optimism can carry you far.",
                "I hear you, {first_name}. That hopeful outlook is something to hold onto.",
            ],
            "pride": [
                "That's amazing, {first_name}! You should feel proud — that's a real accomplishment.",
                "Thank you for sharing, {first_name}. Pride in your achievements is well deserved.",
                "I hear you, {first_name}. Feeling proud is a great reminder of how far you've come.",
            ],
            "realization": [
                "I understand, {first_name}. Moments of realisation can be both enlightening and overwhelming.",
                "Thank you for sharing, {first_name}. That kind of clarity can be powerful.",
                "I hear you, {first_name}. Realisation is the first step toward meaningful change.",
            ],
            "relief": [
                "I'm so glad you're feeling some relief, {first_name}!",
                "Thank you for sharing, {first_name}. Relief can feel like a weight lifted.",
                "I hear you, {first_name}. Hold onto that feeling — you've earned it.",
            ],
            "remorse": [
                "I understand, {first_name}. Remorse shows how much you care — your feelings are valid.",
                "Thank you for sharing, {first_name}. It takes courage to sit with remorse.",
                "I hear you, {first_name}. Let's work through it together — self-compassion matters too.",
            ],
            "sadness": [
                "I understand how you're feeling, {first_name}. Sadness is a heavy emotion, and it's okay to feel it.",
                "Thank you for sharing, {first_name}. Sadness can feel deep, but you're not alone in it.",
                "I hear you, {first_name}. Sadness is something we can work through together, one step at a time.",
            ],
            "surprise": [
                "I understand, {first_name}. Surprises can be a lot to process — good or not so good!",
                "Thank you for sharing, {first_name}. How are you feeling about this surprise?",
                "I hear you, {first_name}. Let's talk through what happened.",
            ],
            "neutral": [
                "I understand how you're feeling, {first_name}. Feeling neutral can sometimes mean you're in a steady place.",
                "Thank you for sharing, {first_name}. Neutral feelings are natural and can help you recharge.",
                "I hear you, {first_name}. Being in the moment, just as you are, is completely valid.",
            ],
            "default": [
                "I understand how you're feeling, {first_name}. Your emotions are important.",
                "Thank you for sharing, {first_name}. I'm here to listen and support you.",
                "I hear you, {first_name}. Every emotion is valid and meaningful.",
            ],
        }

        emotion_responses = responses_dict.get(emotion, responses_dict["default"])
        response_template = random.choice(emotion_responses)
        response = response_template.format(first_name=first_name, emotion=emotion)

        # Append memory-personalised hint if available
        if memory_hint:
            response = response + memory_hint

        dispatcher.utter_message(text=response)

        # Phase 3: if distress detected, include a support-signal metadata
        # The frontend watches for is_distress=true slot to trigger EmailJS
        if is_distress:
            dispatcher.utter_message(
                text=(
                    f"I've noticed you might be having a really tough time, {first_name}. "
                    "Remember, it's okay to reach out for help. "
                    "I'm letting your trusted contact know that you might need some support right now."
                )
            )

        return []
