const bookingForm = document.querySelector('#booking-form');
const lookupForm = document.querySelector('#lookup-form');
const bookingMessage = document.querySelector('#booking-message');
const lookupMessage = document.querySelector('#lookup-message');
const bookingResult = document.querySelector('#booking-result');
const appointmentResult = document.querySelector('#appointment-result');
const trackingCode = document.querySelector('#tracking-code');
const copyCodeButton = document.querySelector('#copy-code');

function showMessage(element, message, type = 'error') {
  element.textContent = message;
  element.classList.toggle('message--success', type === 'success');
  element.hidden = false;
}

function hideMessage(element) {
  element.hidden = true;
  element.textContent = '';
  element.classList.remove('message--success');
}

function setLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = loading;
  button.setAttribute('aria-busy', String(loading));
}

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(bookingMessage);
  bookingResult.hidden = true;

  if (!bookingForm.checkValidity()) {
    bookingForm.reportValidity();
    return;
  }

  const formData = new FormData(bookingForm);
  const fechaHora = new Date(formData.get('fecha_hora'));
  const payload = {
    nombre: formData.get('nombre').trim(),
    contacto: formData.get('contacto').trim(),
    fecha_hora: fechaHora.toISOString(),
  };

  setLoading(bookingForm, true);

  try {
    const response = await fetch('/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'No fue posible reservar la cita.');
    }

    trackingCode.textContent = result.solicitud.codigo_seguimiento;
    bookingResult.hidden = false;
    showMessage(bookingMessage, '¡Tu cita fue reservada correctamente!', 'success');
    bookingForm.reset();
  } catch (error) {
    showMessage(bookingMessage, error.message || 'No fue posible reservar la cita. Inténtalo nuevamente.');
  } finally {
    setLoading(bookingForm, false);
  }
});

copyCodeButton.addEventListener('click', async () => {
  const code = trackingCode.textContent;

  try {
    await navigator.clipboard.writeText(code);
    copyCodeButton.textContent = '¡Copiado!';
    window.setTimeout(() => {
      copyCodeButton.textContent = 'Copiar';
    }, 1800);
  } catch {
    showMessage(bookingMessage, `Copia este código: ${code}`, 'success');
  }
});

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(lookupMessage);
  appointmentResult.hidden = true;

  if (!lookupForm.checkValidity()) {
    lookupForm.reportValidity();
    return;
  }

  const formData = new FormData(lookupForm);
  const code = formData.get('codigo_seguimiento').trim().toUpperCase();
  setLoading(lookupForm, true);

  try {
    const response = await fetch(`/solicitudes/${encodeURIComponent(code)}`);
    const result = await response.json();

    if (response.status === 404) {
      showMessage(lookupMessage, 'No encontramos una cita con ese código. Revísalo e inténtalo nuevamente.');
      return;
    }

    if (!response.ok) {
      throw new Error('No fue posible consultar la cita. Inténtalo nuevamente.');
    }

    const solicitud = result.solicitud;
    document.querySelector('#result-name').textContent = solicitud.nombre;
    document.querySelector('#result-contact').textContent = solicitud.contacto;
    document.querySelector('#result-date').textContent = new Intl.DateTimeFormat('es', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(solicitud.fecha_hora));
    document.querySelector('#result-status').textContent = solicitud.estado;
    document.querySelector('#result-code').textContent = solicitud.codigo_seguimiento;
    appointmentResult.hidden = false;
  } catch (error) {
    showMessage(lookupMessage, error.message || 'No fue posible consultar la cita. Inténtalo nuevamente.');
  } finally {
    setLoading(lookupForm, false);
  }
});
