/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONASE — CONFIGURACIÓN                                      ║
 * ║  Completar estos valores antes de hacer deploy               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * PASOS PARA OBTENER LAS CREDENCIALES:
 * Ver README.md → sección "Configuración Google Cloud"
 */

const CONFIG = {

  // ── Google OAuth ──────────────────────────────────────────────
  // Obtener en: console.cloud.google.com → APIs → Credenciales → OAuth 2.0
  GOOGLE_CLIENT_ID: '43163248778-qri63io046lkhtcj0h3fu6lj0ogpkbid.apps.googleusercontent.com',

  // ── Apps Script (backend principal) ──────────────────────────
  // Obtener en: script.google.com → Implementar → Administrar implementaciones
  // → copiar la URL "Aplicación web"
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec',

  // ── Control de acceso ─────────────────────────────────────────
  ALLOWED_DOMAIN: 'inase.gob.ar',

  // URL de la app en producción (para OAuth redirect)
  // En desarrollo local usar: http://localhost:5500
  APP_URL: 'https://TU_ORG.github.io/conase-app',

  // ── Scopes OAuth ─────────────────────────────────────────────
  // Solo necesitamos el perfil — el acceso a Sheets lo maneja el Apps Script
  SCOPES: 'openid email profile',

};
