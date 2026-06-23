"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  Sparkles,
  Clapperboard,
  MapPin,
  Camera,
  Smile,
  Lightbulb,
  CalendarRange,
  CalendarDays,
  Recycle,
  Upload,
  Library,
  Trash2,
  Wand2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import type { MarketingCaps } from "@/lib/features";
import {
  generateScript,
  generateIdeas,
  expandIdeaToPost,
  generateAgendaCampaigns,
  generateWeeklyCalendar,
  repurposeContent,
  listSavedContent,
  deleteSavedContent,
  type SavedContent,
} from "@/lib/actions/marketing-agent";
import {
  GOALS,
  DURATIONS,
  PLATFORMS,
  type ScriptVariation,
  type ContentIdea,
  type FullPost,
  type AgendaCampaign,
  type CalendarDay,
  type RepurposePieces,
} from "@/lib/marketing-catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaStudio } from "./media-studio";

const VIDEO_ENABLED = process.env.NEXT_PUBLIC_MARKETING_VIDEO === "on";

function copy(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Copiado"))
    .catch(() => toast.error("No se pudo copiar"));
}

function hashtagsLine(tags: string[]): string {
  return tags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
}

export function MarketingView({ caps }: { caps: MarketingCaps }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Agente de Marketing
        </h1>
        <p className="text-muted-foreground">
          Guiones, ideas y campañas con IA, adaptados a tu especialidad y tu
          agenda. Revisa y ajusta antes de publicar.
        </p>
      </div>

      <Tabs defaultValue={caps.create ? "crear" : "ideas"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="crear">
            {caps.create ? (
              <Wand2 className="mr-1 size-4" />
            ) : (
              <Lock className="mr-1 size-4" />
            )}
            Crear contenido
          </TabsTrigger>
          <TabsTrigger value="ideas">
            <Lightbulb className="mr-1 size-4" /> Ideas
          </TabsTrigger>
          <TabsTrigger value="agenda">
            {caps.agenda ? (
              <CalendarRange className="mr-1 size-4" />
            ) : (
              <Lock className="mr-1 size-4" />
            )}
            Desde tu agenda
          </TabsTrigger>
          <TabsTrigger value="calendario">
            {caps.create ? (
              <CalendarDays className="mr-1 size-4" />
            ) : (
              <Lock className="mr-1 size-4" />
            )}
            Calendario
          </TabsTrigger>
          <TabsTrigger value="reutilizar">
            {caps.create ? (
              <Recycle className="mr-1 size-4" />
            ) : (
              <Lock className="mr-1 size-4" />
            )}
            Reutilizar
          </TabsTrigger>
          <TabsTrigger value="guardados">
            <Library className="mr-1 size-4" /> Guardados
          </TabsTrigger>
          {VIDEO_ENABLED && (
            <TabsTrigger value="video">
              <Clapperboard className="mr-1 size-4" /> Video
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="crear" className="mt-4">
          {caps.create ? (
            <ScriptCreator />
          ) : (
            <UpsellCard
              title="Crea guiones de video"
              feature="5 variaciones de guion con instrucciones de grabación, listas para que cualquiera grabe."
              plan="Pro"
            />
          )}
        </TabsContent>
        <TabsContent value="ideas" className="mt-4">
          <IdeasSection canExpand={caps.create} />
        </TabsContent>
        <TabsContent value="agenda" className="mt-4">
          {caps.agenda ? (
            <AgendaSection />
          ) : (
            <UpsellCard
              title="Campañas desde tu agenda"
              feature="La IA revisa tus citas (huecos, cancelaciones, inactivos) y crea campañas conectadas a tu negocio."
              plan="Premium"
            />
          )}
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          {caps.create ? (
            <CalendarSection />
          ) : (
            <UpsellCard
              title="Calendario semanal"
              feature="Un plan de contenido para los 7 días de la semana, listo para publicar."
              plan="Pro"
            />
          )}
        </TabsContent>
        <TabsContent value="reutilizar" className="mt-4">
          {caps.create ? (
            <RepurposeSection />
          ) : (
            <UpsellCard
              title="Reutiliza tu contenido"
              feature="Convierte un video o texto en Reel, Historia, carrusel y post con un clic."
              plan="Pro"
            />
          )}
        </TabsContent>
        <TabsContent value="guardados" className="mt-4">
          <SavedSection />
        </TabsContent>
        {VIDEO_ENABLED && (
          <TabsContent value="video" className="mt-4">
            <MediaStudio />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function UpsellCard({
  title,
  feature,
  plan,
}: {
  title: string;
  feature: string;
  plan: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent">
          <Lock className="size-5 text-muted-foreground" />
        </span>
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{feature}</p>
        <p className="text-sm">
          Disponible desde el plan <span className="font-semibold">{plan}</span>.
        </p>
        <Button asChild>
          <Link href="/app/facturacion">Mejorar mi plan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- Crear guion ----------

function ScriptCreator() {
  const [goal, setGoal] = useState<string>(GOALS[0].value);
  const [duration, setDuration] = useState<number>(30);
  const [platform, setPlatform] = useState<string>("reels");
  const [topic, setTopic] = useState("");
  const [variations, setVariations] = useState<ScriptVariation[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await generateScript({ goal, duration, platform, topic });
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo generar.");
      return;
    }
    setVariations(res.data);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Objetivo">
              <Select value={goal} onChange={setGoal}>
                {GOALS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duración">
              <Select
                value={String(duration)}
                onChange={(v) => setDuration(Number(v))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} segundos
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Plataforma">
              <Select value={platform} onChange={setPlatform}>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Tema (opcional)">
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              placeholder="Ej: encías que sangran al cepillarse"
            />
          </Field>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Generando 5
                versiones…
              </>
            ) : (
              <>
                <Sparkles className="mr-1 size-4" />
                {variations.length > 0
                  ? "Generar otras 5"
                  : "Generar 5 guiones"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {loading && variations.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {variations.map((v, i) => (
        <VariationCard key={i} v={v} />
      ))}
    </div>
  );
}

function VariationCard({ v }: { v: ScriptVariation }) {
  const full = `${v.hook}\n\n${v.body}\n\n${v.cta}\n\n${v.caption}\n${hashtagsLine(
    v.hashtags
  )}`;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <Badge className="capitalize">{v.tone}</Badge>
          <Button variant="outline" size="sm" onClick={() => copy(full)}>
            <Copy className="mr-1 size-4" /> Copiar todo
          </Button>
        </div>

        <div className="space-y-3">
          <ScriptPart label="🎯 Gancho" text={v.hook} />
          <ScriptPart label="Desarrollo" text={v.body} />
          <ScriptPart label="CTA" text={v.cta} />
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo grabarlo
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <RecTip icon={MapPin} label="Dónde" text={v.recording.location} />
            <RecTip icon={Camera} label="Plano" text={v.recording.shot} />
            <RecTip icon={Smile} label="Expresión" text={v.recording.expression} />
          </div>
        </div>

        {(v.caption || v.hashtags.length > 0) && (
          <div className="space-y-2 border-t pt-3">
            {v.caption && <p className="whitespace-pre-wrap text-sm">{v.caption}</p>}
            {v.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {v.hashtags.map((h) => (
                  <Badge key={h} variant="secondary">
                    {h.startsWith("#") ? h : `#${h}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScriptPart({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function RecTip({
  icon: Icon,
  label,
  text,
}: {
  icon: React.ElementType;
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{text || "—"}</p>
      </div>
    </div>
  );
}

// ---------- Ideas ----------

function IdeasSection({ canExpand }: { canExpand: boolean }) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [post, setPost] = useState<{ idea: string; post: FullPost } | null>(null);
  const [platform] = useState("reels");

  async function run() {
    setLoading(true);
    const res = await generateIdeas();
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo generar.");
      return;
    }
    setIdeas(res.data);
  }

  async function expand(idea: string) {
    setExpanding(idea);
    const res = await expandIdeaToPost({ idea, platform });
    setExpanding(null);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo crear la publicación.");
      return;
    }
    setPost({ idea, post: res.data });
  }

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" /> Generando ideas…
          </>
        ) : (
          <>
            <Lightbulb className="mr-1 size-4" />
            {ideas.length > 0 ? "Generar otras 30" : "Generar 30 ideas"}
          </>
        )}
      </Button>

      {ideas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {ideas.map((idea, i) => (
            <Card key={i}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{idea.title}</p>
                  {idea.angle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {idea.angle}
                    </p>
                  )}
                </div>
                {canExpand && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={expanding === idea.title}
                    onClick={() => expand(idea.title)}
                  >
                    {expanding === idea.title ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Crear post"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(post)} onOpenChange={(o) => !o && setPost(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{post?.post.title || post?.idea}</DialogTitle>
          </DialogHeader>
          {post && <PostBody post={post.post} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostBody({ post }: { post: FullPost }) {
  const full = `${post.title}\n\n${post.caption}\n\n${hashtagsLine(post.hashtags)}`;
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-sm">{post.caption}</p>
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.hashtags.map((h) => (
            <Badge key={h} variant="secondary">
              {h.startsWith("#") ? h : `#${h}`}
            </Badge>
          ))}
        </div>
      )}
      {post.imageIdea && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          <span className="font-medium">Idea de imagen:</span> {post.imageIdea}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={() => copy(full)}>
        <Copy className="mr-1 size-4" /> Copiar publicación
      </Button>
    </div>
  );
}

// ---------- Desde la agenda ----------

function AgendaSection() {
  const [campaigns, setCampaigns] = useState<AgendaCampaign[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await generateAgendaCampaigns();
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo generar.");
      return;
    }
    setCampaigns(res.data);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            La IA revisa tus citas (huecos, cancelaciones, servicios frecuentes,
            pacientes inactivos) y propone campañas conectadas a tu negocio.
          </p>
          <Button onClick={run} disabled={loading} className="shrink-0">
            {loading ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Analizando…
              </>
            ) : (
              <>
                <CalendarRange className="mr-1 size-4" /> Analizar mi agenda
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {campaigns.map((c, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">{c.situation}</Badge>
                <h3 className="mt-2 font-heading text-base font-semibold">
                  {c.title}
                </h3>
                {c.audience && (
                  <p className="text-xs text-muted-foreground">
                    Para: {c.audience}
                  </p>
                )}
              </div>
            </div>
            {c.message && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mensaje listo
                </p>
                <p className="whitespace-pre-wrap text-sm">{c.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copy(c.message)}
                >
                  <Copy className="mr-1 size-4" /> Copiar mensaje
                </Button>
              </div>
            )}
            {(c.hook || c.body || c.cta) && (
              <div className="space-y-2 border-t pt-3">
                <ScriptPart label="🎯 Gancho" text={c.hook} />
                <ScriptPart label="Desarrollo" text={c.body} />
                <ScriptPart label="CTA" text={c.cta} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Calendario semanal ----------

function CalendarSection() {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [post, setPost] = useState<{ idea: string; post: FullPost } | null>(null);

  async function run() {
    setLoading(true);
    const res = await generateWeeklyCalendar();
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo generar.");
      return;
    }
    setDays(res.data);
  }

  async function expand(idea: string) {
    setExpanding(idea);
    const res = await expandIdeaToPost({ idea, platform: "reels" });
    setExpanding(null);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo crear la publicación.");
      return;
    }
    setPost({ idea, post: res.data });
  }

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" /> Armando calendario…
          </>
        ) : (
          <>
            <CalendarDays className="mr-1 size-4" />
            {days.length > 0 ? "Generar otro calendario" : "Generar calendario semanal"}
          </>
        )}
      </Button>

      {days.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((d, i) => (
            <Card key={i}>
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-heading text-sm font-semibold">{d.day}</p>
                  <Badge variant="outline">{d.theme}</Badge>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{d.idea}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={expanding === d.idea}
                  onClick={() => expand(d.idea)}
                >
                  {expanding === d.idea ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Crear post"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(post)} onOpenChange={(o) => !o && setPost(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{post?.post.title || post?.idea}</DialogTitle>
          </DialogHeader>
          {post && <PostBody post={post.post} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Reutilizar contenido (1 → N) ----------

function RepurposeSection() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pieces, setPieces] = useState<RepurposePieces | null>(null);

  async function run() {
    if (!text.trim() && !file) {
      toast.error("Pega un texto o sube un video/audio.");
      return;
    }
    const fd = new FormData();
    fd.set("text", text);
    if (file) fd.set("media", file);
    setLoading(true);
    const res = await repurposeContent(fd);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo reutilizar.");
      return;
    }
    setPieces(res.data);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Field label="Texto base (pega un guion, post o nota)">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Pega aquí el contenido que quieres convertir en varias piezas…"
            />
          </Field>
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-2 text-sm">
              <Upload className="size-4" /> O sube un video/audio (lo transcribimos)
            </Label>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Máx 25 MB. Mejor audio o video corto (1-2 min).
            </p>
          </div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Generando piezas…
              </>
            ) : (
              <>
                <Recycle className="mr-1 size-4" /> Convertir en varias piezas
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {pieces && <RepurposeResult pieces={pieces} />}
    </div>
  );
}

function RepurposeResult({ pieces }: { pieces: RepurposePieces }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-6">
          <PieceHeader title="🎬 Reel / TikTok" text={`${pieces.reel.hook}\n\n${pieces.reel.body}\n\n${pieces.reel.cta}`} />
          <ScriptPart label="🎯 Gancho" text={pieces.reel.hook} />
          <ScriptPart label="Desarrollo" text={pieces.reel.body} />
          <ScriptPart label="CTA" text={pieces.reel.cta} />
        </CardContent>
      </Card>

      {pieces.story && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <PieceHeader title="📱 Historia" text={pieces.story} />
            <p className="whitespace-pre-wrap text-sm">{pieces.story}</p>
          </CardContent>
        </Card>
      )}

      {pieces.carousel.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <PieceHeader
              title="🖼️ Carrusel"
              text={pieces.carousel.map((s, i) => `Slide ${i + 1}: ${s}`).join("\n")}
            />
            <ol className="space-y-2">
              {pieces.carousel.map((s, i) => (
                <li key={i} className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <span className="mr-2 font-semibold text-primary">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {pieces.post.caption && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <PieceHeader
              title="📘 Post Facebook / Instagram"
              text={`${pieces.post.caption}\n${hashtagsLine(pieces.post.hashtags)}`}
            />
            <p className="whitespace-pre-wrap text-sm">{pieces.post.caption}</p>
            {pieces.post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pieces.post.hashtags.map((h) => (
                  <Badge key={h} variant="secondary">
                    {h.startsWith("#") ? h : `#${h}`}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PieceHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="font-heading text-sm font-semibold">{title}</p>
      <Button variant="outline" size="sm" onClick={() => copy(text)}>
        <Copy className="mr-1 size-4" /> Copiar
      </Button>
    </div>
  );
}

// ---------- Guardados ----------

function SavedSection() {
  const [items, setItems] = useState<SavedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    const res = await listSavedContent();
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "No se pudo cargar.");
      return;
    }
    setItems(res.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteSavedContent(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Eliminado");
    });
  }

  if (loading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );

  if (items.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aún no has guardado contenido. Lo que generes aparece aquí.
      </p>
    );

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Card key={it.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{KIND_LABELS[it.kind]}</Badge>
                <p className="truncate font-medium">{it.title || "Sin título"}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(it.created_at).toLocaleDateString("es-EC", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive"
              disabled={pending}
              onClick={() => remove(it.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const KIND_LABELS: Record<SavedContent["kind"], string> = {
  script: "Guion",
  idea_batch: "Ideas",
  post: "Publicación",
  campaign: "Campaña",
  calendar: "Calendario",
  repurpose: "Reutilizado",
};

// ---------- UI helpers ----------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
    >
      {children}
    </select>
  );
}
