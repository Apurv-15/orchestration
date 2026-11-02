import { collectDetails, type Detail } from "./details";

export type Rect = { x: number; y: number; w: number; h: number };

export type PlotKind = "text" | "image" | "box";

export type PlotItem = Rect & {
  label: string;
  spec: string;
  kind: PlotKind;
  radius: number;
  measure: boolean;
  /** No plotted elements inside it, so it gets hatched. */
  leaf: boolean;
  el: HTMLElement;
  /** The element's full box (text items are boxed by their ink, but lettered at this). */
  outer: Rect;
};

export type Plot = {
  frame: Rect & { radius: number };
  /** The UI's own surface (the card), revealed first in the hi-fi stage. */
  surface: HTMLElement | null;
  /** Pass one: the layout boxes. */
  items: PlotItem[];
  /** Pass two: every shape, line and run of text inside them. */
  details: Detail[];
};

const TEXT_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "SPAN", "LABEL", "SMALL", "STRONG", "B", "DT", "DD", "TD", "TH"]);
const IMAGE_TAGS = new Set(["IMG", "SVG", "CANVAS", "VIDEO", "PICTURE"]);

/** `scale` undoes any transform on an ancestor: the drawing lives in the frame's local space. */
const relative = (r: DOMRect, origin: DOMRect, scale: number): Rect => ({
  x: (r.left - origin.left) / scale,
  y: (r.top - origin.top) / scale,
  w: r.width / scale,
  h: r.height / scale,
});

const radiusOf = (el: Element) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;

const kindOf = (el: HTMLElement): PlotKind => {
  const declared = el.dataset.plotKind;
  if (declared === "text" || declared === "image" || declared === "box") return declared;
  if (IMAGE_TAGS.has(el.tagName.toUpperCase()) || el.getAttribute("role") === "img") return "image";
  if (TEXT_TAGS.has(el.tagName) && el.textContent?.trim()) return "text";
  return "box";
};

/** The ink of a text element: its laid-out lines, not the full block. */
const inkRect = (el: HTMLElement, origin: DOMRect, scale: number) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = relative(range.getBoundingClientRect(), origin, scale);
  range.detach();
  return rect;
};

const specOf = (el: HTMLElement, kind: PlotKind, r: Rect) => {
  if (kind !== "text") return `${Math.round(r.w)}×${Math.round(r.h)}`;
  const cs = getComputedStyle(el);
  return `${Math.round(parseFloat(cs.fontSize))}/${cs.fontWeight}`;
};

/** Measure the frame and every `[data-plot]` element inside it, relative to the frame. */
export const measure = (root: HTMLElement): Plot => {
  const origin = root.getBoundingClientRect();
  const scale = origin.width / root.offsetWidth || 1;
  const surface = root.querySelector<HTMLElement>("[data-plot-frame]") ?? (root.firstElementChild?.firstElementChild as HTMLElement | null);

  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-plot]"))
    .filter((el) => el.checkVisibility())
    .map((el): PlotItem => {
      const kind = kindOf(el);
      const outer = relative(el.getBoundingClientRect(), origin, scale);
      const box = kind === "text" ? inkRect(el, origin, scale) : outer;
      return {
        ...box,
        outer,
        kind,
        el,
        label: el.dataset.plot ?? "",
        spec: specOf(el, kind, box),
        radius: kind === "text" ? 0 : radiusOf(el),
        measure: "plotMeasure" in el.dataset,
        leaf: !el.querySelector("[data-plot]"),
      };
    });

  const content = (root.querySelector<HTMLElement>(".plot-content") ?? root) as HTMLElement;
  return {
    frame: { x: 0, y: 0, w: root.offsetWidth, h: root.offsetHeight, radius: surface ? radiusOf(surface) : 0 },
    surface,
    items,
    details: collectDetails(content, origin, scale, surface),
  };
};
