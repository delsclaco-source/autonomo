import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Star rating.
 *
 * The numeric value is always rendered as text beside the stars by the caller —
 * colour and icon count are not accessible on their own, and a screen-reader user
 * should not have to infer a rating from decorative glyphs. Hence aria-hidden
 * here: this is the visual half of a pair.
 *
 * Stars are whole-filled at the .5 boundary rather than clipped. A half-filled
 * glyph needs an SVG gradient def per instance, which is a lot of markup for a
 * distinction nobody reads off the icons anyway.
 */
export function RatingStars({
  value,
  className,
  size = 14,
}: {
  value: number
  className?: string
  size?: number
}) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.5

        return (
          <Star
            key={i}
            width={size}
            height={size}
            strokeWidth={1.5}
            className={cn('shrink-0', filled ? 'text-warning' : 'text-border')}
            fill={filled ? 'currentColor' : 'none'}
          />
        )
      })}
    </span>
  )
}
