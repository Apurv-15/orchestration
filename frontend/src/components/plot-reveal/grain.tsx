import type { Rect } from "./measure";

type GrainProps = { id: string; region: Rect };

/**
 * Pencil grain: a fine noise field nudges each line off true (displacement) and wears it
 * unevenly (alpha), so strokes read as drawn rather than rendered. The region is in user
 * space because a straight line's bounding box has zero height and would be dropped.
 */
export const Grain = ({ id, region }: GrainProps) => (
  <filter
    id={id}
    filterUnits="userSpaceOnUse"
    x={region.x}
    y={region.y}
    width={region.w}
    height={region.h}
    colorInterpolationFilters="sRGB"
  >
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={7} result="grain" />
    <feDisplacementMap in="SourceGraphic" in2="grain" scale={1.8} xChannelSelector="R" yChannelSelector="G" result="wavered" />
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 0.15" result="wear" />
    <feComposite in="wavered" in2="wear" operator="in" />
  </filter>
);
