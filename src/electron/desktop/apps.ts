import type { AppCategory } from '../../types/api'

/** Known apps by bundle id (prefix match). Checked before the name heuristics. */
const BY_BUNDLE: [prefix: string, category: AppCategory][] = [
  // Coding & terminals
  ['com.microsoft.VSCode', 'code'],
  ['com.todesktop.230313mzl4w4u92', 'code'], // Cursor
  ['com.apple.dt.Xcode', 'code'],
  ['com.jetbrains.', 'code'],
  ['com.sublimetext.', 'code'],
  ['dev.zed.', 'code'],
  ['com.googlecode.iterm2', 'code'],
  ['com.apple.Terminal', 'code'],
  ['dev.warp.', 'code'],
  ['com.mitchellh.ghostty', 'code'],
  ['com.github.GitHubClient', 'code'],
  // Music
  ['com.spotify.client', 'music'],
  ['com.apple.Music', 'music'],
  ['com.apple.iTunes', 'music'],
  ['com.tidal.desktop', 'music'],
  ['com.deezer.', 'music'],
  // Calls & meetings
  ['us.zoom.', 'call'],
  ['com.microsoft.teams', 'call'],
  ['com.apple.FaceTime', 'call'],
  ['com.cisco.webex', 'call'],
  ['com.webex.', 'call'],
  // Video
  ['com.apple.TV', 'video'],
  ['org.videolan.vlc', 'video'],
  ['com.colliderli.iina', 'video'],
  ['com.apple.QuickTimePlayerX', 'video'],
  // Browsers
  ['com.google.Chrome', 'browse'],
  ['com.apple.Safari', 'browse'],
  ['org.mozilla.firefox', 'browse'],
  ['company.thebrowser.', 'browse'], // Arc
  ['com.brave.Browser', 'browse'],
  ['com.microsoft.edgemac', 'browse'],
  ['com.operasoftware.', 'browse'],
  // Chat
  ['com.tinyspeck.slackmacgap', 'chat'],
  ['com.hnc.Discord', 'chat'],
  ['net.whatsapp.WhatsApp', 'chat'],
  ['ru.keepcoder.Telegram', 'chat'],
  ['com.apple.MobileSMS', 'chat'],
  ['org.whispersystems.signal-desktop', 'chat'],
  // Design
  ['com.figma.Desktop', 'design'],
  ['com.adobe.', 'design'],
  ['com.bohemiancoding.sketch3', 'design'],
  ['com.seriflabs.', 'design'],
  ['com.pixelmatorteam.', 'design'],
  // Writing & notes
  ['com.apple.iWork.Pages', 'write'],
  ['com.microsoft.Word', 'write'],
  ['notion.id', 'write'],
  ['md.obsidian', 'write'],
  ['com.apple.Notes', 'write'],
  ['com.apple.TextEdit', 'write'],
  ['com.ulyssesapp.', 'write'],
  // Games
  ['com.valvesoftware.steam', 'game'],
  ['com.blizzard.', 'game'],
  ['com.epicgames.', 'game']
]

const BY_NAME: [pattern: RegExp, category: AppCategory][] = [
  [/code|studio|terminal|term\b|intellij|pycharm|webstorm/i, 'code'],
  [/spotify|music|tidal|deezer/i, 'music'],
  [/zoom|teams|meet|webex|facetime/i, 'call'],
  [/chrome|safari|firefox|browser|arc|edge/i, 'browse'],
  [/slack|discord|whatsapp|telegram|messages|signal/i, 'chat'],
  [/figma|photoshop|illustrator|sketch|affinity/i, 'design'],
  [/word|pages|notion|obsidian|notes/i, 'write'],
  [/steam|minecraft|game/i, 'game']
]

/** Sort an app into a rough category from its bundle id (or, failing that, its name). */
export function categorize(app: { name: string; bundleId: string }): AppCategory {
  for (const [prefix, category] of BY_BUNDLE) if (app.bundleId.startsWith(prefix)) return category
  for (const [pattern, category] of BY_NAME) if (pattern.test(app.name)) return category
  return 'other'
}

/** Short description for the AI, e.g. "coding in VS Code". */
export function describeActivity(app: string, category: AppCategory): string {
  const doing: Record<AppCategory, string> = {
    code: 'coding',
    music: 'listening to music',
    call: 'on a call',
    video: 'watching something',
    browse: 'browsing the web',
    chat: 'chatting',
    design: 'designing',
    write: 'writing',
    game: 'playing a game',
    other: 'using'
  }
  return category === 'other' ? `using ${app}` : `${doing[category]} in ${app}`
}
