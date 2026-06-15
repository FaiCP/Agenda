"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Clock,
  Hash,
  MessageSquare,
} from "lucide-react";
import {
  generateSocialPosts,
  type SocialPost,
} from "@/lib/actions/marketing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaStudio } from "./media-studio";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "Estado de WhatsApp" },
];

const GOALS = [
  { value: "atraer", label: "Atraer clientes nuevos" },
  { value: "promocion", label: "Promoción / oferta" },
  { value: "educativo", label: "Contenido educativo" },
  { value: "recordatorio", label: "Recordar agendar cita" },
];

export function MarketingView() {
  const [platform, setPlatform] = useState("instagram");
  const [goal, setGoal] = useState("atraer");
  const [topic, setTopic] = useState("");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await generateSocialPosts({ platform, goal, topic });
    setLoading(false);
    if (res.error || !res.posts) {
      toast.error(res.error ?? "No se pudo generar el contenido.");
      return;
    }
    setPosts(res.posts);
  }

  function copyPost(post: SocialPost) {
    const text = [post.caption, post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")]
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Publicación copiada"))
      .catch(() => toast.error("No se pudo copiar"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Contenido para redes
        </h1>
        <p className="text-muted-foreground">
          Genera texto y videos con IA a partir de tu negocio. Revisa y ajusta
          antes de publicar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Tabs defaultValue="texto">
            <TabsList>
              <TabsTrigger value="texto">Texto</TabsTrigger>
              <TabsTrigger value="video">Reel / Imagen</TabsTrigger>
            </TabsList>

            <TabsContent value="texto" className="mt-4 space-y-6">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Red social</Label>
                      <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivo</Label>
                      <select
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                      >
                        {GOALS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="topic">Tema o promoción (opcional)</Label>
                    <Textarea
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      rows={2}
                      placeholder="Ej: 20% de descuento en limpieza dental durante junio"
                    />
                  </div>
                  <Button onClick={generate} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-1 size-4 animate-spin" /> Generando…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1 size-4" />
                        {posts.length > 0
                          ? "Generar otras 3"
                          : "Generar 3 publicaciones"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {posts.map((post, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Opción {i + 1}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyPost(post)}
                      >
                        <Copy className="mr-1 size-4" /> Copiar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                      <CardDescription className="flex items-start gap-2 border-t pt-3">
                        <ImageIcon className="mt-0.5 size-4 shrink-0" />
                        <span>
                          <span className="font-medium">Idea de imagen:</span>{" "}
                          {post.imageIdea}
                        </span>
                      </CardDescription>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="video" className="mt-4">
              <MediaStudio />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-primary p-5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <p className="font-heading text-sm font-semibold">Tip del día</p>
            </div>
            <p className="mt-2 text-sm text-primary-foreground/85">
              Las publicaciones con videos cortos (Reels) tienen un 40% más de
              alcance orgánico que las imágenes estáticas.
            </p>
          </div>

          <TipCard
            icon={Clock}
            label="Mejor hora para publicar"
            value="19:00 – 21:00"
          />
          <TipCard
            icon={Hash}
            label="Hashtags clave"
            value="#Salud #Bienestar"
          />
          <TipCard
            icon={MessageSquare}
            label="Tono de voz"
            value="Profesional & Cercano"
          />
        </aside>
      </div>
    </div>
  );
}

function TipCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
