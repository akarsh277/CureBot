from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import datetime
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client["curebotDB"]
profiles = db["profiles"]

API_KEY = os.getenv("API_KEY")
WEATHER_KEY = os.getenv("WEATHER_API_KEY")
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# Build system prompt — medical friendly & safe
def build_system_prompt(language, age, gender, symptoms):
    # short language-specific instruction at top
    lang_map = {
        "english": "Respond in simple, friendly English.",
        "telugu": "Respond fully in Telugu (తెలుగు), using simple friendly tone.",
        "hindi": "Respond fully in Hindi (हिन्दी), using simple friendly tone."
    }
    base = lang_map.get(language, lang_map["english"])

    safe_meds = (
        "Only suggest commonly available over-the-counter (OTC) medicines when appropriate, "
        "such as Paracetamol (for fever/pain), ORS (for dehydration), Cetirizine (for allergies), "
        "Antacids (for acidity), simple cough syrups. Do NOT prescribe antibiotics, controlled substances, "
        "or strong prescription-only drugs. If unsure or symptoms are severe, always advise seeing a doctor."
    )

    profile_text = f"Profile: Age: {age} | Gender: {gender} | Symptoms: {symptoms}"

    prompt = f"""{base}

You are CureBot, a friendly, supportive medical assistant for quick, safe guidance.

{profile_text}

Guidelines for responses:
- Keep answers concise and easy to follow.
- Offer possible causes, simple home care, and safe OTC medicine names when relevant.
- When mentioning medicines, give the medicine name (brand/generic) and a very general mention (e.g., 'Paracetamol for fever') — do not give precise prescription-level dosing for children or special cases.
- If the symptoms indicate a potentially serious condition (chest pain, difficulty breathing, severe bleeding, unconsciousness, very high fever, signs of stroke), immediately advise urgent medical attention.
- Use the language indicated by the user and do not mix languages.
- Always include a line advising to consult a healthcare professional if symptoms persist or worsen.

Safe medicine rules:
{safe_meds}

Now respond as the assistant in the user's language.
"""
    return prompt

@app.websocket("/ws")
async def websocket_chat(ws: WebSocket):
    await ws.accept()
    user_profile = {"language": "english", "age": "", "gender": "", "symptoms": ""}

    while True:
        try:
            data = await ws.receive_json()
            message = data.get("message", "")
            language = data.get("language", user_profile["language"])
            age = data.get("age", user_profile["age"])
            gender = data.get("gender", user_profile["gender"])
            symptoms = data.get("symptoms", user_profile["symptoms"])

            # update profile
            user_profile.update({"language": language, "age": age, "gender": gender, "symptoms": symptoms})
            profiles.update_one({}, {"$set": user_profile}, upsert=True)

            msg = message.lower()

            # simple intent: time
            if any(x in msg for x in ["time", "samayam", "samay", "clock"]):
                now = datetime.datetime.now().strftime("%I:%M %p")
                if language == "telugu":
                    reply = f"⏰ ఇప్పుడు సమయం: {now}"
                elif language == "hindi":
                    reply = f"⏰ अभी का समय: {now}"
                else:
                    reply = f"⏰ Current time: {now}"
                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # small safety checks: emergency keywords => immediate advise
            emergencies = ["chest pain", "difficulty breathing", "unconscious", "severe bleeding", "stroke", "trouble breathing"]
            if any(k in msg for k in emergencies):
                if language == "telugu":
                    await ws.send_json({"sender": "bot", "message": "ఆ విషయంలో వెంటనే అర్జెంట్ వైద్య సహాయం అనివార్యం. దయచేసి అత్యవసర సేవల్ని సంప్రదించండి."})
                elif language == "hindi":
                    await ws.send_json({"sender": "bot", "message": "यह एक आपात स्थिति हो सकती है — कृपया तुरंत नज़दीकी अस्पताल या आपातकालीन सेवाएं संपर्क करें।"})
                else:
                    await ws.send_json({"sender": "bot", "message": "This may be an emergency — please seek immediate medical attention or call emergency services."})
                continue

            # AI call to Gemini
            system_prompt = build_system_prompt(language, age, gender, symptoms)
            await ws.send_json({"sender": "bot", "message": "⌛ Thinking..."})

            try:
                ai_res = requests.post(
                    f"{API_URL}?key={API_KEY}",
                    json={
                        "contents": [{
                            "role": "user",
                            "parts": [{"text": system_prompt + "\nUser: " + message}]
                        }]
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )

                r = ai_res.json()
                reply = r["candidates"][0]["content"]["parts"][0]["text"].strip()

                # shorten if extremely long
                if len(reply) > 500:
                    reply = reply[:480] + "..."

            except Exception as e:
                print("AI call failed:", e)
                # fallback simple responder (very basic)
                if language == "telugu":
                    reply = "క్షమించండి, ఇప్పుడు సహాయం అందుబాటులో లేదు. దయచేసి కొంచెం తర్వాత ప్రయత్నించండి."
                elif language == "hindi":
                    reply = "क्षमा करें, अभी सहायता उपलब्ध नहीं है। कृपया थोड़ी देर में कोशिश करें।"
                else:
                    reply = "Sorry, assistance is temporarily unavailable. Please try again shortly."

            await ws.send_json({"sender": "bot", "message": reply})

        except WebSocketDisconnect:
            print("🔌 Client disconnected")
            break
