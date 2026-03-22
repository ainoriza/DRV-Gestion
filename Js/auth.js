/**
 * auth.js — Autenticación con Google OAuth 2.0
 *
 * Flujo: redirect (no popup, no One Tap)
 * - El usuario hace clic en "Ingresar con Google"
 * - Se redirige a Google para autenticar
 * - Google redirige de vuelta a APP_URL con el token en el hash (#)
 * - Se valida el dominio @inase.gob.ar y se guarda la sesión
 *
 * Este flujo funciona siempre, sin depender de cookies de terceros
 * ni de Google Identity Services.
 */

const Auth = (() => {

  const TOKEN_KEY = 'conase_token';
  const USER_KEY  = 'conase_user';
  const STATE_KEY = 'conase_oauth_state';

  let _user        = null;
  let _accessToken = null;

  // ── Init: restaurar sesión o procesar callback de OAuth ──────
  function init() {
    // 1. ¿Hay un token en el hash? (callback de Google)
    if (window.location.hash && window.location.hash.includes('access_token')) {
      return _processCallback();
    }

    // 2. ¿Hay sesión guardada en sessionStorage?
    const savedUser = sessionStorage.getItem(USER_KEY);
    const savedTok  = sessionStorage.getItem(TOKEN_KEY);
    if (savedUser && savedTok) {
      _user        = JSON.parse(savedUser);
      _accessToken = savedTok;
      return true;
    }

    return false;
  }

  // ── Iniciar login: redirigir a Google ────────────────────────
  function login() {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      client_id:     CONFIG.GOOGLE_CLIENT_ID,
      redirect_uri:  CONFIG.APP_URL,
      response_type: 'token id_token',
      scope:         'openid email profile',
      nonce:         Math.random().toString(36).slice(2),
      state:         state,
      hd:            CONFIG.ALLOWED_DOMAIN,
      prompt:        'select_account',
    });

    window.location.href =
      'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  }

  // ── Procesar el callback de Google (token en el hash) ────────
  function _processCallback() {
    const hash   = new URLSearchParams(window.location.hash.slice(1));
    const idTok  = hash.get('id_token');
    const accTok = hash.get('access_token');
    const state  = hash.get('state');

    // Limpiar el hash de la URL sin recargar
    history.replaceState(null, '', window.location.pathname);

    if (!idTok || !accTok) return false;

    // Validar state anti-CSRF
    const savedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (savedState && state && savedState !== state) {
      console.error('OAuth state mismatch');
      return false;
    }

    // Decodificar el ID token para obtener el perfil
    let payload;
    try {
      payload = _parseJwt(idTok);
    } catch (e) {
      console.error('Error al decodificar ID token', e);
      return false;
    }

    // Validar dominio
    const email = payload.email || '';
    if (!email.endsWith('@' + CONFIG.ALLOWED_DOMAIN)) {
      window._authError = `Acceso denegado. Solo cuentas @${CONFIG.ALLOWED_DOMAIN} pueden ingresar. (${email})`;
      return false;
    }

    // Guardar sesión
    _user = {
      name:    payload.name    || email.split('@')[0],
      email:   payload.email,
      picture: payload.picture || '',
      sub:     payload.sub,
    };
    _accessToken = accTok;

    sessionStorage.setItem(USER_KEY,  JSON.stringify(_user));
    sessionStorage.setItem(TOKEN_KEY, _accessToken);

    return true;
  }

  // ── Cerrar sesión ─────────────────────────────────────────────
  function logout() {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    _user        = null;
    _accessToken = null;
  }

  // ── Getters ───────────────────────────────────────────────────
  function getUser()    { return _user; }
  function getToken()   { return _accessToken; }
  function isLoggedIn() { return !!_user; }

  // ── Decodificar JWT payload (sin verificar firma) ─────────────
  function _parseJwt(token) {
    const b64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='));
    return JSON.parse(json);
  }

  return { init, login, logout, getUser, getToken, isLoggedIn };

})();
