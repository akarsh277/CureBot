const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const themeToggle = document.getElementById("theme-toggle");

function autoScroll() {
  window.scrollTo(0, document.body.scrollHeight);
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

// Bot response
async function botResponse(userMsg) {
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("bot-message", "typing");
  typingDiv.innerHTML = `
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  `;
  chatBox.appendChild(typingDiv);
  autoScroll();

  try {
    const res = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg }),
    });

    const data = await res.json();
    typingDiv.remove();
    addMessage(data.response, "bot");

  } catch (err) {
    typingDiv.remove();
    addMessage("⚠️ Backend connection failed!", "bot");
  }
}

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
sendBtn.addEventListener("click", () => {
  const text = userInput.value.trim();
  if (!text) return;
  addMessage(text, "user");
  userInput.value = "";
  botResponse(text);
});

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

  addMessage(greet + " How can I assist you?", "bot");
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
    document.querySelectorAll(".star").forEach(star => {
        let speed = 0.02;
        let x = (window.innerWidth - e.pageX * speed);
        let y = (window.innerHeight - e.pageY * speed);
        star.style.transform = `translate(${x}px, ${y}px)`;
    });
});
