import { describe, expect, it } from 'vitest'
import { categorize, describeActivity } from './apps'

describe('app awareness', () => {
  it.each([
    ['Code', 'com.microsoft.VSCode', 'code'],
    ['Spotify', 'com.spotify.client', 'music'],
    ['zoom.us', 'us.zoom.xos', 'call'],
    ['Arc', 'company.thebrowser.Browser', 'browse'],
    ['Slack', 'com.tinyspeck.slackmacgap', 'chat'],
    ['Figma', 'com.figma.Desktop', 'design'],
    ['Some IDE Studio', 'com.example.unknown', 'code'],
    ['Finder', 'com.apple.finder', 'other']
  ] as const)('%s → %s', (name, bundleId, category) => {
    expect(categorize({ name, bundleId })).toBe(category)
  })

  it('describes activity for the AI', () => {
    expect(describeActivity('VS Code', 'code')).toBe('coding in VS Code')
    expect(describeActivity('Finder', 'other')).toBe('using Finder')
  })
})
