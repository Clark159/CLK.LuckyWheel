const MAX_PARTICIPANTS = 200;
const STORAGE_KEY = "lucky-wheel-state-v1";
const DEFAULT_NAMES = [
  "王小明",
  "陳美玲",
  "林大華",
  "張雅婷",
  "李志豪",
  "黃怡君",
  "吳承恩",
  "劉佳穎"
];
const COLORS = ["#ff4f91", "#8b5cf6", "#46d9d1", "#ff934f", "#6377f4", "#f6c945"];

const elements = {
  canvas: document.querySelector("#wheel"),
  namesInput: document.querySelector("#namesInput"),
  participantCount: document.querySelector("#participantCount"),
  lineCounter: document.querySelector("#lineCounter"),
  hubCount: document.querySelector("#hubCount"),
  spinButton: document.querySelector("#spinButton"),
  spinHint: document.querySelector("#spinHint"),
  winnerCard: document.querySelector("#winnerCard"),
  winnerName: document.querySelector("#winnerName"),
  removeWinnerToggle: document.querySelector("#removeWinnerToggle"),
  soundToggle: document.querySelector("#soundToggle"),
  historyList: document.querySelector("#historyList"),
  historyEmpty: document.querySelector("#historyEmpty"),
  historyCount: document.querySelector("#historyCount"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  clearNamesButton: document.querySelector("#clearNamesButton"),
  fileInput: document.querySelector("#fileInput"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  confettiLayer: document.querySelector("#confettiLayer"),
  toast: document.querySelector("#toast"),
  saveState: document.querySelector("#saveState")
};

const context = elements.canvas.getContext("2d");
let participants = [];
let history = [];
let rotation = 0;
let isSpinning = false;
let saveTimer;
let toastTimer;
let audioContext;

function normalizeNames(value) {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_PARTICIPANTS);
}

function secureRandomIndex(length) {
  if (length <= 0) return -1;
  const max = Math.floor(0x100000000 / length) * length;
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= max);
  return values[0] % length;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const names = Array.isArray(saved?.participants) ? saved.participants : DEFAULT_NAMES;
    participants = names.slice(0, MAX_PARTICIPANTS);
    history = Array.isArray(saved?.history) ? saved.history : [];
    elements.removeWinnerToggle.checked = saved?.removeWinner !== false;
    elements.soundToggle.checked = saved?.sound !== false;
  } catch {
    participants = [...DEFAULT_NAMES];
    history = [];
  }
  elements.namesInput.value = participants.join("\n");
}

function saveState() {
  clearTimeout(saveTimer);
  elements.saveState.textContent = "儲存中…";
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      participants,
      history,
      removeWinner: elements.removeWinnerToggle.checked,
      sound: elements.soundToggle.checked
    }));
    elements.saveState.textContent = "已自動儲存";
  }, 180);
}

function syncParticipantsFromInput() {
  const rawLines = elements.namesInput.value.split(/\r?\n/).filter((line) => line.trim());
  participants = normalizeNames(elements.namesInput.value);
  if (rawLines.length > MAX_PARTICIPANTS) {
    elements.namesInput.value = participants.join("\n");
    showToast(`最多只能加入 ${MAX_PARTICIPANTS} 人`);
  }
  updateParticipantUI();
  drawWheel();
  saveState();
}

function updateParticipantUI() {
  const count = participants.length;
  elements.participantCount.textContent = count;
  elements.lineCounter.textContent = `${count} / ${MAX_PARTICIPANTS}`;
  elements.hubCount.textContent = count;
  elements.spinButton.disabled = isSpinning || count === 0;
  elements.spinHint.textContent = count
    ? "每位參加者都有相同的中獎機會"
    : "請先在右側加入參加者";
}

function fitCanvas() {
  const size = 760;
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  elements.canvas.width = size * ratio;
  elements.canvas.height = size * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawWheel();
}

function drawWheel() {
  const size = 760;
  const center = size / 2;
  const radius = center - 8;
  context.clearRect(0, 0, size, size);

  if (!participants.length) {
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.fillStyle = "#302946";
    context.fill();
    context.fillStyle = "#918aa5";
    context.font = "700 28px Microsoft JhengHei, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("等待加入名單", center, center - 75);
    return;
  }

  const arc = (Math.PI * 2) / participants.length;
  participants.forEach((name, index) => {
    const start = index * arc - Math.PI / 2;
    const end = start + arc;

    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, start, end);
    context.closePath();
    context.fillStyle = COLORS[index % COLORS.length];
    context.fill();

    context.strokeStyle = participants.length > 80
      ? "rgba(255,255,255,0.14)"
      : "rgba(18,13,31,0.3)";
    context.lineWidth = participants.length > 80 ? 0.6 : 2;
    context.stroke();

    if (participants.length <= 60) {
      const label = participants.length > 28 ? String(index + 1) : name;
      const fontSize = participants.length <= 12 ? 22 : participants.length <= 28 ? 15 : 11;
      context.save();
      context.translate(center, center);
      context.rotate(start + arc / 2);
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillStyle = "#fff";
      context.font = `800 ${fontSize}px Microsoft JhengHei, sans-serif`;
      context.shadowColor = "rgba(0,0,0,.35)";
      context.shadowBlur = 3;
      context.fillText(truncate(label, participants.length <= 12 ? 10 : 7), radius - 34, 0);
      context.restore();
    }
  });

  context.beginPath();
  context.arc(center, center, radius - 2, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,255,255,0.45)";
  context.lineWidth = 4;
  context.stroke();
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function spin() {
  if (isSpinning || !participants.length) return;

  isSpinning = true;
  updateParticipantUI();
  elements.winnerCard.classList.remove("revealed");
  elements.winnerName.textContent = "轉動中…";
  const winnerIndex = secureRandomIndex(participants.length);
  const winner = participants[winnerIndex];
  const segment = 360 / participants.length;
  const segmentCenter = winnerIndex * segment + segment / 2;
  const currentNormalized = ((rotation % 360) + 360) % 360;
  const desiredNormalized = (360 - segmentCenter) % 360;
  const adjustment = (desiredNormalized - currentNormalized + 360) % 360;
  rotation += 360 * 7 + adjustment;

  elements.canvas.style.transform = `rotate(${rotation}deg)`;
  playSpinSound();

  window.setTimeout(() => finishSpin(winner, winnerIndex), 7100);
}

function finishSpin(winner, winnerIndex) {
  const now = new Date();
  history.unshift({
    name: winner,
    time: now.toISOString()
  });

  elements.winnerName.textContent = winner;
  elements.winnerCard.classList.add("revealed");
  playWinnerSound();
  launchConfetti();

  if (elements.removeWinnerToggle.checked) {
    participants.splice(winnerIndex, 1);
    elements.namesInput.value = participants.join("\n");
  }

  isSpinning = false;
  renderHistory();
  updateParticipantUI();
  drawWheel();
  saveState();
}

function renderHistory() {
  elements.historyCount.textContent = history.length;
  elements.historyEmpty.hidden = history.length > 0;
  elements.clearHistoryButton.hidden = history.length === 0;
  elements.historyList.innerHTML = "";

  history.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const rank = document.createElement("span");
    rank.className = "history-rank";
    rank.textContent = index + 1;

    const name = document.createElement("strong");
    name.textContent = entry.name;

    const time = document.createElement("time");
    const date = new Date(entry.time);
    time.dateTime = entry.time;
    time.textContent = Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });

    item.append(rank, name, time);
    elements.historyList.append(item);
  });
}

function activateTab(button) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.id === button.dataset.panel;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

async function importFile(file) {
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showToast("檔案過大，請選擇 1 MB 以下的檔案");
    return;
  }

  try {
    const text = await file.text();
    const names = text
      .split(/\r?\n/)
      .flatMap((line) => line.split(","))
      .map((name) => name.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean)
      .slice(0, MAX_PARTICIPANTS);

    elements.namesInput.value = names.join("\n");
    syncParticipantsFromInput();
    showToast(`已匯入 ${names.length} 位參加者`);
  } catch {
    showToast("無法讀取這個檔案");
  } finally {
    elements.fileInput.value = "";
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ffd84d", "#ff4f91", "#8b5cf6", "#46d9d1", "#ffffff"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--duration", `${2.3 + Math.random() * 2.2}s`);
    piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
    piece.style.setProperty("--rotation", `${360 + Math.random() * 720}deg`);
    piece.style.animationDelay = `${Math.random() * 0.55}s`;
    fragment.append(piece);
  }

  elements.confettiLayer.replaceChildren(fragment);
  setTimeout(() => elements.confettiLayer.replaceChildren(), 5200);
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playTone(frequency, start, duration, volume = 0.04) {
  const audio = getAudioContext();
  if (!audio || !elements.soundToggle.checked) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(volume, audio.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(audio.currentTime + start);
  oscillator.stop(audio.currentTime + start + duration);
}

function playSpinSound() {
  if (!elements.soundToggle.checked) return;
  for (let index = 0; index < 12; index += 1) {
    playTone(260 + index * 18, index * 0.09, 0.06, 0.022);
  }
}

function playWinnerSound() {
  [523, 659, 784, 1047].forEach((frequency, index) => {
    playTone(frequency, index * 0.13, 0.45, 0.055);
  });
}

elements.namesInput.addEventListener("input", syncParticipantsFromInput);
elements.spinButton.addEventListener("click", spin);
elements.fileInput.addEventListener("change", (event) => importFile(event.target.files[0]));
elements.clearNamesButton.addEventListener("click", () => {
  if (isSpinning) return;
  elements.namesInput.value = "";
  syncParticipantsFromInput();
  elements.winnerCard.classList.remove("revealed");
  elements.winnerName.textContent = "等待開獎";
});
elements.clearHistoryButton.addEventListener("click", () => {
  history = [];
  renderHistory();
  saveState();
  showToast("已清除得獎紀錄");
});
elements.removeWinnerToggle.addEventListener("change", saveState);
elements.soundToggle.addEventListener("change", saveState);
elements.fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    showToast("此瀏覽器不支援全螢幕模式");
  }
});
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab));
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
  if (event.code === "Space" && !isTyping) {
    event.preventDefault();
    spin();
  }
});
window.addEventListener("resize", drawWheel);

loadState();
fitCanvas();
renderHistory();
updateParticipantUI();
