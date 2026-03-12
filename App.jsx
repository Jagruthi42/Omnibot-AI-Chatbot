import { useState, useRef, useEffect, useCallback } from "react";

/* ── Google Fonts ─────────────────────────────────────────────────────────── */
const _link = document.createElement("link");
_link.rel  = "stylesheet";
_link.href = "https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";
document.head.appendChild(_link);

/* ── Topic definitions ────────────────────────────────────────────────────── */
const TOPICS = [
  { id: "general",    label: "General",    icon: "◈", color: "#2563eb", bg: "#eff6ff" },
  { id: "medical",    label: "Medical",    icon: "✚", color: "#059669", bg: "#ecfdf5" },
  { id: "education",  label: "Education",  icon: "⬡", color: "#d97706", bg: "#fffbeb" },
  { id: "geography",  label: "Geography",  icon: "◉", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "science",    label: "Science",    icon: "⬟", color: "#0891b2", bg: "#ecfeff" },
  { id: "technology", label: "Technology", icon: "◫", color: "#dc2626", bg: "#fef2f2" },
];

/* ── System prompts — each topic strictly refuses off-topic questions ─────── */
const SYS = {
  general:
    "You are OmniBot in General mode. Answer questions about history, culture, economics, politics, and everyday topics. " +
    "If the user asks about medicine, education, geography, science, or technology, say: " +
    "This belongs to the [domain] topic. Please switch to [domain] mode using the sidebar. " +
    "Never use **, ## or any markdown. Plain sentences only.",

  medical:
    "You are OmniBot in Medical mode. ONLY answer questions about medicine, health, anatomy, diseases, symptoms, treatments, nutrition, or mental health. " +
    "If the question is not medical or health-related, say: " +
    "I only answer medical questions in this mode. Please switch to the correct topic mode. " +
    "Always recommend consulting a qualified doctor. Never use **, ## or any markdown. Plain sentences only.",

  education:
    "You are OmniBot in Education mode. ONLY answer questions about academic subjects, mathematics, study techniques, exams, school or university topics. " +
    "If the question is not education-related, say: " +
    "I only answer education questions in this mode. Please switch to the correct topic mode. " +
    "Never use **, ## or any markdown. Plain sentences only.",

  geography:
    "You are OmniBot in Geography mode. ONLY answer questions about countries, capitals, physical geography, climate, oceans, mountains, cultures, populations, or geopolitics. " +
    "If the question is not geography-related, say: " +
    "I only answer geography questions in this mode. Please switch to the correct topic mode. " +
    "Never use **, ## or any markdown. Plain sentences only.",

  science:
    "You are OmniBot in Science mode. ONLY answer questions about physics, chemistry, biology, astronomy, environmental science, or natural phenomena. " +
    "If the question is not science-related, say: " +
    "I only answer science questions in this mode. Please switch to the correct topic mode. " +
    "Never use **, ## or any markdown. Plain sentences only.",

  technology:
    "You are OmniBot in Technology mode. ONLY answer questions about programming, software, hardware, AI, machine learning, cybersecurity, internet, or digital technology. " +
    "If the question is not technology-related, say: " +
    "I only answer technology questions in this mode. Please switch to the correct topic mode. " +
    "Never use **, ## or any markdown. Plain sentences only.",
};

const HINTS = {
  general:    ["What caused World War II?", "What is inflation?", "How does democracy work?"],
  medical:    ["What are symptoms of diabetes?", "How does the immune system work?", "What is hypertension?"],
  education:  ["Explain Newton's laws of motion", "What is the Pythagorean theorem?", "How do I study effectively?"],
  geography:  ["What is the capital of Kazakhstan?", "Explain tectonic plates", "Largest country by area?"],
  science:    ["What is quantum entanglement?", "How does photosynthesis work?", "What is DNA made of?"],
  technology: ["What is machine learning?", "How does the internet work?", "Explain blockchain"],
};

const WELCOME = {
  general:    "Welcome to General mode.\n\nI answer questions about history, culture, economics, politics, and everyday topics.\n\nFor medical, education, geography, science, or technology questions please switch to that topic mode.",
  medical:    "Welcome to Medical mode.\n\nI only answer questions about medicine, health, diseases, symptoms, treatments, and the human body.\n\nFor other topics please switch modes.",
  education:  "Welcome to Education mode.\n\nI only answer questions about academic subjects, mathematics, study techniques, and learning.\n\nFor other topics please switch modes.",
  geography:  "Welcome to Geography mode.\n\nI only answer questions about countries, capitals, climate, and physical geography.\n\nFor other topics please switch modes.",
  science:    "Welcome to Science mode.\n\nI only answer questions about physics, chemistry, biology, astronomy, and scientific phenomena.\n\nFor other topics please switch modes.",
  technology: "Welcome to Technology mode.\n\nI only answer questions about programming, AI, software, hardware, and digital technology.\n\nFor other topics please switch modes.",
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stripMd(text) {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs,   "$1")
    .replace(/__(.+?)__/gs,   "$1")
    .replace(/_(.+?)_/gs,     "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/gs, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* Build the initial display-messages state — ONE welcome message per topic */
function makeInitialMessages() {
  const m = {};
  TOPICS.forEach(t => {
    m[t.id] = [{ role: "assistant", content: WELCOME[t.id], time: nowTime() }];
  });
  return m;
}

/* Build the initial API-history state — empty array per topic */
function makeInitialHistories() {
  const h = {};
  TOPICS.forEach(t => { h[t.id] = []; });
  return h;
}

/* ── PDF extraction via pdf.js ────────────────────────────────────────────── */
async function extractPDF(file) {
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const ct = await pg.getTextContent();
    out += `[Page ${i}]\n${ct.items.map(x => x.str).join(" ")}\n\n`;
  }
  return out.trim();
}

/* ── Groq API call ────────────────────────────────────────────────────────── */
async function groq(systemPrompt, topicHistory) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:      "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages:   [{ role: "system", content: systemPrompt }, ...topicHistory],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return stripMd(d.choices?.[0]?.message?.content ?? "No response.");
}

/* ── Sub-components ───────────────────────────────────────────────────────── */
function Dots() {
  return (
    <div style={{ display:"flex", gap:"5px", padding:"3px 0" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:"7px", height:"7px", borderRadius:"50%", background:"#9ca3af",
          display:"inline-block",
          animation:`_dot 1.2s ease-in-out ${i*0.18}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function Pill({ t, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", display:"flex", alignItems:"center", gap:"10px",
      padding:"9px 10px", marginBottom:"3px", borderRadius:"8px",
      background: active ? t.bg : "transparent",
      border:`1px solid ${active ? t.color+"30" : "transparent"}`,
      color: active ? t.color : "#6b7280",
      cursor:"pointer", transition:"all .18s",
      fontSize:"13.5px", fontFamily:"'DM Sans',sans-serif", fontWeight: active ? 600 : 400,
    }}>
      <span style={{
        width:"28px", height:"28px", borderRadius:"6px", flexShrink:0,
        background: active ? t.color : "#f3f4f6",
        display:"flex", alignItems:"center", justifyContent:"center",
        color: active ? "#fff" : "#9ca3af", fontSize:"13px", fontWeight:700,
        transition:"all .18s",
      }}>{t.icon}</span>
      <span style={{ flex:1 }}>{t.label}</span>
      {count > 0 && (
        <span style={{
          background: active ? t.color : "#e5e7eb",
          color: active ? "#fff" : "#6b7280",
          borderRadius:"10px", fontSize:"10px", padding:"1px 7px",
          fontFamily:"'DM Mono',monospace", fontWeight:600, minWidth:"20px", textAlign:"center",
        }}>{count}</span>
      )}
    </button>
  );
}

function Bubble({ msg, color }) {
  const me = msg.role === "user";
  return (
    <div style={{ display:"flex", gap:"12px", marginBottom:"22px", flexDirection: me ? "row-reverse" : "row", animation:"_slide .28s ease-out" }}>
      <div style={{
        width:"34px", height:"34px", flexShrink:0, marginTop:"2px",
        borderRadius: me ? "10px" : "50%",
        background: me ? color : "#1a1a2e",
        display:"flex", alignItems:"center", justifyContent:"center",
        color:"#fff", fontFamily:"'Lora',serif", fontWeight:700, fontSize:"14px",
      }}>{me ? "U" : "Ω"}</div>
      <div style={{ maxWidth:"82%", display:"flex", flexDirection:"column", alignItems: me ? "flex-end" : "flex-start" }}>
        <div style={{
          padding:"12px 16px",
          borderRadius: me ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: me ? color : "#fff",
          color: me ? "#fff" : "#1a1a2e",
          fontSize:"14px", lineHeight:"1.75",
          boxShadow: me ? `0 4px 16px ${color}33` : "0 2px 12px rgba(0,0,0,.07)",
          border: me ? "none" : "1px solid #e8e4dc",
          fontFamily:"'DM Sans',sans-serif", whiteSpace:"pre-wrap", wordBreak:"break-word",
        }}>{msg.content}</div>
        <div style={{ fontSize:"10.5px", color:"#b0a898", marginTop:"5px", fontFamily:"'DM Mono',monospace", display:"flex", gap:"8px" }}>
          {msg.time}
          {msg.pdf && <span style={{ background:"#fef3c7", borderRadius:"4px", padding:"1px 7px", color:"#92400e" }}>PDF</span>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   Key design decision:
   • allMsgs  (useState)  — display messages per topic, triggers re-render
   • histories (useRef)   — API histories per topic, never shared across topics
   Each topic has its OWN key in both objects. They are never merged.
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  /* Per-topic display messages — stored in state so UI updates */
  const [allMsgs,  setAllMsgs]  = useState(makeInitialMessages);

  /* Per-topic API histories — stored in a ref map so mutations are instant */
  const histories = useRef(makeInitialHistories());

  const [topic,    setTopic]    = useState("general");
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [pdfText,  setPdfText]  = useState("");
  const [pdfName,  setPdfName]  = useState("");
  const [pdfState, setPdfState] = useState("idle"); // idle | loading | ready | error
  const [mic,      setMic]      = useState(false);
  const [sidebar,  setSidebar]  = useState(true);

  const endRef    = useRef(null);
  const fileRef   = useRef(null);
  const taRef     = useRef(null);
  const recogRef  = useRef(null);

  const T = TOPICS.find(t => t.id === topic);

  /* Messages shown for the current topic */
  const msgs = allMsgs[topic] ?? [];

  /* How many user turns each topic has — derived from histories ref.
     We track this separately in state so the UI badge re-renders correctly. */
  const [counts, setCounts] = useState(() => {
    const c = {};
    TOPICS.forEach(t => { c[t.id] = 0; });
    return c;
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMsgs, loading, topic]);

  /* ── helpers ── */
  const pushMsg = (tid, msg) =>
    setAllMsgs(prev => ({ ...prev, [tid]: [...prev[tid], msg] }));

  const incCount = (tid) =>
    setCounts(prev => ({ ...prev, [tid]: prev[tid] + 1 }));

  const switchTopic = (id) => {
    setTopic(id);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  /* ── PDF upload ── */
  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f || f.type !== "application/pdf") return;
    e.target.value = "";
    setPdfState("loading"); setPdfName(f.name); setPdfText("");
    try {
      const txt = await extractPDF(f);
      if (!txt || txt.length < 20) throw new Error("No readable text found. The file may be a scanned image.");
      setPdfText(txt.slice(0, 12000));
      setPdfState("ready");
      const pages = (txt.match(/\[Page \d+\]/g) || []).length;
      pushMsg(topic, {
        role:"assistant",
        content:`PDF loaded: "${f.name}"\n\n${pages} page(s) extracted. Ask me anything about the document.`,
        time: nowTime(), pdf: true,
      });
    } catch (err) {
      setPdfState("error"); setPdfText("");
      pushMsg(topic, { role:"assistant", content:`Could not read "${f.name}". ${err.message}`, time: nowTime() });
    }
  };

  /* ── Voice ── */
  const toggleMic = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome or Edge."); return; }
    if (mic) { recogRef.current?.stop(); setMic(false); return; }
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = "en-US";
    r.onresult = e => setInput(p => (p ? p+" " : "") + e.results[0][0].transcript);
    r.onend = () => setMic(false);
    r.onerror = () => setMic(false);
    recogRef.current = r;
    r.start(); setMic(true);
  }, [mic]);

  /* ── Send message ─────────────────────────────────────────────────────────
     THIS is where isolation is guaranteed:
     1. We snapshot `topic` into `tid` immediately.
     2. We read and write ONLY histories.current[tid].
     3. We push display messages ONLY into allMsgs[tid].
     No other topic's data is touched.
  ── */
  const send = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    /* Snapshot the active topic RIGHT NOW — switching topic mid-request
       will NOT corrupt any history because we use tid, not topic. */
    const tid = topic;

    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);

    /* 1. Show the user's message in THIS topic's chat */
    pushMsg(tid, { role: "user", content: userText, time: nowTime() });

    /* 2. Append to THIS topic's API history ONLY */
    histories.current[tid] = [
      ...histories.current[tid],
      { role: "user", content: userText },
    ];

    /* 3. Increment THIS topic's query counter */
    incCount(tid);

    /* 4. Build system prompt for THIS topic */
    let sys = SYS[tid];
    if (pdfText) {
      sys +=
        "\n\nThe user has uploaded a PDF. Answer PDF questions using ONLY the text below." +
        "\n---PDF START---\n" + pdfText + "\n---PDF END---" +
        "\nIf the answer is not in the PDF, say so clearly.";
    }

    try {
      /* 5. Call Groq with ONLY this topic's history */
      const reply = await groq(sys, histories.current[tid]);

      /* 6. Append AI reply to THIS topic's history ONLY */
      histories.current[tid] = [
        ...histories.current[tid],
        { role: "assistant", content: reply },
      ];

      /* 7. Show AI reply in THIS topic's chat ONLY */
      pushMsg(tid, { role: "assistant", content: reply, time: nowTime() });

    } catch (err) {
      /* On error, remove the failed user turn from history */
      histories.current[tid] = histories.current[tid].slice(0, -1);
      pushMsg(tid, {
        role: "assistant",
        content: `Error: ${err.message || "Network error. Check your connection."}`,
        time: nowTime(),
      });
    } finally {
      setLoading(false);
    }
  };

  /* ── Clear current topic only ── */
  const clearThis = () => {
    histories.current[topic] = [];
    setCounts(p => ({ ...p, [topic]: 0 }));
    setAllMsgs(p => ({ ...p, [topic]: [{ role:"assistant", content: WELCOME[topic], time: nowTime() }] }));
  };

  /* ── Clear all topics ── */
  const clearAll = () => {
    histories.current = makeInitialHistories();
    setCounts(() => { const c={}; TOPICS.forEach(t=>{c[t.id]=0;}); return c; });
    setAllMsgs(makeInitialMessages());
    setPdfText(""); setPdfName(""); setPdfState("idle");
  };

  const thisCnt = counts[topic] ?? 0;

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#f8f7f4}
        @keyframes _dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-6px);opacity:1}}
        @keyframes _slide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes _pulse{0%,100%{opacity:1}50%{opacity:.4}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#d1cdc5;border-radius:4px}
        textarea,button{font-family:'DM Sans',sans-serif;outline:none}
        textarea{resize:none}
        .gh:hover{background:#f3f4f6!important}
        .sq:hover{background:#f0ede8!important;border-color:#c5bfb6!important}
      `}</style>

      <div style={{ display:"flex", height:"100vh", fontFamily:"'DM Sans',sans-serif", color:"#1a1a2e", overflow:"hidden" }}>

        {/* ═══ SIDEBAR ═══ */}
        {sidebar && (
          <div style={{ width:"252px", flexShrink:0, background:"#fff", borderRight:"1px solid #e8e4dc", display:"flex", flexDirection:"column", boxShadow:"2px 0 10px rgba(0,0,0,.04)" }}>

            <div style={{ padding:"26px 22px 18px", borderBottom:"1px solid #f0ede8" }}>
              <div style={{ fontFamily:"'Lora',serif", fontSize:"22px", fontWeight:700, letterSpacing:"-0.02em" }}>OmniBot</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#b0a898", letterSpacing:"0.18em", marginTop:"4px", textTransform:"uppercase" }}>General Purpose AI Assistant</div>
            </div>

            {/* Topic list — badge = query count for THAT topic */}
            <div style={{ padding:"18px 14px", flex:1, overflowY:"auto" }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#b0a898", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"10px", paddingLeft:"8px" }}>Topic Mode</div>
              {TOPICS.map(t => (
                <Pill key={t.id} t={t} active={topic===t.id} onClick={()=>switchTopic(t.id)} count={counts[t.id]} />
              ))}
            </div>

            {/* PDF status */}
            {pdfName && (
              <div style={{ margin:"0 14px 10px", padding:"10px 12px", borderRadius:"8px",
                background: pdfState==="ready"?"#ecfdf5":pdfState==="loading"?"#fffbeb":"#fef2f2",
                border:`1px solid ${pdfState==="ready"?"#6ee7b7":pdfState==="loading"?"#fcd34d":"#fca5a5"}` }}>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase",
                  color: pdfState==="ready"?"#059669":pdfState==="loading"?"#d97706":"#dc2626", marginBottom:"3px" }}>
                  {pdfState==="loading"?"Extracting…":pdfState==="ready"?"PDF Ready ✓":"PDF Error ✕"}
                </div>
                <div style={{ fontSize:"11.5px", color:"#4b5563", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pdfName}</div>
                {pdfState==="ready" && <>
                  <div style={{ fontSize:"10px", color:"#6b7280", marginTop:"3px", fontFamily:"'DM Mono',monospace" }}>~{Math.round(pdfText.length/5)} words</div>
                  <button onClick={()=>{setPdfText("");setPdfName("");setPdfState("idle");}} style={{ marginTop:"5px", fontSize:"11px", color:"#9ca3af", background:"none", border:"none", cursor:"pointer", padding:0 }}>Remove ✕</button>
                </>}
              </div>
            )}

            {/* Session stats — THIS topic's count only */}
            <div style={{ margin:"0 14px 10px", padding:"14px", background:"#f8f7f4", borderRadius:"10px", border:"1px solid #e8e4dc" }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#b0a898", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"10px" }}>{T.label} Session</div>
              <div style={{ display:"flex", gap:"20px" }}>
                <div>
                  <div style={{ fontFamily:"'Lora',serif", fontSize:"28px", fontWeight:700, color:T.color, lineHeight:1 }}>{thisCnt}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#9ca3af", marginTop:"2px" }}>Queries here</div>
                </div>
                <div>
                  <div style={{ fontFamily:"'Lora',serif", fontSize:"28px", fontWeight:700, color:T.color, lineHeight:1 }}>{TOPICS.filter(t=>counts[t.id]>0).length}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#9ca3af", marginTop:"2px" }}>Topics used</div>
                </div>
              </div>
            </div>

            <button className="gh" onClick={clearThis} style={{ margin:"0 14px 6px", padding:"8px", borderRadius:"8px", background:"transparent", border:`1px solid ${T.color}33`, color:T.color, cursor:"pointer", fontSize:"11px", fontFamily:"'DM Mono',monospace", transition:"all .15s" }}>
              Clear {T.label} chat
            </button>
            <button className="gh" onClick={clearAll} style={{ margin:"0 14px 18px", padding:"8px", borderRadius:"8px", background:"transparent", border:"1px solid #e8e4dc", color:"#9ca3af", cursor:"pointer", fontSize:"11px", fontFamily:"'DM Mono',monospace", transition:"all .15s" }}>
              Clear all chats
            </button>
          </div>
        )}

        {/* ═══ MAIN ═══ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Topbar */}
          <div style={{ padding:"0 24px", height:"62px", background:"#fff", borderBottom:"1px solid #e8e4dc", display:"flex", alignItems:"center", gap:"13px", boxShadow:"0 1px 6px rgba(0,0,0,.04)", flexShrink:0 }}>
            {/* Sidebar toggle */}
            <button className="gh" onClick={()=>setSidebar(s=>!s)} style={{ width:"34px", height:"34px", borderRadius:"8px", background:"transparent", border:"1px solid #e8e4dc", color:"#6b7280", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", flexShrink:0, transition:"all .15s" }}>
              {sidebar?"‹":"☰"}
            </button>
            {/* Topic icon */}
            <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:T.bg, border:`1.5px solid ${T.color}44`, display:"flex", alignItems:"center", justifyContent:"center", color:T.color, fontSize:"16px", fontWeight:800, flexShrink:0 }}>{T.icon}</div>
            {/* Title — flex:1 so it fills ALL remaining space, pushing buttons to the far right */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Lora',serif", fontWeight:600, fontSize:"15px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>OmniBot — {T.label} Mode</div>
              <div style={{ fontSize:"11px", color:"#6b7280", fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:"5px" }}>
                <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#10b981", display:"inline-block", flexShrink:0 }}/>
                {T.label} only · Isolated history
              </div>
            </div>
            {/* Action buttons — sit flush at the far right, no gap */}
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display:"none" }} onChange={onFile}/>
            <button className="gh" onClick={()=>fileRef.current?.click()} style={{ padding:"7px 14px", borderRadius:"8px", background:pdfText?"#ecfdf5":"transparent", border:`1px solid ${pdfText?"#6ee7b7":"#e8e4dc"}`, color:pdfText?"#059669":"#6b7280", cursor:"pointer", fontSize:"12px", fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:"6px", flexShrink:0, transition:"all .15s" }}>
              📄 {pdfState==="loading"?"Reading…":pdfText?"PDF Active":"Upload PDF"}
            </button>
            <button onClick={toggleMic} style={{ padding:"7px 14px", borderRadius:"8px", background:mic?"#fef2f2":"transparent", border:`1px solid ${mic?"#fca5a5":"#e8e4dc"}`, color:mic?"#dc2626":"#6b7280", cursor:"pointer", fontSize:"12px", fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:"6px", flexShrink:0, animation:mic?"_pulse 1.5s infinite":"none", transition:"all .15s" }}>
              🎙 {mic?"Listening…":"Voice"}
            </button>
          </div>

          {/* Chat area — renders msgs[topic], nothing else */}
          <div style={{ flex:1, overflowY:"auto", padding:"26px 40px" }}>

            {/* Topic banner */}
            <div style={{ marginBottom:"20px", padding:"10px 16px", borderRadius:"10px", background:T.bg, border:`1px solid ${T.color}22`, display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"16px" }}>{T.icon}</span>
              <div>
                <div style={{ fontSize:"11px", fontWeight:600, color:T.color, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.08em" }}>{T.label} Mode · Isolated History</div>
                <div style={{ fontSize:"11px", color:"#6b7280", marginTop:"1px" }}>
                  {thisCnt > 0
                    ? `${thisCnt} question${thisCnt>1?"s":""} in this topic. Other topics have their own separate history.`
                    : "No questions asked yet here. Each topic keeps its own history."}
                </div>
              </div>
            </div>

            {/* Suggestion chips — visible only before first question in this topic */}
            {thisCnt === 0 && (
              <div style={{ marginBottom:"26px" }}>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:"#b0a898", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"10px" }}>Try asking</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                  {HINTS[topic].map((q,i)=>(
                    <button key={i} className="sq" onClick={()=>send(q)} style={{ padding:"7px 15px", borderRadius:"20px", background:"#fff", border:"1px solid #e8e4dc", color:"#4b5563", cursor:"pointer", fontSize:"13px", transition:"all .15s" }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Only this topic's messages */}
            {msgs.map((m,i) => <Bubble key={i} msg={m} color={T.color}/>)}

            {loading && (
              <div style={{ display:"flex", gap:"12px", marginBottom:"22px", animation:"_slide .28s ease-out" }}>
                <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"#1a1a2e", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"'Lora',serif", fontWeight:700, fontSize:"14px", flexShrink:0, marginTop:"2px" }}>Ω</div>
                <div style={{ padding:"12px 18px", borderRadius:"4px 16px 16px 16px", background:"#fff", border:"1px solid #e8e4dc", boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}><Dots/></div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Input zone */}
          <div style={{ padding:"14px 40px 18px", background:"#fff", borderTop:"1px solid #e8e4dc", flexShrink:0 }}>

            {/* Quick topic strip — coloured dot if topic has history */}
            <div style={{ display:"flex", gap:"6px", marginBottom:"10px", flexWrap:"wrap" }}>
              {TOPICS.map(t=>(
                <button key={t.id} onClick={()=>switchTopic(t.id)} style={{ padding:"4px 12px", borderRadius:"14px", background:topic===t.id?t.bg:"transparent", border:`1px solid ${topic===t.id?t.color+"44":"#e8e4dc"}`, color:topic===t.id?t.color:"#9ca3af", cursor:"pointer", fontSize:"11.5px", fontWeight:topic===t.id?600:400, transition:"all .15s", position:"relative" }}>
                  {t.icon} {t.label}
                  {counts[t.id]>0 && topic!==t.id && (
                    <span style={{ position:"absolute", top:"1px", right:"1px", width:"5px", height:"5px", borderRadius:"50%", background:t.color }}/>
                  )}
                </button>
              ))}
            </div>

            <div style={{ display:"flex", gap:"10px", alignItems:"flex-end", background:"#f8f7f4", border:"1.5px solid #e0dbd2", borderRadius:"14px", padding:"10px 12px", transition:"border-color .2s" }}
              onFocusCapture={e=>e.currentTarget.style.borderColor=T.color+"70"}
              onBlurCapture={e=>e.currentTarget.style.borderColor="#e0dbd2"}
            >
              <textarea
                ref={taRef}
                value={input}
                onChange={e=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,130)+"px"; }}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }}
                placeholder={pdfText?`Ask about your PDF in ${T.label} mode…`:`Ask a ${T.label.toLowerCase()} question… (Enter to send)`}
                disabled={loading}
                rows={1}
                style={{ flex:1, background:"none", border:"none", color:"#1a1a2e", fontSize:"14px", lineHeight:"1.65", maxHeight:"130px", overflowY:"auto", caretColor:T.color }}
              />
              <button onClick={()=>send()} disabled={loading||!input.trim()} style={{ width:"38px", height:"38px", borderRadius:"10px", background:loading||!input.trim()?"#e8e4dc":T.color, border:"none", cursor:loading||!input.trim()?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px", flexShrink:0, color:loading||!input.trim()?"#b0a898":"#fff", transition:"all .15s", boxShadow:loading||!input.trim()?"none":`0 3px 12px ${T.color}44` }}>
                ➤
              </button>
            </div>

            <div style={{ textAlign:"center", marginTop:"7px", fontSize:"10px", color:"#c5bfb6", fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em" }}>
              OmniBot · {T.label} Mode · Groq LLaMA 3.3 70B · Final Year Project
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
