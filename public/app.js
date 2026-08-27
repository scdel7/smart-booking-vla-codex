const bookingForm = document.querySelector('#booking-form');
const lookupForm = document.querySelector('#lookup-form');
const bookingMessage = document.querySelector('#booking-message');
const lookupMessage = document.querySelector('#lookup-message');
const bookingResult = document.querySelector('#booking-result');
const appointmentResult = document.querySelector('#appointment-result');
const trackingCode = document.querySelector('#tracking-code');
const copyCodeButton = document.querySelector('#copy-code');
const dateTimeInput = document.querySelector('#fecha_hora');
const weatherCard = document.querySelector('#weather-card');
const weatherIcon = document.querySelector('#weather-icon');
const weatherLocation = document.querySelector('#weather-location');
const weatherDetails = document.querySelector('#weather-details');
const weatherTemperature = document.querySelector('#weather-temperature');
const weatherRange = document.querySelector('#weather-range');
const weatherDescription = document.querySelector('#weather-description');
const weatherMessage = document.querySelector('#weather-message');

let weatherRequest;

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

function getWeatherIcon(description) {
  const normalizedDescription = description.toLowerCase();
  if (normalizedDescription.includes('lluv') || normalizedDescription.includes('torment')) return '🌧️';
  if (normalizedDescription.includes('nub')) return '☁️';
  return '☀️';
}

function showWeatherMessage(message) {
  weatherCard.hidden = false;
  weatherCard.removeAttribute('aria-busy');
  weatherDetails.hidden = true;
  weatherLocation.textContent = '';
  weatherMessage.textContent = message;
  weatherMessage.hidden = false;
  weatherIcon.textContent = '☁️';
}

function clearWeather() {
  if (weatherRequest) weatherRequest.abort();
  weatherCard.hidden = true;
  weatherCard.removeAttribute('aria-busy');
  weatherMessage.hidden = true;
  weatherDetails.hidden = false;
}

async function loadWeather(date) {
  if (weatherRequest) weatherRequest.abort();
  weatherRequest = new AbortController();
  weatherCard.hidden = false;
  weatherCard.setAttribute('aria-busy', 'true');
  weatherDetails.hidden = true;
  weatherMessage.textContent = 'Consultando el pronóstico…';
  weatherMessage.hidden = false;
  weatherLocation.textContent = '';

  try {
    const response = await fetch(`/clima?fecha=${encodeURIComponent(date)}`, {
      signal: weatherRequest.signal,
    });
    const result = await response.json();

    if (response.status === 400) {
      showWeatherMessage('El pronóstico todavía no está disponible para esta fecha.');
      return;
    }

    if (!response.ok) {
      throw new Error('Weather request failed');
    }

    weatherIcon.textContent = getWeatherIcon(result.descripcion);
    weatherLocation.textContent = result.ubicacion;
    weatherTemperature.textContent = `${result.temperatura} °C`;
    weatherRange.textContent = `Mín. ${result.minima} °C · Máx. ${result.maxima} °C`;
    weatherDescription.textContent = result.descripcion;
    weatherMessage.hidden = true;
    weatherDetails.hidden = false;
    weatherCard.removeAttribute('aria-busy');
  } catch (error) {
    if (error.name !== 'AbortError') {
      showWeatherMessage('No pudimos consultar el clima en este momento.');
    }
  }
}

dateTimeInput.addEventListener('change', () => {
  const date = dateTimeInput.value.split('T')[0];
  if (date) loadWeather(date);
  else clearWeather();
});

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
    clearWeather();
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
