from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("API_KEY")  # You will add Gemini key to .env later
WEATHER_KEY = os.getenv("WEATHER_API_KEY")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def get_weather(district):
    try:
        # Step 1: Get geolocation
        geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={district},IN&limit=1&appid={WEATHER_KEY}"
        geo_res = requests.get(geo_url).json()

        if not geo_res:
            return None

        lat = geo_res[0]["lat"]
        lon = geo_res[0]["lon"]

        # Step 2: Get weather by lat/lon
        weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={WEATHER_KEY}"
        weather = requests.get(weather_url).json()

        details = {
            "temp": weather["main"]["temp"],
            "humidity": weather["main"]["humidity"],
            "description": weather["weather"][0]["description"]
        }
        return details
    except:
        return None


@app.post("/chat")
async def chat(payload: dict):
    user_text = payload.get("message", "")
    language = payload.get("language", "english")

    # Select language output rules
    if language == "english":
        system_prompt = "Respond in pure English only. Keep it simple."
    elif language == "telugu":
        system_prompt = "Respond fully in Telugu (తెలుగు), no English words."
    elif language == "telugu-eng":
        system_prompt = "Respond in Telugu using English letters only."
    else:
        system_prompt = "Respond in pure English only."

    response = requests.post(
        f"{API_URL}?key={API_KEY}",
        json={
            "contents": [
                {"role": "system", "parts": [{"text": system_prompt}]},
                {"role": "user", "parts": [{"text": user_text}]}
            ]
        },
        headers={"Content-Type": "application/json"}
    )

    try:
        data = response.json()
        reply = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print("DEBUG RESPONSE:", data)
        reply = "⚠️ Gemini response error!"

    return {"response": reply}
