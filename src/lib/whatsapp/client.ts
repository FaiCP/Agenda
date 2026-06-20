/**
 * Cliente REST del gateway OpenWA (motor Baileys), una sesión por organización.
 * SOLO servidor. Importar únicamente desde server actions / route handlers.
 *
 * Endpoints según la API de OpenWA. Verifica las rutas reales en el Swagger
 * de tu gateway: http://TU_VPS:2785/api/docs
 */

const BASE = process.env.OPENWA_URL?.replace(/\/$/, "") ?? "";
const API_KEY = process.env.OPENWA_API_KEY ?? "";

export function whatsappConfigured(): boolean {
  return Boolean(BASE && API_KEY);
}

/**
 * "name" estable que le ponemos a la sesión de cada org en el gateway.
 * El gateway solo acepta nombres ALFANUMÉRICOS (sin "_", "-", etc.), así que
 * quitamos los guiones del UUID de la org.
 * OJO: el gateway identifica la sesión por su UUID (campo `id`), no por este
 * name. Usa ensureSession() para obtener el UUID a partir del name.
 */
export function orgSessionName(organizationId: string): string {
  return `org${organizationId.replace(/[^a-zA-Z0-9]/g, "")}`;
}

/**
 * Número (cualquier formato) -> chatId WhatsApp ("<digitos>@c.us").
 * Normaliza a formato internacional asumiendo Ecuador (+593) por defecto:
 *  - "0991234567" (10 díg, local) -> "593991234567"
 *  - "991234567"  (9 díg, sin 0)  -> "593991234567"
 *  - "593991234567" / "+593..."   -> se respeta
 *  - "00593..."                   -> se quita el 00
 */
export function toChatId(phone: string, defaultCountry = "593"): string | null {
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = defaultCountry + d.slice(1);
  else if (d.length === 9) d = defaultCountry + d;
  if (d.length < 11) return null; // sin código de país válido
  return `${d}@c.us`;
}

async function api(
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (!whatsappConfigured())
    throw new Error("OPENWA_URL u OPENWA_API_KEY no configurados.");
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // El gateway puede tardar en responder al iniciar sesión.
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

type SessionInfo = {
  id: string;
  name?: string;
  status?: string;
  phone?: string | null;
};

/** Lista todas las sesiones del gateway. */
async function listSessions(): Promise<SessionInfo[]> {
  const res = await api("/api/sessions");
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as unknown;
  // El gateway puede devolver un array o {data:[...]} / {sessions:[...]}
  const arr = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>)?.data ??
        (data as Record<string, unknown>)?.sessions ??
        []);
  return (arr as SessionInfo[]) ?? [];
}

/** Busca el UUID de la sesión cuyo name coincide. null si no existe. */
export async function resolveSessionId(name: string): Promise<string | null> {
  const list = await listSessions();
  return list.find((s) => s.name === name)?.id ?? null;
}

/**
 * Garantiza que exista la sesión de la org y la inicia.
 * Devuelve el **UUID** del gateway (que se debe persistir y usar en el resto
 * de llamadas). Si ya existía, reutiliza su UUID (no crea duplicados).
 */
export async function ensureSession(name: string): Promise<string> {
  let id = await resolveSessionId(name);

  if (!id) {
    const res = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!res.ok && res.status !== 409) {
      const txt = await res.text().catch(() => "");
      throw new Error(`crear sesión (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    id = (data.id as string) ?? (await resolveSessionId(name));
  }

  if (!id) throw new Error("no se obtuvo el id de sesión");

  // Iniciar (idempotente). Ahora sí con el UUID correcto.
  await api(`/api/sessions/${encodeURIComponent(id)}/start`, {
    method: "POST",
  }).catch(() => {});

  return id;
}

export type QrResult = { image?: string; raw?: string };

/**
 * Devuelve el QR para vincular. Normaliza a data URL si el gateway entrega PNG;
 * si entrega el string crudo de Baileys, lo devuelve en `raw`.
 */
export async function getQr(sessionId: string): Promise<QrResult> {
  const res = await api(
    `/api/sessions/${encodeURIComponent(sessionId)}/qr`
  );
  if (!res.ok) return {};
  const ct = res.headers.get("content-type") ?? "";

  if (ct.startsWith("image/")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { image: `data:${ct};base64,${buf.toString("base64")}` };
  }

  // JSON: buscar el campo que traiga el QR
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const val =
    (data.qr as string) ??
    (data.qrCode as string) ??
    (data.base64 as string) ??
    (data.data as string) ??
    "";
  if (!val) return {};
  if (val.startsWith("data:image")) return { image: val };
  // base64 de PNG sin prefijo
  if (/^[A-Za-z0-9+/=]+$/.test(val) && val.length > 100)
    return { image: `data:image/png;base64,${val}` };
  // string crudo (ascii) de Baileys
  return { raw: val };
}

export type GatewayStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "failed";

/** Estado actual de la sesión en el gateway + número vinculado si lo hay. */
export async function getStatus(
  sessionId: string
): Promise<{ status: GatewayStatus; phone: string | null }> {
  const res = await api(`/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return { status: "disconnected", phone: null };
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const rawStatus = String(
    (data.status as string) ?? (data.state as string) ?? ""
  ).toLowerCase();

  let status: GatewayStatus = "disconnected";
  if (
    ["connected", "authenticated", "ready", "open", "working", "online"].includes(
      rawStatus
    )
  )
    status = "connected";
  else if (
    [
      "created",
      "initializing",
      "starting",
      "connecting",
      "qr",
      "scanning",
      "pairing",
    ].includes(rawStatus)
  )
    status = "connecting";
  else if (
    ["failed", "error", "logout", "closed", "stopped"].includes(rawStatus)
  )
    status = "failed";

  const phone =
    (data.phone as string) ??
    (data.me as string) ??
    ((data.user as Record<string, unknown> | undefined)?.id as string) ??
    null;

  return { status, phone: phone ? phone.replace(/\D/g, "") || null : null };
}

/** Envía texto. chatId = "<digitos>@c.us". Devuelve true si el gateway aceptó. */
export async function sendText(
  sessionId: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const res = await api(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
    { method: "POST", body: JSON.stringify({ chatId, text }) }
  );
  return res.ok;
}

/** Cierra y elimina la sesión en el gateway (desvincula el número). */
export async function deleteSession(sessionId: string): Promise<void> {
  await api(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  }).catch(() => {});
}
