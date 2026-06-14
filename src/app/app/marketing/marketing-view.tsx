"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contenido para redes</h1>
        <p className="text-muted-foreground">
          Genera texto y videos con IA a partir de tu negocio. Revisa y ajusta
          antes de publicar.
        </p>
      </div>

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
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" />
                {posts.length > 0 ? "Generar otras 3" : "Generar 3 publicaciones"}
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
                <Copy className="mr-1 h-4 w-4" /> Copiar
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
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
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
  );
}
