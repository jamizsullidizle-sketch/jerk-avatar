// Jerk Avatar v1 — front end.
// Brain:  Supabase function "roast"  -> falls back to OFFLINE DEMO lines.
// Voice:  Supabase function "speak"  -> falls back to the free browser voice.
(() => {
  "use strict";

  const cfg = window.JERK_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const forceDemo = params.has("demo");
  const backendUrl = (cfg.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = cfg.supabaseAnonKey || "";
  const backendConfigured = !forceDemo && !!backendUrl && !!anonKey;

  const state = {
    demo: !backendConfigured, // flips to true if the backend says it has no AI key
    // "unknown" until `speak` answers: "cloud" only after real Jimmy-voice audio comes back,
    // "browser" once it says it isn't set up (503). The badge only claims Jimmy's voice for "cloud".
    voice: backendConfigured ? "unknown" : "browser",
    history: [], // [{role, content}] real AI turns only
    busy: false,
    lastDemo: -1,
  };

  // ---------- OFFLINE DEMO lines (not AI, clearly labeled) ----------
  const DEMO_LINES = [
    "That's it? I've seen better effort from a cold weld on a rainy Tuesday.",
    "Kid, you talk like you learned English from a Dunkin' drive-thru speaker.",
    "Wicked brave typing that. Wicked dumb, but brave.",
    "You got more porosity in that argument than a first-year's practice bead.",
    "I've been stuck on Route 95 at rush hour and still had a better time than this conversation.",
    "Buddy, you couldn't weld butter to a hot pan.",
    "Say it again, slower, so I can ignore it properly.",
    "You're like a clam cake with no clam. All batter, no point.",
    "I'd roast you harder, but my boss says I gotta save some heat for the steel.",
    "That's the weakest thing to come outta Rhode Island since the Warwick Mall food court.",
    "You call that trash talk? Del's lemonade has more bite.",
    "Hey, I'm on break. Come back when you got something worth grinding down.",
  ];

  function demoReply() {
    let i;
    do {
      i = Math.floor(Math.random() * DEMO_LINES.length);
    } while (i === state.lastDemo && DEMO_LINES.length > 1);
    state.lastDemo = i;
    return DEMO_LINES[i];
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const logEl = $("log");
  const form = $("form");
  const input = $("input");
  const sendBtn = $("sendBtn");
  const micBtn = $("micBtn");
  const micHint = $("micHint");
  const avatar = $("avatar");
  const statusEl = $("status");
  const badge = $("modeBadge");
  const demoBanner = $("demoBanner");
  const statusTag = $("statusTag");

  function renderMode() {
    if (state.demo) {
      badge.textContent = "OFFLINE DEMO";
      badge.className = "badge demo";
      statusTag.textContent = "Jimmy.Twin.Demo // scripted";
      demoBanner.hidden = false;
    } else {
      const cloud = state.voice === "cloud";
      badge.textContent = cloud ? "LIVE AI + Jimmy's voice" : "LIVE AI";
      badge.title = cloud ? "AI replies, spoken in Jimmy's cloned voice" : "AI replies, spoken by your browser's built-in voice";
      badge.className = "badge live";
      statusTag.textContent = "Jimmy.Twin.Online // AI";
      demoBanner.hidden = true;
    }
  }

  const ICONS = {
    you: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>',
    jimmy: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  };

  function addMsg(who, text, opts = {}) {
    const div = document.createElement("div");
    div.className = `msg ${who}${opts.demo ? " demo" : ""}`;
    div.dataset.role = who;
    if (opts.demo) div.dataset.demo = "true";
    if (who === "system") {
      div.textContent = text;
    } else {
      const icon = document.createElement("div");
      icon.className = "msg-icon";
      icon.innerHTML = ICONS[who]; // static SVG only, never user text
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      const label = document.createElement("span");
      label.className = "who";
      label.textContent = who === "you" ? "You" : "Jimmy";
      if (opts.demo) {
        const tag = document.createElement("span");
        tag.className = "tag-demo";
        tag.textContent = "DEMO";
        tag.title = "Pre-written demo line, not AI";
        label.appendChild(tag);
      }
      bubble.appendChild(label);
      bubble.appendChild(document.createTextNode(text)); // text node: no HTML injection
      div.append(icon, bubble);
    }
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    return div;
  }

  function setAvatar(mode) {
    avatar.classList.remove("talking", "thinking", "listening");
    if (mode) avatar.classList.add(mode);
  }

  function setBusy(b) {
    state.busy = b;
    sendBtn.disabled = b;
  }

  // ---------- Brain ----------
  async function callBackend(fn, body, asBlob = false) {
    const res = await fetch(`${backendUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
    });
    return { res, data: asBlob || !res.ok ? null : await res.json() };
  }

  async function getReply(message) {
    if (!state.demo) {
      try {
        const { res, data } = await callBackend("roast", {
          message,
          history: state.history.slice(-10),
        });
        if (res.ok && data && data.reply) {
          state.history.push({ role: "user", content: message });
          state.history.push({ role: "assistant", content: data.reply });
          return { text: data.reply, demo: false };
        }
        if (res.status === 503) {
          state.demo = true;
          renderMode();
          addMsg("system", "The AI key isn't set on the server yet, so switching to offline demo mode.");
        } else if (res.status === 429) {
          addMsg("system", "You hit the roast limit (20 per 10 minutes). Here's a demo line while you cool off.");
        } else {
          addMsg("system", `AI hiccup (${res.status}). Here's a demo line instead.`);
        }
      } catch (err) {
        console.warn("roast failed", err);
        addMsg("system", "Couldn't reach the AI. Here's a demo line instead.");
      }
    }
    await new Promise((r) => setTimeout(r, 350)); // tiny pause so it feels natural
    return { text: demoReply(), demo: true };
  }

  // ---------- Voice ----------
  let currentAudio = null;

  async function speak(text) {
    stopSpeaking();
    if (state.voice !== "browser" && !state.demo) {
      try {
        const { res } = await callBackend("speak", { text }, true);
        const type = res.headers.get("content-type") || "";
        if (res.ok && type.startsWith("audio")) {
          if (state.voice !== "cloud") {
            state.voice = "cloud";
            renderMode();
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          await playAudio(url);
          URL.revokeObjectURL(url);
          return;
        }
        if (res.status === 503) {
          state.voice = "browser"; // no voice clone set up: stop asking, badge stays "LIVE AI"
          renderMode();
        }
        if (!res.ok || !type.startsWith("audio")) await res.body?.cancel();
      } catch (err) {
        console.warn("speak failed, using browser voice", err);
      }
    }
    await browserSpeak(text);
  }

  function playAudio(url) {
    return new Promise((resolve) => {
      const a = new Audio(url);
      currentAudio = a;
      a.onplay = () => setAvatar("talking");
      a.onended = a.onerror = () => {
        setAvatar(null);
        resolve();
      };
      a.play().catch(() => {
        setAvatar(null);
        resolve();
      });
    });
  }

  let chosenVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices();
    const en = voices.filter((v) => /^en[-_]US/i.test(v.lang));
    const male = en.find((v) => /male|david|guy|fred|alex|daniel|mark/i.test(v.name));
    return male || en[0] || voices.find((v) => /^en/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) {
    chosenVoice = pickVoice();
    speechSynthesis.onvoiceschanged = () => (chosenVoice = pickVoice());
  }

  function browserSpeak(text) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        // No voice at all: animate the mouth for a beat so it still feels alive.
        setAvatar("talking");
        setTimeout(() => {
          setAvatar(null);
          resolve();
        }, Math.min(4000, 60 * text.length));
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      if (chosenVoice) u.voice = chosenVoice;
      u.rate = 1.08;
      u.pitch = 0.8;
      u.onstart = () => setAvatar("talking");
      u.onend = u.onerror = () => {
        clearTimeout(safety);
        setAvatar(null);
        resolve();
      };
      // Safety net: some browsers never fire onend.
      const safety = setTimeout(() => {
        setAvatar(null);
        resolve();
      }, 1500 + 90 * text.length);
      setAvatar("talking");
      speechSynthesis.speak(u);
    });
  }

  function stopSpeaking() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setAvatar(null);
  }

  // ---------- Send flow ----------
  async function send(text) {
    text = (text || "").trim();
    if (!text || state.busy) return;
    setBusy(true);
    input.value = "";
    addMsg("you", text);
    setAvatar("thinking");
    statusEl.textContent = "Jimmy's lifting his hood…";
    const reply = await getReply(text);
    addMsg("jimmy", reply.text, { demo: reply.demo });
    statusEl.textContent = reply.demo ? "(demo line, not AI)" : "";
    setBusy(false);
    await speak(reply.text);
    statusEl.textContent = "Go on. Say something else.";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value);
  });

  // ---------- Hold-to-talk mic ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.hidden = true;
    micHint.textContent = "Voice input isn't supported in this browser. Type instead (try Chrome or Safari for the mic).";
  } else {
    micHint.textContent = "Hold the mic to talk, let go to send.";
    let rec = null;
    let finalText = "";
    let holding = false;

    const start = (e) => {
      e.preventDefault();
      if (holding || state.busy) return;
      holding = true;
      stopSpeaking();
      finalText = "";
      rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (ev) => {
        let interim = "";
        finalText = "";
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        input.value = (finalText + " " + interim).trim();
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          micHint.textContent = "Mic blocked. Allow microphone access, or just type.";
        }
      };
      rec.onend = () => {
        micBtn.classList.remove("recording");
        setAvatar(null);
        const said = input.value.trim();
        if (said) send(said);
        statusEl.textContent = "";
      };
      try {
        rec.start();
        micBtn.classList.add("recording");
        setAvatar("listening");
        statusEl.textContent = "Listening… (let go to send)";
      } catch (err) {
        console.warn(err);
        holding = false;
      }
    };
    const stop = () => {
      if (!holding) return;
      holding = false;
      if (rec) rec.stop(); // onend fires and sends
    };
    micBtn.addEventListener("pointerdown", start);
    micBtn.addEventListener("pointerup", stop);
    micBtn.addEventListener("pointerleave", stop);
    micBtn.addEventListener("pointercancel", stop);
    micBtn.addEventListener("contextmenu", (e) => e.preventDefault());
    // Keyboard: hold Space/Enter while the mic button is focused.
    micBtn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e);
    });
    micBtn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") stop();
    });
  }

  // ---------- Boot ----------
  renderMode();
  addMsg(
    "jimmy",
    state.demo
      ? "Oh great, another one. Go ahead, type something. This is just the demo, so I'm workin' off a script."
      : "Oh great, another one. Go ahead, say somethin'. I got all day... actually I don't.",
    { demo: state.demo },
  );
  if (backendConfigured) statusEl.textContent = "Connected. Say something. I dare ya.";

  // Expose a tiny hook for tests/debugging.
  window.__jerk = { state, send };
})();
