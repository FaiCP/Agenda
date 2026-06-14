"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Share2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { createMediaRender, getMediaAsset } from "@/lib/actions/media";
import { generateSocialPosts } from "@/lib/actions/marketing";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const FORMATS = [
  { value: "reel", label: "Reel (vertical 9:16)" },
  { value: "post", label: "Publicación (cuadrada 1:1)" },
  { value: "story", label: "Estado / Historia (9:16)" },
];

const MAX_PHOTOS = 5;
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

type Phase = "idle" | "working" | "ready" | "failed";

export function MediaStudio() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [format, setFormat] = useState("reel");
  const [caption, setCaption] = useState("");
  const [topic, setTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Previews de las fotos seleccionadas (revocadas al cambiar/desmontar)
  const previews = useMemo(
    () => photos.map((p) => URL.createObjectURL(p)),
    [photos]
  );
  useEffect(
    () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
    [previews]
  );

  // Polling del estado del render
  useEffect(() => {
    if (!assetId || phase !== "working") return;
    let active = true;
    const start = Date.now();

    const tick = async () => {
      if (!active) return;
      const a = await getMediaAsset(assetId);
      if (!active) return;
      if (a?.status === "ready") {
        setVideoUrl(a.videoUrl);
        setPhase("ready");
        return;
      }
      if (a?.status === "failed") {
        setPhase("failed");
        toast.error("No se pudo generar el video. Intenta de nuevo.");
        return;
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        setPhase("failed");
        toast.error("El video tardó demasiado. Intenta de nuevo.");
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };

    let timer = setTimeout(tick, POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assetId, phase]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function fillCaptionWithAI() {
    setAiLoading(true);
    const res = await generateSocialPosts({
      platform: "instagram",
      goal: "atraer",
      topic,
    });
    setAiLoading(false);
    if (res.error || !res.posts?.length) {
      toast.error(res.error ?? "No se pudo generar el texto.");
      return;
    }
    const p = res.posts[0];
    const tags = p.hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    setCaption([p.caption, tags].filter(Boolean).join("\n\n"));
    toast.success("Texto generado. Revísalo antes de publicar.");
  }

  async function generate() {
    if (photos.length === 0) {
      toast.error("Sube al menos una foto.");
      return;
    }
    setPhase("working");
    setVideoUrl(null);
    setAssetId(null);

    const fd = new FormData();
    photos.forEach((p) => fd.append("photos", p));
    fd.append("format", format);
    fd.append("caption", caption);

    const res = await createMediaRender(fd);
    if (res.error || !res.assetId) {
      setPhase("idle");
      toast.error(res.error ?? "No se pudo iniciar la generación.");
      return;
    }
    setAssetId(res.assetId);
  }

  async function share() {
    if (!videoUrl) return;
    try {
      const blob = await (await fetch(videoUrl)).blob();
      const file = new File([blob], "reel.mp4", { type: "video/mp4" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
      } else {
        download();
      }
    } catch {
      // El usuario canceló el diálogo de compartir: sin error.
    }
  }

  function download() {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "reel.mp4";
    a.click();
  }

  const working = phase === "working";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* Fotos */}
          <div className="space-y-2">
            <Label>Fotos del negocio ({photos.length}/{MAX_PHOTOS})</Label>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
                    aria-label="Quitar foto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-muted"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Subir</span>
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={onPick}
            />
          </div>

          {/* Formato */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="caption">Texto del post</Label>
            </div>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Tema para la IA (opcional)"
                className="h-9 flex-1 rounded-md border bg-transparent px-3 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillCaptionWithAI}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                IA
              </Button>
            </div>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Escribe el texto o genéralo con IA"
            />
          </div>

          <Button onClick={generate} disabled={working} className="w-full">
            {working ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Generando video…
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" /> Generar video
              </>
            )}
          </Button>
          {working && (
            <p className="text-center text-xs text-muted-foreground">
              Esto toma unos segundos. No cierres la página.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultado */}
      {phase === "ready" && videoUrl && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <video
              src={videoUrl}
              controls
              playsInline
              className="mx-auto max-h-[70vh] rounded-md"
            />
            <div className="flex gap-2">
              <Button onClick={share} className="flex-1">
                <Share2 className="mr-1 h-4 w-4" /> Compartir
              </Button>
              <Button onClick={download} variant="outline" className="flex-1">
                <Download className="mr-1 h-4 w-4" /> Descargar
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              En el celular, &quot;Compartir&quot; abre Instagram, WhatsApp o TikTok
              directamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
