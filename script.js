const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const themeToggle = document.getElementById("theme-toggle");
const micBtn = document.getElementById("mic-btn");
let voiceMode = false;

let setupStep = 0;
let farmerInfo = {
  language: "",
  state: "",
  district: "",
  crop: "",
};

let setupCompleteFlag = false;

function autoScroll() {
  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: "smooth",
  });
}

// Add message
function addMessage(message, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add(sender === "user" ? "user-message" : "bot-message");
  // support HTML safe small tags if needed (we're using textContent for safety)
  msgDiv.textContent = message;
  chatBox.appendChild(msgDiv);
  autoScroll();
  return msgDiv;
}

function showTyping() {
  // remove previous typing if any
  hideTyping();
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("bot-message", "typing");
  typingDiv.id = "typing-indicator";
  typingDiv.innerHTML = `
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  `;
  chatBox.appendChild(typingDiv);
  autoScroll();
  return typingDiv;
}

function hideTyping() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) typingIndicator.remove();
}

// --- WebSocket Setup (robust with reconnect) ---
let ws = null;
let wsReconnectTimer = null;

function initWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket("ws://127.0.0.1:5000/ws");

  ws.onopen = () => {
    console.log("WS CONNECTED 🔗");
    // Clear any reconnect timer
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.sender === "bot") {
        hideTyping();
        addMessage(data.message, "bot");
        if (voiceMode) {
          speak(data.message);
        }
      }
    } catch (e) {
      console.error("WS message parse error", e);
    }
  };

  ws.onclose = (ev) => {
    console.warn("WS closed. Reconnecting...", ev);
    hideTyping();
    // attempt reconnect with small backoff
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        initWebSocket();
      }, 2000);
    }
  };

  ws.onerror = (err) => {
    console.error("WS error", err);
    try { ws.close(); } catch (e) {}
  };
}

// initialize websocket immediately
initWebSocket();

// Safe send helper
function safeWSSend(obj) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // try reinit and notify user
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

// --- Send Message ---
function sendMessage() {
  voiceMode = false; // typing → no voice output
  const input = userInput.value.trim();
  if (!input) return;

  addMessage(input, "user");
  userInput.value = "";

  // Setup process first
  if (!setupCompleteFlag) {
    switch (setupStep) {
      case 0:
        if (input === "1") farmerInfo.language = "english";
        else if (input === "2") farmerInfo.language = "telugu";
        else if (input === "3") farmerInfo.language = "telugu-eng";
        else farmerInfo.language = "english";

        setupStep++;
        askState();
        return;

      case 1:
        farmerInfo.state = input;
        setupStep++;
        askDistrict();
        return;

      case 2:
        farmerInfo.district = input;
        setupStep++;
        askCrop();
        return;

      case 3:
        farmerInfo.crop = input;
        setupStep++;
        setupComplete();
        return;
    }
  }

  // After basic setup → send message to WebSocket backend
  // show typing indicator while waiting for response
  showTyping();

  const payload = {
    message: input,
    language: farmerInfo.language,
    state: farmerInfo.state,
    district: farmerInfo.district,
    crop: farmerInfo.crop,
  };

  const sent = safeWSSend(payload);
  if (!sent) {
    hideTyping();
    addMessage("⚠️ Could not send message to backend.", "bot");
  }

  autoScroll();
}

// Starfield effect
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
createStars(50);

// Send button
sendBtn.addEventListener("click", sendMessage);

// Enter key
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// Dark mode toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeToggle.textContent = document.body.classList.contains("dark")
    ? "☀️"
    : "🌙";
});

// Greeting
window.onload = () => {
  const hour = new Date().getHours();
  let greet = "Hello!";

  if (hour < 12) greet = "Good Morning 🌞";
  else if (hour <= 15) greet = "Good Afternoon ☀️";
  else greet = "Good Evening 🌙";

  addMessage(`${greet} Welcome to Smart Farmer Bot 🚜`, "bot");
  setTimeout(askLanguage, 1000);
};

autoScroll();

// Parallax background shapes
document.addEventListener("mousemove", (e) => {
  const x = e.clientX / window.innerWidth - 0.5;
  const y = e.clientY / window.innerHeight - 0.5;

  document.querySelectorAll(".bg-shape").forEach((shape, i) => {
    const speed = (i + 1) * 30;
    shape.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
  });
});

// Star movement on mouse
document.addEventListener("mousemove", (e) => {
  document.querySelectorAll(".star").forEach((star) => {
    let speed = 0.02;
    let x = window.innerWidth - e.pageX * speed;
    let y = window.innerHeight - e.pageY * speed;
    star.style.transform = `translate(${x}px, ${y}px)`;
  });
});

function askLanguage() {
  addMessage(
    "🌐 Please select your language:\n1️⃣ English\n2️⃣ Telugu\n3️⃣ Telugu in English (Eng+Tel)",
    "bot"
  );
}

function askState() {
  addMessage("📍 Your State name?", "bot");
}

function askDistrict() {
  addMessage(`${farmerInfo.state}-district: ?`, "bot");
}

function askCrop() {
  addMessage("🌱 crop: ", "bot");
}

function setupComplete() {
  setupCompleteFlag = true;
  addMessage(`✔ Done! \nLet's start farming assistance! 😊`, "bot");
}

// ---- Voice Input ---- //
const speechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = new speechRecognition();
recognition.continuous = false;
recognition.interimResults = false;

// Set language dynamically
function updateVoiceLang() {
  if (farmerInfo.language === "telugu") {
    recognition.lang = "te-IN";
  } else if (farmerInfo.language === "telugu-eng") {
    recognition.lang = "en-IN";
  } else {
    recognition.lang = "en-US";
  }
}
updateVoiceLang();

// Mic click → start listening
micBtn.addEventListener("click", () => {
  voiceMode = true; // enable voice output only for this message
  updateVoiceLang(); // fixed function name
  recognition.start();
  micBtn.style.background = "red";
});

recognition.onresult = (event) => {
  const spoken = event.results[0][0].transcript;
  userInput.value = spoken;
  sendMessage();
  micBtn.style.background = "";
};

recognition.onerror = () => {
  micBtn.style.background = "";
};

recognition.onend = () => {
  // ensure mic UI resets
  micBtn.style.background = "";
};

// Voice Output
function speak(text) {
  // if user did NOT use voice input → NO SPEAK
  if (!voiceMode) return;

  const utter = new SpeechSynthesisUtterance(text);

  updateVoiceLang();
  utter.lang = recognition.lang;

  speechSynthesis.speak(utter);

  // disable voice after speaking once
  voiceMode = false;
}

// Wake Word listener (optional)
let wakeRecognition;
try {
  wakeRecognition = new speechRecognition();
  wakeRecognition.lang = "en-IN";
  wakeRecognition.continuous = true;

  wakeRecognition.onresult = (event) => {
    const cmd =
      event.results[event.results.length - 1][0].transcript.toLowerCase();
    if (cmd.includes("hey farmer bot")) {
      // give small audible ack only if user used voice
      voiceMode = true;
      speak("Yes, I'm listening!");
      recognition.start();
    }
  };

  wakeRecognition.onend = () => {
    // keep wake listener alive
    try {
      wakeRecognition.start();
    } catch (e) {
      // ignore if user blocked or not supported
    }
  };

  wakeRecognition.start();
} catch (e) {
  console.warn("Wake word not supported in this browser", e);
}
/* -------- AgriPulse UI helpers (leaves + particles + logo pulse) -------- */

// Ensure app-title exists before running
function initAgriPulseUI() {
  // 1) ensure title element - if missing, create it
  let title = document.querySelector(".app-title");
  if (!title) {
    title = document.createElement("div");
    title.className = "app-title";
    title.innerHTML = `<div class="logo-badge">🌱</div><div class="title-text">AgriPulse</div>`;
    document.body.prepend(title);
  }

  // pulse the badge gently
  title.classList.add("pulse");

  // 2) create leaves layer
  const leafLayer = document.getElementById("leaf-layer") || (() => {
    const el = document.createElement("div");
    el.id = "leaf-layer";
    document.body.appendChild(el);
    return el;
  })();

  // create N leaves with random positions
  function createLeaves(n=8) {
    leafLayer.innerHTML = "";
    for (let i=0;i<n;i++){
      const L = document.createElement("div");
      L.className = "leaf";
      const left = Math.random() * 100;
      const top = Math.random() * 45 + 5; // keep upper area
      L.style.left = left + "vw";
      L.style.top = top + "vh";
      L.style.opacity = 0.75 + Math.random()*0.25;
      L.style.transform = `rotate(${Math.random()*360}deg) scale(${0.8 + Math.random()*0.6})`;
      L.style.animationDuration = (8 + Math.random()*6) + "s";
      L.style.animationDelay = (-Math.random()*8) + "s";
      leafLayer.appendChild(L);
    }
  }
  createLeaves(9);

  // 3) particle stars already created elsewhere; add small parallax on mouse
  document.addEventListener("mousemove", (e) => {
    const cx = (e.clientX / window.innerWidth - 0.5);
    const cy = (e.clientY / window.innerHeight - 0.5);
    // move leaves subtly
    document.querySelectorAll(".leaf").forEach((el, i) => {
      const s = (i+1) * 6;
      el.style.transform = `translate(${cx * s}px, ${cy * s}px) rotate(${(i*22) + cx*20}deg) scale(${0.85 + (i%3)*0.08})`;
    });
    // title parallax
    const title = document.querySelector(".app-title");
    if (title) title.style.transform = `translateX(-50%) translateY(${cy*6}px)`;
  });

  // small responsiveness: recreate leaves on resize
  window.addEventListener("resize", () => { createLeaves(9); });
}

// call it (safe)
try { initAgriPulseUI(); } catch(e){ console.warn("AgriPulse UI init failed:", e); }
