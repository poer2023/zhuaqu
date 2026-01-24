import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
    const key = process.env.X_TOKEN_ENCRYPTION_KEY
    if (!key) {
        throw new Error("X_TOKEN_ENCRYPTION_KEY environment variable is not set")
    }
    // Key should be 32 bytes base64 encoded
    return Buffer.from(key, "base64")
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns base64 encoded string: iv:authTag:ciphertext
 */
export function encryptToken(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(plaintext, "utf8", "base64")
    encrypted += cipher.final("base64")

    const authTag = cipher.getAuthTag()

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`
}

/**
 * Decrypt a ciphertext string encrypted with encryptToken
 */
export function decryptToken(ciphertext: string): string {
    const key = getEncryptionKey()
    const parts = ciphertext.split(":")

    if (parts.length !== 3) {
        throw new Error("Invalid ciphertext format")
    }

    const iv = Buffer.from(parts[0], "base64")
    const authTag = Buffer.from(parts[1], "base64")
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, "base64", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
}

/**
 * Generate a random encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString("base64")
}
