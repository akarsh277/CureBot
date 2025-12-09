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

API_KEY = os.getenv("GEMINI_API_KEY")  # You will add Gemini key to .env later
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
    language = payload.get("language", "English")
    state = payload.get("state", "")
    district = payload.get("district", "")
    crop = payload.get("crop", "")

    weather_info = get_weather(district)

    weather_text = ""
    if weather_info:
        weather_text = f"""
Current Weather in {district}:
• {weather_info['description']}
• Temperature: {weather_info['temp']}°C
• Humidity: {weather_info['humidity']}%

Crop Impact:
- If humidity > 70%, high chance of fungal disease attack.
"""

    prompt = f"""
User Message: {user_text}

Farmer Profile:
Language: {language}
State: {state}
District: {district}
Crop: {crop}

Weather & Crop Notes:
{weather_text}

Your Goal:
Respond in selected language.
Help farmers in a friendly way with crop tips, weather warnings, and organic fertilizer suggestions.
Ask follow-up questions if needed.
"""

    response = requests.post(
        f"{GEMINI_URL}?key={API_KEY}",
        json={"contents": [{"role": "user", "parts": [{"text": prompt}]}]},
        headers={"Content-Type": "application/json"}
    )

    data = response.json()
    try:
        reply = data["candidates"][0]["content"]["parts"][0]["text"]
    except:
        print("DEBUG:", data)
        reply = "⚠️ Weather/Gemini response error!"

    return {"response": reply}
