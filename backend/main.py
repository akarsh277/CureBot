from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("API_KEY")
WEATHER_KEY = os.getenv("WEATHER_API_KEY")
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def get_weather(district):
    try:
        geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={district},IN&limit=1&appid={WEATHER_KEY}"
        geo_res = requests.get(geo_url).json()
        if not geo_res:
            return None

        lat = geo_res[0]["lat"]
        lon = geo_res[0]["lon"]

        weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={WEATHER_KEY}"
        weather = requests.get(weather_url).json()

        return {
            "temp": weather["main"]["temp"],
            "humidity": weather["main"]["humidity"],
            "description": weather["weather"][0]["description"]
        }
    except:
        return None


@app.websocket("/ws")
async def websocket_chat(ws: WebSocket):
    await ws.accept()

    while True:
        try:
            data = await ws.receive_json()
            message = data.get("message", "")
            language = data.get("language", "english")
            district = data.get("district", "")
            crop = data.get("crop", "")

            # Language selection
            if language == "english":
                system_prompt = "Respond in pure English. Keep it simple."
            elif language == "telugu":
                system_prompt = "Respond fully in Telugu (తెలుగు), no English words."
            elif language == "telugu-eng":
                system_prompt = "Respond in Telugu using English letters only."
            else:
                system_prompt = "Respond in pure English."

            system_prompt += " DO NOT mix languages."

            # Weather Check
            if "weather" in message.lower() and district:
                weather = get_weather(district)
                if weather:
                    reply = (
                        f"🌦 {district} Weather:\n"
                        f"Temperature: {weather['temp']}°C\n"
                        f"Condition: {weather['description']}\n"
                        f"Humidity: {weather['humidity']}%"
                    )
                else:
                    reply = "⚠️ Weather data unavailable!"
                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # Time
            if any(x in message.lower() for x in ["time", "clock", "samayam"]):
                now = datetime.datetime.now().strftime("%I:%M %p")
                reply = f"⏰ Current Time: {now}"
                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # AI Market Price Estimation — NEW
            if any(x in message.lower() for x in ["price", "rate", "market"]):
                reply = f"📊 Estimated price for {crop} in {district}:\n₹1800–₹2400 per Quintal approx.\n(Note: Real mandi data can be added later)"
                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # Gemini API response
            ws.send_json({"sender": "bot", "message": "⌛ Thinking..."})

            response = requests.post(
                f"{API_URL}?key={API_KEY}",
                json={
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": system_prompt + "\nUser: " + message}]
                    }]
                },
                headers={"Content-Type": "application/json"}
            )

            try:
                res = response.json()
                reply = res["candidates"][0]["content"]["parts"][0]["text"]
            except:
                reply = "⚠️ Gemini response error!"

            await ws.send_json({"sender": "bot", "message": reply})

        except WebSocketDisconnect:
            print("Client disconnected!")
            break
