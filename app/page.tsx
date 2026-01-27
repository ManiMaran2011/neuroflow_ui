"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { login, ask, approveExecution, getExecution } from "../lib/api";

/* ================== UTILS ================== */

const agentStyle = (agent: string) => {
  if (agent.includes("Calendar")) return "border-blue-500 text-blue-400";
  if (agent.includes("Monitor")) return "border-yellow-500 text-yellow-400";
  if (agent.includes("Notify")) return "border-purple-500 text-purple-400";
  if (agent.includes("XP")) return "border-green-500 text-green-400";
  return "border-slate-600 text-slate-300";
};

const badge = (state: string) => {
  if (state === "running")
    return "bg-yellow-400 text-black animate-pulse";
  if (state === "completed") return "bg-green-400 text-black";
  return "bg-slate-600 text-white";
};

/* ================== PAGE ================== */

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");

  const [plan, setPlan] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const [agentState, setAgentState] = useState<Record<string, string>>({});
  const [streaming, setStreaming] = useState(false);

  const [xpBurst, setXpBurst] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* ---------- RESTORE LOGIN ---------- */

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (t) setToken(t);
  }, []);

  /* ---------- STREAM EXECUTION ---------- */

  useEffect(() => {
    if (!streaming || !executionId || !token) return;

    const interval = setInterval(async () => {
      const exec = await getExecution(token, executionId);
      setExecution(exec);

      exec.agents.forEach((a: string) =>
        setAgentState((p) => ({
          ...p,
          [a]: p[a] === "completed" ? "completed" : "running",
        }))
      );

      if (exec.status === "executed" || exec.status === "active") {
        exec.agents.forEach((a: string) =>
          setAgentState((p) => ({ ...p, [a]: "completed" }))
        );
        setStreaming(false);
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [streaming, executionId, token]);

  /* ---------- HANDLERS ---------- */

  async function handleLogin() {
    const res = await login(email);
    localStorage.setItem("access_token", res.access_token);
    setToken(res.access_token);
  }

  function connectGoogleCalendar() {
    const t = localStorage.getItem("access_token");
    if (!t) return;
    window.location.href =
      `${process.env.NEXT_PUBLIC_API_BASE}/oauth/google/connect?token=${t}`;
  }

  async function handleAsk() {
    if (!token || !input) return;
    const res = await ask(token, input);

    setPlan(res.execution_plan);
    setExecutionId(res.execution_id);
    setExecution(null);

    const init: Record<string, string> = {};
    res.execution_plan.agents.forEach((a: string) => (init[a] = "pending"));
    setAgentState(init);
  }

  async function handleApprove() {
    if (!token || !executionId) return;

    setStreaming(true);
    setXpBurst(null);

    setAgentState((prev) =>
      Object.fromEntries(Object.keys(prev).map((k) => [k, "running"]))
    );

    const res = await approveExecution(token, executionId);

    // 🔥 ALWAYS trigger XP animation
    setTimeout(() => setXpBurst(res.xp_gained ?? 15), 200);
  }

  /* ================== LOGIN ================== */

  if (!token) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-[420px] bg-slate-950 border border-slate-700 p-8 rounded-2xl">
          <h1 className="text-2xl font-bold mb-4">🧠 NeuroFlow OS</h1>

          <input
            className="w-full p-3 mb-4 bg-slate-900 border border-slate-700 rounded"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={handleLogin}
            className="w-full bg-cyan-400 text-black p-3 rounded font-semibold"
          >
            Login
          </button>
        </div>
      </main>
    );
  }

  /* ================== MAIN ================== */

  return (
    <main className="min-h-screen bg-black text-slate-200 p-10">
      <h1 className="text-3xl font-bold mb-1">🧠 NeuroFlow OS</h1>
      <p className="opacity-60 mb-4">
        An agentic AI system with memory, monitoring, and real-world actions.
      </p>

      {/* 🔗 GOOGLE CALENDAR */}
      <button
        onClick={connectGoogleCalendar}
        className="mb-6 bg-blue-500 text-black px-5 py-2 rounded-lg font-semibold"
      >
        🔗 Connect Google Calendar
      </button>

      {/* COMMAND INPUT */}
      <textarea
        className="w-full h-28 p-4 rounded-xl bg-slate-900 border border-slate-700 mb-4"
        placeholder="Try: Schedule a meeting tomorrow at 5pm"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleAsk}
        className="bg-cyan-400 text-black px-6 py-3 rounded-xl font-semibold"
      >
        Execute Command
      </button>

      {/* AGENTS */}
      {plan && (
        <div className="mt-10">
          <h3 className="text-xl mb-4">🤖 Agents</h3>

          <div className="grid grid-cols-2 gap-4">
            {plan.agents.map((a: string, i: number) => (
              <motion.div
                key={a}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl bg-slate-900 border ${agentStyle(a)}`}
              >
                <div className="flex justify-between items-center">
                  <strong>{a}</strong>
                  <span
                    className={`text-xs px-2 py-1 rounded ${badge(
                      agentState[a]
                    )}`}
                  >
                    {agentState[a]}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={handleApprove}
            className="mt-6 bg-green-400 text-black px-6 py-3 rounded-xl font-semibold"
          >
            Approve & Execute
          </button>
        </div>
      )}

      {/* TIMELINE */}
      {execution && (
        <div className="mt-12">
          <h3 className="text-xl mb-4">🕒 Execution Timeline</h3>
          <div className="space-y-3">
            {execution.timeline.map((t: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="p-3 rounded bg-slate-900 border border-slate-700"
              >
                {t.message}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ADVANCED */}
      {execution && (
        <div className="mt-10">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
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

      {/* XP BURST */}
      {xpBurst && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1.1, opacity: 1, y: -20 }}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-green-400 to-emerald-500 text-black px-6 py-4 rounded-2xl font-bold shadow-2xl"
        >
          ⚡ +{xpBurst} XP
        </motion.div>
      )}
    </main>
  );
}





















