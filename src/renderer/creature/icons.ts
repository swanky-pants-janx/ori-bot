/** Small pixel-art icons and effect sprites that match the pet's style. */

export const ICON_PALETTE: Readonly<Record<string, string>> = {
  R: '#ff5f5f',
  t: '#7a5230',
  g: '#6cc24a',
  W: '#ffffff',
  P: '#ff6f9c',
  Y: '#ffc93c',
  O: '#ff9f43',
  S: '#4fb0f5',
  G: '#8a7fa3',
  C: '#ff7a6b',
  M: '#4fb592',
  I: '#3b2d4f',
  N: '#a0805e',
  V: '#9bbf5a',
  D: '#7cc7ff',
  H: '#d9a21b'
}

export interface Glyph {
  w: number
  h: number
  rows: readonly string[]
}

function glyph(rows: readonly string[]): Glyph {
  return { w: rows[0].length, h: rows.length, rows }
}

export const ICONS = {
  feed: glyph([
    '.....t.....',
    '.....tgg...',
    '..RRRtRRR..',
    '.RRRRRRRRR.',
    'RRWRRRRRRRR',
    'RWRRRRRRRRR',
    'RRRRRRRRRRR',
    'RRRRRRRRRRR',
    '.RRRRRRRRR.',
    '..RRRRRRR..',
    '...RR.RR...'
  ]),
  pet: glyph([
    '...........',
    '.PPP...PPP.',
    'PPPPP.PPPPP',
    'PWPPPPPPPPP',
    'PWPPPPPPPPP',
    'PPPPPPPPPPP',
    '.PPPPPPPPP.',
    '..PPPPPPP..',
    '...PPPPP...',
    '....PPP....',
    '.....P.....'
  ]),
  play: glyph([
    '....YYY....',
    '..CCYYYSS..',
    '.CCCYYYSSS.',
    '.CCWYYYSSS.',
    'CCCCYYYSSSS',
    'CCCCYYYSSSS',
    'CCCCYYYSSSS',
    '.CCCYYYSSS.',
    '.CCCYYYSSS.',
    '..CCYYYSS..',
    '....YYY....'
  ]),
  sleep: glyph([
    '...YYYY....',
    '.YYYY......',
    '.YYY.......',
    'YYY........',
    'YYY........',
    'YYY........',
    'YYYY.......',
    '.YYYY......',
    '.YYYYY.....',
    '..YYYYYYY..',
    '....YYYY...'
  ]),
  wake: glyph([
    '.....O.....',
    '..O..O..O..',
    '.OO.....OO.',
    '....YYY....',
    '...YYYYY...',
    'OO.YYYYY.OO',
    '...YYYYY...',
    '....YYY....',
    '.OO.....OO.',
    '..O..O..O..',
    '.....O.....'
  ]),
  clean: glyph([
    '...........',
    '.......SSS.',
    '......SWDDS',
    '..SSSS.SDDS',
    '.SWWDDS.SS.',
    'SWWDDDDS...',
    'SDDDDDDS...',
    'SDDDDDDS.S.',
    '.SDDDDS.SWS',
    '..SSSS...S.',
    '...........'
  ]),
  chat: glyph([
    '...........',
    '..IIIIIII..',
    '.IWWWWWWWI.',
    'IWWWWWWWWWI',
    'IWIWWIWWIWI',
    'IWWWWWWWWWI',
    '.IWWWWWWWI.',
    '..IIWIIII..',
    '...IWI.....',
    '...II......',
    '...........'
  ]),
  stats: glyph([
    '...........',
    '.......SS..',
    '.......SS..',
    '....YY.SS..',
    '....YY.SS..',
    '....YY.SS..',
    '.CC.YY.SS..',
    '.CC.YY.SS..',
    '.CC.YY.SS..',
    'IIIIIIIIIII',
    '...........'
  ]),
  settings: glyph([
    '....GGG....',
    '.GG.GGG.GG.',
    '.GGGGGGGGG.',
    '..GGGGGGG..',
    'GGGG...GGGG',
    'GGGG...GGGG',
    'GGGG...GGGG',
    '..GGGGGGG..',
    '.GGGGGGGGG.',
    '.GG.GGG.GG.',
    '....GGG....'
  ]),
  sponge: glyph([
    '.ggggggggg.',
    'ggggggggggg',
    'YYHYYYYHYYY',
    'YYYYYHYYYYY',
    'YHYYYYYYHYY',
    'YYYYYYHYYYY',
    'YYYHYYYYYHY',
    '.YYYYYYYYY.'
  ]),
  hide: glyph([
    '...........',
    '...........',
    '...........',
    '...........',
    '...........',
    '..IIIIIII..',
    '..IIIIIII..',
    '...........',
    '...........',
    '...........',
    '...........'
  ]),
  close: glyph([
    'II.....II',
    'III...III',
    '.III.III.',
    '..IIIII..',
    '...III...',
    '..IIIII..',
    '.III.III.',
    'III...III',
    'II.....II'
  ]),
  send: glyph([
    '....I....',
    '....II...',
    'IIIIIII..',
    'IIIIIIII.',
    'IIIIIII..',
    '....II...',
    '....I....'
  ]),
  health: glyph(['...MMM...', '...MMM...', 'MMMMMMMMM', 'MMMMMMMMM', 'MMMMMMMMM', '...MMM...', '...MMM...']),
  energy: glyph(['....YYY', '...YYY.', '..YYY..', '.YYYYYY', '...YYY.', '..YYY..', '.YY....', 'Y......'])
} as const

export type IconName = keyof typeof ICONS

/** Effect sprites for particles and overlays. */
export const EFFECTS = {
  heart: glyph(['.PP.PP.', 'PPPPPPP', 'PWPPPPP', '.PPPPP.', '..PPP..', '...P...']),
  sparkle: glyph(['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..']),
  bubble: glyph(['.SSS.', 'SW..S', 'S...S', 'S...S', '.SSS.']),
  z: glyph(['IIIII', '...I.', '..I..', '.I...', 'IIIII']),
  drop: glyph(['..D', '.DD', 'DWD', 'DDD', '.D.']),
  stink: glyph(['.V.', 'V..', '.V.', '..V', '.V.', 'V..', '.V.']),
  anger: glyph(['CC.CC', 'C...C', '.....', 'C...C', 'CC.CC']),
  crumb: glyph(['NN', 'NN']),
  note: glyph(['...II', '..III', '..I.I', '..I..', '..I..', 'III..', 'III..']),
  apple: [
    ICONS.feed,
    glyph([
      '.....t.....',
      '.....tgg...',
      '..RRRtR....',
      '.RRRRRR....',
      'RRWRRRRR...',
      'RWRRRRRR...',
      'RRRRRRRRR..',
      'RRRRRRRRRR.',
      '.RRRRRRRRR.',
      '..RRRRRRR..',
      '...RR.RR...'
    ]),
    glyph([
      '.....t.....',
      '.....tgg...',
      '.....t.....',
      '....RR.....',
      '...RRR.....',
      '...RWR.....',
      '...RRR.....',
      '...RRRR....',
      '..RRRRRRR..',
      '..RRRRRRR..',
      '...RR.RR...'
    ])
  ]
} as const
