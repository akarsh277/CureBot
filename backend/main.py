from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import datetime
import base64
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

API_KEY = os.getenv("API_KEY")
API_URL = "https://models.inference.ai.azure.com/chat/completions"


# ------------------------------
# System Prompt Builder
# ------------------------------
def build_system_prompt(language, age, gender, symptoms):

    lang_map = {
        "english": "Respond in simple, friendly English only.",
        "telugu": "Respond fully in Telugu (తెలుగు), simple and friendly.",
        "hindi": "Respond fully in Hindi (हिन्दी), simple and friendly."
    }

    base = lang_map.get(language, lang_map["english"])

    safe_meds = (
        "Suggest only simple and safe over-the-counter medicines like Paracetamol, ORS, Cetirizine, "
        "antacids, and basic cough syrups. Do NOT prescribe antibiotics, steroids, injections, "
        "or any restricted/prescription-only medicines."
    )

    profile_text = f"Patient Profile → Age: {age}, Gender: {gender}, Symptoms: {symptoms}"

    final_prompt = f"""
{base}

You are CureBot 🩺 — a friendly medical assistant that gives short, clear, safe medical guidance.

{profile_text}

Rules:
1. Use ONLY the user's selected language.
2. Explain symptoms and possible causes clearly.
3. Suggest only common OTC medicines (Paracetamol, ORS, Cetirizine, basic antacids).
4. Do NOT suggest antibiotics or prescription drugs.
5. Give simple home remedies and precautions.
6. If symptoms are severe or dangerous, warn the user to see a doctor ASAP.
7. The response must ALWAYS be complete. Do NOT stop mid-sentence.

Now answer the user's message below:
User: {symptoms}
"""
    return final_prompt

from base64 import b64encode
@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        b64_data = base64.b64encode(content).decode()

        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this medical image. Identify tablets, medicine names, dosage strength, or prescription details. Respond clearly and safely."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{file.content_type};base64,{b64_data}"
                            }
                        }
                    ]
                }
            ]
        }

        ai_res = requests.post(
            API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            timeout=20
        ).json()

        reply = ai_res["choices"][0]["message"]["content"]
        return {"message": reply}

    except Exception as e:
        print("IMAGE ANALYSIS ERROR:", e)
        return {"message": "❌ Unable to analyze image. Please try a clearer photo."}

# ------------------------------
# WebSocket Chat
# ------------------------------
@app.websocket("/ws")
async def websocket_chat(ws: WebSocket):
    await ws.accept()

    user_profile = {
        "language": "english",
        "age": "",
        "gender": "",
        "symptoms": ""
    }

    while True:
        try:
            data = await ws.receive_json()

            message = data.get("message", "")
            language = data.get("language", user_profile["language"])
            age = data.get("age", user_profile["age"])
            gender = data.get("gender", user_profile["gender"])
            symptoms = data.get("symptoms", user_profile["symptoms"])

            # Update local memory
            user_profile.update({
                "language": language,
                "age": age,
                "gender": gender,
                "symptoms": symptoms
            })

            msg_lower = message.lower()

            # ---------------- TIME INTENT ----------------
            if any(x in msg_lower for x in ["time", "clock", "samayam", "samay"]):
                now = datetime.datetime.now().strftime("%I:%M %p")

                if language == "telugu":
                    reply = f"⏰ ఇప్పుడు సమయం: {now}"
                elif language == "hindi":
                    reply = f"⏰ अभी का समय: {now}"
                else:
                    reply = f"⏰ Current time: {now}"

                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # ---------------- EMERGENCY CHECK ----------------
            emergencies = [
                "chest pain", "difficulty breathing", "unconscious",
                "severe bleeding", "heart attack", "stroke"
            ]

            if any(e in msg_lower for e in emergencies):
                if language == "telugu":
                    reply = "⚠️ ఇది అత్యవసర పరిస్థితి కావచ్చు. వెంటనే ఆసుపత్రికి వెళ్లండి."
                elif language == "hindi":
                    reply = "⚠️ यह आपात स्थिति हो सकती है। कृपया तुरंत अस्पताल जाएँ।"
                else:
                    reply = "⚠️ This may be an emergency. Please visit the nearest hospital immediately."
                await ws.send_json({"sender": "bot", "message": reply})
                continue

            # ---------------- AI PROCESSING ----------------
            system_prompt = build_system_prompt(language, age, gender, symptoms)

            # Show "Thinking…"
            await ws.send_json({"sender": "bot", "message": "⌛ Thinking..."})

            try:
                ai_res = requests.post(
                    API_URL,
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": message}
                        ]
                    },
                    headers={
                        "Authorization": f"Bearer {API_KEY}",
                        "Content-Type": "application/json"
                    },
                    timeout=25
                )

                res = ai_res.json()
                print("AI Response:", res)

                reply = res["choices"][0]["message"]["content"].strip()

            except Exception as e:
                print("AI ERROR:", e)

                if language == "telugu":
                    reply = "క్షమించండి, ప్రస్తుతం స్పందించలేకపోతున్నాను. కొద్దిసేపటి తర్వాత ప్రయత్నించండి."
                elif language == "hindi":
                    reply = "क्षमा करें, अभी उत्तर नहीं दे पा रहा हूँ। थोड़ी देर बाद पुनः प्रयास करें।"
                else:
                    reply = "Sorry, I’m unable to respond right now. Please try again shortly."

            # Send FULL reply (no cutting)
            await ws.send_json({"sender": "bot", "message": reply})

        except WebSocketDisconnect:
            print("🔌 WebSocket disconnected")
            break
