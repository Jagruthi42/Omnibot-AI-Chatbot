import { useState, useRef, useEffect, useCallback } from "react";

const FONT_LINK = document.createElement("link");
FONT_LINK.rel = "stylesheet";
FONT_LINK.href = "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";
document.head.appendChild(FONT_LINK);

const CATEGORIES = [
  { id: "general",    label: "General",    icon: "◈", color: "#2563eb", bg: "#eff6ff" },
  { id: "medical",    label: "Medical",    icon: "✚", color: "#059669", bg: "#ecfdf5" },
  { id: "education",  label: "Education",  icon: "⬡", color: "#d97706", bg: "#fffbeb" },
  { id: "geography",  label: "Geography",  icon: "◉", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "science",    label: "Science",    icon: "⬟", color: "#0891b2", bg: "#ecfeff" },
  { id: "technology", label: "Technology", icon: "◫", color: "#dc2626", bg: "#fef2f2" },
];

const SUGGESTIONS = {
  general:    ["What is the stock market?", "Explain the French Revolution", "What causes inflation?"],
  medical:    ["What are symptoms of diabetes?", "How does the immune system work?", "What is hypertension?"],
  education:  ["Explain Newton's laws of motion", "What is the Pythagorean theorem?", "How do I study effectively?"],
  geography:  ["What is the capital of Kazakhstan?", "Explain tectonic plates", "Largest country by area?"],
  science:    ["What is quantum entanglement?", "How does photosynthesis work?", "What is DNA made of?"],
  technology: ["What is machine learning?", "How does the internet work?", "Explain blockchain"],
};

const SYSTEM_PROMPTS = {
  general:    "You are OmniBot, a helpful general-purpose academic assistant. Answer clearly and thoroughly across all topics.",
  medical:    "You are OmniBot in Medical mode. Provide accurate, evidence-based medical information. Always advise consulting a qualified doctor for personal medical decisions.",
  education:  "You are OmniBot in Education mode. Act as an expert tutor. Break down concepts step-by-step with examples and analogies.",
  geography:  "You are OmniBot in Geography mode. Answer questions about countries, cultures, physical geography, climate, and geopolitics with depth.",
  science:    "You are OmniBot in Science mode. Explain scientific concepts from physics, chemistry, biology, and astronomy accurately and engagingly.",
  technology: "You are OmniBot in Technology mode. Help with programming, AI, software, hardware, and digital technology topics with practical clarity.",
};

// ─── GROQ API CALL FUNCTION ───────────────────────────────────────────────────
// This is the single function that handles all API calls to Groq
async function callGroq(messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: messages,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response received.";
}
// ─────────────────────────────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: "5px", padding: "3px 0" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "#9ca3af",
          display: "inline-block",
          animation: `omniDot 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  );
}

function CategoryPill({ cat, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 10px",
        marginBottom: "3px",
        borderRadius: "8px",
        background: active ? cat.bg : "transparent",
        border: `1px solid ${active ? cat.color + "30" : "transparent"}`,
        color: active ? cat.color : "#6b7280",
        cursor: "pointer",
        transition: "all 0.18s",
        textAlign: "left",
        fontSize: "13.5px",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: active ? 600 : 400,
      }}
    >
      <span style={{
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        background: active ? cat.color : "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "#fff" : "#9ca3af",
        fontSize: "13px",
        fontWeight: 700,
        transition: "all 0.18s",
        flexShrink: 0,
      }}>
        {cat.icon}
      </span>
      {cat.label}
      {active && (
        <span style={{
          marginLeft: "auto",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: cat.color,
        }} />
      )}
    </button>
  );
}

function ChatMessage({ msg, catColor }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      gap: "12px",
      marginBottom: "22px",
      flexDirection: isUser ? "row-reverse" : "row",
      animation: "omniSlide 0.28s ease-out",
    }}>
      <div style={{
        width: "34px",
        height: "34px",
        borderRadius: isUser ? "10px" : "50%",
        background: isUser ? catColor : "#1a1a2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        flexShrink: 0,
        color: "#fff",
        fontFamily: "'Lora', serif",
        fontWeight: 700,
        marginTop: "2px",
      }}>
        {isUser ? "U" : "Ω"}
      </div>
      <div style={{
        maxWidth: "70%",
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: isUser ? catColor : "#ffffff",
          color: isUser ? "#ffffff" : "#1a1a2e",
          fontSize: "14px",
          lineHeight: "1.75",
          boxShadow: isUser ? `0 4px 16px ${catColor}33` : "0 2px 12px rgba(0,0,0,0.07)",
          border: isUser ? "none" : "1px solid #e8e4dc",
          fontFamily: "'DM Sans', sans-serif",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        <div style={{
          fontSize: "10.5px",
          color: "#b0a898",
          marginTop: "5px",
          fontFamily: "'DM Mono', monospace",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}>
          {!isUser && msg.category && (
            <span style={{
              background: "#f0ede8",
              borderRadius: "4px",
              padding: "1px 7px",
              color: catColor,
              fontWeight: 500,
            }}>
              {CATEGORIES.find(c => c.id === msg.category)?.label}
            </span>
          )}
          {msg.time}
          {msg.source === "pdf" && (
            <span style={{
              background: "#fef3c7",
              borderRadius: "4px",
              padding: "1px 7px",
              color: "#92400e",
            }}>
              PDF
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OmniBot() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Hello! I'm OmniBot — your intelligent academic assistant.\n\nI can answer questions across Medical, Educational, Geographical, Scientific, Technology domains and more.\n\nSelect a topic mode from the sidebar, upload a PDF for document-based Q&A, use voice input, or simply type your question below.",
    category: "general",
    time: nowTime(),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("general");
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const chatHistory = useRef([]);
  const messagesEnd = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ─── PDF Upload ───────────────────────────────────────────────────────────────
  const handlePDF = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;
    e.target.value = "";
    setUploadStatus("loading");
    setPdfName(file.name);
    try {
      // Read PDF as text using FileReader
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      // Ask Groq to extract/summarize the PDF text
      const summary = await callGroq([
        { role: "system", content: "You are a document reader. The user will give you raw text from a PDF. Summarize and clean it so it can be used as context for future questions." },
        { role: "user", content: `Here is the PDF content:\n\n${text.slice(0, 8000)}` },
      ]);

      setPdfText(summary);
      setUploadStatus("ready");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `✓ PDF loaded: "${file.name}"\n\nI've read the document. You can now ask me questions about its content!`,
        category,
        time: nowTime(),
        source: "pdf",
      }]);
    } catch (err) {
      console.error("PDF error:", err);
      setUploadStatus("error");
      setPdfText("");
    }
  };

  // ─── Voice Input ──────────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input requires Chrome or Edge browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = "en-US";
    recog.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + " " : "") + t);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recognitionRef.current = recog;
    recog.start();
    setListening(true);
  }, [listening]);

  // ─── Send Message ─────────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg = { role: "user", content: userText, time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    chatHistory.current = [...chatHistory.current, { role: "user", content: userText }];

    // Build system prompt — add PDF context if a file was uploaded
    let sysPrompt = SYSTEM_PROMPTS[category] || SYSTEM_PROMPTS.general;
    if (pdfText) {
      sysPrompt += `\n\nThe user has uploaded a PDF. Here is its content:\n\n${pdfText}\n\nUse this to answer questions when relevant.`;
    }

    try {
      // Call Groq with system prompt + full chat history
      const reply = await callGroq([
        { role: "system", content: sysPrompt },
        ...chatHistory.current,
      ]);

      chatHistory.current = [...chatHistory.current, { role: "assistant", content: reply }];
      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        category,
        time: nowTime(),
      }]);
    } catch (err) {
      console.error("API error:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠ Error: ${err.message || "Network error. Please check your connection and API key."}`,
        category,
        time: nowTime(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    chatHistory.current = [];
    setPdfText("");
    setPdfName("");
    setUploadStatus("");
    setMessages([{
      role: "assistant",
      content: "Chat cleared. Ready for your next question — ask me anything!",
      category: "general",
      time: nowTime(),
    }]);
  };

  const userCount = messages.filter(m => m.role === "user").length;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8f7f4; }
        @keyframes omniDot {
          0%, 80%, 100% { transform: translateY(0); opacity: .3; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes omniSlide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes omniPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1cdc5; border-radius: 4px; }
        textarea { outline: none; resize: none; font-family: 'DM Sans', sans-serif; }
        button { outline: none; font-family: 'DM Sans', sans-serif; }
        .hov-ghost:hover { background: #f3f4f6 !important; }
        .hov-suggest:hover { background: #f0ede8 !important; border-color: #c5bfb6 !important; }
      `}</style>

      <div style={{
        display: "flex", height: "100vh", width: "100%",
        background: "#f8f7f4", fontFamily: "'DM Sans', sans-serif",
        color: "#1a1a2e", overflow: "hidden",
      }}>

        {/* ════════ SIDEBAR ════════ */}
        {sidebarOpen && (
          <div style={{
            width: "252px", flexShrink: 0, background: "#ffffff",
            borderRight: "1px solid #e8e4dc", display: "flex",
            flexDirection: "column", boxShadow: "2px 0 10px rgba(0,0,0,0.04)",
          }}>
            <div style={{ padding: "26px 22px 18px", borderBottom: "1px solid #f0ede8" }}>
              <div style={{ fontFamily: "'Lora', serif", fontSize: "22px", fontWeight: 700, color: "#1a1a2e", letterSpacing: "-0.02em" }}>OmniBot</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#b0a898", letterSpacing: "0.18em", marginTop: "4px", textTransform: "uppercase" }}>General Purpose AI Assistant</div>
            </div>

            <div style={{ padding: "18px 14px", flex: 1, overflowY: "auto" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#b0a898", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", paddingLeft: "8px" }}>Topic Mode</div>
              {CATEGORIES.map(c => (
                <CategoryPill key={c.id} cat={c} active={category === c.id} onClick={() => setCategory(c.id)} />
              ))}
            </div>

            {pdfName && (
              <div style={{
                margin: "0 14px 10px", padding: "10px 12px", borderRadius: "8px",
                background: uploadStatus === "ready" ? "#ecfdf5" : uploadStatus === "loading" ? "#fffbeb" : "#fef2f2",
                border: `1px solid ${uploadStatus === "ready" ? "#6ee7b7" : uploadStatus === "loading" ? "#fcd34d" : "#fca5a5"}`,
              }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: uploadStatus === "ready" ? "#059669" : uploadStatus === "loading" ? "#d97706" : "#dc2626", marginBottom: "3px" }}>
                  {uploadStatus === "loading" ? "Reading PDF…" : uploadStatus === "ready" ? "PDF Loaded ✓" : "PDF Error ✕"}
                </div>
                <div style={{ fontSize: "11.5px", color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdfName}</div>
                {uploadStatus === "ready" && (
                  <button onClick={() => { setPdfText(""); setPdfName(""); setUploadStatus(""); }} style={{ marginTop: "5px", fontSize: "11px", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remove ✕</button>
                )}
              </div>
            )}

            <div style={{ margin: "0 14px 12px", padding: "14px", background: "#f8f7f4", borderRadius: "10px", border: "1px solid #e8e4dc" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#b0a898", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Session</div>
              <div style={{ display: "flex", gap: "20px" }}>
                {[["Queries", userCount], ["Topics", CATEGORIES.filter(c => messages.some(m => m.category === c.id)).length]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: "24px", fontWeight: 700, color: cat.color, lineHeight: 1 }}>{v}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9ca3af", marginTop: "2px" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <button className="hov-ghost" onClick={clearChat} style={{ margin: "0 14px 18px", padding: "9px", borderRadius: "8px", background: "transparent", border: "1px solid #e8e4dc", color: "#9ca3af", cursor: "pointer", fontSize: "11.5px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em", transition: "all .15s" }}>
              Clear conversation
            </button>
          </div>
        )}

        {/* ════════ MAIN ════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Topbar */}
          <div style={{ padding: "0 24px", height: "62px", background: "#ffffff", borderBottom: "1px solid #e8e4dc", display: "flex", alignItems: "center", gap: "13px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", flexShrink: 0 }}>
            <button className="hov-ghost" onClick={() => setSidebarOpen(o => !o)} style={{ width: "34px", height: "34px", borderRadius: "8px", background: "transparent", border: "1px solid #e8e4dc", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0, transition: "all .15s" }}>
              {sidebarOpen ? "‹" : "☰"}
            </button>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: cat.bg, border: `1.5px solid ${cat.color}44`, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color, fontSize: "16px", fontWeight: 800, flexShrink: 0 }}>{cat.icon}</div>
            <div>
              <div style={{ fontFamily: "'Lora', serif", fontWeight: 600, fontSize: "15px", color: "#1a1a2e" }}>OmniBot — {cat.label} Mode</div>
              <div style={{ fontSize: "11px", color: "#6b7280", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                Active · Powered by Groq (Llama 3.3)
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
              <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePDF} />
              <button className="hov-ghost" onClick={() => fileInputRef.current?.click()} style={{ padding: "7px 14px", borderRadius: "8px", background: pdfText ? "#ecfdf5" : "transparent", border: `1px solid ${pdfText ? "#6ee7b7" : "#e8e4dc"}`, color: pdfText ? "#059669" : "#6b7280", cursor: "pointer", fontSize: "12px", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: "6px", transition: "all .15s" }}>
                📄 {pdfText ? "PDF Active" : "Upload PDF"}
              </button>
              <button onClick={toggleVoice} style={{ padding: "7px 14px", borderRadius: "8px", background: listening ? "#fef2f2" : "transparent", border: `1px solid ${listening ? "#fca5a5" : "#e8e4dc"}`, color: listening ? "#dc2626" : "#6b7280", cursor: "pointer", fontSize: "12px", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: "6px", animation: listening ? "omniPulse 1.5s infinite" : "none", transition: "background .15s, border-color .15s, color .15s" }}>
                🎙 {listening ? "Listening…" : "Voice"}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "26px 30px" }}>
            {messages.length <= 1 && (
              <div style={{ marginBottom: "26px" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#b0a898", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Suggested for {cat.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {(SUGGESTIONS[category] || SUGGESTIONS.general).map((q, i) => (
                    <button key={i} className="hov-suggest" onClick={() => sendMessage(q)} style={{ padding: "7px 15px", borderRadius: "20px", background: "#ffffff", border: "1px solid #e8e4dc", color: "#4b5563", cursor: "pointer", fontSize: "13px", transition: "all .15s" }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} catColor={cat.color} />
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "12px", marginBottom: "22px", animation: "omniSlide .28s ease-out" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>Ω</div>
                <div style={{ padding: "12px 18px", borderRadius: "4px 16px 16px 16px", background: "#ffffff", border: "1px solid #e8e4dc", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input Zone */}
          <div style={{ padding: "14px 24px 18px", background: "#ffffff", borderTop: "1px solid #e8e4dc", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)} style={{ padding: "4px 12px", borderRadius: "14px", background: category === c.id ? c.bg : "transparent", border: `1px solid ${category === c.id ? c.color + "44" : "#e8e4dc"}`, color: category === c.id ? c.color : "#9ca3af", cursor: "pointer", fontSize: "11.5px", fontWeight: category === c.id ? 600 : 400, transition: "all .15s" }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", background: "#f8f7f4", border: "1.5px solid #e0dbd2", borderRadius: "14px", padding: "10px 12px", transition: "border-color .2s" }}
              onFocusCapture={e => e.currentTarget.style.borderColor = cat.color + "70"}
              onBlurCapture={e => e.currentTarget.style.borderColor = "#e0dbd2"}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px";
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Ask anything in ${cat.label} mode… (Enter to send)`}
                disabled={loading}
                rows={1}
                style={{ flex: 1, background: "none", border: "none", color: "#1a1a2e", fontSize: "14px", lineHeight: "1.65", maxHeight: "130px", overflowY: "auto", caretColor: cat.color }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{ width: "38px", height: "38px", borderRadius: "10px", background: loading || !input.trim() ? "#e8e4dc" : cat.color, border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0, color: loading || !input.trim() ? "#b0a898" : "#fff", transition: "all .15s", boxShadow: loading || !input.trim() ? "none" : `0 3px 12px ${cat.color}44` }}
              >
                ➤
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: "7px", fontSize: "10px", color: "#c5bfb6", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
              OmniBot · Powered by Groq (Llama 3.3 70B) · Final Year Project
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
