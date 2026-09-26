<script lang="ts">
  import { toRuns } from './pixels'
  import type { PixelLayer } from './types'

  interface Props {
    width: number
    height: number
    layers: readonly PixelLayer[]
    palette: Readonly<Record<string, string>>
    /** Rendered pixel size in CSS px. */
    scale?: number
    label?: string
  }

  let { width, height, layers, palette, scale = 1, label }: Props = $props()
  const runs = $derived(toRuns(layers, palette))
</script>

<svg
  viewBox="0 0 {width} {height}"
  width={width * scale}
  height={height * scale}
  shape-rendering="crispEdges"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : true}
>
  {#each runs as r, i (i)}
    <rect x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
  {/each}
</svg>

<style>
  svg {
    display: block;
    image-rendering: pixelated;
  }
</style>
