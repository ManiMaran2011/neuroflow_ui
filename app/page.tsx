"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import {
  login,
  ask,
  approveExecution,
  getExecution,
} from "../lib/api";

export default function Home() {
  /* ================= STATE ================= */

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");

  const [plan, setPlan] = useState<any>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execution, setExecution] = useState<any>(null);

  const [recording, setRecording] = useState(false);
  const [xpGained, setXpGained] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /* ================= FORCE LOGIN ON RELOAD ================= */

  useEffect(() => {
    setToken(null);
  }, []);

  /* ================= AUTO HIDE XP ================= */

  useEffect(() => {
    if (!xpGained) return;
    const t = setTimeout(() => setXpGained(null), 3000);
    return () => clearTimeout(t);
  }, [xpGained]);

  /* ================= LOGIN ================= */

  async function handleLogin() {
    if (!email) return;
    const res = await login(email);
    setToken(res.access_token);
  }

  /* ================= ASK ================= */

  async function handleAsk() {
    if (!token || !input) return;

    const res = await ask(token, input);

    setPlan(res.execution_plan);
    setExecutionId(res.execution_id);
    setExecution(null);
    setXpGained(null);
  }

  /* ================= APPROVE ================= */

  async function handleApprove() {
    if (!token || !executionId) return;

    await approveExecution(token, executionId);
    const exec = await getExecution(token, executionId);

    setExecution(exec);
    setXpGained(exec.xp_gained ?? 15);
  }

  /* ================= MIC ================= */

  async function startRecording() {
    if (!token) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
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

    setTimeout(() => {
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    }, 6000);
  }

  /* ================= LOGIN SCREEN ================= */

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-slate-200">
        <div className="w-[420px] p-8 rounded-2xl border border-slate-700 bg-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
          <h1 className="text-2xl font-bold mb-2">🧠 NeuroFlow OS</h1>
          <p className="text-slate-400 mb-6">Agentic AI Execution System</p>

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 p-3 rounded-lg bg-slate-900 border border-slate-600"
          />

          <button
            onClick={handleLogin}
            className="w-full p-3 rounded-lg bg-cyan-400 text-black font-semibold mb-6"
          >
            Login
          </button>

          <div className="flex justify-center">
            {/* ✅ WORKING GOOGLE LOGIN — UNTOUCHED */}
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                if (!credentialResponse.credential) return;

                fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/google`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id_token: credentialResponse.credential,
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => setToken(data.access_token))
                  .catch((err) =>
                    console.error("Google login error:", err)
                  );
              }}
              onError={() => console.log("Google Login Failed")}
            />
          </div>
        </div>
      </main>
    );
  }

  /* ================= MAIN UI ================= */

  return (
    <main className="min-h-screen bg-black text-slate-200 p-10">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-3xl font-bold mb-2">🧠 NeuroFlow OS</h1>
        <p className="text-slate-400 mb-6">
          Speak → Plan → Approve → Execute
        </p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or speak your command..."
          className="w-full h-28 p-4 rounded-xl bg-slate-900 border border-slate-700 mb-4"
        />

        <div className="flex items-center gap-4">
          <button
            onClick={handleAsk}
            className="px-6 py-3 rounded-xl bg-cyan-400 text-black font-semibold"
          >
            Execute
          </button>

          <button
            onClick={startRecording}
            disabled={recording}
            className={`p-3 rounded-full ${
              recording
                ? "bg-red-500"
                : "border border-cyan-400 text-cyan-400"
            }`}
          >
            🎤
          </button>

          {recording && (
            <span className="text-red-400 animate-pulse">
              Listening…
            </span>
          )}
        </div>

        <AnimatePresence>
          {plan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-10"
            >
              <h3 className="text-xl mb-4">🤖 Agents Executing</h3>

              <div className="grid grid-cols-2 gap-4">
                {plan.agents.map((agent: string, i: number) => (
                  <motion.div
                    key={agent}
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.15 }}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-700 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                  >
                    <strong>{agent}</strong>
                    <p className="text-slate-400 text-sm">Executing</p>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={handleApprove}
                className="mt-6 px-6 py-3 rounded-xl bg-green-400 text-black font-semibold"
              >
                Approve & Execute
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {execution && (
          <div className="mt-12">
            <h3 className="text-xl mb-4">📜 Execution Timeline</h3>
            <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 font-mono text-sm space-y-2">
              {execution.timeline.map((t: any, i: number) => (
                <div key={i}>
                  <span className="text-cyan-400">›</span> {t.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= XP ANIMATION (UI ONLY) ================= */}

        <AnimatePresence>
          {xpGained && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 40 }}
              animate={{ scale: 1.15, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="fixed bottom-10 right-10 z-50
                         px-6 py-4 rounded-xl
                         bg-gradient-to-r from-purple-500 to-pink-500
                         text-black font-bold text-xl
                         shadow-[0_0_40px_rgba(168,85,247,0.6)]"
            >
              +{xpGained} XP 🚀
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}














