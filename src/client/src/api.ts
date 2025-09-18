// API helper with loud logging

export const API_BASE =
  (typeof DEVVIT !== "undefined" && (DEVVIT as any).ENV?.HIDDEN_STROKE_API) ||
  (globalThis as any).HIDDEN_STROKE_API ||
  "https://rairo-dev-stroke.hf.space";

export async function startToday(user: { id: string; name: string }) {
  const url = `${API_BASE}/cases/today/start`;
  console.info("[API] startToday ->", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Reddit-Id": user.id,
        "X-Reddit-User": user.name,
      },
      body: JSON.stringify({}),
    });
    console.info("[API] startToday status", res.status);
    const text = await res.text();
    console.info("[API] startToday raw", text.slice(0, 400));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    return JSON.parse(text);
  } catch (e: any) {
    console.error("[API] startToday failed", e?.message || e);
    throw e;
  }
}

export async function callToolSignature(caseId: string, sessionId: string, index: number) {
  const url = `${API_BASE}/cases/${caseId}/tool/signature`;
  console.info("[API] tool/signature ->", url, { index });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
    },
    body: JSON.stringify({ image_index: index }),
  });
  const data = await res.json().catch(() => ({}));
  console.info("[API] signature resp", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}
