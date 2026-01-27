"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { login, ask, approveExecution, getExecution } from "../lib/api";

/* ================= UTIL ================= */

const agentColor = (agent: string) => {
  if (agent.includes("Calendar")) return "border-blue-500 text-blue-400";
  if (agent.includes("Monitor")) return "border-yellow-500 text-yellow-400";
  if (agent.includes("XP")) return "border-green-500 text-green-400";
  if (agent.includes("Notify") || agent.includes("Email"))
    return "border-purple-500 text-purple-400";
  return "border-slate-600 text-slate-300";
};

const humanIntent = (intent: string) => {
  if (!intent) return "🧠 Intelligent Execution";
  if (intent.toLowerCase().includes("track"))
    return "🎯 Daily Progress Tracking";
  if (intent.toLowerCase().includes("schedule"))
    return "📅 Scheduled Task";
  return "🧠 Intelligent Execution";
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
  const [xpGained, setXpGained] = useState<number | null>(null);

  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
  const [streaming, setStreaming] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);

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
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [token, execution]);

  /* ---------- XP AUTO HIDE ---------- */

  useEffect(() => {
    if (!xpGained) return;
    const t = setTimeout(() => setXpGained(null), 3000);
    return () => clearTimeout(t);
  }, [xpGained]);

  /* ---------- REAL-TIME STREAMING (POLLING) ---------- */

  useEffect(() => {
    if (!streaming || !token || !executionId) return;

    const interval = setInterval(async () => {
      const exec = await getExecution(token, executionId);
      setExecution(exec);

      exec.agents.forEach((agent: string) => {
        setAgentStatus((prev) => ({
          ...prev,
          [agent]: prev[agent] === "completed" ? "completed" : "running",
        }));
      });

      if (exec.status === "executed" || exec.status === "active") {
        exec.agents.forEach((a: string) =>
          setAgentStatus((prev) => ({ ...prev, [a]: "completed" }))
        );
        setStreaming(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [streaming, token, executionId]);

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

  /* ---------- ASK ---------- */

  async function handleAsk() {
    if (!token || !input) return;
    const res = await ask(token, input);

    setPlan(res.execution_plan);
    setExecutionId(res.execution_id);
    setExecution(null);

    const initial: Record<string, string> = {};
    res.execution_plan.agents.forEach((a: string) => (initial[a] = "pending"));
    setAgentStatus(initial);
  }

  async function handleApprove() {
    if (!token || !executionId) return;

    setStreaming(true);
    setAgentStatus((prev) =>
      Object.fromEntries(Object.keys(prev).map((k) => [k, "running"]))
    );

    await approveExecution(token, executionId);
  }

  /* ---------- STREAK CALC ---------- */

  const completed = history.filter((h) => h.status === "completed").length;
  const streak = Math.min(completed, 7);
  const streakPercent = Math.min((streak / 7) * 100, 100);

  /* ================= UI ================= */

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

  return (
    <main className="min-h-screen bg-black text-slate-200 p-10">
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-red-500 text-black px-4 py-2 rounded"
      >
        Logout
      </button>

      <h1 className="text-3xl font-bold mb-2">🧠 NeuroFlow OS</h1>
      <p className="opacity-60 mb-6">
        Agentic system with memory, monitoring, and feedback loops.
      </p>

      <textarea
        className="w-full h-28 p-4 rounded bg-slate-900 border border-slate-700 mb-4"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Try: Track my progress for 7 days"
      />

      <button
        onClick={handleAsk}
        className="bg-cyan-400 text-black px-6 py-3 rounded font-semibold"
      >
        Execute
      </button>

      {/* ---------- STREAK ---------- */}

      <div className="mt-10 p-6 rounded-xl bg-slate-900 border border-slate-700">
        <h3 className="font-semibold mb-2">📈 Progress Streak</h3>
        <div className="h-3 bg-slate-700 rounded overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${streakPercent}%` }}
            className="h-full bg-green-400"
          />
        </div>
        <p className="text-sm opacity-60 mt-2">
          {streak} day streak · {completed} total completions
        </p>
      </div>

      {/* ---------- AGENTS ---------- */}

      {plan && (
        <div className="mt-10">
          <h3 className="text-xl mb-4">🤖 Agents</h3>
          <div className="grid grid-cols-2 gap-4">
            {plan.agents.map((agent: string) => (
              <motion.div
                key={agent}
                animate={{ opacity: 1 }}
                className={`p-4 rounded-xl bg-slate-900 border ${agentColor(
                  agent
                )}`}
              >
                <div className="flex justify-between">
                  <strong>{agent}</strong>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      agentStatus[agent] === "running"
                        ? "bg-yellow-500 text-black animate-pulse"
                        : agentStatus[agent] === "completed"
                        ? "bg-green-500 text-black"
                        : "bg-slate-600"
                    }`}
                  >
                    {agentStatus[agent]}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={handleApprove}
            className="mt-6 bg-green-400 text-black px-6 py-3 rounded font-semibold"
          >
            Approve & Execute
          </button>
        </div>
      )}

      {/* ---------- ADVANCED ---------- */}

      {execution && (
        <div className="mt-10">
          <button
            onClick={() => setShowAdvanced((p) => !p)}
            className="text-sm opacity-60 underline"
          >
            {showAdvanced ? "Hide" : "Show"} advanced details
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.pre
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-slate-950 border border-slate-700 rounded text-xs overflow-auto"
              >
                {JSON.stringify(execution, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---------- XP ---------- */}

      {xpGained && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 10 }}
          animate={{ scale: 1.1, opacity: 1, y: -20 }}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-green-400 to-emerald-500 text-black px-6 py-4 rounded-2xl font-bold shadow-2xl"
        >
          ⚡ +{xpGained} XP
        </motion.div>
      )}
    </main>
  );
}


















