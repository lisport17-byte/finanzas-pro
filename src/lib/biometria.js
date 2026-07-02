/**
 * Desbloqueo biométrico (huella / Face ID) usando WebAuthn.
 *
 * Cómo funciona: la sesión de Supabase queda guardada en el dispositivo
 * (persistSession) y esta capa agrega un CANDADO local — al abrir la app
 * se pide la huella antes de mostrar los datos. La credencial vive en el
 * hardware seguro del teléfono; aquí solo guardamos su ID.
 *
 * Nota: es un bloqueo de acceso al dispositivo, no reemplaza la contraseña
 * (que sigue siendo necesaria para iniciar sesión la primera vez).
 */

const FLAG = 'fp_huella_activa'
const CRED_ID = 'fp_huella_cred'

const bufToB64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const b64ToBuf = (b64) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const arr = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i)
  return arr.buffer
}

export const biometria = {
  /** ¿El dispositivo tiene huella/biometría disponible? */
  disponible: async () => {
    try {
      return (
        !!window.PublicKeyCredential &&
        (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
      )
    } catch {
      return false
    }
  },

  /** ¿El usuario activó el bloqueo con huella en este dispositivo? */
  estaActiva: () => localStorage.getItem(FLAG) === '1' && !!localStorage.getItem(CRED_ID),

  /** Registra la huella del usuario en este dispositivo */
  activar: async (user) => {
    try {
      const credencial = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'FinanzasPro', id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user.id),
            name: user.email || 'usuario',
            displayName: user.email || 'Usuario FinanzasPro',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // huella/face del propio dispositivo
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })
      localStorage.setItem(CRED_ID, bufToB64(credencial.rawId))
      localStorage.setItem(FLAG, '1')
      return { ok: true, mensaje: '🔒 Huella activada — se pedirá al abrir la app' }
    } catch (err) {
      return {
        ok: false,
        mensaje:
          err?.name === 'NotAllowedError'
            ? 'Registro cancelado o no permitido'
            : 'Error: ' + (err?.message || 'este dispositivo no lo soporta'),
      }
    }
  },

  /** Pide la huella y devuelve true si el usuario la verificó */
  verificar: async () => {
    const credId = localStorage.getItem(CRED_ID)
    if (!credId) return false
    try {
      const resultado = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: b64ToBuf(credId) }],
          userVerification: 'required',
          timeout: 60000,
        },
      })
      return !!resultado
    } catch {
      return false
    }
  },

  /** Quita el bloqueo con huella de este dispositivo */
  desactivar: () => {
    localStorage.removeItem(FLAG)
    localStorage.removeItem(CRED_ID)
    return { ok: true, mensaje: 'Bloqueo con huella desactivado' }
  },
}
