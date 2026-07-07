"""
WarmWhisper v2 — Emotion Model Canary Test (Phase 1)
------------------------------------------------------
Tests that the fine-tuned RoBERTa model produces expected top-emotion
labels for a fixed set of inputs. Run this after any model change to
verify the 99% accuracy baseline is preserved.

Run:
    cd Chat-Bot/RASA
    python ../Model-tune/finetest_canary.py
"""

import os
import sys

MODEL_DIR = os.path.join(os.path.dirname(__file__), "finetuned")

EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization", "relief",
    "remorse", "sadness", "surprise", "neutral"
]

# Fixed test cases: (input_text, expected_top_emotion)
CANARY_CASES = [
    ("I'm feeling really happy and excited today!",          "joy"),
    ("I feel so deeply sad and hopeless.",                   "sadness"),
    ("I'm absolutely terrified right now.",                  "fear"),
    ("I'm so angry I can't stop shaking.",                   "anger"),
    ("I feel overwhelmed with grief after losing someone.",  "grief"),
    ("Thank you so much, I'm incredibly grateful.",         "gratitude"),
    ("I love you so much, you mean the world to me.",       "love"),
    ("I'm nervous about the big presentation tomorrow.",    "nervousness"),
    ("I feel so confused and lost right now.",               "confusion"),
    ("I'm just okay, nothing special going on.",            "neutral"),
]

CONFIDENCE_THRESHOLD = 0.20  # matches actions.py filter threshold


def run_canary():
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch
    except ImportError:
        print("ERROR: transformers and torch must be installed.")
        sys.exit(1)

    tokenizer_path = os.path.join(MODEL_DIR, "tokenizer")
    model_path     = os.path.join(MODEL_DIR, "model")

    if not os.path.exists(tokenizer_path) or not os.path.exists(model_path):
        print(f"ERROR: Fine-tuned model not found at {MODEL_DIR}")
        print("Run Model-tune/tune.py first to generate the model.")
        sys.exit(1)

    print("Loading fine-tuned model...")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
    model     = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()
    print("Model loaded.\n")

    passed = 0
    failed = 0
    results = []

    for text, expected in CANARY_CASES:
        inputs = tokenizer(text, return_tensors="pt", truncation=True,
                           padding=True, max_length=128)
        with __import__('torch').no_grad():
            outputs = model(**inputs)

        import torch
        probs = torch.sigmoid(outputs.logits).squeeze().tolist()
        scored = [(EMOTION_LABELS[i], p) for i, p in enumerate(probs) if p > CONFIDENCE_THRESHOLD]
        scored.sort(key=lambda x: x[1], reverse=True)

        top_emotion = scored[0][0] if scored else "neutral"
        top_conf    = scored[0][1] if scored else 0.0
        ok = top_emotion == expected

        results.append((text[:55], expected, top_emotion, f"{top_conf:.2f}", "✅" if ok else "❌"))
        if ok:
            passed += 1
        else:
            failed += 1

    # Print results table
    print(f"{'Input':<55}  {'Expected':<14} {'Got':<14} {'Conf':<6} {'OK'}")
    print("-" * 100)
    for row in results:
        print(f"{row[0]:<55}  {row[1]:<14} {row[2]:<14} {row[3]:<6} {row[4]}")

    print(f"\n{'─'*100}")
    print(f"Canary Results: {passed}/{len(CANARY_CASES)} passed")

    if failed > 0:
        print(f"❌ {failed} canary test(s) FAILED — baseline accuracy may have degraded!")
        sys.exit(1)
    else:
        print("✅ All canary tests passed — model baseline is intact.")


if __name__ == "__main__":
    run_canary()
