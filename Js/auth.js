/**
 * auth.js — Autenticación con Google OAuth 2.0
 * Restricción de dominio: @inase.gob.ar
 * Usa Google Identity Services (GIS) — popup flow
 */

const Auth = (() => {

  let _tokenClient = null;
  let _accessToken  = null;
  let _user         = null;
  const TOKEN_KEY   = 'conase_token';
  const USER_KEY    = 'conase_user';

  // ── Init: se llama al cargar la app ──────────────────────────
  function init() {
    // Intentar restaurar sesión previa
    const saved = sessionStorage.getItem(USER_KEY);
    const tok   = sessionStorage.getItem(TOKEN_KEY);
    if (saved && tok) {
      _user        = JSON.parse(saved);
      _accessToken = tok;
      return true; // sesión activa
    }
    return false;
  }

  // ── Iniciar login con popup de Google ────────────────────────
  function login() {
    return new Promise((resolve, reject) => {

      // Paso 1: ID token (para obtener perfil de usuario)
      google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback:  (response) => _handleIdToken(response, resolve, reject),
        auto_select: false,
      });

      // Paso 2: Access token (para Google Sheets API)
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope:     CONFIG.SCOPES,
        callback:  (tokenResponse) => {
          if (tokenResponse.error) { reject(tokenResponse); return; }
          _accessToken = tokenResponse.access_token;
          sessionStorage.setItem(TOKEN_KEY, _accessToken);
          resolve({ user: _user, token: _accessToken });
        },
      });

      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: popup manual
          google.accounts.id.renderButton(
            document.createElement('div'),
            { type: 'standard' }
          );
          _showFallbackPopup(resolve, reject);
        }
      });
    });
  }

  // Fallback cuando el One Tap no muestra
  function _showFallbackPopup(resolve, reject) {
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id',     CONFIG.GOOGLE_CLIENT_ID);
    oauthUrl.searchParams.set('redirect_uri',  CONFIG.APP_URL);
    oauthUrl.searchParams.set('response_type', 'token id_token');
    oauthUrl.searchParams.set('scope',         'openid email profile ' + CONFIG.SCOPES);
    oauthUrl.searchParams.set('nonce',         Math.random().toString(36).slice(2));
    oauthUrl.searchParams.set('hd',            CONFIG.ALLOWED_DOMAIN); // restringe al dominio

    const popup = window.open(oauthUrl.toString(), 'google-login', 'width=500,height=600');

    const timer = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(timer); return; }
        const href = popup.location.href;
        if (href.startsWith(CONFIG.APP_URL)) {
          popup.close(); clearInterval(timer);
          const hash   = new URLSearchParams(href.split('#')[1] || '');
          const idTok  = hash.get('id_token');
          const accTok = hash.get('access_token');
          if (idTok && accTok) {
            _accessToken = accTok;
            sessionStorage.setItem(TOKEN_KEY, accTok);
            const payload = _parseJwt(idTok);
            _validateAndSave(payload, resolve, reject);
          }
        }
      } catch(_) {} // cross-origin hasta que redirige al dominio propio
    }, 300);
  }

  // Callback del One Tap
  function _handleIdToken(response, resolve, reject) {
    const payload = _parseJwt(response.credential);
    _validateAndSave(payload, resolve, reject);
  }

  // Validar dominio y guardar usuario
  function _validateAndSave(payload, resolve, reject) {
    const email = payload.email || '';

    if (!email.endsWith('@' + CONFIG.ALLOWED_DOMAIN)) {
      reject({
        code: 'DOMAIN_MISMATCH',
        message: `Acceso denegado. Solo cuentas @${CONFIG.ALLOWED_DOMAIN} pueden ingresar.`
      });
      return;
    }

    _user = {
      name:    payload.name,
      email:   payload.email,
      picture: payload.picture,
      sub:     payload.sub,
    };

    sessionStorage.setItem(USER_KEY, JSON.stringify(_user));

    // Ahora pedir el access token para Sheets
    if (_tokenClient) {
      _tokenClient.requestAccessToken({ prompt: '' });
    } else {
      resolve({ user: _user, token: null });
    }
  }

  // Cerrar sesión
  function logout() {
    google.accounts.id.disableAutoSelect();
    if (_accessToken) {
      google.accounts.oauth2.revoke(_accessToken, () => {});
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    _user        = null;
    _accessToken = null;
  }

  // Getters
  function getUser()  { return _user; }
  function getToken() { return _accessToken; }
  function isLoggedIn() { return !!_user && !!_accessToken; }

  // Decodificar JWT (solo payload — no verificar firma en cliente)
  function _parseJwt(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  }

  return { init, login, logout, getUser, getToken, isLoggedIn };

})();
