export function unwrapGameEnvelope<T>(payload: any): T {
  return (payload?.data?.data ?? payload?.data ?? payload) as T;
}

export function extractGameError(payload: any): string {
  if (!payload) return "Unknown error";
  if (typeof payload === "string") return payload;
  if (payload instanceof Error) return payload.message || "Unknown error";
  if (typeof payload?.response?.data === "object") return extractGameError(payload.response.data);
  if (typeof payload?.error === "string" && payload.error) return payload.error;
  if (typeof payload?.error?.message === "string" && payload.error.message) return payload.error.message;
  if (typeof payload?.message === "string" && payload.message) return payload.message;
  if (typeof payload?.data?.error?.message === "string" && payload.data.error.message) return payload.data.error.message;
  if (typeof payload?.data?.message === "string" && payload.data.message) return payload.data.message;
  if (typeof payload?.data?.error === "string" && payload.data.error) return payload.data.error;
  console.warn("[extractGameError] unhandled payload:", payload);
  return "Request failed";
}
