const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const themeToggle = document.getElementById("theme-toggle");

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
    behavior: "smooth"
  });
}


// Add message
function addMessage(message, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add(sender === "user" ? "user-message" : "bot-message");
  msgDiv.textContent = message;
  chatBox.appendChild(msgDiv);
  autoScroll();
  return msgDiv;
}
function showTyping() {
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
  return typingDiv; // IMPORTANT! 🔥
}

function hideTyping() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) typingIndicator.remove();
}

// Bot response
// --- WebSocket Setup ---
let ws = new WebSocket("ws://127.0.0.1:5000/ws");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.sender === "bot") {
    addMessage(data.message, "bot");
    speak(data.message, farmerInfo.language);
  }
};

// Handle socket close and reconnect automatically
ws.onclose = () => {
  setTimeout(() => {
    ws = new WebSocket("ws://127.0.0.1:5000/ws");
  }, 2000);
};


// --- Send Message ---
function sendMessage() {
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
  ws.send(JSON.stringify({
    message: input,
    language: farmerInfo.language,
    state: farmerInfo.state,
    district: farmerInfo.district,
    crop: farmerInfo.crop
  }));
  
  autoScroll();
}

// Starfield effect 

function createStars(count = 40) {
  const starsContainer = document.getElementById("stars");
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
document.addEventListener("mousemove", (e) => {
  const x = e.clientX / window.innerWidth - 0.5;
  const y = e.clientY / window.innerHeight - 0.5;

  document.querySelectorAll(".bg-shape").forEach((shape, i) => {
    const speed = (i + 1) * 30;
    shape.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
  });
});
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
  addMessage(
    `✔ Done! \nLet's start farming assistance! 😊`,
    "bot"
  );
}
// ---- Voice Input ---- //
const micBtn = document.getElementById("mic-btn");

const speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
  updateVoiceLang();
  recognition.start();
  micBtn.style.background = "#ff4545";
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

// Voice Output
function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  updateVoiceLang();
  utter.lang = recognition.lang;
  speechSynthesis.speak(utter);
}

// Wake Word listener (not continuous)
let wakeRecognition = new speechRecognition();
wakeRecognition.lang = "en-IN";
wakeRecognition.continuous = true;

wakeRecognition.onresult = (event) => {
  const cmd = event.results[event.results.length - 1][0].transcript.toLowerCase();
  if (cmd.includes("hey farmer bot")) {
    speak("Yes, I'm listening!");
    recognition.start(); 
  }
};

wakeRecognition.start();
