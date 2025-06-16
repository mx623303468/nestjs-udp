import * as crypto from 'crypto'
import { EncryptedPacket } from '../udp.interface'

const AES_KEY = Buffer.from(process.env.UDP_AES_KEY!, 'base64') // 32 bytes
const HMAC_KEY = Buffer.from(process.env.UDP_HMAC_KEY!, 'base64') // 可随意长度

export function encryptAndSign(payload: object): any {
  const iv = crypto.randomBytes(12) // 96-bit nonce for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv)

  const plaintext = Buffer.from(JSON.stringify(payload))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  const messageToSign = Buffer.concat([iv, ciphertext, authTag])
  const signature = crypto.createHmac('sha256', HMAC_KEY).update(messageToSign).digest('base64')

  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
    signature
  }
}

export function decryptAndVerify(packet: EncryptedPacket): any {
  const iv = Buffer.from(packet.iv, 'base64')
  const ciphertext = Buffer.from(packet.ciphertext, 'base64')
  const authTag = Buffer.from(packet.authTag, 'base64')

  const messageToVerify = Buffer.concat([iv, ciphertext, authTag])
  const expectedSignature = crypto
    .createHmac('sha256', HMAC_KEY)
    .update(messageToVerify)
    .digest('base64')

  if (packet.signature !== expectedSignature) {
    throw new Error('Signature mismatch: possible tampering')
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString())
}
