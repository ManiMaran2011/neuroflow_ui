const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

/* =========================
   AUTH
========================= */

export async function login(email: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

    if (!res.ok) {
    const err = await res.text();
    console.error("Login error:", err);
    throw new Error("Login failed");
  }

  return res.json(); // { access_token }
}

/* =========================
   ASK / PLAN
========================= */

export async function ask(token: string, userInput: string) {
  if (!token) {
    throw new Error("Missing auth token");
  }

  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_input: userInput,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Ask failed:", err);
    throw new Error("Ask failed");
  }

  return res.json(); 
  /*
    {
      status,
      execution_id,
      execution_plan
    }
  */
}

/* =========================
   APPROVE EXECUTION
========================= */

export async function approveExecution(token: string, executionId: string) {
  if (!token) {
    throw new Error("Missing auth token");
  }

  const res = await fetch(
    `${API_BASE}/executions/${executionId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Approve failed:", err);
    throw new Error("Approve failed");
  }

  return res.json();
}

/* =========================
   GET EXECUTION DETAILS
========================= */

export async function getExecution(token: string, executionId: string) {
  if (!token) {
    throw new Error("Missing auth token");
  }

  const res = await fetch(
    `${API_BASE}/executions/${executionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Get execution failed:", err);
    throw new Error("Get execution failed");
  }

  return res.json();
}

/* =========================
   VOICE → TEXT
========================= */

export async function transcribeAudio(file: Blob) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Transcription failed:", err);
    throw new Error("Voice transcription failed");
  }

  return res.json(); // { text }
}




