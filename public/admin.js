import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const adminShell = document.querySelector('#admin-shell');
const brandPanel = document.querySelector('#brand-panel');
const accessCard = document.querySelector('#access-card');
const loadingView = document.querySelector('#loading-view');
const loginView = document.querySelector('#login-view');
const adminView = document.querySelector('#admin-view');
const loginForm = document.querySelector('#login-form');
const logoutButton = document.querySelector('#logout-button');
const refreshButton = document.querySelector('#refresh-button');
const sessionEmail = document.querySelector('#session-email');
const message = document.querySelector('#message');
const panelMessage = document.querySelector('#panel-message');
const appointmentsCount = document.querySelector('#appointments-count');
const appointmentsLoading = document.querySelector('#appointments-loading');
const appointmentsEmpty = document.querySelector('#appointments-empty');
const appointmentsList = document.querySelector('#appointments-list');

let supabase;
let currentSession;

function showView(view) {
  const showingDashboard = view === adminView;
  brandPanel.hidden = showingDashboard;
  accessCard.hidden = showingDashboard;
  loadingView.hidden = view !== loadingView;
  loginView.hidden = view !== loginView;
  adminView.hidden = !showingDashboard;
  adminShell.classList.toggle('admin-shell--dashboard', showingDashboard);
}

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle('message--error', isError);
  element.hidden = false;
}

function clearMessage(element) {
  element.hidden = true;
  element.textContent = '';
  element.classList.remove('message--error');
}

async function authenticatedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${currentSession.access_token}`);

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new Error('Tu sesión expiró. Solicita un nuevo enlace de acceso.');
  }

  return response;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function addDetail(list, label, value) {
  const wrapper = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value || 'No disponible';
  wrapper.append(term, description);
  list.append(wrapper);
}

function createActionButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.classList.add(className);
  button.addEventListener('click', async () => {
    button.disabled = true;
    await handler();
    button.disabled = false;
  });
  return button;
}

async function updateAppointment(codigo, action) {
  clearMessage(panelMessage);

  try {
    const response = await authenticatedFetch(`/solicitudes/${encodeURIComponent(codigo)}/${action}`, {
      method: 'PATCH',
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'No fue posible actualizar la solicitud.');
    }

    setMessage(panelMessage, result.mensaje);
    await loadAppointments();
  } catch (error) {
    setMessage(panelMessage, error.message || 'No fue posible actualizar la solicitud.', true);
  }
}

function renderAppointment(appointment) {
  const card = document.createElement('article');
  card.className = 'appointment-card';

  const heading = document.createElement('div');
  heading.className = 'appointment-card__heading';
  const name = document.createElement('h2');
  name.textContent = appointment.nombre || 'Sin nombre';
  const status = document.createElement('span');
  status.className = 'status-badge';
  status.dataset.status = appointment.estado;
  status.textContent = appointment.estado;
  heading.append(name, status);

  const details = document.createElement('dl');
  addDetail(details, 'Contacto', appointment.contacto);
  addDetail(details, 'Fecha y hora', formatDate(appointment.fecha_hora));
  addDetail(details, 'Código de seguimiento', appointment.codigo_seguimiento);
  if (Object.hasOwn(appointment, 'servicio') && appointment.servicio) {
    addDetail(details, 'Servicio', appointment.servicio);
  }

  card.append(heading, details);

  const actions = document.createElement('div');
  actions.className = 'appointment-card__actions';

  if (appointment.estado === 'pendiente') {
    actions.append(createActionButton('Confirmar', '', () => (
      updateAppointment(appointment.codigo_seguimiento, 'confirmar')
    )));
  } else if (appointment.estado === 'confirmada') {
    const appointmentTime = new Date(appointment.fecha_hora).getTime();

    if (Number.isFinite(appointmentTime) && appointmentTime < Date.now()) {
      actions.append(createActionButton('Marcar no-show', 'no-show-button', () => (
        updateAppointment(appointment.codigo_seguimiento, 'no-show')
      )));
    } else {
      const note = document.createElement('p');
      note.className = 'future-note';
      note.textContent = 'No-show estará disponible después de la fecha y hora de la cita.';
      actions.append(note);
    }
  }

  if (actions.childElementCount) card.append(actions);
  return card;
}

async function loadAppointments() {
  appointmentsLoading.hidden = false;
  appointmentsEmpty.hidden = true;
  appointmentsList.replaceChildren();
  refreshButton.disabled = true;

  try {
    const response = await authenticatedFetch('/admin/solicitudes');
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'No fue posible cargar las solicitudes.');
    }

    appointmentsCount.textContent = result.solicitudes.length;
    appointmentsEmpty.hidden = result.solicitudes.length !== 0;
    appointmentsList.append(...result.solicitudes.map(renderAppointment));
  } catch (error) {
    appointmentsCount.textContent = '0';
    setMessage(panelMessage, error.message || 'No fue posible cargar las solicitudes.', true);
  } finally {
    appointmentsLoading.hidden = true;
    refreshButton.disabled = false;
  }
}

async function validateSession(session) {
  if (!session?.access_token) {
    currentSession = null;
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
    setMessage(message, 'Tu sesión expiró. Solicita un nuevo enlace de acceso.', true);
    return;
  }

  const result = await response.json();
  currentSession = session;
  sessionEmail.textContent = result.user.email;
  clearMessage(message);
  clearMessage(panelMessage);
  showView(adminView);
  await loadAppointments();
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

    if (error) throw error;

    await validateSession(data.session);

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        validateSession(session);
      } else if (event === 'SIGNED_OUT') {
        currentSession = null;
        showView(loginView);
      }
    });
  } catch (error) {
    showView(loginView);
    setMessage(message, error.message || 'No fue posible iniciar la autenticación.', true);
    loginForm.querySelector('button').disabled = true;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(message);

  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  const button = loginForm.querySelector('button');
  const email = new FormData(loginForm).get('email').trim();
  button.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        shouldCreateUser: false,
      },
    });

    if (error) throw error;

    loginForm.reset();
    setMessage(message, 'Revisa tu correo. Te enviamos un enlace seguro para entrar.');
  } catch (error) {
    setMessage(message, 'No fue posible enviar el enlace. Revisa el correo e inténtalo nuevamente.', true);
  } finally {
    button.disabled = false;
  }
});

refreshButton.addEventListener('click', loadAppointments);

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  logoutButton.disabled = false;

  if (error) {
    setMessage(panelMessage, 'No fue posible cerrar la sesión. Inténtalo nuevamente.', true);
    return;
  }

  currentSession = null;
  sessionEmail.textContent = '';
  showView(loginView);
  setMessage(message, 'Sesión cerrada correctamente.');
});

initializeAuth();
