import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { measure, type Plot } from "./measure";
import { PlotLayer } from "./plot-layer";

export type PlotStage = "measuring" | "plotting" | "morphing" | "waiting" | "resolving" | "done";

/** What the UI inside should show: generic placeholder data while it's sketched, then its real data. */
export type PlotPhase = "sketch" | "real";

const PhaseContext = createContext<PlotPhase>("real");

/** For UI inside a `morph` PlotReveal: render generic data in "sketch" (bars at the average, a flat line), real data in "real". */
export const usePlotPhase = () => useContext(PhaseContext);

export type PlotRevealProps = {
  /** Data has arrived. The drawing always finishes first, then holds (breathing) until this is true. */
  ready?: boolean;
  /** Tag drawn under the frame, e.g. "Invoice card". */
  label?: string;
  /** Leader lines and spec tags beside the frame for labelled elements. Off gives a centred, quieter drawing. */
  annotate?: boolean;
  /**
   * Sketch the UI with generic data first (see usePlotPhase), then morph every pencil box and line to the real
   * layout before the UI fills in. Slower, but shows the drawing adjusting to the data.
   */
  morph?: boolean;
  className?: string;
  children: ReactNode;
  onStageChange?: (stage: PlotStage) => void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/**
 * A loading state that drafts the UI before it arrives. Every `[data-plot]` element inside is
 * measured from the real layout, then boxed, hatched, annotated and lettered in blue pencil.
 * Once the drawing is done and `ready` is true, the real UI comes in element by element and the pencil clears with it.
 * Remount (change `key`) to replay.
 */
export const PlotReveal = ({ ready = true, label, annotate = true, morph = false, className, children, onStageChange }: PlotRevealProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<PlotStage>("measuring");
  const [phase, setPhase] = useState<PlotPhase>(morph ? "sketch" : "real");
  const [plot, setPlot] = useState<Plot | null>(null);
  const [target, setTarget] = useState<Plot | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [morphed, setMorphed] = useState(!morph);
  const stageListener = useRef(onStageChange);

  useEffect(() => {
    stageListener.current = onStageChange;
  }, [onStageChange]);

  useEffect(() => {
    stageListener.current?.(stage);
  }, [stage]);

  const measureLabelled = useCallback(
    (root: HTMLElement) => {
      const measured = measure(root);
      return annotate ? measured : { ...measured, items: measured.items.map((it) => ({ ...it, label: "" })) };
    },
    [annotate],
  );

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("real");
      setStage("done");
      return;
    }
    let alive = true;
    (async () => {
      await Promise.race([document.fonts.ready, wait(1200)]);
      await nextFrame();
      if (!alive || !rootRef.current) return;
      setPlot(measureLabelled(rootRef.current));
      setStage("plotting");
    })();
    return () => {
      alive = false;
    };
  }, [measureLabelled]);

  // Morph: once the sketch is drawn, swap in the real data (still hidden), measure it, and let the layer move the pencil there.
  useEffect(() => {
    if (!drawn) return;
    if (!morphed) {
      setStage("morphing");
      setPhase("real");
      return;
    }
    setStage(ready ? "resolving" : "waiting");
  }, [drawn, ready, morphed]);

  useLayoutEffect(() => {
    if (!morph || phase !== "real" || !plot || target || !rootRef.current) return;
    setTarget(measureLabelled(rootRef.current));
  }, [morph, phase, plot, target, measureLabelled]);

  const handleDrawn = useCallback(() => setDrawn(true), []);
  const handleMorphed = useCallback(() => setMorphed(true), []);
  const handleDone = useCallback(() => setStage("done"), []);

  return (
    <div ref={rootRef} data-plot-state={stage} className={cn("plot-root relative isolate", className)}>
      <PhaseContext.Provider value={phase}>
        <div className="plot-content">{children}</div>
      </PhaseContext.Provider>
      {plot && stage !== "done" && (
        <PlotLayer
          plot={plot}
          target={target}
          label={label}
          ready={ready && morphed}
          morph={morph}
          onDrawn={handleDrawn}
          onMorphed={handleMorphed}
          onDone={handleDone}
        />
      )}
    </div>
  );
};
