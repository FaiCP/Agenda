"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Mic,
  Square,
  Loader2,
  FileText,
  Printer,
  Save,
  Sparkles,
  Pause,
  Play,
  X,
} from "lucide-react";
import { addRecordEntry } from "@/lib/actions/clients";
import { generateDocument } from "@/lib/actions/documents";
import type { DocumentType } from "@/lib/document-types";
import type { EntryDraft } from "@/lib/ai";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables, Json } from "@/lib/supabase/database.types";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/verticals";
import { formatDateShort, formatTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientForm } from "../clientes-view";

type Client = Tables<"clients">;
type TemplateField = Tables<"record_template_fields">;

interface Template {
  id: string;
  name: string;
  record_template_fields: TemplateField[];
}

interface Entry {
  id: string;
  title: string | null;
  data: Json;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
}

const initialState: ActionState = { error: null };

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ExpedienteView({
  client,
  clientLabel,
  recordLabel,
  templates,
  entries,
  appointments,
  aiEnabled,
  orgName,
  professionalName,
  documentTypes,
}: {
  client: Client;
  clientLabel: string;
  recordLabel: string;
  templates: Template[];
  entries: Entry[];
  appointments: AppointmentRow[];
  aiEnabled: boolean;
  orgName: string;
  professionalName: string;
  documentTypes: DocumentType[];
}) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  // Borrador generado al grabar una consulta completa; abre el formulario prellenado.
  const [consultDraft, setConsultDraft] = useState<EntryDraft | null>(null);
  const [draftSeq, setDraftSeq] = useState(0);

  function handleConsultation(draft: EntryDraft, transcript: string) {
    setConsultDraft({
      ...draft,
      notes: [draft.notes, `— Transcripción completa de la consulta —\n${transcript}`]
        .filter(Boolean)
        .join("\n\n"),
    });
    setDraftSeq((s) => s + 1);
    setEntryOpen(true);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/app/clientes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Expediente del {clientLabel}
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar size="lg" className="size-14">
              <AvatarFallback className="bg-accent text-base font-semibold text-accent-foreground">
                {initials(client.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">
                  {client.full_name}
                </h1>
                <Badge className="border-transparent bg-emerald-50 text-emerald-700">
                  Activo
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[client.email, client.phone, client.document_id]
                  .filter(Boolean)
                  .join(" · ") || "Sin datos de contacto"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 size-4" /> Editar datos
            </Button>
            {aiEnabled && documentTypes.length > 0 && (
              <Button variant="outline" onClick={() => setDocOpen(true)}>
                <FileText className="mr-1 size-4" /> Generar documento
              </Button>
            )}
            <Button onClick={() => setEntryOpen(true)}>
              <Plus className="mr-1 size-4" /> Nueva entrada
            </Button>
          </div>
        </CardContent>
      </Card>

      {aiEnabled && (
        <ConsultationRecorder
          templateId={templates[0]?.id ?? ""}
          onComplete={handleConsultation}
        />
      )}

      <Tabs defaultValue="expediente">
        <TabsList>
          <TabsTrigger value="expediente">{recordLabel}</TabsTrigger>
          <TabsTrigger value="citas">Historial de citas</TabsTrigger>
        </TabsList>

        <TabsContent value="expediente" className="space-y-3">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Expediente vacío. Registra la primera entrada tras la consulta.
              </CardContent>
            </Card>
          ) : (
            entries.map((e) => (
              <Card key={e.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {e.title || "Entrada de expediente"}
                    </CardTitle>
                    <CardDescription>
                      {formatDateShort(e.created_at)} {formatTime(e.created_at)}
                      {e.profiles && ` · ${e.profiles.full_name}`}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(
                      (e.data as Record<string, string>) ?? {}
                    ).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                          {key.replaceAll("_", " ")}
                        </dt>
                        <dd className="whitespace-pre-wrap text-sm">
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {e.notes && (
                    <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground">
                      {e.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="citas">
          <Card>
            <CardContent className="divide-y py-2">
              {appointments.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  Sin citas registradas.
                </p>
              )}
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span>
                    {formatDateShort(a.starts_at)} {formatTime(a.starts_at)} ·{" "}
                    {a.services?.name ?? "Servicio"} ·{" "}
                    {a.profiles?.full_name ?? ""}
                  </span>
                  <Badge variant="outline">
                    {APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva entrada — {recordLabel}</DialogTitle>
          </DialogHeader>
          <EntryForm
            key={draftSeq}
            clientId={client.id}
            templates={templates}
            aiEnabled={aiEnabled}
            initialDraft={consultDraft}
            onDone={() => {
              setEntryOpen(false);
              setConsultDraft(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              Editar {clientLabel}
            </DialogTitle>
          </DialogHeader>
          <ClientForm client={client} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generar documento con IA</DialogTitle>
          </DialogHeader>
          <DocumentGenerator
            clientId={client.id}
            clientName={client.full_name}
            orgName={orgName}
            professionalName={professionalName}
            documentTypes={documentTypes}
            onSaved={() => setDocOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryForm({
  clientId,
  templates,
  aiEnabled,
  initialDraft = null,
  onDone,
}: {
  clientId: string;
  templates: Template[];
  aiEnabled: boolean;
  initialDraft?: EntryDraft | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    addRecordEntry,
    initialState
  );
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [draft, setDraft] = useState<EntryDraft | null>(initialDraft);
  // Los inputs son no-controlados: al llegar un borrador de IA se remonta el
  // bloque de campos con esta clave para que los defaultValue se apliquen.
  const [draftKey, setDraftKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      toast.success("Entrada guardada");
      onDone();
    }
  }, [state, onDone]);

  const template = templates.find((t) => t.id === templateId);
  const fields = [...(template?.record_template_fields ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="template_id" value={templateId} />

      {aiEnabled && (
        <VoiceDictation
          templateId={templateId}
          onDraft={(d) => {
            setDraft(d);
            setDraftKey((k) => k + 1);
          }}
        />
      )}

      {templates.length > 1 && (
        <div className="space-y-2">
          <Label>Plantilla</Label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div key={draftKey} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título (opcional)</Label>
          <Input
            id="title"
            name="title"
            placeholder="Ej: Consulta de control"
            defaultValue={draft?.title ?? ""}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const name = `field__${f.field_key}`;
            const draftValue = draft?.fields[f.field_key] ?? "";
            const choices =
              (f.options as { choices?: string[] } | null)?.choices ?? [];
            const fullWidth =
              f.field_type === "textarea" || f.field_type === "multiselect";
            return (
              <div
                key={f.id}
                className={`space-y-2 ${fullWidth ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={name}>
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </Label>
                {f.field_type === "textarea" ? (
                  <Textarea
                    id={name}
                    name={name}
                    required={f.required}
                    rows={3}
                    defaultValue={draftValue}
                  />
                ) : f.field_type === "select" ? (
                  <select
                    id={name}
                    name={name}
                    required={f.required}
                    defaultValue={
                      choices.includes(draftValue) ? draftValue : ""
                    }
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="">Seleccionar…</option>
                    {choices.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : f.field_type === "boolean" ? (
                  <select
                    id={name}
                    name={name}
                    defaultValue={
                      ["Sí", "No"].includes(draftValue) ? draftValue : ""
                    }
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="">—</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <Input
                    id={name}
                    name={name}
                    required={f.required}
                    defaultValue={draftValue}
                    type={
                      f.field_type === "number"
                        ? "number"
                        : f.field_type === "date"
                          ? "date"
                          : "text"
                    }
                    step={f.field_type === "number" ? "any" : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas adicionales</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={draft?.notes && draft.notes.length > 300 ? 10 : 2}
            defaultValue={draft?.notes ?? ""}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar entrada"}
      </Button>
    </form>
  );
}

function VoiceDictation({
  templateId,
  onDraft,
}: {
  templateId: string;
  onDraft: (draft: EntryDraft) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void send(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("No se pudo acceder al micrófono. Revisa los permisos.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function send(blob: Blob) {
    setProcessing(true);
    try {
      const form = new FormData();
      form.append(
        "audio",
        new File([blob], "dictado.webm", { type: blob.type })
      );
      form.append("template_id", templateId);
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { error?: string; draft?: EntryDraft };
      if (!res.ok || !json.draft) {
        toast.error(json.error ?? "No se pudo procesar el dictado.");
        return;
      }
      onDraft(json.draft);
      toast.success("Dictado procesado. Revisa los campos antes de guardar.");
    } catch {
      toast.error("Error de conexión al procesar el dictado.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      {processing ? (
        <Button type="button" variant="secondary" disabled>
          <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Procesando dictado…
        </Button>
      ) : recording ? (
        <Button type="button" variant="destructive" onClick={stop}>
          <Square className="mr-1 h-4 w-4" /> Detener y procesar
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={start}>
          <Mic className="mr-1 h-4 w-4" /> Dictar con IA
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {recording
          ? "Grabando… dicta la nota de la consulta."
          : "Dicta la nota y la IA llenará los campos del expediente."}
      </p>
    </div>
  );
}

type RecorderStatus = "idle" | "recording" | "paused" | "processing";

function ConsultationRecorder({
  templateId,
  onComplete,
}: {
  templateId: string;
  onComplete: (draft: EntryDraft, transcript: string) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  // Aviso al salir de la página con una grabación activa
  useEffect(() => {
    if (status !== "recording" && status !== "paused") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  function startTimer() {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 32 kbps mono: suficiente para voz, ~14 MB/hora (límite API: 25 MB)
      const recorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 32000,
      });
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        if (cancelledRef.current) {
          setStatus("idle");
          setSeconds(0);
          return;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void send(blob);
      };
      recorder.start(1000); // chunks cada segundo: no se pierde nada si algo falla
      recorderRef.current = recorder;
      setSeconds(0);
      setStatus("recording");
      startTimer();
    } catch {
      toast.error("No se pudo acceder al micrófono. Revisa los permisos.");
    }
  }

  function pause() {
    recorderRef.current?.pause();
    stopTimer();
    setStatus("paused");
  }

  function resume() {
    recorderRef.current?.resume();
    startTimer();
    setStatus("recording");
  }

  function stop() {
    setStatus("processing");
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function cancel() {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  async function send(blob: Blob) {
    try {
      const form = new FormData();
      form.append(
        "audio",
        new File([blob], "consulta.webm", { type: blob.type })
      );
      form.append("template_id", templateId);
      form.append("mode", "consulta");
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        error?: string;
        draft?: EntryDraft;
        transcript?: string;
      };
      if (!res.ok || !json.draft) {
        toast.error(json.error ?? "No se pudo procesar la consulta.");
        return;
      }
      onComplete(json.draft, json.transcript ?? "");
      toast.success("Consulta procesada. Revisa la entrada antes de guardar.");
    } catch {
      toast.error("Error de conexión al procesar la consulta.");
    } finally {
      setStatus("idle");
      setSeconds(0);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (status === "idle")
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary p-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">
              Grabar consulta con IA
            </p>
            <p className="text-xs text-primary-foreground/80">
              Transcribe y sintetiza automáticamente la consulta en notas
              médicas estructuradas.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={start}
          className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <Mic className="mr-1 size-4" /> Grabar consulta
        </Button>
      </div>
    );

  if (status === "processing")
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
        <Button type="button" variant="secondary" disabled>
          <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Procesando
          consulta…
        </Button>
        <p className="text-xs text-muted-foreground">
          Transcribiendo y estructurando. Esto puede tardar un poco según la
          duración.
        </p>
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
      <span className="flex items-center gap-2 font-mono text-sm tabular-nums">
        <span
          className={`h-2.5 w-2.5 rounded-full bg-destructive ${
            status === "recording" ? "animate-pulse" : ""
          }`}
        />
        {mm}:{ss}
        {status === "paused" && (
          <span className="text-xs text-muted-foreground">(en pausa)</span>
        )}
      </span>
      {status === "recording" ? (
        <Button type="button" size="sm" variant="outline" onClick={pause}>
          <Pause className="mr-1 h-4 w-4" /> Pausar
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={resume}>
          <Play className="mr-1 h-4 w-4" /> Reanudar
        </Button>
      )}
      <Button type="button" size="sm" onClick={stop}>
        <Square className="mr-1 h-4 w-4" /> Terminar y procesar
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={cancel}>
        <X className="mr-1 h-4 w-4" /> Descartar
      </Button>
    </div>
  );
}

function DocumentGenerator({
  clientId,
  clientName,
  orgName,
  professionalName,
  documentTypes,
  onSaved,
}: {
  clientId: string;
  clientName: string;
  orgName: string;
  professionalName: string;
  documentTypes: DocumentType[];
  onSaved: () => void;
}) {
  const [docTypeKey, setDocTypeKey] = useState(documentTypes[0]?.key ?? "");
  const [instructions, setInstructions] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setGenerating(true);
    const res = await generateDocument({
      clientId,
      docTypeKey,
      instructions,
    });
    setGenerating(false);
    if (res.error || !res.body) {
      toast.error(res.error ?? "No se pudo generar el documento.");
      return;
    }
    setTitle(res.title ?? "");
    setBody(res.body);
  }

  async function saveToRecord() {
    setSaving(true);
    const fd = new FormData();
    fd.append("client_id", clientId);
    fd.append("title", `Documento: ${title}`);
    fd.append("notes", body);
    const res = await addRecordEntry({ error: null }, fd);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Documento guardado en el expediente");
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de documento</Label>
        <select
          value={docTypeKey}
          onChange={(e) => setDocTypeKey(e.target.value)}
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {documentTypes.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-instructions">Indicaciones (opcional)</Label>
        <Textarea
          id="doc-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="Ej: paracetamol 500 mg cada 8 horas por 5 días; reposo 2 días"
        />
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={generate}
        disabled={generating || !docTypeKey}
      >
        {generating ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Generando…
          </>
        ) : (
          <>
            <Sparkles className="mr-1 h-4 w-4" />
            {body ? "Volver a generar" : "Generar borrador"}
          </>
        )}
      </Button>

      {body && (
        <>
          <div className="space-y-2">
            <Label htmlFor="doc-body">
              Borrador — revisa y edita antes de imprimir
            </Label>
            <Textarea
              id="doc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() =>
                printDocument({ orgName, professionalName, clientName, title, body })
              }
            >
              <Printer className="mr-1 h-4 w-4" /> Imprimir / PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={saving}
              onClick={saveToRecord}
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar en expediente"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function printDocument({
  orgName,
  professionalName,
  clientName,
  title,
  body,
}: {
  orgName: string;
  professionalName: string;
  clientName: string;
  title: string;
  body: string;
}) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    toast.error("Permite ventanas emergentes para imprimir.");
    return;
  }
  const date = new Date().toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  w.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — ${escapeHtml(clientName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 40px auto; color: #111; line-height: 1.6; padding: 0 24px; }
  header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 8px; }
  header h1 { font-size: 20px; margin: 0; }
  header p { margin: 2px 0; font-size: 13px; color: #444; }
  .meta { display: flex; justify-content: space-between; font-size: 13px; color: #444; margin-bottom: 20px; }
  h2 { text-align: center; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
  .firma { margin-top: 90px; text-align: center; }
  .firma .linea { border-top: 1px solid #111; width: 280px; margin: 0 auto 6px; }
  .firma p { margin: 0; font-size: 13px; }
  @media print { body { margin: 0 auto; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(orgName)}</h1>
  <p>${escapeHtml(professionalName)}</p>
</header>
<div class="meta">
  <span>${escapeHtml(clientName)}</span>
  <span>${escapeHtml(date)}</span>
</div>
<h2>${escapeHtml(title)}</h2>
<pre>${escapeHtml(body)}</pre>
<div class="firma">
  <div class="linea"></div>
  <p>${escapeHtml(professionalName)}</p>
  <p>${escapeHtml(orgName)}</p>
</div>
</body>
</html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
