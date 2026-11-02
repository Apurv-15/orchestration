import type { ReactNode } from "react";
import { usePlotPhase } from "@/components/plot-reveal";
import { cn } from "@/lib/cn";

/**
 * Film two's widgets. They follow metric-widgets.tsx but stay on one blue ramp and are sized for the dashboard:
 * a full-width trend over a row of four. Kept apart so the filmed originals don't change.
 *
 * Each chart reads usePlotPhase: while it's sketched it shows generic data (bars at the average, a flat line,
 * equal segments), so the pencil visibly adjusts to the real numbers before they fill in.
 */

/** The dashboard is laid out at this width, then scaled to fit the screen (see film-two.tsx). */
export const DASHBOARD_WIDTH = 1312;
const GAP = 16;
const TILE_W = (DASHBOARD_WIDTH - GAP * 3) / 4;

type PanelProps = { width: number; className?: string; children: ReactNode };

const Panel = ({ width, className, children }: PanelProps) => (
  <article
    data-plot-frame
    className={cn("flex flex-col rounded-xl border border-line bg-card p-6 shadow-[0_2px_8px_rgb(2_6_23/0.06)]", className)}
    style={{ width }}
  >
    {children}
  </article>
);

const Info = () => (
  <span
    data-plot=""
    data-plot-kind="image"
    className="grid size-3.5 place-items-center rounded-full border-[1.5px] border-muted text-[9px] leading-none font-semibold text-muted"
  >
    i
  </span>
);

const Title = ({ children }: { children: ReactNode }) => (
  <h3 className="flex items-center gap-1.5 text-[16px] leading-6 font-semibold">
    <span data-plot="title">{children}</span>
    <Info />
  </h3>
);

/** Every number in a figure: "$486,200", "4m 32s", "3.4", "15%". */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/**
 * Figures are data too: while the chart is sketched each number reads zero, in its real format ("$0", "0m 0s", "0.0"),
 * and the pencil counts it up to the real value in the morph. Labels stay as they are.
 */
const useFigure = () => {
  const sketch = usePlotPhase() === "sketch";
  return (real: string) =>
    sketch ? real.replace(NUMBER, (n) => (n.includes(".") ? `0.${"0".repeat(n.split(".")[1].length)}` : "0")) : real;
};

const Metric = ({ value, change, down }: { value: string; change: string; down?: boolean }) => {
  const figure = useFigure();
  return (
    <p className="flex items-center gap-2.5">
      <span data-plot="metric" className="text-[30px] leading-9 font-bold tracking-[-0.02em] tabular-nums">
        {figure(value)}
      </span>
      <span data-plot="change" className="rounded-md bg-positive-soft px-1.5 py-0.5 text-[13px] leading-4 font-semibold text-positive">
        {figure(`${down ? "↘" : "↗"} ${change}`)}
      </span>
    </p>
  );
};

const Previous = ({ value, className }: { value: string; className: string }) => {
  const figure = useFigure();
  return (
    <p data-plot="previous" className={cn("text-[13px] leading-5 text-mid", className)}>
      {figure(`${value} previous period`)}
    </p>
  );
};

type TileProps = { title: string; value: string; change: string; previous: string; children: ReactNode };

/** A row tile: title, number with change chip, previous period, chart pinned to the bottom. */
const Tile = ({ title, value, change, previous, children }: TileProps) => (
  <Panel className="h-[372px]" width={TILE_W}>
    <Title>{title}</Title>
    <div className="mt-5">
      <Metric value={value} change={change} />
    </div>
    <Previous value={previous} className="mt-1.5" />
    <div className="mt-auto">{children}</div>
  </Panel>
);

const Legend = ({ items }: { items: { label: string; count: string; dot: string }[] }) => {
  const figure = useFigure();
  return (
    <div className="mt-2.5 flex gap-4 text-[12px] leading-4 text-ink/80">
      {items.map((it) => (
        <span key={it.label} data-plot="" className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", it.dot)} />
          {figure(`${it.label} ${it.count}`)}
        </span>
      ))}
    </div>
  );
};

/* The trend: one sample per half day across the week, as heights in chart units (higher is slower). */
const CHART_W = DASHBOARD_WIDTH - 48;
const CHART_H = 150;
const THIS_PERIOD = [74, 70, 76, 64, 60, 66, 54, 50, 56, 46, 42, 46, 38, 34];
const LAST_PERIOD = [56, 60, 52, 58, 50, 54, 48, 52, 46, 50, 44, 48, 42, 46];
const DAYS = ["Fri 23", "Sat 24", "Sun 25", "Mon 26", "Tue 27", "Wed 28", "Thu 29"];

/** A smooth path through evenly spaced points: each segment eases out of one point and into the next. */
const smoothPath = (ys: number[]) => {
  const step = CHART_W / (ys.length - 1);
  return ys.reduce((d, y, i) => {
    if (i === 0) return `M0 ${CHART_H - y * 1.6}`;
    const x = i * step;
    const mid = x - step / 2;
    const prev = CHART_H - ys[i - 1] * 1.6;
    return `${d} C${mid} ${prev} ${mid} ${CHART_H - y * 1.6} ${x} ${CHART_H - y * 1.6}`;
  }, "");
};

const average = (ys: number[]) => ys.map(() => ys.reduce((a, b) => a + b, 0) / ys.length);

/** Full-width hero: the headline number sits top right and the line runs edge to edge underneath. */
export const ReplyTrendPanel = () => {
  const sketch = usePlotPhase() === "sketch";
  const current = sketch ? average(THIS_PERIOD) : THIS_PERIOD;
  const previous = sketch ? average(LAST_PERIOD) : LAST_PERIOD;
  const thisPath = smoothPath(current);
  const lastY = CHART_H - current[current.length - 1] * 1.6;
  return (
    <Panel className="h-[300px]" width={DASHBOARD_WIDTH}>
      <div className="flex items-start justify-between">
        <div>
          <Title>Median reply time</Title>
          <p className="mt-1 flex items-center gap-4 text-[13px] leading-5 text-mid">
            <span data-plot="">Across every channel</span>
            <span data-plot="" className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-4" />
              This period
            </span>
            <span data-plot="" className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-previous" />
              Previous period
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end">
          <Metric value="4m 32s" change="15%" down />
          <Previous value="5m 20s" className="mt-1" />
        </div>
      </div>

      <svg
        data-plot="trend"
        data-plot-kind="box"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="mt-auto block overflow-visible"
        style={{ width: CHART_W, height: CHART_H }}
      >
        <defs>
          <linearGradient id="trend-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--blue-4)" stopOpacity=".18" />
            <stop offset="1" stopColor="var(--blue-4)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={CHART_W} y1={CHART_H * f} y2={CHART_H * f} stroke="var(--line)" />
        ))}
        <path d={smoothPath(previous)} fill="none" stroke="var(--previous)" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={`${thisPath} V${CHART_H} H0 Z`} fill="url(#trend-fade)" />
        <path d={thisPath} fill="none" stroke="var(--blue-4)" strokeWidth="2" />
        <circle cx={CHART_W} cy={lastY} r="4" fill="var(--blue-4)" stroke="var(--card)" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex justify-between text-[12px] leading-4 text-mid">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </Panel>
  );
};

const STAGES = [
  { stage: "Leads", count: 1284 },
  { stage: "Qualified", count: 846 },
  { stage: "Proposal", count: 412 },
  { stage: "Won", count: 86 },
];
/** Deepens stage by stage, the same ramp the other tiles use. */
const STAGE_FILLS = ["bg-blue-2", "bg-blue-3", "bg-blue-4", "bg-blue-5"];
const BARS_H = 112;
const RAMP_W = 10;
/** Matches the bars' rounded-t-lg: each connector leaves a bar where its corner curve ends and meets the next where its curve begins. */
const BAR_R = 8;
const barHeight = (count: number) => Math.max(BAR_R + 4, Math.round((count / STAGES[0].count) * BARS_H));
/** Sketched before the counts are known: every stage the same height. */
const SKETCH_BAR = Math.round(BARS_H * 0.6);

/**
 * A stepped funnel: one column per stage, split by hairlines. Each bar steps down to the next through a sloped
 * connector, so the drop-off reads as a shape rather than a number.
 */
export const PipelineTile = () => {
  const height = usePlotPhase() === "sketch" ? () => SKETCH_BAR : barHeight;
  const figure = useFigure();
  return (
    <Tile title="Pipeline value" value="$486,200" change="15%" previous="$422,800">
      <div data-plot="funnel" className="flex">
        {STAGES.map((s, i) => {
          const next = STAGES[i + 1];
          const h = height(s.count);
          return (
            <div key={s.stage} className="flex flex-1 flex-col border-l border-line">
              <div className="px-1.5">
                <span data-plot="" className="block text-[11px] leading-4 text-muted">
                  {s.stage}
                </span>
                <b data-plot="" className="mt-0.5 block text-[15px] leading-5 font-semibold tabular-nums">
                  {figure(s.count.toLocaleString("en-US"))}
                </b>
              </div>
              <div className="mt-3 flex items-end" style={{ height: BARS_H }}>
                <div data-plot="" className={cn("hatch flex-1 rounded-t-lg", STAGE_FILLS[i])} style={{ height: h }} />
                {next && (
                  <svg aria-hidden viewBox={`0 0 ${RAMP_W} ${BARS_H}`} className="block shrink-0" style={{ width: RAMP_W, height: BARS_H }}>
                    <polygon
                      points={`0,${BARS_H - h + BAR_R} ${RAMP_W},${BARS_H - height(next.count) + BAR_R} ${RAMP_W},${BARS_H} 0,${BARS_H}`}
                      fill="var(--blue-1)"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Tile>
  );
};

const SOURCES = [
  { label: "Referrals", share: 32, fill: "bg-blue-5" },
  { label: "Website", share: 24, fill: "bg-blue-4" },
  { label: "LinkedIn", share: 18, fill: "bg-blue-3" },
  { label: "Google ads", share: 11, fill: "bg-blue-2" },
  { label: "Events", share: 6, fill: "bg-blue-1" },
  { label: "Other", share: 9, fill: "bg-well" },
];

/** Where leads came from: a striped stacked bar, then the breakdown as a list. */
export const LeadSourcesTile = () => {
  const sketch = usePlotPhase() === "sketch";
  const figure = useFigure();
  return (
    <Tile title="Lead sources" value="1,284" change="12%" previous="1,146">
      <div data-plot="mix" className="flex h-6 gap-1">
        {SOURCES.map((s) => (
          <span
            key={s.label}
            className={cn("rounded-md", s.fill, s.label !== "Other" && "hatch")}
            style={{ flexGrow: sketch ? 1 : s.share }}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-1 text-[13px] leading-5">
        {SOURCES.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span className={cn("size-2.5 shrink-0 rounded-[3px]", s.fill)} />
            <span data-plot="">{s.label}</span>
            <span data-plot="" className="ml-auto text-mid tabular-nums">
              {figure(`${s.share}%`)}
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
};

/** Share of clients per touchpoint bucket, as a bar height in %. */
const TOUCHES = [38, 68, 84, 60, 32, 18, 14];
/** The bucket the 3.4 average falls in. */
const TOUCH_PEAK = 2;
const TOUCH_LABELS = ["1", "2", "3", "4", "5", "6", "7+"];

export const TouchpointsTile = () => {
  const sketch = usePlotPhase() === "sketch";
  return (
    <Tile title="Touchpoints per client" value="3.4" change="10%" previous="3.1">
      <div data-plot="columns" className="flex h-[150px] items-end gap-2">
        {TOUCHES.map((h, i) => (
          <div key={i} className="flex h-full flex-1 items-end rounded-[10px] bg-well">
            <div
              data-plot=""
              className={cn("w-full rounded-[10px]", i === TOUCH_PEAK ? "bg-blue-4" : "bg-blue-2")}
              style={{ height: `${sketch ? 50 : h}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex text-[12px] leading-4 text-mid">
        {TOUCH_LABELS.map((l) => (
          <span key={l} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </div>
    </Tile>
  );
};

/** Enquiries per hour of the day, as a bar height in %. */
const HOURS = [18, 14, 6, 6, 6, 8, 14, 26, 38, 64, 70, 80, 78, 72, 68, 66, 64, 56, 60, 70, 76, 62, 44, 28];
/** Office hours are 9 am to 5 pm. Each bar gets exactly one colour: `cn` doesn't dedupe, so two bg classes fight. */
const isOfficeHour = (hour: number) => hour >= 9 && hour < 17;

export const AfterHoursTile = () => {
  const sketch = usePlotPhase() === "sketch";
  return (
    <Tile title="After-hours enquiries" value="60%" change="4%" previous="56%">
      <div data-plot="by hour" className="flex h-[118px] items-end gap-[3px]">
        {HOURS.map((h, i) => (
          <i
            key={i}
            className={cn("block flex-1 rounded-[3px]", isOfficeHour(i) ? "bg-blue-4" : "bg-blue-2")}
            style={{ height: `${sketch ? 45 : h}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] leading-4 text-mid">
        <span>12 am</span>
        <span>9 am</span>
        <span>5 pm</span>
        <span>12 am</span>
      </div>
      <Legend
        items={[
          { label: "Office hours", count: "96", dot: "bg-blue-4" },
          { label: "After hours", count: "147", dot: "bg-blue-2" },
        ]}
      />
    </Tile>
  );
};

export const DASHBOARD_ROW = [
  { id: "pipeline", Component: PipelineTile },
  { id: "lead-sources", Component: LeadSourcesTile },
  { id: "touchpoints", Component: TouchpointsTile },
  { id: "after-hours", Component: AfterHoursTile },
];
