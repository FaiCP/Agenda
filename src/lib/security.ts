import { createHash, timingSafeEqual } from "crypto";

/**
 * Compara dos strings en tiempo constante (anti timing-attack).
 * Hashea ambos a SHA-256 para no filtrar la longitud y comparar buffers iguales.
 */
export function timingSafeEqualStr(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Rate limiter en memoria (ventana deslizante) por clave. Best-effort:
 * el estado es por instancia/proceso, no compartido entre réplicas. Mitiga
 * ráfagas y bucles de abuso, no es una cuota durable. Para límites estrictos
 * usar un contador en la base de datos.
 */
/**
 * Extensión segura a partir del MIME ya validado (no del nombre del archivo,
 * que es controlado por el usuario y permite path traversal en la ruta).
 */
export function extFromImageMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    default:
      return "jpg";
  }
}

const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Limpieza oportunista para no crecer sin límite.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  return true;
}
