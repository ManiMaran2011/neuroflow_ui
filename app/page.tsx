"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { login, ask, approveExecution, getExecution } from "../lib/api";

/* ================== STYLES ================== */

const agentGlow = (agent: string) => {
  if (agent.includes("Calendar")) return "border-cyan-400 shadow-cyan-500/40 text-cyan-300";
  if (agent.includes("Monitor")) return "border-yellow-400 shadow-yellow-500/40 text-yellow-300";
  if (agent.includes("Notify")) return "border-purple-400 shadow-purple-500/40 text-purple-300";
  if (agent.includes("XP")) return "border-green-400 shadow-green-500/40 text-green-300";
  return "border-slate-600 shadow-slate-700/40 text-slate-300";
};

const badge = (state: string) => {
  if (state === "running") return "bg-yellow-400 text-black animate-pulse";
  if (state === "completed") return "bg-green-400 text-black";
  return "bg-slate-700 text-slate-200";
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
    }, 1500);

    return () => clearInterval(interval);
  }, [streaming, executionId, token]);

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
    setExecutionId(null);
    setAgentState({});
  }

  function connectGoogleCalendar() {
    const t = localStorage.getItem("access_token");
    if (!t) return;
    window.location.href =
      `${process.env.NEXT_PUBLIC_API_BASE}/oauth/google/connect?token=${t}`;
  }

  /* ---------- ASK ---------- */

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
    setTimeout(() => setXpBurst(res.xp_gained ?? 15), 200);
  }

  /* ================= LOGIN ================= */

  if (!token) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-[420px] bg-gradient-to-br from-slate-900 to-black border border-purple-500/40 rounded-2xl p-8 shadow-[0_0_40px_rgba(168,85,247,0.3)]">
          <h1 className="text-3xl font-bold text-purple-400 mb-2">
            🧠 NeuroFlow OS
          </h1>
          <p className="text-slate-400 mb-6">
            Agentic AI Operating System
          </p>

          <input
            className="w-full p-3 mb-4 rounded bg-black border border-purple-500/30 text-purple-200"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={handleLogin}
            className="w-full bg-purple-500 hover:bg-purple-600 text-black p-3 rounded-lg font-semibold mb-4 shadow-[0_0_20px_rgba(168,85,247,0.6)]"
          >
            Login
          </button>

          <div className="flex justify-center">
            <GoogleLogin
              theme="filled_black"
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
        </div>
      </main>
    );
  }

  /* ================= MAIN ================= */

  return (
    <main className="min-h-screen bg-black text-slate-200 p-10">
      {/* LOGOUT */}
      <button
        onClick={handleLogout}
        className="fixed top-6 right-6 bg-red-500 text-black px-4 py-2 rounded-lg shadow-lg"
      >
        Logout
      </button>

      <h1 className="text-3xl font-bold text-purple-400 mb-1">
        🧠 NeuroFlow OS
      </h1>
      <p className="text-slate-400 mb-4">
        Persistent multi-agent execution engine
      </p>

      <button
        onClick={connectGoogleCalendar}
        className="mb-6 bg-cyan-500 text-black px-5 py-2 rounded-lg font-semibold shadow-[0_0_20px_rgba(34,211,238,0.6)]"
      >
        🔗 Connect Google Calendar
      </button>

      <textarea
        className="w-full h-28 p-4 rounded-xl bg-black border border-purple-500/30 text-purple-200 mb-4 shadow-[0_0_25px_rgba(168,85,247,0.2)]"
        placeholder="Try: Schedule a meeting tomorrow at 5pm"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleAsk}
        className="bg-purple-500 text-black px-6 py-3 rounded-xl font-semibold shadow-[0_0_30px_rgba(168,85,247,0.7)]"
      >
        Execute Command
      </button>

      {/* AGENTS */}
      {plan && (
        <div className="mt-10">
          <h3 className="text-xl mb-4 text-purple-300">🤖 Agents</h3>

          <div className="grid grid-cols-2 gap-4">
            {plan.agents.map((a: string, i: number) => (
              <motion.div
                key={a}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl bg-black border ${agentGlow(
                  a
                )} shadow-lg`}
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
            className="mt-6 bg-green-500 text-black px-6 py-3 rounded-xl font-semibold shadow-[0_0_30px_rgba(34,197,94,0.6)]"
          >
            Approve & Execute
          </button>
        </div>
      )}

      {/* TIMELINE */}
      {execution && (
        <div className="mt-12">
          <h3 className="text-xl mb-4 text-purple-300">🕒 Execution Timeline</h3>
          <div className="space-y-3">
            {execution.timeline.map((t: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-black border border-purple-500/20 rounded shadow"
              >
                {t.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADVANCED */}
      {execution && (
        <div className="mt-10">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-sm text-purple-400 underline"
          >
            {showAdvanced ? "Hide" : "Show"} advanced details
          </button>

          {showAdvanced && (
            <pre className="mt-4 p-4 bg-black border border-purple-500/30 rounded text-xs overflow-auto text-purple-200">
              {JSON.stringify(execution, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* XP BURST */}
      {xpBurst && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 30 }}
          animate={{ scale: 1.2, opacity: 1, y: -20 }}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-500 to-pink-500 text-black px-6 py-4 rounded-2xl font-bold shadow-[0_0_40px_rgba(236,72,153,0.8)]"
        >
          ⚡ +{xpBurst} XP
        </motion.div>
      )}
    </main>
  );
}

























