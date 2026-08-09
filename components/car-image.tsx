import { cn } from '@/lib/utils'
import type { BodyType } from '@/lib/data/catalog'

/**
 * Car illustration.
 *
 * Placeholder art, deliberately. There are no licensed photos of these models in
 * the repo, and hotlinking manufacturer press images would break the moment a URL
 * rotates. A flat side profile reads as intentional design rather than as a
 * missing asset.
 *
 * The shape is generated from proportions rather than hand-drawn paths, so the
 * five body types are actually distinguishable: an SUV sits higher on bigger
 * wheels than a sedan, an MPV has one long roofline, a city car is short with an
 * upright greenhouse. Hand-tuned paths drifted towards looking like the same
 * sedan five times, which is exactly the "every card is identical" problem.
 *
 * Colour follows the 60/20/20 budget: ink body on white, red reserved for the
 * tail lamp and the floor glow. Per-brand colour was removed on purpose — twelve
 * brand hues on one page is what broke the palette.
 *
 * When real photography arrives, add `photoUrl` to the catalog entry and render
 * next/image here, falling back to this silhouette.
 */

type Proportions = {
  /** Rear bumper / front bumper on a 400-wide viewBox. */
  rear: number
  front: number
  /** Roofline start and end, and its height. Lower y = taller car. */
  roofRear: number
  roofFront: number
  roofY: number
  /** Beltline: where the glass ends and the body begins. */
  beltRearY: number
  beltFrontY: number
  /** Where the windscreen meets the hood. */
  hood: number
  wheelRadius: number
  wheelRear: number
  wheelFront: number
}

const BASE_Y = 140

const PROPORTIONS: Record<BodyType, Proportions> = {
  // Short, upright, tiny overhangs — an Air ev, not a shrunken sedan.
  citycar: {
    rear: 122,
    front: 300,
    roofRear: 152,
    roofFront: 226,
    roofY: 60,
    beltRearY: 98,
    beltFrontY: 98,
    hood: 254,
    wheelRadius: 21,
    wheelRear: 158,
    wheelFront: 268,
  },
  // Longer than a city car, roof falls straight into a stubby tail.
  hatchback: {
    rear: 88,
    front: 332,
    roofRear: 128,
    roofFront: 232,
    roofY: 66,
    beltRearY: 100,
    beltFrontY: 98,
    hood: 268,
    wheelRadius: 22,
    wheelRear: 134,
    wheelFront: 292,
  },
  // Three-box: the rear deck runs flat well past the back glass.
  sedan: {
    rear: 70,
    front: 344,
    roofRear: 138,
    roofFront: 224,
    roofY: 74,
    beltRearY: 104,
    beltFrontY: 100,
    hood: 262,
    wheelRadius: 22,
    wheelRear: 126,
    wheelFront: 302,
  },
  // Tall body, big wheels, visible ground clearance.
  suv: {
    rear: 78,
    front: 338,
    roofRear: 124,
    roofFront: 250,
    roofY: 50,
    beltRearY: 92,
    beltFrontY: 90,
    hood: 280,
    wheelRadius: 27,
    wheelRear: 132,
    wheelFront: 292,
  },
  // One-box: roof starts almost at the tailgate and runs nearly to the screen.
  mpv: {
    rear: 74,
    front: 342,
    roofRear: 106,
    roofFront: 258,
    roofY: 48,
    beltRearY: 92,
    beltFrontY: 94,
    hood: 292,
    wheelRadius: 23,
    wheelRear: 130,
    wheelFront: 298,
  },
}

function bodyPath(p: Proportions): string {
  return [
    `M${p.rear} ${BASE_Y}`,
    `V${p.beltRearY + 6}`,
    `Q${p.rear} ${p.beltRearY} ${p.rear + 10} ${p.beltRearY}`,
    `L${p.roofRear} ${p.roofY + 6}`,
    `Q${p.roofRear + 4} ${p.roofY} ${p.roofRear + 14} ${p.roofY}`,
    `H${p.roofFront}`,
    `Q${p.roofFront + 10} ${p.roofY} ${p.roofFront + 16} ${p.roofY + 8}`,
    `L${p.hood} ${p.beltFrontY}`,
    `H${p.front - 14}`,
    `Q${p.front} ${p.beltFrontY} ${p.front} ${p.beltFrontY + 14}`,
    `V${BASE_Y}`,
    'Z',
  ].join(' ')
}

/** Two windows, split by a B-pillar, inset from the body outline. */
function glassPaths(p: Proportions): [string, string] {
  const pillar = p.roofRear + (p.roofFront - p.roofRear) * 0.48
  const top = p.roofY + 9
  const bottom = Math.min(p.beltRearY, p.beltFrontY) - 8

  const rear = [
    `M${p.roofRear + 14} ${top}`,
    `H${pillar - 5}`,
    `V${bottom}`,
    `H${p.rear + 22}`,
    'Z',
  ].join(' ')

  const front = [
    `M${pillar + 5} ${top}`,
    `H${p.roofFront - 2}`,
    `L${p.hood - 6} ${bottom}`,
    `H${pillar + 5}`,
    'Z',
  ].join(' ')

  return [rear, front]
}

export function CarImage({
  bodyType,
  brandName,
  alt,
  className,
}: {
  bodyType: BodyType
  /** Rendered as a large ghosted watermark so cards stay tellable apart. */
  brandName: string
  alt: string
  className?: string
}) {
  const p = PROPORTIONS[bodyType]
  const [rearGlass, frontGlass] = glassPaths(p)

  return (
    <div
      className={cn(
        'relative aspect-[16/10] w-full overflow-hidden bg-white',
        // A single soft red wash anchored bottom-right: the only red on the
        // image, and it doubles as the light source for the shadow below.
        '[background-image:radial-gradient(90%_70%_at_78%_92%,rgba(212,0,0,0.10),transparent_62%)]',
        className,
      )}
    >
      <svg viewBox="0 0 400 180" role="img" aria-label={alt} className="absolute inset-0 size-full">
        <text
          x="200"
          y="118"
          textAnchor="middle"
          className="fill-foreground/[0.045] font-heading"
          style={{ fontSize: 92, fontWeight: 700, letterSpacing: '-0.04em' }}
          aria-hidden="true"
        >
          {brandName.toUpperCase()}
        </text>

        <ellipse cx="204" cy="152" rx="132" ry="7" className="fill-foreground/10" />

        <path d={bodyPath(p)} className="fill-foreground" />
        <path d={rearGlass} className="fill-white/25" />
        <path d={frontGlass} className="fill-white/25" />

        {/* Tail lamp — the one red detail on the car itself. */}
        <rect
          x={p.rear + 2}
          y={p.beltRearY + 10}
          width="7"
          height="12"
          rx="2"
          fill="var(--color-primary)"
        />

        {[p.wheelRear, p.wheelFront].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={BASE_Y} r={p.wheelRadius} className="fill-foreground" />
            <circle
              cx={cx}
              cy={BASE_Y}
              r={p.wheelRadius * 0.44}
              className="fill-white"
              fillOpacity="0.9"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
