"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { login, ask, approveExecution, getExecution } from "../lib/api";

/* ================= UTIL ================= */

const agentColor = (agent: string) => {
  if (agent.includes("Calendar")) return "border-blue-500 text-blue-400";
  if (agent.includes("Monitor")) return "border-yellow-500 text-yellow-400";
  if (agent.includes("XP") || agent.includes("Report"))
    return "border-green-500 text-green-400";
  if (agent.includes("Notify") || agent.includes("Email"))
    return "border-purple-500 text-purple-400";
  return "border-slate-600 text-slate-300";
};

/* ================= COMPONENT ================= */

export default function Home() {
  /* ---------- STATE ---------- */

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");

  const [plan, setPlan] = useState<any>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execution, setExecution] = useState<any>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [recording, setRecording] = useState(false);
  const [xpGained, setXpGained] = useState<number | null>(null);

  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /* ---------- RESTORE LOGIN ---------- */

  useEffect(() => {
    const stored = localStorage.getItem("access_token");
    if (stored) setToken(stored);
  }, []);

  /* ---------- LOAD HISTORY ---------- */

  useEffect(() => {
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/executions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [token, execution]);

  /* ---------- XP AUTO HIDE ---------- */

  useEffect(() => {
    if (!xpGained) return;
    const t = setTimeout(() => setXpGained(null), 3000);
    return () => clearTimeout(t);
  }, [xpGained]);

  /* ---------- AUTH ---------- */

  async function handleLogin() {
    const res = await login(email);
    localStorage.setItem("access_token", res.access_token);
    setToken(res.access_token);
  }

  function handleLogout() {
    localStorage.clear();
    setToken(null);
    setPlan(null);
    setExecution(null);
    setAgentStatus({});
  }

  /* ---------- GOOGLE CAL ---------- */

  function connectGoogleCalendar() {
    const t = localStorage.getItem("access_token");
    if (!t) return;
    window.location.assign(
      `${process.env.NEXT_PUBLIC_API_BASE}/oauth/google/connect?token=${t}`
    );
  }

  /* ---------- ASK ---------- */

  async function handleAsk() {
    if (!token || !input) return;
    const res = await ask(token, input);

    setPlan(res.execution_plan);
    setExecutionId(res.execution_id);
    setExecution(null);

    const initialStatus: Record<string, string> = {};
    res.execution_plan.agents.forEach((a: string) => {
      initialStatus[a] = "pending";
    });
    setAgentStatus(initialStatus);
  }

  async function handleApprove() {
    if (!token || !executionId) return;

    // mark all agents running
    setAgentStatus((prev) =>
      Object.fromEntries(Object.keys(prev).map((k) => [k, "running"]))
    );

    await approveExecution(token, executionId);
    const exec = await getExecution(token, executionId);

    setExecution(exec);
    setXpGained(exec.xp_gained ?? 5);

    // mark completed progressively
    exec.agents.forEach((agent: string, i: number) => {
      setTimeout(() => {
        setAgentStatus((prev) => ({ ...prev, [agent]: "completed" }));
      }, 600 * (i + 1));
    });
  }

  /* ---------- VOICE ---------- */

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current);
      const formData = new FormData();
      formData.append("file", blob);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/voice/transcribe`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (data.text) setInput(data.text);
      setRecording(false);
    };

    recorder.start();
    setRecording(true);
    setTimeout(() => recorder.stop(), 5000);
  }

  /* ---------- LOGIN UI ---------- */

  if (!token) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-[420px] p-8 rounded-2xl bg-slate-950 border border-slate-700 text-slate-200">
          <h1 className="text-2xl font-bold mb-4">🧠 NeuroFlow OS</h1>

          <input
            className="w-full p-3 rounded bg-slate-900 border border-slate-600 mb-4"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={handleLogin}
            className="w-full p-3 bg-cyan-400 text-black rounded font-semibold mb-4"
          >
            Login
          </button>

          <GoogleLogin
            onSuccess={async (cred) => {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE}/auth/google`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id_token: cred.credential }),
                }
              );
              const data = await res.json();
              localStorage.setItem("access_token", data.access_token);
              setToken(data.access_token);
            }}
          />
        </div>
      </main>
    );
  }

  /* ================= MAIN UI ================= */

  return (
    <main className="min-h-screen bg-black text-slate-200 p-10">
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-red-500 text-black px-4 py-2 rounded"
      >
        Logout
      </button>

      <h1 className="text-3xl font-bold mb-6">🧠 NeuroFlow OS</h1>

      <button
        onClick={connectGoogleCalendar}
        className="mb-4 bg-blue-500 text-black px-4 py-2 rounded"
      >
        Connect Google Calendar
      </button>

      <textarea
        className="w-full h-28 p-4 rounded bg-slate-900 border border-slate-700 mb-4"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type or speak a command..."
      />

      <div className="flex gap-4 items-center">
        <button
          onClick={handleAsk}
          className="bg-cyan-400 text-black px-6 py-3 rounded font-semibold"
        >
          Execute
        </button>

        <button
          onClick={startRecording}
          disabled={recording}
          className={`p-3 rounded-full ${
            recording ? "bg-red-500" : "border border-cyan-400 text-cyan-400"
          }`}
        >
          🎤
        </button>

        {recording && <span className="text-red-400">Listening…</span>}
      </div>

      {/* ---------- AGENTS ---------- */}

      <AnimatePresence>
        {plan && (
          <motion.div className="mt-10">
            <h3 className="text-xl mb-4">🤖 Agents</h3>

            <div className="grid grid-cols-2 gap-4">
              {plan.agents.map((agent: string, i: number) => {
                const status = agentStatus[agent];

                return (
                  <motion.div
                    key={agent}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className={`p-4 rounded-xl bg-slate-900 border ${agentColor(
                      agent
                    )}`}
                  >
                    <div className="flex justify-between items-center">
                      <strong>{agent}</strong>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          status === "running"
                            ? "bg-yellow-500 text-black animate-pulse"
                            : status === "completed"
                            ? "bg-green-500 text-black"
                            : "bg-slate-600"
                        }`}
                      >
                        {status ?? "pending"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <button
              onClick={handleApprove}
              className="mt-6 bg-green-400 text-black px-6 py-3 rounded font-semibold"
            >
              Approve & Execute
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- EXECUTION SUMMARY ---------- */}

      {execution && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-10 p-6 rounded-xl bg-slate-900 border border-slate-700"
        >
          <h3 className="text-lg font-semibold mb-3">📊 Execution Summary</h3>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="opacity-60">Tokens</p>
              <p className="font-bold">{execution.estimated_tokens}</p>
            </div>
            <div>
              <p className="opacity-60">Cost</p>
              <p className="font-bold">${execution.estimated_cost}</p>
            </div>
            <div>
              <p className="opacity-60">XP</p>
              <p className="font-bold text-green-400">
                +{execution.xp_gained}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ---------- TIMELINE ---------- */}

      {execution && (
        <div className="mt-12">
          <h3 className="text-xl mb-4">🕒 Execution Timeline</h3>

          <div className="space-y-3">
            {execution.timeline.map((t: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.2 }}
                className="p-3 rounded bg-slate-900 border border-slate-700 text-sm"
              >
                {t.message}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- HISTORY ---------- */}

      <div className="mt-16">
        <h3 className="text-xl mb-4">📜 Execution History</h3>

        <div className="space-y-3">
          {history.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-slate-900 border border-slate-700 rounded-xl"
            >
              <div className="flex justify-between">
                <span>{h.intent}</span>
                <span className="text-sm opacity-60">{h.status}</span>
              </div>
              <div className="text-xs opacity-60 mt-2">
                XP {h.xp_gained ?? 0}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ---------- XP POPUP ---------- */}

      {xpGained && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-green-400 to-emerald-500 text-black px-6 py-4 rounded-2xl font-bold shadow-2xl"
        >
          ⚡ +{xpGained} XP Earned
        </motion.div>
      )}
    </main>
  );
}

















