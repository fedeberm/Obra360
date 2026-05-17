"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GridCalibration } from "@/types";
import { cn } from "@/lib/utils";
import { Crosshair, Check, X, Ruler, Trash2 } from "lucide-react";

interface ScreenPt { x: number; y: number; }
interface SphPt { yaw: number; pitch: number; }

interface Measurement {
  a: SphPt;
  b: SphPt;
  meters: number;
}

interface GridOverlay360Props {
  visible: boolean;
  showPanel: boolean;
  calibration: GridCalibration | null;
  viewer: any;
  onCalibrationSave: (cal: GridCalibration) => void;
  onToggleGrid: () => void;
  onClosePanel: () => void;
}

function angularDist(a: SphPt, b: SphPt) {
  const d =
    Math.sin(a.pitch) * Math.sin(b.pitch) +
    Math.cos(a.pitch) * Math.cos(b.pitch) * Math.cos(a.yaw - b.yaw);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

function inFront(pt: SphPt, cam: SphPt) {
  return (
    Math.sin(pt.pitch) * Math.sin(cam.pitch) +
    Math.cos(pt.pitch) * Math.cos(cam.pitch) * Math.cos(pt.yaw - cam.yaw)
  ) > 0.02;
}

export function GridOverlay360({
  visible, showPanel, calibration, viewer,
  onCalibrationSave, onToggleGrid, onClosePanel,
}: GridOverlay360Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // ── Calibration ─────────────────────────────────────────
  const [calibMode, setCalibMode] = useState(false);
  const [calibSph1, setCalibSph1] = useState<SphPt | null>(null);
  const [calibSph2, setCalibSph2] = useState<SphPt | null>(null);
  const [calibScr1, setCalibScr1] = useState<ScreenPt | null>(null);
  const [calibScr2, setCalibScr2] = useState<ScreenPt | null>(null);
  const [realDist, setRealDist] = useState("1");

  // ── Measurement ──────────────────────────────────────────
  const [measureMode, setMeasureMode] = useState(false);
  const [measSph1, setMeasSph1] = useState<SphPt | null>(null);
  const [measSph2, setMeasSph2] = useState<SphPt | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  const hasCalib = calibration?.metersPerRad !== undefined;

  // Keep canvas size in sync
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight; };
    const obs = new ResizeObserver(sync);
    obs.observe(parent);
    sync();
    return () => obs.disconnect();
  }, []);

  // ── Draw loop — measurement line follows the panorama ────
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!visible || !measurement || !viewer) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    function draw() {
      if (!canvas || !viewer || !measurement) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cam: SphPt = viewer.getPosition();

      const aVisible = inFront(measurement.a, cam);
      const bVisible = inFront(measurement.b, cam);

      if (!aVisible && !bVisible) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const scrA: ScreenPt | null = aVisible
        ? viewer.dataHelper.sphericalCoordsToViewerCoords(measurement.a)
        : null;
      const scrB: ScreenPt | null = bVisible
        ? viewer.dataHelper.sphericalCoordsToViewerCoords(measurement.b)
        : null;

      const DOT_R = 8;

      // Line between points (only if both visible)
      if (scrA && scrB) {
        ctx.strokeStyle = "rgba(255, 220, 0, 0.95)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(scrA.x, scrA.y);
        ctx.lineTo(scrB.x, scrB.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance label at midpoint
        const mx = (scrA.x + scrB.x) / 2;
        const my = (scrA.y + scrB.y) / 2;
        const label = `${measurement.meters.toFixed(2)} m`;
        ctx.font = "bold 14px sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.beginPath();
        ctx.roundRect(mx - tw / 2 - 8, my - 12, tw + 16, 24, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,220,0,1)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Dot A
      if (scrA) {
        ctx.fillStyle = "rgba(255,220,0,0.95)";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(scrA.x, scrA.y, DOT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "black";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("A", scrA.x, scrA.y);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Dot B
      if (scrB) {
        ctx.fillStyle = "rgba(255,220,0,0.95)";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(scrB.x, scrB.y, DOT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "black";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("B", scrB.x, scrB.y);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible, measurement, viewer]);

  // ── Tap handler ──────────────────────────────────────────
  function getScreenAndSph(e: React.MouseEvent | React.TouchEvent): { scr: ScreenPt; sph: SphPt } | null {
    if (!viewer) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      const t = e.changedTouches[0];
      cx = t.clientX - rect.left; cy = t.clientY - rect.top;
    } else {
      cx = (e as React.MouseEvent).clientX - rect.left;
      cy = (e as React.MouseEvent).clientY - rect.top;
    }
    const sph: SphPt = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: cx, y: cy });
    if (!sph) return null;
    return { scr: { x: cx, y: cy }, sph };
  }

  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    const hit = getScreenAndSph(e);
    if (!hit) return;

    if (calibMode) {
      if (!calibSph1) {
        setCalibSph1(hit.sph); setCalibScr1(hit.scr);
      } else if (!calibSph2) {
        setCalibSph2(hit.sph); setCalibScr2(hit.scr);
      }
      return;
    }

    if (measureMode) {
      if (!measSph1) {
        setMeasSph1(hit.sph);
      } else if (!measSph2) {
        const dist = calibration!.metersPerRad! * angularDist(measSph1, hit.sph);
        setMeasSph2(hit.sph);
        setMeasurement({ a: measSph1, b: hit.sph, meters: dist });
        setMeasureMode(false);
      }
      return;
    }
  }

  const isInteractive = calibMode || measureMode;

  // ── Calibration ──────────────────────────────────────────
  function confirmCalib() {
    if (!calibSph1 || !calibSph2) return;
    const d = parseFloat(realDist);
    if (!d || d <= 0) return;
    const angDist = angularDist(calibSph1, calibSph2);
    if (angDist < 0.001) return;
    onCalibrationSave({
      metersPerRad: d / angDist,
      cellSizeMeters: calibration?.cellSizeMeters ?? 1,
      opacity: calibration?.opacity ?? 0.7,
      anchorYaw: (calibSph1.yaw + calibSph2.yaw) / 2,
      anchorPitch: (calibSph1.pitch + calibSph2.pitch) / 2,
    });
    resetCalib();
  }

  function resetCalib() {
    setCalibMode(false);
    setCalibSph1(null); setCalibSph2(null);
    setCalibScr1(null); setCalibScr2(null);
  }

  function startCalib() {
    setMeasureMode(false);
    setCalibMode(true);
    setCalibSph1(null); setCalibSph2(null);
    setCalibScr1(null); setCalibScr2(null);
  }

  // ── Measurement ──────────────────────────────────────────
  function startMeasure() {
    setCalibMode(false);
    setMeasureMode(true);
    setMeasSph1(null); setMeasSph2(null);
    setMeasurement(null);
  }

  function clearMeasurement() {
    setMeasureMode(false);
    setMeasSph1(null); setMeasSph2(null);
    setMeasurement(null);
  }

  // Instruction text
  const instruction =
    calibMode
      ? !calibSph1 ? "Tocá el punto A (distancia conocida)"
        : !calibSph2 ? "Tocá el punto B"
        : "Ingresá la distancia real en el panel →"
      : measureMode
      ? !measSph1 ? "Tocá el punto A a medir"
        : "Tocá el punto B a medir"
      : null;

  return (
    <>
      {/* Invisible canvas — captures taps + draws measurement */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{ pointerEvents: isInteractive ? "auto" : "none", cursor: isInteractive ? "crosshair" : "default" }}
        onClick={isInteractive ? handleTap : undefined}
        onTouchEnd={isInteractive ? handleTap : undefined}
      />

      {/* Calibration dots SVG (static, not on canvas so they don't flicker) */}
      {calibMode && (calibScr1 || calibScr2) && (
        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
          {calibScr1 && (
            <>
              <circle cx={calibScr1.x} cy={calibScr1.y} r={8} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
              <text x={calibScr1.x} y={calibScr1.y + 1} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="10" fontWeight="bold">A</text>
            </>
          )}
          {calibScr1 && calibScr2 && (
            <>
              <line x1={calibScr1.x} y1={calibScr1.y} x2={calibScr2.x} y2={calibScr2.y}
                stroke="rgba(255,220,0,0.9)" strokeWidth="2" strokeDasharray="6,3" />
              <circle cx={calibScr2.x} cy={calibScr2.y} r={8} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
              <text x={calibScr2.x} y={calibScr2.y + 1} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="10" fontWeight="bold">B</text>
            </>
          )}
        </svg>
      )}

      {/* Measure mode: dot A before B is placed */}
      {measureMode && measSph1 && !measSph2 && viewer && (() => {
        const cam: SphPt = viewer.getPosition();
        const scr = inFront(measSph1, cam)
          ? viewer.dataHelper.sphericalCoordsToViewerCoords(measSph1)
          : null;
        return scr ? (
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            <circle cx={scr.x} cy={scr.y} r={8} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
            <text x={scr.x} y={scr.y + 1} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="10" fontWeight="bold">A</text>
          </svg>
        ) : null;
      })()}

      {/* Instruction banner */}
      {instruction && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur
                        rounded-full px-5 py-2.5 text-yellow-400 text-sm font-medium
                        pointer-events-none shadow-lg"
          style={{ top: "80px" }}>
          {instruction}
        </div>
      )}

      {/* Control panel */}
      {showPanel && (
        <div className="fixed z-[60] bg-black/85 backdrop-blur rounded-xl
                        border border-white/10 p-4 w-64 space-y-4 shadow-2xl"
          style={{ top: "72px", right: "16px" }}>

          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold flex items-center gap-2">
              <Ruler className="w-4 h-4 text-yellow-400" />
              Herramienta de medición
            </p>
            <button onClick={onClosePanel} className="text-white/50 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Calibración ────────────────────────── */}
          <div className="space-y-2">
            <p className="text-white/60 text-xs uppercase tracking-wide">Escala</p>

            {hasCalib && !calibMode && (
              <div className="bg-white/5 rounded-lg px-3 py-2 space-y-0.5">
                <p className="text-white/80 text-xs">
                  1 m = {(1 / calibration!.metersPerRad!).toFixed(3)} rad
                </p>
                <p className="text-white/40 text-[10px]">Calibración activa</p>
              </div>
            )}

            {!calibMode ? (
              <button onClick={startCalib}
                className="w-full flex items-center justify-center gap-2
                           bg-white/10 hover:bg-white/15 text-white/80
                           text-xs py-2 rounded-lg border border-white/15 transition-colors">
                <Crosshair className="w-3.5 h-3.5" />
                {hasCalib ? "Recalibrar" : "Calibrar escala"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-yellow-400 text-xs">
                  {!calibSph1 ? "→ Tocá el punto A en la foto"
                   : !calibSph2 ? "→ Tocá el punto B en la foto"
                   : "→ Ingresá la distancia A→B"}
                </p>
                {calibSph1 && calibSph2 && (
                  <div className="flex gap-2 items-center">
                    <input type="number" value={realDist}
                      onChange={(e) => setRealDist(e.target.value)}
                      className="flex-1 bg-white/10 text-white text-sm px-2 py-1.5 rounded
                                 border border-white/20 focus:outline-none focus:border-yellow-400"
                      placeholder="metros" min="0.01" step="0.1" autoFocus />
                    <span className="text-white/50 text-xs">m</span>
                    <button onClick={confirmCalib}
                      className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded text-white">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button onClick={resetCalib} className="text-white/40 hover:text-white/70 text-xs">
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* ── Medición ───────────────────────────── */}
          {hasCalib && (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <p className="text-white/60 text-xs uppercase tracking-wide">Medir</p>

              {measurement ? (
                <div className="space-y-2">
                  <div className="bg-yellow-400/15 border border-yellow-400/30 rounded-lg px-3 py-2.5 text-center">
                    <p className="text-yellow-400 text-xl font-bold">{measurement.meters.toFixed(2)} m</p>
                    <p className="text-yellow-400/60 text-[10px] mt-0.5">distancia A → B</p>
                  </div>
                  <button onClick={startMeasure}
                    className="w-full text-xs py-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30
                               text-yellow-400 border border-yellow-400/30 transition-colors">
                    Nueva medición
                  </button>
                  <button onClick={clearMeasurement}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5
                               text-white/40 hover:text-white/70 transition-colors">
                    <Trash2 className="w-3 h-3" />
                    Borrar
                  </button>
                </div>
              ) : measureMode ? (
                <div className="space-y-2">
                  <p className="text-yellow-400 text-xs">
                    {!measSph1 ? "→ Tocá el punto A en la foto" : "→ Tocá el punto B en la foto"}
                  </p>
                  <button onClick={clearMeasurement} className="text-white/40 hover:text-white/70 text-xs">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={startMeasure}
                  className="w-full flex items-center justify-center gap-2
                             bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400
                             text-xs py-2.5 rounded-lg border border-yellow-400/30 transition-colors">
                  <Ruler className="w-3.5 h-3.5" />
                  Medir distancia
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
