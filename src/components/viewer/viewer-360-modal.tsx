"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoVisit } from "@/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  X, ChevronLeft, ChevronRight, Calendar, MessageSquare,
  Maximize2, Minimize2, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Viewer360ModalProps {
  visit: PhotoVisit;
  pointName: string;
  allVisits: PhotoVisit[];
  onClose: () => void;
  onChangeVisit: (visit: PhotoVisit) => void;
}

export function Viewer360Modal({
  visit, pointName, allVisits, onClose, onChangeVisit,
}: Viewer360ModalProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const psvRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(
    allVisits.findIndex((v) => v.id === visit.id)
  );
  const [loading, setLoading] = useState(true);

  // Inicializar Photo Sphere Viewer
  useEffect(() => {
    let viewer: any = null;

    async function initViewer() {
      if (!viewerRef.current) return;

      try {
        const { Viewer } = await import("@photo-sphere-viewer/core");

        setLoading(true);

        viewer = new Viewer({
          container: viewerRef.current,
          panorama: allVisits[currentIndex].photo_url,
          defaultZoomLvl: 50,
          navbar: false,
          loadingImg: undefined,
          touchmoveTwoFingers: false,
          mousewheelCtrlKey: false,
          lang: {
            zoom: "Zoom",
            zoomIn: "Acercar",
            zoomOut: "Alejar",
            moveUp: "Arriba",
            moveDown: "Abajo",
            moveLeft: "Izquierda",
            moveRight: "Derecha",
            download: "Descargar",
            fullscreen: "Pantalla completa",
            menu: "Menú",
            twoFingers: "Usá dos dedos para navegar",
            ctrlZoom: "Ctrl + scroll para hacer zoom",
            loadError: "No se pudo cargar el panorama",
          } as any,
        });

        viewer.addEventListener("ready", () => setLoading(false), { once: true });
        psvRef.current = viewer;
      } catch (err) {
        console.error("Error inicializando visor 360:", err);
        setLoading(false);
      }
    }

    initViewer();

    return () => {
      if (psvRef.current) {
        try { psvRef.current.destroy(); } catch {}
        psvRef.current = null;
      }
    };
  }, []);

  // Cambiar panorama sin reiniciar el viewer
  useEffect(() => {
    if (!psvRef.current) return;
    setLoading(true);
    psvRef.current
      .setPanorama(allVisits[currentIndex].photo_url)
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [currentIndex]);

  function goPrev() {
    if (currentIndex < allVisits.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      onChangeVisit(allVisits[newIdx]);
    }
  }

  function goNext() {
    if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      onChangeVisit(allVisits[newIdx]);
    }
  }

  function resetNorth() {
    if (psvRef.current) {
      psvRef.current.rotate({ longitude: 0, latitude: 0 });
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex]);

  const currentVisit = allVisits[currentIndex];
  const hasPrev = currentIndex < allVisits.length - 1;
  const hasNext = currentIndex > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">{pointName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white/70 text-sm flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(currentVisit.taken_at)}
            </span>
            <span className="text-white/40 text-xs">
              Visita {allVisits.length - currentIndex} de {allVisits.length}
            </span>
          </div>
          {currentVisit.notes && (
            <p className="text-white/60 text-xs mt-1 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              {currentVisit.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetNorth}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Resetear vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Visor */}
      <div className="flex-1 relative">
        <div ref={viewerRef} className="w-full h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <div className="text-white text-center">
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/70">Cargando panorama...</p>
            </div>
          </div>
        )}

        {/* Navegación entre fechas */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors group"
            title="Visita anterior"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {allVisits[currentIndex + 1] ? formatDate(allVisits[currentIndex + 1].taken_at) : ""}
            </span>
          </button>
        )}
        {hasNext && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors group"
            title="Visita siguiente"
          >
            <ChevronRight className="w-5 h-5" />
            <span className="absolute right-14 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {allVisits[currentIndex - 1] ? formatDate(allVisits[currentIndex - 1].taken_at) : ""}
            </span>
          </button>
        )}
      </div>

      {/* Timeline de visitas en el footer */}
      {allVisits.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-white/50 text-xs flex-shrink-0">Avance:</span>
            {[...allVisits].reverse().map((v, idx) => {
              const reversedIdx = allVisits.length - 1 - idx;
              const isCurrent = reversedIdx === currentIndex;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setCurrentIndex(reversedIdx);
                    onChangeVisit(v);
                  }}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all",
                    isCurrent
                      ? "bg-white/20 border border-white/40"
                      : "hover:bg-white/10 border border-transparent"
                  )}
                >
                  <img
                    src={v.photo_url}
                    alt=""
                    className="w-12 h-8 object-cover rounded"
                  />
                  <span className="text-white/70 text-[10px]">
                    {formatDate(v.taken_at, { day: "2-digit", month: "short" })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
