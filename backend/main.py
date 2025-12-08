from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, requests

load_dotenv()  # Load .env file

API_KEY = os.getenv("API_KEY")
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat")
async def chat(payload: dict):
    user_text = payload.get("message", "")

    response = requests.post(
        f"{API_URL}?key={API_KEY}",
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_text}]
                }
            ]
        },
        headers={"Content-Type": "application/json"}
    )

    data = response.json()
    try:
        reply = data["candidates"][0]["content"]["parts"][0]["text"]
    except:
        print("DEBUG RESPONSE:", data)
        reply = "⚠️ Gemini response error!"

    return {"response": reply}