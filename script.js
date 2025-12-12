// CureBot frontend — Patched script.js (fade animations + initial voice language-detect + mic-on-click voice)

// Get DOM elements
const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const micBtn = document.getElementById("mic-btn");
// State variables
let voiceMode = false;                // true when mic-button initiated for that exchange
let setupStep = 0;
let profile = { language: "english", age: "", gender: "", symptoms: "" };
let setupCompleteFlag = false;
let initialLangAutoListen = true;     // we'll auto-listen once for initial language prompt

function autoScroll() {
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
}

/**
 * addMessage(message, sender)
 * - Adds message element
 * - Adds fade-in animation class and removes it after completion for cleanliness
 * - For bot: always adds 'bot-msg' to enable avatar
 */
function addMessage(message, sender, noAvatar = false) {
  const msgDiv = document.createElement("div");

  // USER
  if (sender === "user") {
    msgDiv.classList.add("user-message", "fade-in");
  }
  // BOT
  else {
    msgDiv.classList.add("bot-message", "fade-in");
    if (!noAvatar) msgDiv.classList.add("bot-msg"); // avatar ON
  }

  // FIX #1 → Proper multi-line + markdown-like formatting
  msgDiv.innerHTML = message
    .replace(/\n/g, "<br>"); // supports multiple lines properly

  chatBox.appendChild(msgDiv);

  // FIX #2 → Animation only after DOM insert
  requestAnimationFrame(() => {
    msgDiv.style.opacity = "1";
    msgDiv.style.transform = "translateY(0)";
  });

  // FIX #3 → Auto-scroll after bubble expands
  setTimeout(() => autoScroll(), 30);

  return msgDiv;
}

/* Typing loader (ring) */
function showTyping() {
  hideTyping();
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("typing");
  typingDiv.id = "typing-indicator";
  chatBox.appendChild(typingDiv);
  autoScroll();
  return typingDiv;
}

function hideTyping() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

// ---------- WebSocket (Auto Switch: Local / Render) ----------
function getWSUrl() {
  const isLocal = (location.hostname === "127.0.0.1" || location.hostname === "localhost");

  return isLocal
    ? "ws://127.0.0.1:5000/ws"
    : "wss://curebot-uuey.onrender.com/ws";
}

let ws = null;
let wsReconnectTimer = null;

function initWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return; // already connected or connecting
  }

  const wsUrl = getWSUrl();
  ws = new WebSocket(wsUrl);
  console.log("Connecting WebSocket →", wsUrl);

  ws.onopen = () => {
    console.log("WS CONNECTED 🔗", wsUrl);

    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      hideTyping();

      // show bot message
      addMessage(data.message, "bot");

      // speak only if mic was used
      if (voiceMode) {
        try { speak(data.message); } 
        catch (err) { console.error("TTS error", err); }
      }
    } catch (err) {
      console.error("WS parse error", err);
    }
  };

  ws.onerror = (err) => {
    console.error("WS ERROR ❌", err);
    try { ws.close(); } catch {}
  };

  ws.onclose = () => {
    console.warn("WS CLOSED. Attempting reconnect…");

    hideTyping();

    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        console.log("Reconnecting WebSocket…");
        initWebSocket();
      }, 2000);
    }
  };
}

// initialize on page load
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

// ---------- Prompts ----------
const Q = {
  language: {
    english: "🌐 Please choose a language: 1. English 2. Telugu 3. Hindi",
    telugu: "🌐 దయచేసి భాషను ఎంచుకోండి: 1. English 2. Telugu 3. Hindi",
    hindi: "🌐 कृपया भाषा चुनें: 1. English 2. Telugu 3. Hindi"
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

// ---------- Speech setup ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
try {
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
  }
} catch (e) {
  recognition = null;
}

function detectLanguageFromText(text) {
  if (!text || typeof text !== "string") return "english";
  const s = text.trim().toLowerCase();

  // Telugu keywords (romanised and native)
  const teluguKw = ["ardham", "kaaledu", "kaledu", "telugu", "ledhu", "ledu", "artham"];
  for (let k of teluguKw) if (s.includes(k)) return "telugu";

  // Hindi keywords
  const hindiKw = ["pata", "patha", "nahi", "samaj", "samajh"];
  for (let k of hindiKw) if (s.includes(k)) return "hindi";

  // Unicode detection fallback
  if (/[ \u0C00-\u0C7F]+/.test(s)) return "telugu";
  if (/[ \u0900-\u097F]+/.test(s)) return "hindi";

  return "english";
}

function updateRecognitionLangFor(lang) {
  if (!recognition) return;
  if (lang === "telugu") recognition.lang = "te-IN";
  else if (lang === "hindi") recognition.lang = "hi-IN";
  else recognition.lang = "en-US";
}

// TTS speaking (used for prompts and replies when mic is used)
function speak(text) {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    if (profile.language === "telugu") utter.lang = "te-IN";
    else if (profile.language === "hindi") utter.lang = "hi-IN";
    else utter.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  } catch (e) {
    console.error("TTS error", e);
  }
}

// ---------- UI flow with initial voice ask ----------
window.onload = () => {
  const hour = new Date().getHours();
  let greet = "Hello!";
  if (hour < 12) greet = "Good Morning 🌞";
  else if (hour <= 15) greet = "Good Afternoon ☀️";
  else greet = "Good Evening 🌙";

  addMessage(`${greet} Welcome to CureBot 🩺 — I will ask a few quick questions to help you better.`, "bot");

  // ask language with voice and auto-listen once
  setTimeout(() => {
    askLanguage(true); // autoListen = true for initial language prompt
  }, 900);
};

function askLanguage(autoListen = false) {
  setupStep = 0;
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.language.english;
    addMessage(text, "bot");
    // speak the language prompt
    try { speak(text); } catch (e) {}
    if (autoListen && recognition) {
      // prepare recognition to capture user response (broad capture)
      recognition.lang = "en-US"; // accept romanized responses as well
      try {
        recognition.start();
        // We'll use onresult to process reply for setupStep === 0
      } catch (e) {
        console.warn("recognition start failed", e);
      }
    }
  }, 600);
}

function askAge() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.askAge[profile.language] || Q.askAge.english;
    addMessage(text, "bot");
    speak(text);
  }, 400);
}

function askGender() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.askGender[profile.language] || Q.askGender.english;
    addMessage(text, "bot");
    speak(text);
    showGenderButtons();
  }, 400);
}

function askSymptoms() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const text = Q.askSymptoms[profile.language] || Q.askSymptoms.english;
    addMessage(text, "bot");
    speak(text);
  }, 400);
}

function showGenderButtons() {
  const wrapper = document.createElement("div");
  wrapper.className = "bot-message bot-system";
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

// ---------- message send handler ----------
function sendMessage() {
  voiceMode = false;
  const input = userInput.value.trim();
  if (!input) return;
  addMessage(input, "user");
  userInput.value = "";

  // Setup flow (if not complete)
  if (!setupCompleteFlag) {
    switch (setupStep) {
      case 0:
        // language selection — accept 1/2/3 or words
        if (input === "1" || /english/i.test(input)) profile.language = "english";
        else if (input === "2" || /telugu/i.test(input) || /తెలుగు/.test(input)) profile.language = "telugu";
        else if (input === "3" || /hindi/i.test(input) || /हिन्दी|हिंदी/.test(input)) profile.language = "hindi";
        else profile.language = detectLanguageFromText(input) || "english";

        setupStep = 1;
        askAge();
        return;

      case 1:
        // age typed
        profile.age = input;
        setupStep = 2;
        askGender();
        return;

      case 2:
        // gender typed fallback (if user typed instead of buttons)
        if (/male/i.test(input)) profile.gender = "Male";
        else if (/female/i.test(input)) profile.gender = "Female";
        else profile.gender = input;
        setupStep = 3;
        askSymptoms();
        return;

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
  addMessage("✔ Setup complete! I will respond in your chosen language.", "bot");

  // Immediately request medical suggestion from backend (text only)
  showTyping();
  const payload = {
    message: profile.symptoms,
    language: profile.language,
    age: profile.age,
    gender: profile.gender,
    symptoms: profile.symptoms,
    setup: true
  };
  const sent = safeWSSend(payload);
  if (!sent) {
    hideTyping();
    addMessage("⚠️ Could not send symptoms to backend.", "bot");
  }
}

// ---------- Mic button: voice input only on click ----------
function startMicForUserInput() {
  if (!recognition) {
    addMessage("Voice input is not supported in this browser.", "bot");
    return;
  }

  // enable voiceMode for this exchange so replies are spoken too
  voiceMode = true;
  // set recognition language to user's chosen language
  updateRecognitionLangFor(profile.language);
  try {
    recognition.start();
    micBtn.style.background = "red";
  } catch (e) {
    console.warn("recognition start error", e);
    micBtn.style.background = "";
    voiceMode = false;
  }
}

// update recognition language
function updateRecognitionLangFor(lang) {
  if (!recognition) return;
  if (lang === "telugu") recognition.lang = "te-IN";
  else if (lang === "hindi") recognition.lang = "hi-IN";
  else recognition.lang = "en-US";
}

// Recognition events
if (recognition) {
  recognition.onresult = (event) => {
    const spoken = event.results[0][0].transcript.trim();
    // If we're still in setup language step (initial auto-listen)
    if (!setupCompleteFlag && setupStep === 0 && initialLangAutoListen) {
      addMessage(spoken, "user");
      // detect keywords to decide language
      const det = detectLanguageFromText(spoken);
      profile.language = det;
      updateRecognitionLangFor(det);
      // provide short confirmation
      addMessage(`Language set to ${det}`, "bot");
      // speak the confirmation and continue in that language
      try {
        speak(det === "telugu" ? "భాష సెట్ చేయబడింది" : det === "hindi" ? "भाषा सेट कर दी गई" : "Language set");
      } catch (e) {}

      // move to next step
      setupStep = 1;
      initialLangAutoListen = false; // only auto-listen once
      setTimeout(askAge, 600);
      try { recognition.stop(); } catch (e) {}
      return;
    }

    // Otherwise it's a normal mic-button initiated message/input
    addMessage(spoken, "user");
    userInput.value = spoken;
    sendMessage();

    // after finishing, recognition will end — keep voiceMode true so backend reply is spoken
    // we'll reset voiceMode on recognition.onend
  };

  recognition.onerror = (ev) => {
    console.error("recognition error", ev);
    micBtn.style.background = "";
    voiceMode = false;
    if (!setupCompleteFlag && setupStep === 0 && initialLangAutoListen) {
      hideTyping();
      addMessage("I couldn't hear that. Please type the language or click mic to speak.", "bot");
    }
  };

  recognition.onend = () => {
    micBtn.style.background = "";
    // Reset voiceMode — we only speak replies during the mic-initiated exchange
    voiceMode = false;
  };
}

// ---------- createStars with parallax movement ----------
const starsState = [];

function createStars(count = 40) {
  const starsContainer = document.getElementById("stars");
  if (!starsContainer) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.classList.add("star");
    const x = Math.random() * vw;
    const y = Math.random() * vh;
    const size = Math.random() * 2 + 1;
    star.style.left = x + "px";
    star.style.top = y + "px";
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.opacity = 0.4 + Math.random() * 0.7;
    star.style.animation = `twinkle ${2 + Math.random() * 3}s infinite ${Math.random() * 2}s`;
    starsContainer.appendChild(star);
    starsState.push({ el: star, x, y, depth: 0.2 + Math.random() * 0.8 });
  }
}
createStars(48);

// parallax on mouse move (smooth)
document.addEventListener("mousemove", (e) => {
  document.querySelectorAll(".bg-shape").forEach((shape, i) => {
    const speed = (i + 1) * 20;
    shape.style.transform = `translate(${(e.clientX - window.innerWidth/2) / window.innerWidth * speed}px, ${(e.clientY - window.innerHeight/2) / window.innerHeight * speed}px)`;
  });

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  starsState.forEach(s => {
    const dx = (e.clientX - cx) * s.depth * 0.02;
    const dy = (e.clientY - cy) * s.depth * 0.02;
    s.el.style.transform = `translate(${dx}px, ${dy}px)`;
  });
});

window.addEventListener("resize", () => { /* nothing special needed */ });

document.addEventListener("touchmove", (e) => {
  if (e.touches && e.touches[0]) {
    const t = e.touches[0];
    const evt = new MouseEvent("mousemove", { clientX: t.clientX, clientY: t.clientY });
    document.dispatchEvent(evt);
  }
}, { passive: true });

// ---------- events ----------
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
micBtn.addEventListener("click", () => {
  // mic-initiated voice exchange only when user clicks mic
  startMicForUserInput();
});

// ---------- small UI init ----------
function initCureUI() {
  try {
    const title = document.querySelector(".app-title");
    if (title) title.classList.add("pulse");
  } catch (e) {}
}
initCureUI();
// ------------------------------
// IMAGE UPLOAD & ANALYSIS
// ------------------------------

// get HTML elements
const cameraBtn = document.getElementById("camera-btn");
const imageInput = document.getElementById("image-input");

// when user clicks camera icon
cameraBtn.addEventListener("click", () => {
    imageInput.click(); // opens camera or file picker
});

// when an image is selected
// Auto-detect backend URL
// ---------- Image Upload (Auto Switch: Local / Render) ----------
function getAPIUrl() {
  const isLocal = (location.hostname === "127.0.0.1" || location.hostname === "localhost");
  return isLocal
    ? "http://127.0.0.1:5000/analyze-image"
    : "https://curebot-uuey.onrender.com/analyze-image";
}

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  addMessage("📸 Analyzing image…", "bot");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(getAPIUrl(), {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (data.message) {
      addMessage(data.message, "bot");
    } else {
      addMessage("⚠️ No response from the backend.", "bot");
    }

  } catch (err) {
    console.error("IMAGE ERROR:", err);
    addMessage("❌ Unable to analyze the image. Please try again.", "bot");
  }

  // Reset file input so same file can be selected again
  imageInput.value = "";
});

// ------------------------------
// END OF SCRIPT
// ------------------------------
