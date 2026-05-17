"use client";

import { useState, useRef, useEffect } from "react";
import { GridCalibration } from "@/types";
import { cn } from "@/lib/utils";
import { Crosshair, Check, X, Ruler, Trash2, ArrowLeftRight, ArrowUpDown } from "lucide-react";

interface ScreenPt { x: number; y: number; }
interface SphPt { yaw: number; pitch: number; }

interface Measurement {
  a: SphPt;
  b: SphPt;
  meters: number;
  direction: "H" | "V" | "D"; // horizontal / vertical / diagonal
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

// ── Math helpers ────────────────────────────────────────────
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

/**
 * Detect if measurement is mainly horizontal, vertical or diagonal.
 * Uses the angular deltas in each axis.
 */
function measureDirection(a: SphPt, b: SphPt): "H" | "V" | "D" {
  const dYaw = Math.abs(b.yaw - a.yaw) * Math.cos((a.pitch + b.pitch) / 2); // correct for latitude
  const dPitch = Math.abs(b.pitch - a.pitch);
  const ratio = dYaw === 0 ? Infinity : dPitch / dYaw;
  if (ratio > 2) return "V";   // 2× more vertical than horizontal
  if (ratio < 0.5) return "H"; // 2× more horizontal than vertical
  return "D";
}

/**
 * Pick the best metersPerRad for a measurement given calibration and direction.
 * Falls back to any available calibration.
 */
function pickScale(cal: GridCalibration, dir: "H" | "V" | "D"): number | null {
  if (dir === "V") return cal.metersPerRadV ?? cal.metersPerRadH ?? cal.metersPerRad ?? null;
  if (dir === "H") return cal.metersPerRadH ?? cal.metersPerRadV ?? cal.metersPerRad ?? null;
  // Diagonal: average if both available
  if (cal.metersPerRadH && cal.metersPerRadV) return (cal.metersPerRadH + cal.metersPerRadV) / 2;
  return cal.metersPerRadH ?? cal.metersPerRadV ?? cal.metersPerRad ?? null;
}

// ── Component ───────────────────────────────────────────────
type CalibAxis = "H" | "V";
type Mode = "idle" | "calibH1" | "calibH2" | "calibV1" | "calibV2" | "meas1" | "meas2";

export function GridOverlay360({
  visible, showPanel, calibration, viewer,
  onCalibrationSave, onToggleGrid, onClosePanel,
}: GridOverlay360Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>("idle");
  const [calibSph1, setCalibSph1] = useState<SphPt | null>(null);
  const [calibSph2, setCalibSph2] = useState<SphPt | null>(null);
  const [calibScr1, setCalibScr1] = useState<ScreenPt | null>(null);
  const [calibScr2, setCalibScr2] = useState<ScreenPt | null>(null);
  const [realDist, setRealDist] = useState("1");

  const [measSph1, setMeasSph1] = useState<SphPt | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  const hasH = !!(calibration?.metersPerRadH ?? calibration?.metersPerRad);
  const hasV = !!(calibration?.metersPerRadV ?? calibration?.metersPerRad);
  const hasAny = hasH || hasV;

  // Canvas buffer size sync
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

  // ── Draw loop — measurement follows the panorama ──────────
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
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cam: SphPt = viewer.getPosition();
      const aVis = inFront(measurement.a, cam);
      const bVis = inFront(measurement.b, cam);
      if (!aVis && !bVis) { animRef.current = requestAnimationFrame(draw); return; }

      const scrA: ScreenPt | null = aVis ? viewer.dataHelper.sphericalCoordsToViewerCoords(measurement.a) : null;
      const scrB: ScreenPt | null = bVis ? viewer.dataHelper.sphericalCoordsToViewerCoords(measurement.b) : null;

      // Dashed line between A and B
      if (scrA && scrB) {
        ctx.strokeStyle = "rgba(255,220,0,0.95)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(scrA.x, scrA.y); ctx.lineTo(scrB.x, scrB.y); ctx.stroke();
        ctx.setLineDash([]);

        // Distance label at midpoint
        const mx = (scrA.x + scrB.x) / 2;
        const my = (scrA.y + scrB.y) / 2;
        const dirIcon = measurement.direction === "V" ? "↕" : measurement.direction === "H" ? "↔" : "↗";
        const label = `${dirIcon} ${measurement.meters.toFixed(2)} m`;
        ctx.font = "bold 14px sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        (ctx as any).roundRect?.(mx - tw / 2 - 9, my - 13, tw + 18, 26, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,220,0,1)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Warn if direction doesn't match calibration
        const warnH = measurement.direction === "H" && !hasH;
        const warnV = measurement.direction === "V" && !hasV;
        if (warnH || warnV) {
          const warn = `⚠ sin calibración ${warnV ? "vertical" : "horizontal"}`;
          ctx.font = "11px sans-serif";
          ctx.fillStyle = "rgba(255,100,0,0.9)";
          ctx.textAlign = "center";
          ctx.fillText(warn, mx, my + 20);
          ctx.textAlign = "left";
        }
      }

      // Dot A
      if (scrA) drawDot(ctx, scrA, "A");
      // Dot B
      if (scrB) drawDot(ctx, scrB, "B");

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible, measurement, viewer, hasH, hasV]);

  function drawDot(ctx: CanvasRenderingContext2D, p: ScreenPt, label: string) {
    ctx.fillStyle = "rgba(255,220,0,0.95)";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "black";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, p.x, p.y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ── Tap handler ──────────────────────────────────────────
  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!viewer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    if (!sph) return;
    const scr: ScreenPt = { x: cx, y: cy };

    if (mode === "calibH1" || mode === "calibV1") {
      setCalibSph1(sph); setCalibScr1(scr);
      setMode(mode === "calibH1" ? "calibH2" : "calibV2");
    } else if (mode === "calibH2" || mode === "calibV2") {
      setCalibSph2(sph); setCalibScr2(scr);
    } else if (mode === "meas1") {
      setMeasSph1(sph);
      setMode("meas2");
    } else if (mode === "meas2" && measSph1) {
      const dir = measureDirection(measSph1, sph);
      const scale = pickScale(calibration!, dir);
      if (!scale) return;
      const meters = scale * angularDist(measSph1, sph);
      setMeasurement({ a: measSph1, b: sph, meters, direction: dir });
      setMode("idle");
      setMeasSph1(null);
    }
  }

  // ── Calibration confirm ──────────────────────────────────
  function confirmCalib() {
    if (!calibSph1 || !calibSph2) return;
    const d = parseFloat(realDist);
    if (!d || d <= 0) return;
    const angDist = angularDist(calibSph1, calibSph2);
    if (angDist < 0.001) return;
    const mPerRad = d / angDist;
    const axis: CalibAxis = mode === "calibH2" ? "H" : "V";
    const updated: GridCalibration = {
      ...(calibration ?? { opacity: 0.7 }),
      ...(axis === "H" ? { metersPerRadH: mPerRad } : { metersPerRadV: mPerRad }),
    };
    onCalibrationSave(updated);
    resetCalib();
  }

  function resetCalib() {
    setMode("idle");
    setCalibSph1(null); setCalibSph2(null);
    setCalibScr1(null); setCalibScr2(null);
  }

  function startCalib(axis: CalibAxis) {
    setMeasSph1(null); setMeasurement(null);
    setCalibSph1(null); setCalibSph2(null);
    setCalibScr1(null); setCalibScr2(null);
    setMode(axis === "H" ? "calibH1" : "calibV1");
  }

  function startMeasure() {
    resetCalib();
    setMeasSph1(null); setMeasurement(null);
    setMode("meas1");
  }

  function clearMeasurement() {
    setMeasurement(null); setMeasSph1(null);
    setMode("idle");
  }

  const isCalibMode = mode.startsWith("calib");
  const isMeasMode = mode.startsWith("meas");
  const isInteractive = isCalibMode || isMeasMode;

  const calibAxis: CalibAxis | null = mode.startsWith("calibH") ? "H" : mode.startsWith("calibV") ? "V" : null;
  const awaitingSecondCalib = mode === "calibH2" || mode === "calibV2";

  const instruction =
    mode === "calibH1" ? "Tocá el punto A (extremo izquierdo de la medida)" :
    mode === "calibH2" && !calibSph2 ? "Tocá el punto B (extremo derecho)" :
    mode === "calibH2" && calibSph2 ? "Ingresá la distancia real →" :
    mode === "calibV1" ? "Tocá el punto A (parte superior)" :
    mode === "calibV2" && !calibSph2 ? "Tocá el punto B (parte inferior)" :
    mode === "calibV2" && calibSph2 ? "Ingresá la distancia real →" :
    mode === "meas1" ? "Tocá el punto A a medir" :
    mode === "meas2" ? "Tocá el punto B a medir" :
    null;

  return (
    <>
      {/* Canvas — measurement tracking */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{ pointerEvents: isInteractive ? "auto" : "none", cursor: isInteractive ? "crosshair" : "default" }}
        onClick={isInteractive ? handleTap : undefined}
        onTouchEnd={isInteractive ? handleTap : undefined}
      />

      {/* Calibration dots SVG */}
      {isCalibMode && (calibScr1 || calibScr2) && (
        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
          {calibScr1 && (
            <>
              <circle cx={calibScr1.x} cy={calibScr1.y} r={9} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
              <text x={calibScr1.x} y={calibScr1.y + 1} textAnchor="middle" dominantBaseline="middle"
                fill="black" fontSize="11" fontWeight="bold">A</text>
            </>
          )}
          {calibScr1 && calibScr2 && (
            <>
              <line x1={calibScr1.x} y1={calibScr1.y} x2={calibScr2.x} y2={calibScr2.y}
                stroke="rgba(255,220,0,0.9)" strokeWidth="2" strokeDasharray="6,3" />
              <circle cx={calibScr2.x} cy={calibScr2.y} r={9} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
              <text x={calibScr2.x} y={calibScr2.y + 1} textAnchor="middle" dominantBaseline="middle"
                fill="black" fontSize="11" fontWeight="bold">B</text>
            </>
          )}
        </svg>
      )}

      {/* Measure dot A (before B placed) */}
      {mode === "meas2" && measSph1 && viewer && (() => {
        const cam: SphPt = viewer.getPosition();
        if (!inFront(measSph1, cam)) return null;
        const scr = viewer.dataHelper.sphericalCoordsToViewerCoords(measSph1);
        if (!scr) return null;
        return (
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            <circle cx={scr.x} cy={scr.y} r={9} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
            <text x={scr.x} y={scr.y + 1} textAnchor="middle" dominantBaseline="middle"
              fill="black" fontSize="11" fontWeight="bold">A</text>
          </svg>
        );
      })()}

      {/* Instruction banner */}
      {instruction && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur
                        rounded-full px-5 py-2.5 text-yellow-400 text-sm font-medium
                        pointer-events-none shadow-lg" style={{ top: "80px" }}>
          {instruction}
        </div>
      )}

      {/* ── Panel ──────────────────────────────────────────── */}
      {showPanel && (
        <div className="fixed z-[60] bg-black/85 backdrop-blur rounded-xl border border-white/10
                        p-4 w-68 space-y-4 shadow-2xl" style={{ top: "72px", right: "16px", width: "270px" }}>

          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold flex items-center gap-2">
              <Ruler className="w-4 h-4 text-yellow-400" />
              Herramienta de medición
            </p>
            <button onClick={onClosePanel} className="text-white/50 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Calibración ──────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-white/50 text-[10px] uppercase tracking-wider">Escala de referencia</p>

            {/* Horizontal */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                hasH ? "border-white/20 bg-white/5 text-white/70" : "border-white/10 text-white/30"
              )}>
                <ArrowLeftRight className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {calibration?.metersPerRadH
                    ? `${calibration.metersPerRadH.toFixed(2)} m/rad`
                    : "Sin calibrar"}
                </span>
              </div>
              {!isCalibMode || calibAxis !== "H" ? (
                <button onClick={() => startCalib("H")}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-white/70 text-xs
                             rounded-lg border border-white/15 transition-colors whitespace-nowrap">
                  {hasH ? "Recal." : "Calibrar"}
                </button>
              ) : (
                <button onClick={resetCalib} className="px-2.5 py-1.5 text-white/40 hover:text-white/70 text-xs">
                  Cancelar
                </button>
              )}
            </div>

            {/* Calibration input for H */}
            {calibAxis === "H" && awaitingSecondCalib && calibSph2 && (
              <div className="flex gap-2 items-center pl-1">
                <input type="number" value={realDist}
                  onChange={(e) => setRealDist(e.target.value)}
                  className="flex-1 bg-white/10 text-white text-sm px-2 py-1.5 rounded border
                             border-white/20 focus:outline-none focus:border-yellow-400"
                  placeholder="ancho en metros" min="0.01" step="0.01" autoFocus />
                <span className="text-white/50 text-xs">m</span>
                <button onClick={confirmCalib}
                  className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded text-white flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Vertical */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                hasV ? "border-white/20 bg-white/5 text-white/70" : "border-white/10 text-white/30"
              )}>
                <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {calibration?.metersPerRadV
                    ? `${calibration.metersPerRadV.toFixed(2)} m/rad`
                    : "Sin calibrar"}
                </span>
              </div>
              {!isCalibMode || calibAxis !== "V" ? (
                <button onClick={() => startCalib("V")}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-white/70 text-xs
                             rounded-lg border border-white/15 transition-colors whitespace-nowrap">
                  {hasV ? "Recal." : "Calibrar"}
                </button>
              ) : (
                <button onClick={resetCalib} className="px-2.5 py-1.5 text-white/40 hover:text-white/70 text-xs">
                  Cancelar
                </button>
              )}
            </div>

            {/* Calibration input for V */}
            {calibAxis === "V" && awaitingSecondCalib && calibSph2 && (
              <div className="flex gap-2 items-center pl-1">
                <input type="number" value={realDist}
                  onChange={(e) => setRealDist(e.target.value)}
                  className="flex-1 bg-white/10 text-white text-sm px-2 py-1.5 rounded border
                             border-white/20 focus:outline-none focus:border-yellow-400"
                  placeholder="alto en metros" min="0.01" step="0.01" autoFocus />
                <span className="text-white/50 text-xs">m</span>
                <button onClick={confirmCalib}
                  className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded text-white flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <p className="text-white/30 text-[10px] leading-tight">
              Calibrá ancho con una referencia horizontal y alto con una vertical. El sistema elige la escala según la dirección de cada medición.
            </p>
          </div>

          {/* ── Medición ─────────────────────────────────── */}
          {hasAny && (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <p className="text-white/50 text-[10px] uppercase tracking-wider">Medir</p>

              {measurement ? (
                <div className="space-y-2">
                  <div className="bg-yellow-400/15 border border-yellow-400/30 rounded-lg px-3 py-3 text-center">
                    <p className="text-yellow-400 text-2xl font-bold">{measurement.meters.toFixed(2)} m</p>
                    <p className="text-yellow-400/60 text-[10px] mt-0.5">
                      {measurement.direction === "V" ? "↕ medición vertical"
                       : measurement.direction === "H" ? "↔ medición horizontal"
                       : "↗ medición diagonal"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={startMeasure}
                      className="flex-1 text-xs py-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30
                                 text-yellow-400 border border-yellow-400/30 transition-colors">
                      Nueva medición
                    </button>
                    <button onClick={clearMeasurement}
                      className="p-2 text-white/40 hover:text-white/70 hover:bg-white/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : isMeasMode ? (
                <div className="space-y-2">
                  <p className="text-yellow-400 text-xs">
                    {mode === "meas1" ? "→ Tocá el punto A en la foto" : "→ Tocá el punto B en la foto"}
                  </p>
                  <button onClick={clearMeasurement}
                    className="text-white/40 hover:text-white/70 text-xs">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={startMeasure}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400/20
                             hover:bg-yellow-400/30 text-yellow-400 text-xs py-2.5 rounded-lg
                             border border-yellow-400/30 transition-colors">
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
