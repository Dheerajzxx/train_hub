/* ============ Admin Auth (Client-side) ============ */
// Default demo creds: admin / admin123 (SHA-256 of 'admin:admin123')
const ADMIN_CREDS_HASH = 'bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d';

function hex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashCreds(username, password) {
  const text = `${username}:${password}`;
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return hex(buf);
}

function isAuthed() {
  try {
    return sessionStorage.getItem('admin_authed') === 'true';
  } catch (e) {
    return false;
  }
}

function setAuthed(v) {
  try {
    if (v) sessionStorage.setItem('admin_authed', 'true');
    else sessionStorage.removeItem('admin_authed');
  } catch (e) {}
}

function logout() {
  setAuthed(false);
  location.hash = '#/login';
  location.reload();
}

let _authBound = false;

function initAuth() {
  const loginView = document.getElementById('loginView');
  const appWrap = document.getElementById('appWrap');
  if (!isAuthed()) {
    if (loginView) loginView.style.display = 'flex';
    if (appWrap) appWrap.style.display = 'none';
    const form = document.getElementById('loginForm');
    const err = document.getElementById('loginError');
    if (form && !_authBound) {
      _authBound = true;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUser').value.trim();
        const p = document.getElementById('loginPass').value;
        err.textContent = '';
        try {
          const h = await hashCreds(u, p);
          if (h === ADMIN_CREDS_HASH) {
            setAuthed(true);
            loginView.style.display = 'none';
            appWrap.style.display = 'grid';
            if (typeof bootApp === 'function') await bootApp();
            else if (typeof route === 'function') route();
            else location.hash = '#/dashboard';
          } else {
            err.textContent = 'Invalid username or password';
          }
        } catch (e2) {
          err.textContent = 'Login error';
        }
      };
    }
    // keep hash on login while unauthenticated
    if (location.hash !== '#/login') {
      location.hash = '#/login';
    }
  } else {
    if (loginView) loginView.style.display = 'none';
    if (appWrap) appWrap.style.display = 'grid';
  }
}

function requireAuth() {
  if (!isAuthed()) {
    location.hash = '#/login';
    initAuth();
    return false;
  }
  return true;
}
