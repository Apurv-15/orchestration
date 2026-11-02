import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DASHBOARD_ROW, DASHBOARD_WIDTH, ReplyTrendPanel } from "@/components/demo/dashboard-widgets";
import { PlotReveal } from "@/components/plot-reveal";
import { cn } from "@/lib/cn";

/**
 * Pocket Dashboard: a loading state that sketches the dashboard in blue pencil, morphs each sketch to the real data,
 * then fills in the UI. Settings: normal speed, 1500ms between charts, data arrives straight away, morph on, labels off.
 */

/** Gap between one chart's reveal starting and the next, top left first down to bottom right. */
const STAGGER = 1500;
/** The charts wait this long so the page header is sketched first. */
const HEADER_LEAD = 500;
/** The pencil's leader lines and spec tags. They hang off each card's right side, over its neighbour, so they're off. */
const LABELS = false;
/** Sketch each chart with generic data, then morph the pencil to the real numbers before it fills in. */
const MORPH = true;

/** Page header (56) + gap (24) + trend (300) + gap (16) + row of tiles (372). Everything is scaled from this size. */
const DASHBOARD_HEIGHT = 768;
const MAX_SCALE = 1.25;

/**
 * Scales the dashboard to fill the space it's given, so it frames the same on any screen.
 * The pencil layer lives inside the scaled box and measure.ts is scale-aware, so the drawing stays registered.
 */
const useFitScale = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Layout effect: fit before the first paint, so the page never shows a frame at the wrong size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / DASHBOARD_WIDTH, el.clientHeight / DASHBOARD_HEIGHT, MAX_SCALE));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, scale] as const;
};

const Icon = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("size-4 shrink-0", className)}
  >
    {children}
  </svg>
);

type StaggeredProps = { delay: number; layer: number; children: ReactNode };

/**
 * Holds a chart's space (invisible), then starts its reveal after `delay`.
 * `layer` stacks earlier charts above later ones, so a chart's labels would sit over its right-hand neighbour, not under it.
 */
const Staggered = ({ delay, layer, children }: StaggeredProps) => {
  const [started, setStarted] = useState(delay === 0);

  useEffect(() => {
    if (started) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay, started]);

  return started ? (
    <div className="relative w-fit" style={{ zIndex: layer }}>
      <PlotReveal annotate={LABELS} morph={MORPH} ready className="w-fit">
        {children}
      </PlotReveal>
    </div>
  ) : (
    <div className="invisible w-fit">{children}</div>
  );
};

const TABS = [
  { label: "Overview", active: true },
  { label: "Pipeline" },
  { label: "Inbox", count: 12 },
  { label: "Contacts" },
  { label: "Reports" },
];

const TopBar = () => (
  <header className="relative z-10 flex h-16 shrink-0 items-center gap-10 border-b border-line bg-card px-8">
    <p className="flex items-center gap-1.5 text-[18px] leading-none font-medium tracking-[-0.3px]">
      <span>Pocket</span>
      <img src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/1abf8d43-4b9f-4b9a-ba3a-78fffbc3d078/brand-assets/pocket-studio-logo/pocket-studio.svg" alt="" width={14} height={22} className="h-[22px] w-auto" />
      <span>Studio</span>
    </p>

    <nav className="flex items-center gap-1">
      {TABS.map((tab) => (
        <span
          key={tab.label}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] font-medium",
            tab.active ? "bg-well text-ink" : "text-mid",
          )}
        >
          {tab.label}
          {tab.count && <span className="text-[12px] text-muted tabular-nums">{tab.count}</span>}
        </span>
      ))}
    </nav>

    <span className="ml-auto flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg text-mid">
        <Icon>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </Icon>
      </span>
      <img src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/1abf8d43-4b9f-4b9a-ba3a-78fffbc3d078/brand-assets/avatar/avatar.jpg" alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
    </span>
  </header>
);

/** Title and date range, sketched in pencil before any chart. */
const PageHeader = () => (
  <div className="flex h-14 items-center justify-between">
    <PlotReveal annotate={false} className="w-fit">
      <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">
        <span data-plot="">Pocket Dashboard</span>
      </h1>
    </PlotReveal>
    <PlotReveal annotate={false} className="w-fit">
      <span
        data-plot-frame
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-[13px] font-medium text-mid"
      >
        <span data-plot="" data-plot-kind="image">
          <Icon>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </Icon>
        </span>
        <span data-plot="">Last 7 days</span>
      </span>
    </PlotReveal>
  </div>
);

export const App = () => {
  // Bumping `run` remounts every PlotReveal (new keys), which replays the whole reveal.
  const [run, setRun] = useState(1);
  const [fitRef, scale] = useFitScale();

  return (
    <main className="relative flex h-svh flex-col overflow-hidden bg-card text-ink">
      <TopBar />

      <section ref={fitRef} className="relative m-8 flex min-h-0 flex-1 justify-center">
        <div style={{ width: DASHBOARD_WIDTH * scale, height: DASHBOARD_HEIGHT * scale }}>
          <div className="origin-top-left" style={{ width: DASHBOARD_WIDTH, height: DASHBOARD_HEIGHT, transform: `scale(${scale})` }}>
            <PageHeader key={`header-${run}`} />
            <div className="mt-6 flex flex-col gap-4">
              <Staggered key={`trend-${run}`} delay={HEADER_LEAD} layer={DASHBOARD_ROW.length + 1}>
                <ReplyTrendPanel />
              </Staggered>
              <div className="flex gap-4">
                {DASHBOARD_ROW.map(({ id, Component }, i) => (
                  <Staggered key={`${id}-${run}`} delay={HEADER_LEAD + (i + 1) * STAGGER} layer={DASHBOARD_ROW.length - i}>
                    <Component />
                  </Staggered>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="fixed right-5 bottom-5 z-50 flex h-10 items-center gap-2 rounded-full bg-ink pr-5 pl-4 text-[14px] font-medium text-paper shadow-[0_2px_8px_rgb(2_6_23/0.12),0_16px_40px_-12px_rgb(2_6_23/0.3)] transition-transform active:scale-95"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Replay
      </button>
    </main>
  );
};
