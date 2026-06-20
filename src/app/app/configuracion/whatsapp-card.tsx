"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import {
  startWhatsappConnection,
  fetchWhatsappQr,
  syncWhatsappStatus,
  disconnectWhatsapp,
} from "@/lib/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Status = "connected" | "connecting" | "disconnected" | "failed";

export function WhatsappCard({
  initialStatus,
  initialPhone,
  isOwner,
  configured,
}: {
  initialStatus: Status;
  initialPhone: string | null;
  isOwner: boolean;
  configured: boolean;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [phone, setPhone] = useState<string | null>(initialPhone);
  const [qr, setQr] = useState<{ image?: string; raw?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Mientras conecta: refresca QR + consulta estado hasta vincular.
  useEffect(() => {
    if (status !== "connecting") {
      stopPolling();
      return;
    }
    let cancelled = false;

    const tick = async () => {
      const [{ image, raw }, st] = await Promise.all([
        fetchWhatsappQr(),
        syncWhatsappStatus(),
      ]);
      if (cancelled) return;
      if (image || raw) setQr({ image, raw });
      if (st.status === "connected") {
        setStatus("connected");
        setPhone(st.phone);
        setQr(null);
        toast.success("WhatsApp vinculado");
      } else if (st.status === "failed") {
        setStatus("failed");
        toast.error("No se pudo vincular WhatsApp");
      }
    };

    tick();
    pollRef.current = setInterval(tick, 3500);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [status, stopPolling]);

  async function handleConnect() {
    setBusy(true);
    const { error } = await startWhatsappConnection();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setQr(null);
    setStatus("connecting");
  }

  async function handleDisconnect() {
    setBusy(true);
    const { error } = await disconnectWhatsapp();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setStatus("disconnected");
    setPhone(null);
    setQr(null);
    toast.success("WhatsApp desconectado");
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
            <MessageCircle className="size-5" />
          </div>
          <div className="flex-1">
            <Label className="text-base">WhatsApp</Label>
            <p className="text-sm text-muted-foreground">
              Vincula tu número para enviar recordatorios y confirmaciones de
              cita a tus clientes.
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {!configured && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
            El gateway de WhatsApp aún no está configurado en el servidor.
          </p>
        )}

        {status === "connected" && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>
                Conectado{phone ? <> · +{phone}</> : null}
              </span>
            </div>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={busy}
              >
                Desconectar
              </Button>
            )}
          </div>
        )}

        {status === "connecting" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
            {qr?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr.image}
                alt="Código QR de WhatsApp"
                className="size-56 rounded bg-white p-2"
              />
            ) : qr?.raw ? (
              <p className="text-center text-xs text-muted-foreground">
                Tu gateway entrega el QR en texto. Escanéalo desde el panel del
                gateway: <code>/api/docs</code>.
              </p>
            ) : (
              <div className="flex size-56 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo, y
              escanea este código.
            </p>
          </div>
        )}

        {(status === "disconnected" || status === "failed") && isOwner && (
          <Button onClick={handleConnect} disabled={busy || !configured}>
            {busy ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Conectando…
              </>
            ) : status === "failed" ? (
              <>
                <RefreshCw className="mr-1 size-4" /> Reintentar
              </>
            ) : (
              "Conectar WhatsApp"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    connected: { label: "Conectado", cls: "bg-green-500/15 text-green-700" },
    connecting: { label: "Conectando", cls: "bg-amber-500/15 text-amber-700" },
    disconnected: { label: "Sin conectar", cls: "bg-muted text-muted-foreground" },
    failed: { label: "Error", cls: "bg-destructive/15 text-destructive" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
