import type { CreatureArt } from './types'

/**
 * Moth – a fluffy cream moth with tall tan ears, glossy black eyes, a little
 * ω mouth and ivory wings. 35×35 pixels, symmetric around column 17.
 * The ears grow with each life stage; the wings live on the `back` layer so
 * they can flap independently of the body.
 *
 * Keep this file free of runtime imports (see ori.ts).
 */
export const moth: CreatureArt = {
  name: 'Moth',
  width: 35,
  height: 35,
  palette: {
    o: '#5a4838', // outline
    q: '#b8a490', // soft inner line (chin)
    b: '#f5efe5', // cream fur
    s: '#ddd2c2', // fur shade
    e: '#c9ad88', // tan ears / wing spots
    f: '#e2cdaa', // ear highlight
    g: '#a88c69', // ear shade
    w: '#fbf4dd', // ivory wing
    v: '#ebe0c2', // wing shade
    E: '#1d1a24', // eyes
    W: '#ffffff', // eye shine
    M: '#6e5140', // mouth
    k: '#f6b6c1', // cheeks
    T: '#ff8fa3', // tongue
    P: '#ff6f9c', // heart eyes
    N: '#a89078' // dirt
  },
  body: [
    '...................................',
    '...................................',
    '...................................',
    '...................................',
    '...................................',
    '...................................',
    '...............ooooo...............',
    '............ooobbbbbooo............',
    '..........oobbbbbbbbbbboo..........',
    '.........obbbbbbbbbbbbbbbo.........',
    '........obbbbbbbbbbbbbbbbbo........',
    '........obbbbbbbbbbbbbbbbbo........',
    '.......obbbbbbbbbbbbbbbbbbbo.......',
    '.......obbbbbbbbbbbbbbbbbbbo.......',
    '......obbbbbbbbbbbbbbbbbbbbbo......',
    '......obbbbbbbbbbbbbbbbbbbbbo......',
    '......obbbbbbbbbbbbbbbbbbbbbo......',
    '......obbbbbbbbbbbbbbbbbbbbbo......',
    '.......obbbbbbbbbbbbbbbbbbbo.......',
    '.......obbbbbbbbbbbbbbbbbbbo.......',
    '.......obbbbbbbbbbbbbbbbbbbo.......',
    '........obbbbbbbbbbbbbbbbbo........',
    '.........obbbbbbbbbbbbbbso.........',
    '..........obbbbbbbbbsssso..........',
    '...........oqqbbsssssqqo...........',
    '...........obbqqqqqqqbbo...........',
    '..........obbbbbbbbbbbbbo..........',
    '.........obbbbbbbbbbbbbbbo.........',
    '.........obbbbbbbbbbbbbbbo.........',
    '.........ooobbbbbbbbbbbooo.........',
    '............ossssssssso............',
    '............ossssssssso............',
    '............osssooossso............',
    '............oooo...oooo............',
    '...................................'
  ],
  back: [
    {
      x: 0,
      y: 0,
      rows: [
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '...................................',
        '.....oooo.................oooo.....',
        '...oowwwwo...............owwwwoo...',
        '..owwwwwwwo.............owwwwwwwo..',
        '.oweewwwwwo.............owwwwweewo.',
        '.oweewwwwwo.............owwwwweewo.',
        'owwwwwwwwwwoo.........oowwwwwwwwwwo',
        'owwwwwwwwwwwwo.......owwwwwwwwwwwwo',
        '.owwwwwwwwwwwo.......owwwwwwwwwwwo.',
        '..ooovvvvvwwwo.......owwwvvvvvooo..',
        '.....ovvvvvwo.........owvvvvvo.....',
        '.....ovvvvvo...........ovvvvvo.....',
        '.....ovvvvvo...........ovvvvvo.....',
        '......ooovoo...........oovooo......',
        '.........o...............o.........',
        '...................................',
        '...................................',
        '...................................',
        '...................................'
      ]
    }
  ],
  stages: {
    baby: {
      x: 9,
      y: 5,
      rows: [
        '.oo...........oo.',
        'offo.........offo',
        'offb.........bffo',
        'obb...........bbo'
      ]
    },
    child: {
      x: 8,
      y: 3,
      rows: [
        '.ooo...........ooo.',
        'ogeeo.........oeego',
        'offfo.........offfo',
        'ogffo.........offgo',
        '.offb.........bffo.',
        '.obb...........bbo.'
      ]
    },
    teen: {
      x: 8,
      y: 1,
      rows: [
        'ooo.............ooo',
        'ogeo...........oego',
        'offo...........offo',
        'offfo.........offfo',
        'offfo.........offfo',
        'ogffeo.......oeffgo',
        '.oefbb.......bbfeo.',
        '...b...........b...'
      ]
    },
    adult: {
      x: 7,
      y: 0,
      rows: [
        'ooo...............ooo',
        'ogeo.............oego',
        'ogfeo...........oefgo',
        'offfeo.........oefffo',
        'ogfffo.........offfgo',
        '.offfo.........offfo.',
        '.oeffeo.......oeffeo.',
        '..oefbb.......bbfeo..',
        '..obb...........bbo..'
      ]
    },
  },
  eyes: {
    left: { x: 10, y: 14 },
    right: { x: 21, y: 14 },
    kinds: {
      open: ['....', '.EE.', 'EEWE', 'EEWE', 'EEEE', '.EE.'],
      blink: ['....', '....', '....', '....', 'EEEE', '....'],
      happy: ['....', '....', '....', '.EE.', 'E..E', '....'],
      closed: ['....', '....', '....', '....', 'E..E', '.EE.'],
      sad: ['...E', '..E.', '....', '.EE.', 'EEWE', '.EE.'],
      angry: ['E...', '.EE.', '....', 'EEEE', 'EEEE', '.EE.'],
      sleepy: ['....', '....', '....', 'EEEE', 'EEWE', '.EE.'],
      star: ['....', '.EE.', 'EWWE', 'EEEE', 'EEWE', '.EE.'],
      heart: ['....', '....', 'P..P', 'PPPP', '.PP.', '....'],
      surprised: ['....', '.EE.', 'E..E', 'E..E', 'E..E', '.EE.'],
      look: ['.EE.', 'EEWE', 'EEWE', 'EEEE', '.EE.', '....'],
      dizzy: ['....', 'E..E', '.EE.', '.EE.', 'E..E', '....']
    }
  },
  mouth: {
    x: 15,
    y: 21,
    kinds: {
      smile: ['M.M.M', '.M.M.', '.....'],
      cat: ['M.M.M', '.M.M.', '.....'],
      open: ['MMMMM', 'MTTTM', '.MMM.'],
      o: ['..M..', '.M.M.', '..M..'],
      chew: ['.....', '.MMM.', '.....'],
      frown: ['..M..', '.M.M.', '.....'],
      flat: ['.....', '.MMM.', '.....'],
      wavy: ['.M.M.', 'M.M.M', '.....'],
      dot: ['.....', '..M..', '.....'],
      grit: ['.MMM.', 'M...M', '.....']
    }
  },
  cheeks: [
    { x: 9, y: 20, rows: ['kk'] },
    { x: 24, y: 20, rows: ['kk'] }
  ],
  dirt: [
    [
      { x: 12, y: 10, rows: ['N'] },
      { x: 22, y: 25, rows: ['N.', '.N'] }
    ],
    [
      { x: 8, y: 17, rows: ['N'] },
      { x: 25, y: 13, rows: ['N'] },
      { x: 15, y: 28, rows: ['NN'] },
      { x: 20, y: 9, rows: ['N'] }
    ]
  ],
  tints: {
    sleeping: 'brightness(0.92)'
  },
  // Pale fur is recoloured directly so the outline and eyes stay crisp.
  moodPalettes: {
    sick: { b: '#e8eed5', s: '#cdd7b3', w: '#edf0d4', v: '#dbe1be', k: '#d6ddb2' },
    angry: { b: '#fde2da', s: '#f1c1b5', k: '#ff9a9a' },
    sad: { b: '#ebe8e4', s: '#d3cec7', e: '#b8a68e', f: '#cdbfa7' }
  }
}
