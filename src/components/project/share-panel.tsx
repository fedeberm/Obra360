"use client";

import { useState } from "react";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProject, regenerateShareToken } from "@/lib/actions/projects";
import { toast } from "@/hooks/use-toast";
import { getShareUrl } from "@/lib/utils";
import { Copy, RefreshCw, Share2, Globe, Lock, Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface SharePanelProps {
  project: Project;
}

export function SharePanel({ project }: SharePanelProps) {
  const router = useRouter();
  const [shareEnabled, setShareEnabled] = useState(project.share_enabled);
  const [token, setToken] = useState(project.share_token);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [loadingRegen, setLoadingRegen] = useState(false);

  const shareUrl = getShareUrl(token);

  async function handleToggleShare() {
    setLoadingToggle(true);
    try {
      await updateProject(project.id, { share_enabled: !shareEnabled });
      setShareEnabled(!shareEnabled);
      toast({
        title: !shareEnabled ? "Enlace activado" : "Enlace desactivado",
        description: !shareEnabled
          ? "El cliente ahora puede acceder con el enlace."
          : "El enlace ya no es accesible.",
      });
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoadingToggle(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("¿Regenerar el enlace? El enlace anterior dejará de funcionar.")) return;
    setLoadingRegen(true);
    try {
      const newToken = await regenerateShareToken(project.id);
      setToken(newToken);
      toast({ title: "Enlace regenerado", description: "El enlace anterior ya no funciona." });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoadingRegen(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Enlace copiado", description: "Pegalo en un chat o email al cliente." });
  }

  return (
    <div className="space-y-6 py-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Compartir proyecto</h2>
        <p className="text-slate-500 text-sm">
          El cliente accede con este enlace sin necesidad de crear una cuenta.
        </p>
      </div>

      {/* Estado del enlace */}
      <Card className={shareEnabled ? "border-green-200 bg-green-50" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {shareEnabled ? (
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <div>
                <CardTitle className="text-base">
                  {shareEnabled ? "Enlace activo" : "Enlace desactivado"}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {shareEnabled
                    ? "Cualquier persona con el enlace puede ver el proyecto"
                    : "El proyecto no es accesible externamente"}
                </CardDescription>
              </div>
            </div>
            <Button
              variant={shareEnabled ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleShare}
              disabled={loadingToggle}
            >
              {loadingToggle ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : shareEnabled ? (
                "Desactivar"
              ) : (
                "Activar"
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* URL del enlace */}
      {shareEnabled && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Enlace para el cliente</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 border rounded-lg px-3 py-2.5 text-sm text-slate-600 font-mono truncate">
                  {shareUrl}
                </div>
                <Button variant="outline" size="sm" onClick={copyToClipboard} className="flex-shrink-0">
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shareUrl, "_blank")}
                  className="flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <p className="text-sm font-medium text-slate-700">Regenerar enlace</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Útil si compartiste el enlace por error con alguien no deseado.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={loadingRegen}
              >
                {loadingRegen ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Regenerar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-5 pb-5">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">¿Qué ve el cliente?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                Todas las plantas del proyecto con sus planos
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                Los puntos de cámara sobre cada plano
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                Fotos 360° de cada punto con su historial de fechas
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                Vista de solo lectura — no puede modificar nada
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
