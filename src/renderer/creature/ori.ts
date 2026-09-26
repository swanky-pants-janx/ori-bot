import type { CreatureArt } from './types'

/**
 * Ori – a round, mint-coloured blob with little ears and a sprout on its head.
 * 31×30 pixels, symmetric around column 15.
 *
 * This file must stay free of runtime imports: scripts/generate-icons.mjs
 * loads it directly with Node to render the app icon.
 */
export const ori: CreatureArt = {
  name: 'Ori',
  width: 31,
  height: 30,
  palette: {
    o: '#3b2d4f', // outline
    b: '#8fe0c3', // body
    s: '#5fbfa0', // shade
    h: '#d4fbe9', // highlight
    l: '#eafff5', // belly
    p: '#ffaec0', // inner ear
    k: '#ff9fb2', // cheeks
    E: '#2a2238', // eyes & mouth
    W: '#ffffff', // eye shine
    T: '#ff6f91', // tongue
    P: '#ff5f8f', // heart eyes
    N: '#a0805e', // dirt
    g: '#4fa83d', // leaf (dark)
    G: '#8fdc6a', // leaf (light)
    t: '#3f8a34', // stem
    f: '#ffd35c', // petal
    c: '#ff8a5c' // flower centre
  },
  body: [
    '...............................',
    '...............................',
    '...............................',
    '...............................',
    '...............................',
    '.......ooo...........ooo.......',
    '......obbbo.........obbbo......',
    '......obpbbooooooooobbpbo......',
    '......obppbbbbbbbbbbbppbo......',
    '......obppbbbbbbbbbbbppbo......',
    '......obpbbbbbbbbbbbbbpbo......',
    '.....obbhhhhbbbbbbbbbbbbbo.....',
    '....obbbhhhbbbbbbbbbbbbbbbo....',
    '....obbbbbbbbbbbbbbbbbbbbbo....',
    '...obbbbbbbbbbbbbbbbbbbbbbbo...',
    '...obbbbbbbbbbbbbbbbbbbbbbbo...',
    '...obbbbbbbbbbbbbbbbbbbbbbbo...',
    '...obbbbbbbbbbbbbbbbbbbbbbbo...',
    '...obbbbbbbbblllllbbbbbbbbbo...',
    '...obbbbbblllllllllllbbbbbbo...',
    '...obbbbblllllllllllllbbbbbo...',
    '....obbbblllllllllllllbbbbo....',
    '.....obbblllllllllllllbbso.....',
    '......obbblllllllllllssso......',
    '.......oobblllllllllssoo.......',
    '.........obsssssssssso.........',
    '........ossssooooosssso........',
    '........ooooo.....ooooo........',
    '...............................',
    '...............................'
  ],
  stages: {
    baby: { x: 14, y: 4, rows: ['.gG', '.t.', '.t.'] },
    child: { x: 12, y: 3, rows: ['gG...Gg', '.gGtGg.', '...t...', '...t...'] },
    teen: { x: 11, y: 2, rows: ['gGG...GGg', 'ggGG.GGgg', '.ggGtGgg.', '....t....', '....t....'] },
    adult: { x: 12, y: 0, rows: ['..fff..', '.ffcff.', '..fff..', 'gG.t.Gg', '.gGtGg.', '...t...', '...t...'] }
  },
  eyes: {
    left: { x: 10, y: 12 },
    right: { x: 18, y: 12 },
    kinds: {
      open: ['...', '...', '.WE', '.EE', '.EE'],
      blink: ['...', '...', '...', 'EEE', '...'],
      happy: ['...', '...', '...', '.E.', 'E.E'],
      closed: ['...', '...', '...', 'E.E', '.E.'],
      sad: ['..E', '.E.', '...', '.WE', '.EE'],
      angry: ['E..', '.EE', '...', '.EE', '.EE'],
      sleepy: ['...', '...', '...', 'EEE', '.EE'],
      star: ['...', '...', '.E.', 'EWE', '.E.'],
      heart: ['...', '...', 'P.P', 'PPP', '.P.'],
      surprised: ['...', '.E.', 'E.E', 'E.E', '.E.'],
      look: ['...', '.WE', '.EE', '.EE', '...'],
      dizzy: ['...', '...', 'E.E', '.E.', 'E.E']
    }
  },
  mouth: {
    x: 13,
    y: 18,
    kinds: {
      smile: ['.E.E.', '..E..', '.....'],
      cat: ['E.E.E', '.E.E.', '.....'],
      open: ['EEEEE', 'ETTTE', '.EEE.'],
      o: ['..E..', '.E.E.', '..E..'],
      chew: ['.....', '.EEE.', '.....'],
      frown: ['..E..', '.E.E.', '.....'],
      flat: ['.....', '.EEE.', '.....'],
      wavy: ['.E.E.', 'E.E.E', '.....'],
      dot: ['.....', '..E..', '.....'],
      grit: ['.EEE.', 'E...E', '.....']
    }
  },
  cheeks: [
    { x: 6, y: 17, rows: ['kkk'] },
    { x: 22, y: 17, rows: ['kkk'] }
  ],
  dirt: [
    [
      { x: 7, y: 20, rows: ['N.', '.N'] },
      { x: 22, y: 11, rows: ['N'] }
    ],
    [
      { x: 19, y: 22, rows: ['NN'] },
      { x: 5, y: 14, rows: ['N'] },
      { x: 24, y: 19, rows: ['.N', 'N.'] },
      { x: 13, y: 9, rows: ['N'] }
    ]
  ],
  tints: {
    sad: 'saturate(0.65)',
    sleeping: 'brightness(0.93)',
    angry: 'hue-rotate(-150deg) saturate(1.2)',
    sick: 'hue-rotate(-70deg) saturate(0.55) brightness(0.95)'
  }
}
