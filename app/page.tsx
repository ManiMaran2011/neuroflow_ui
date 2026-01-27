"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { login, ask, approveExecution, getExecution } from "../lib/api";

/* ================= UTIL ================= */

const agentStyle = (agent: string) => {
  if (agent.includes("Calendar")) return "border-blue-500 text-blue-600";
  if (agent.includes("Monitor")) return "border-yellow-500 text-yellow-600";
  if (agent.includes("Notify")) return "border-purple-500 text-purple-600";
  if (agent.includes("XP")) return "border-green-500 text-green-600";
  return "border-slate-400 text-slate-600";
};

const badge = (state: string) => {
  if (state === "running")
    return "bg-yellow-400 text-black animate-pulse";
  if (state === "completed") return "bg-green-500 text-white";
  return "bg-slate-400 text-white";
};

/* ================= PAGE ================= */

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
    localStorage.removeItem("access_token");
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

  /* ================= LOGIN UI ================= */

  if (!token) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="w-[420px] bg-white shadow-2xl rounded-2xl p-8">
          <h1 className="text-3xl font-bold mb-2 text-slate-800">
            🧠 NeuroFlow OS
          </h1>
          <p className="text-slate-500 mb-6">
            Agentic AI for real-world execution
          </p>

          <input
            className="w-full p-3 mb-4 border rounded-lg"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={handleLogin}
            className="w-full bg-cyan-500 text-white p-3 rounded-lg font-semibold mb-4"
          >
            Login with Email
          </button>

          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-slate-300" />
            <span className="px-3 text-sm text-slate-500">OR</span>
            <div className="flex-1 h-px bg-slate-300" />
          </div>

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
    <main className="min-h-screen bg-slate-100 text-slate-800 p-10">
      {/* LOGOUT */}
      <button
        onClick={handleLogout}
        className="fixed top-6 right-6 bg-red-500 text-white px-4 py-2 rounded-lg shadow"
      >
        Logout
      </button>

      <h1 className="text-3xl font-bold mb-1">🧠 NeuroFlow OS</h1>
      <p className="text-slate-500 mb-4">
        Persistent, agentic AI with monitoring and memory
      </p>

      <button
        onClick={connectGoogleCalendar}
        className="mb-6 bg-blue-500 text-white px-5 py-2 rounded-lg font-semibold"
      >
        🔗 Connect Google Calendar
      </button>

      <textarea
        className="w-full h-28 p-4 rounded-xl border mb-4"
        placeholder="Try: Schedule a meeting tomorrow at 5pm"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleAsk}
        className="bg-cyan-500 text-white px-6 py-3 rounded-xl font-semibold"
      >
        Execute Command
      </button>

      {/* AGENTS */}
      {plan && (
        <div className="mt-10">
          <h3 className="text-xl mb-4">🤖 Agents</h3>

          <div className="grid grid-cols-2 gap-4">
            {plan.agents.map((a: string) => (
              <div
                key={a}
                className={`p-4 rounded-xl bg-white border ${agentStyle(a)}`}
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
              </div>
            ))}
          </div>

          <button
            onClick={handleApprove}
            className="mt-6 bg-green-500 text-white px-6 py-3 rounded-xl font-semibold"
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
              <div
                key={i}
                className="p-3 bg-white border rounded"
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
            className="text-sm text-slate-500 underline"
          >
            {showAdvanced ? "Hide" : "Show"} advanced details
          </button>

          {showAdvanced && (
            <pre className="mt-4 p-4 bg-white border rounded text-xs overflow-auto">
              {JSON.stringify(execution, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* XP BURST */}
      {xpBurst && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1.1, opacity: 1, y: -20 }}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-6 py-4 rounded-2xl font-bold shadow-2xl"
        >
          ⚡ +{xpBurst} XP
        </motion.div>
      )}
    </main>
  );
}























