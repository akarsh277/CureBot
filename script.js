// CureBot frontend (replace script.js)

const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const themeToggle = document.getElementById("theme-toggle");
const micBtn = document.getElementById("mic-btn");

let voiceMode = false;
let setupStep = 0;
let profile = { language: "english", age: "", gender: "", symptoms: "" };
let setupCompleteFlag = false;

function autoScroll() {
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
}

function addMessage(message, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add(sender === "user" ? "user-message" : "bot-message");
  msgDiv.textContent = message;
  chatBox.appendChild(msgDiv);
  autoScroll();
  return msgDiv;
}

function showTyping() {
  hideTyping();
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("bot-message", "typing");
  typingDiv.id = "typing-indicator";
  typingDiv.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
  chatBox.appendChild(typingDiv);
  autoScroll();
  return typingDiv;
}

function hideTyping() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) typingIndicator.remove();
}

// WebSocket
let ws = null;
let wsReconnectTimer = null;
function initWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket("ws://127.0.0.1:5000/ws");

  ws.onopen = () => {
    console.log("WS CONNECTED 🔗");
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.sender === "bot") {
        hideTyping();
        addMessage(data.message, "bot");
        if (voiceMode) speak(data.message);
      }
    } catch (e) { console.error("WS message parse error", e); }
  };

  ws.onclose = (ev) => {
    console.warn("WS closed. Reconnecting...", ev);
    hideTyping();
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => initWebSocket(), 2000);
    }
  };

  ws.onerror = (err) => {
    console.error("WS error", err);
    try { ws.close(); } catch (e) {}
  };
}
initWebSocket();

function safeWSSend(obj) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      initWebSocket();
      addMessage("⚠️ Connecting to backend, try again in a moment.", "bot");
      return false;
    }
    ws.send(JSON.stringify(obj));
    return true;
  } catch (e) {
    console.error("WS send failed", e);
    return false;
  }
}

// Setup prompts translations
const Q = {
  language: {
    english: "🌐 Choose language:\n1️⃣ English\n2️⃣ Telugu\n3️⃣ Hindi",
    telugu: "🌐 భాషను ఎంచుకోండి:\n1️⃣ English\n2️⃣ తెలుగు\n3️⃣ हिन्दी",
    hindi: "🌐 भाषा चुनें:\n1️⃣ English\n2️⃣ తెలుగు\n3️⃣ हिन्दी"
  },
  askAge: {
    english: "🧾 What is your age?",
    telugu: "🧾 మీ వయస్సు ఎంత?",
    hindi: "🧾 आपकी उम्र क्या है?"
  },
  askGender: {
    english: "🧑‍⚕️ What is your gender? (Male / Female)",
    telugu: "🧑‍⚕️ మీ లింగం ఏమిటి? (Male / Female)",
    hindi: "🧑‍⚕️ आपका लिंग क्या है? (Male / Female)"
  },
  askSymptoms: {
    english: "❓ What problem are you facing? What symptoms do you have?",
    telugu: "❓ మీకు ఏ సమస్య ఉంది? మీకు ఏ లక్షణాలు కనిపిస్తున్నాయి?",
    hindi: "❓ आपको क्या तकलीफ़ है? कौन से लक्षण दिख रहे हैं?"
  }
};

// greeting and initial flow
window.onload = () => {
  const hour = new Date().getHours();
  let greet = "Hello!";
  if (hour < 12) greet = "Good Morning 🌞";
  else if (hour <= 15) greet = "Good Afternoon ☀️";
  else greet = "Good Evening 🌙";
  addMessage(`${greet} Welcome to CureBot 🩺 — I will ask a few quick questions to help you better.`, "bot");
  setTimeout(() => askLanguage(), 900);
};

function askLanguage() {
  setupStep = 0;
  showTyping();
  setTimeout(() => {
    hideTyping();
    addMessage(Q.language.english, "bot");
  }, 600);
}

function askAge() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.askAge[profile.language] || Q.askAge.english;
    addMessage(text, "bot");
  }, 400);
}

function askGender() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.askGender[profile.language] || Q.askGender.english;
    // show as bot message
    addMessage(text, "bot");
    // also show simple clickable choices for demo
    showGenderButtons();
  }, 400);
}

function askSymptoms() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.askSymptoms[profile.language] || Q.askSymptoms.english;
    addMessage(text, "bot");
  }, 400);
}

function showGenderButtons() {
  // temporary UI: small inline buttons inside chat
  const wrapper = document.createElement("div");
  wrapper.className = "bot-message";
  wrapper.style.paddingLeft = "14px";
  wrapper.style.display = "flex";
  wrapper.style.gap = "8px";

  const male = document.createElement("button");
  male.textContent = "Male";
  male.style.padding = "8px 12px";
  male.style.borderRadius = "8px";
  male.style.border = "none";
  male.style.background = "#1e88e5";
  male.style.color = "#fff";
  male.onclick = () => {
    profile.gender = "Male";
    wrapper.remove();
    addMessage("Male", "user");
    proceedAfterGender();
  };

  const female = document.createElement("button");
  female.textContent = "Female";
  female.style.padding = "8px 12px";
  female.style.borderRadius = "8px";
  female.style.border = "none";
  female.style.background = "#1e88e5";
  female.style.color = "#fff";
  female.onclick = () => {
    profile.gender = "Female";
    wrapper.remove();
    addMessage("Female", "user");
    proceedAfterGender();
  };

  wrapper.appendChild(male);
  wrapper.appendChild(female);
  chatBox.appendChild(wrapper);
  autoScroll();
}

function proceedAfterGender() {
  setupStep = 3;
  askSymptoms();
  autoScroll();
}

// send message handler
function sendMessage() {
  voiceMode = false;
  const input = userInput.value.trim();
  if (!input) return;
  addMessage(input, "user");
  userInput.value = "";

  // Setup flow (step-based)
  if (!setupCompleteFlag) {
    switch (setupStep) {
      case 0:
        // language selection — accept 1/2/3 or words
        if (input === "1" || /english/i.test(input)) profile.language = "english";
        else if (input === "2" || /telugu/i.test(input) || /తెలుగు/.test(input)) profile.language = "telugu";
        else if (input === "3" || /hindi/i.test(input) || /हिन्दी|हिंदी/.test(input)) profile.language = "hindi";
        else profile.language = "english";

        setupStep = 1;
        return askAge();

      case 1:
        // age typed
        profile.age = input;
        setupStep = 2;
        return askGender();

      case 2:
        // gender typed fallback (if user typed instead of buttons)
        if (/male/i.test(input)) profile.gender = "Male";
        else if (/female/i.test(input)) profile.gender = "Female";
        else profile.gender = input;
        setupStep = 3;
        return askSymptoms();

      case 3:
        // symptoms typed
        profile.symptoms = input;
        setupStep = 4;
        setupComplete();
        return;
    }
  }

  // After setup → send payload to backend
  showTyping();

  const payload = {
    message: input,
    language: profile.language,
    age: profile.age,
    gender: profile.gender,
    symptoms: profile.symptoms
  };

  const sent = safeWSSend(payload);
  if (!sent) {
    hideTyping();
    addMessage("⚠️ Could not send message to backend.", "bot");
  }
  autoScroll();
}

function setupComplete() {
  setupCompleteFlag = true;
  addMessage("✔ Setup complete! I will respond in your chosen language. How can I help you today?", "bot");
}

// Events
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendBtn.click(); });

// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
});

// Voice recognition (basic)
const speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
try {
  recognition = new (speechRecognition)();
  recognition.continuous = false;
  recognition.interimResults = false;
} catch (e) {
  recognition = null;
}

function updateVoiceLang() {
  if (!recognition) return;
  if (profile.language === "telugu") recognition.lang = "te-IN";
  else if (profile.language === "hindi") recognition.lang = "hi-IN";
  else recognition.lang = "en-US";
}

if (recognition) {
  micBtn.addEventListener("click", () => {
    voiceMode = true;
    updateVoiceLang();
    try { recognition.start(); micBtn.style.background = "red"; } catch (e) {}
  });

  recognition.onresult = (event) => {
    const spoken = event.results[0][0].transcript;
    userInput.value = spoken;
    sendMessage();
    micBtn.style.background = "";
  };

  recognition.onerror = () => { micBtn.style.background = ""; };
  recognition.onend = () => { micBtn.style.background = ""; };
}

function speak(text) {
  if (!voiceMode) return;
  const utter = new SpeechSynthesisUtterance(text);
  if (profile.language === "telugu") utter.lang = "te-IN";
  else if (profile.language === "hindi") utter.lang = "hi-IN";
  else utter.lang = "en-US";
  speechSynthesis.speak(utter);
  voiceMode = false;
}

// Basic star + leaf UI (kept from original)
function createStars(count = 40) {
  const starsContainer = document.getElementById("stars");
  if (!starsContainer) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.classList.add("star");
    star.style.top = Math.random() * 100 + "vh";
    star.style.left = Math.random() * 100 + "vw";
    star.style.animationDelay = Math.random() * 2 + "s";
    star.style.transform = `scale(${Math.random() * 1.5})`;
    starsContainer.appendChild(star);
  }
}
createStars(40);

// Parallax
document.addEventListener("mousemove", (e) => {
  const x = e.clientX / window.innerWidth - 0.5;
  const y = e.clientY / window.innerHeight - 0.5;
  document.querySelectorAll(".bg-shape").forEach((shape, i) => {
    const speed = (i + 1) * 30;
    shape.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
  });
});

// small AgriPulse -> CureBot UI init (safe)
function initCureUI() {
  try {
    const title = document.querySelector(".app-title");
    if (title) title.classList.add("pulse");
  } catch (e) {}
}
initCureUI();