/**
 * app.js — Orquestador principal
 */

const App = (() => {

  function init() {
    const active = Auth.init();

    if (active) {
      _showApp();
    } else {
      _showLogin();
      // Mostrar error de dominio si viene del callback
      if (window._authError) {
        const el = document.getElementById('login-error');
        if (el) el.textContent = window._authError;
        delete window._authError;
      }
    }
  }

  function _showLogin() {
    document.getElementById('screen-login').classList.add('active');
    document.getElementById('screen-app').classList.remove('active');
  }

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

    ExpedientesModule.render();
    ZipModule.render();
    navigate('expedientes');
  }

  function toast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.background = type === 'error' ? '#B02020' : '';
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  return { init, toast };

})();

// ── Botón "Ingresar con Google" ───────────────────────────────────
// Llama a Auth.login() que redirige directamente a Google.
// No hay await — la página navega a Google y regresa con el token.
function handleLogin() {
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');
  if (errEl) errEl.textContent = '';
  if (btn)   btn.textContent = 'Redirigiendo a Google...';
  Auth.login(); // redirige — no retorna
}

// ── Cerrar sesión ─────────────────────────────────────────────────
function handleLogout() {
  if (!confirm('¿Cerrar sesión?')) return;
  Auth.logout();
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
}

// ── Navegación entre módulos ──────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
}

// ── Arrancar ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
