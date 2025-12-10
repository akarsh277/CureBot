from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import datetime
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = MongoClient(os.getenv("MONGO_URI"))
db = client["farmerDB"]
farmers = db["profiles"]

API_KEY = os.getenv("API_KEY")
WEATHER_KEY = os.getenv("WEATHER_API_KEY")
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


# ------------------------------
# System Prompt
# ------------------------------
def build_system_prompt(language, state, district, crop):
    prompts = {
        "english": "Respond in simple, easy English only.",
        "telugu": "Respond fully in Telugu (తెలుగు), no English.",
        "hindi": "Respond fully in Hindi (हिन्दी), no English."
    }

    base = prompts.get(language, prompts["english"])

    final = f"""
{base}

You are a helpful agriculture assistant.

Farmer Profile:
• State: {state}
• District: {district}
• Crop: {crop}

Rules:
1. Keep responses short and practical.
2. Maintain farmer-friendly tone.
3. Never mix languages.
4. If farmer greets, greet back politely.
"""

    return final


# ------------------------------
# Weather API
# ------------------------------
def get_weather(district):
    try:
        geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={district},IN&limit=1&appid={WEATHER_KEY}"
        geo = requests.get(geo_url).json()
        if not geo:
            return None

        lat, lon = geo[0]["lat"], geo[0]["lon"]

        weather_url = (
            f"https://api.openweathermap.org/data/2.5/weather?"
            f"lat={lat}&lon={lon}&units=metric&appid={WEATHER_KEY}"
        )

        w = requests.get(weather_url).json()

        return {
            "temp": w["main"]["temp"],
            "humidity": w["main"]["humidity"],
            "description": w["weather"][0]["description"],
        }
    except:
        return None


# ------------------------------
# WebSocket Chat (Final Clean)
# ------------------------------
@app.websocket("/ws")
async def websocket_chat(ws: WebSocket):
    await ws.accept()

    farmer_profile = {"language": "", "state": "", "district": "", "crop": ""}

    while True:
        try:
            data = await ws.receive_json()
            message = data.get("message", "")
            language = data.get("language", farmer_profile["language"])
            state = data.get("state", farmer_profile["state"])
            district = data.get("district", farmer_profile["district"])
            crop = data.get("crop", farmer_profile["crop"])

            # Save updates
            farmer_profile.update({
                "language": language,
                "state": state,
                "district": district,
                "crop": crop
            })
            farmers.update_one({}, {"$set": farmer_profile}, upsert=True)

            msg = message.lower()

            # ---------------- INTENT: Weather ----------------
            if "weather" in msg and district:
                w = get_weather(district)
                if w:
                    await ws.send_json({
                        "sender": "bot",
                        "message": f"🌦️ Temp: {w['temp']}°C | {w['description']} | Humidity: {w['humidity']}%"
                    })
                else:
                    await ws.send_json({"sender": "bot", "message": "⚠️ Weather data unavailable"})
                continue

            # ---------------- INTENT: Time ----------------
            if any(x in msg for x in ["time", "clock", "samayam", "samay"]):
                now = datetime.datetime.now().strftime("%I:%M %p")

                if language == "telugu":
                    reply = f"⏰ ఇప్పుడు సమయం: {now}"
                elif language == "hindi":
                    reply = f"⏰ अभी का समय: {now}"
                else:
                    reply = f"⏰ Current time: {now}"

                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # ---------------- INTENT: Fertilizer ----------------
            if any(x in msg for x in ["fertilizer", "urakam", "urakamu"]):
                await ws.send_json({"sender": "bot", "message": "Mee crop stage cheppandi—early/mid/late?"})
                continue

            # ---------------- INTENT: Irrigation ----------------
            if any(x in msg for x in ["water", "neellu", "irrigation"]):
                await ws.send_json({"sender": "bot", "message": "Soil dry ga unda? Moist ga unda?"})
                continue

            # ---------------- AI RESPONSE (Gemini) ----------------
            system_prompt = build_system_prompt(language, state, district, crop)

            await ws.send_json({"sender": "bot", "message": "⌛ Thinking..."})

            ai_res = requests.post(
                f"{API_URL}?key={API_KEY}",
                json={
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": system_prompt + "\nUser: " + message}]
                    }]
                },
                headers={"Content-Type": "application/json"},
            )

            try:
                r = ai_res.json()
                reply = r["candidates"][0]["content"]["parts"][0]["text"].strip()

                # shorten long responses
                if len(reply) > 250:
                    reply = reply[:200] + "..."

            except:
                reply = "⚠️ AI response error."

            await ws.send_json({"sender": "bot", "message": reply})

        except WebSocketDisconnect:
            print("🔌 Client disconnected")
            break