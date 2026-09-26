import { safeStorage } from 'electron'
import type { SecretStore } from '../services/settingsService'

/** API keys are encrypted with the OS keychain (Keychain / DPAPI / libsecret). */
export const secretStore: SecretStore = {
  available() {
    if (!safeStorage.isEncryptionAvailable()) return false
    // On Linux without a keyring Electron falls back to a hard-coded key – not real protection.
    return !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
  },
  encrypt(plain) {
    return safeStorage.encryptString(plain).toString('base64')
  },
  decrypt(cipher) {
    return safeStorage.decryptString(Buffer.from(cipher, 'base64'))
  }
}
