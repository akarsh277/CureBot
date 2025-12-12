🏥 CureBot – AI-Powered Medical Assistant

A smart, conversational medical assistant that helps users understand symptoms, decode prescriptions, identify tablets using images, and receive basic health guidance — built with AI, FastAPI, WebSockets, and a fully interactive UI.

🚀 Project Overview

CureBot is an AI-driven medical chatbot designed to make basic healthcare information more accessible.
It can:

Understand user symptoms and provide medical explanations

Read and analyze doctor prescriptions

Identify tablet strips or medicine photos

Respond instantly using WebSockets

Support voice input using speech recognition

Offer smooth UI animations and an intuitive chat interface

This project is especially valuable for users who face difficulty understanding medical text or describing symptoms clearly.

🎯 Problem Statement

Many individuals — especially in rural or low-literacy communities — struggle to:

Read medical prescriptions

Identify tablets

Explain their symptoms accurately

Access immediate and understandable health guidance

CureBot solves this by offering simple, AI-powered medical assistance through chat, voice, and image analysis.

✨ Key Features
🔹 AI Symptom Analysis

Users can describe their symptoms, and CureBot provides easy-to-understand health explanations and guidance.

🔹 Doctor Prescription Reader

Upload a prescription photo — CureBot extracts medicine names, dosage, and instructions using OCR + AI.

🔹 Tablet Identification

Upload a tablet strip image — CureBot identifies the medicine and gives basic details.

🔹 WebSocket Live Chat

Fast, real-time communication using WebSockets instead of traditional HTTP calls.

🔹 Voice Input

Users can click the mic button and speak their symptoms directly.

🔹 Camera Upload Support

Works on mobile — opens camera instantly to take prescription/tablet photos.

🔹 Clean & Responsive UI

Inspired by a medical theme with:

Smooth fade-in animations

Avatar-based chat bubbles

Light & modern interface

🛠 Tech Stack
Frontend

HTML5

CSS3

JavaScript

WebSockets

Speech Recognition API

Backend

FastAPI

Python

WebSockets (FastAPI)

Google Gemini Vision API (for image analysis)

Deployment

Render (Web Service Deployment)

📷 How Image Analysis Works

User uploads a prescription/tablet image

Image is converted to Base64

Sent to backend FastAPI endpoint

AI reads content, extracts medicine info

CureBot returns a clean, user-friendly response

📡 API Endpoints
1️⃣ WebSocket Endpoint
wss://your-render-url/ws

2️⃣ Image Analysis Endpoint
POST https://your-render-url/analyze-image

🧪 Local Development Setup
1. Clone Repository
git clone https://github.com/akarsh277/CureBot.git
cd CureBot

2. Install Dependencies
pip install -r requirements.txt

3. Run Backend
uvicorn backend.main:app --reload --port 5000

4. Run Frontend

Open the index.html file in your browser
(or use Live Server extension for VS Code)

🚀 Future Enhancements

Add multilingual voice responses

Implement medical history tracking

Add doctor–patient teleconsultation integration

QR code-based medicine scanning

Offline basic medical help using browser storage

👤 Developer

Akarsh Vijjapu
B.Tech CSE
Pragati Engineering College
Passionate about Full-Stack Development, AI, and real-world problem solving.
