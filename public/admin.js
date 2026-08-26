import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const loadingView = document.querySelector('#loading-view');
const loginView = document.querySelector('#login-view');
const adminView = document.querySelector('#admin-view');
const loginForm = document.querySelector('#login-form');
const logoutButton = document.querySelector('#logout-button');
const sessionEmail = document.querySelector('#session-email');
const message = document.querySelector('#message');

let supabase;

function showView(view) {
  loadingView.hidden = view !== loadingView;
  loginView.hidden = view !== loginView;
  adminView.hidden = view !== adminView;
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('message--error', isError);
  message.hidden = false;
}

function clearMessage() {
  message.hidden = true;
  message.textContent = '';
  message.classList.remove('message--error');
}

async function validateSession(session) {
  if (!session?.access_token) {
    showView(loginView);
    return;
  }

  const response = await fetch('/admin/session', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    await supabase.auth.signOut();
    showView(loginView);
    showMessage('Tu sesión expiró. Solicita un nuevo enlace de acceso.', true);
    return;
  }

  const result = await response.json();
  sessionEmail.textContent = result.user.email;
  clearMessage();
  showView(adminView);
}

async function initializeAuth() {
  try {
    const configResponse = await fetch('/auth-config');

    if (!configResponse.ok) {
      throw new Error('La autenticación todavía no está configurada.');
    }

    const config = await configResponse.json();
    supabase = createClient(config.supabaseUrl, config.supabasePublicKey);

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    await validateSession(data.session);

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        validateSession(session);
      } else if (event === 'SIGNED_OUT') {
        showView(loginView);
      }
    });
  } catch (error) {
    showView(loginView);
    showMessage(error.message || 'No fue posible iniciar la autenticación.', true);
    loginForm.querySelector('button').disabled = true;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  const button = loginForm.querySelector('button');
  const email = new FormData(loginForm).get('email').trim();
  button.disabled = true;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/admin`,
      shouldCreateUser: false,
    },
  });

  button.disabled = false;

  if (error) {
    showMessage('No fue posible enviar el enlace. Revisa el correo e inténtalo nuevamente.', true);
    return;
  }

  loginForm.reset();
  showMessage('Revisa tu correo. Te enviamos un enlace seguro para entrar.');
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  logoutButton.disabled = false;

  if (error) {
    showMessage('No fue posible cerrar la sesión. Inténtalo nuevamente.', true);
    return;
  }

  sessionEmail.textContent = '';
  showView(loginView);
  showMessage('Sesión cerrada correctamente.');
});

initializeAuth();
