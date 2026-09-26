<script lang="ts">
  import PixelSprite from '../creature/PixelSprite.svelte'
  import { ICON_PALETTE, type Glyph } from '../creature/icons'

  interface Props {
    glyph: Glyph
    scale?: number
    label?: string
  }

  let { glyph, scale = 2, label }: Props = $props()
  const layers = $derived([{ x: 0, y: 0, rows: glyph.rows }])
</script>

<PixelSprite width={glyph.w} height={glyph.h} {layers} palette={ICON_PALETTE} {scale} {label} />
