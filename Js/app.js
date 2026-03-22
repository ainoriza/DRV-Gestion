/**
 * app.js — Orquestador principal
 * Inicializa la app, maneja login/logout y navegación entre páginas
 */

const App = (() => {

  // ── Inicialización ────────────────────────────────────────────
  function init() {
    // Esperar a que GIS esté disponible
    if (typeof google === 'undefined') {
      setTimeout(init, 200); return;
    }

    const active = Auth.init();
    if (active) {
      _showApp();
    } else {
      _showLogin();
    }
  }

  // ── Mostrar pantalla de login ─────────────────────────────────
  function _showLogin() {
    document.getElementById('screen-login').classList.add('active');
    document.getElementById('screen-app').classList.remove('active');
  }

  // ── Mostrar app ───────────────────────────────────────────────
  function _showApp() {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');

    const user = Auth.getUser();
    if (user) {
      document.getElementById('user-name').textContent  = user.name;
      document.getElementById('user-email').textContent = user.email;
      const avatar = document.getElementById('user-avatar');
      if (user.picture) {
        avatar.src = user.picture;
        avatar.style.display = '';
      } else {
        avatar.style.display = 'none';
      }
    }

    // Renderizar módulo de expedientes
    ExpedientesModule.render();
    ZipModule.render();
    navigate('expedientes');
  }

  // ── Navegación entre páginas ──────────────────────────────────
  function navigate(pageName) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageName);
    });
    document.querySelectorAll('.page').forEach(el => {
      el.classList.remove('active');
    });
    const target = document.getElementById('page-' + pageName);
    if (target) target.classList.add('active');
  }

  // ── Toast notifications ───────────────────────────────────────
  function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = type === 'error' ? 'var(--c-danger)' : 'var(--c-text)';
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  return { init, toast };

})();

// ── Handlers globales de auth (llamados desde HTML) ───────────────
async function handleLogin() {
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Iniciando sesión...';

  try {
    await Auth.login();
    App.init();
  } catch(e) {
    if (e.code === 'DOMAIN_MISMATCH') {
      errEl.textContent = e.message;
    } else {
      errEl.textContent = 'Error al iniciar sesión. Intentá de nuevo.';
      console.error(e);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Ingresar con Google`;
  }
}

function handleLogout() {
  if (!confirm('¿Cerrar sesión?')) return;
  Auth.logout();
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
}

function navigate(page) { App && App.init && null; _navigate(page); }
function _navigate(page) {
  if (page === 'zip' && typeof ZipModule !== 'undefined' && !document.querySelector('#page-zip .drop-zone')) ZipModule.render();
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const t = document.getElementById('page-'+page); if(t) t.classList.add('active');
}

// ── Arrancar cuando el DOM esté listo ──────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
