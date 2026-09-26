/** Window geometry shared by the main process and the UI (CSS pixels). */
export const LAYOUT = {
  width: 300,
  /** Pet + speech bubble + action bar. */
  compactHeight: 290,
  /** Extra height added when a panel (chat/stats/settings) is open. */
  panelHeight: 340,
  /** Distance from the bottom of the compact area to the pet's centre. */
  petCenterFromBottom: 109,
  /** Distance from the top of the compact area to the pet's feet (for standing on things). */
  petFeetFromTop: 230
} as const
