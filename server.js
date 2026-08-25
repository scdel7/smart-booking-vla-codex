require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL y SUPABASE_KEY deben estar definidas.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());
app.use(express.static('public'));

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

app.get('/clima', async (request, response) => {
  const { fecha } = request.query;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return response.status(400).json({
      ok: false,
      error: 'La fecha es obligatoria y debe tener el formato YYYY-MM-DD.',
    });
  }

  const fechaSolicitada = new Date(`${fecha}T00:00:00Z`);

  if (Number.isNaN(fechaSolicitada.getTime()) || fechaSolicitada.toISOString().slice(0, 10) !== fecha) {
    return response.status(400).json({
      ok: false,
      error: 'La fecha indicada no es válida.',
    });
  }

  if (!openWeatherApiKey) {
    console.error('OPENWEATHER_API_KEY no está definida.');
    return response.status(500).json({
      ok: false,
      error: 'El servicio de clima no está configurado.',
    });
  }

  try {
    const forecastUrl = new URL('https://api.openweathermap.org/data/2.5/forecast');
    forecastUrl.searchParams.set('lat', '9.9567');
    forecastUrl.searchParams.set('lon', '-84.0704');
    forecastUrl.searchParams.set('appid', openWeatherApiKey);
    forecastUrl.searchParams.set('units', 'metric');
    forecastUrl.searchParams.set('lang', 'es');

    const forecastResponse = await fetch(forecastUrl);

    if (!forecastResponse.ok) {
      throw new Error(`Pronóstico respondió HTTP ${forecastResponse.status}`);
    }

    const forecast = await forecastResponse.json();
    const timezoneOffset = forecast.city?.timezone || 0;
    const localDate = (unixTime) => new Date((unixTime + timezoneOffset) * 1000)
      .toISOString()
      .slice(0, 10);
    const availableDates = [...new Set(forecast.list.map((item) => localDate(item.dt)))];

    if (!availableDates.includes(fecha)) {
      return response.status(400).json({
        ok: false,
        error: 'La fecha está fuera del rango disponible del pronóstico de 5 días.',
        rango_disponible: {
          desde: availableDates[0],
          hasta: availableDates[availableDates.length - 1],
        },
      });
    }

    const dailyForecast = forecast.list.filter((item) => localDate(item.dt) === fecha);
    const middayForecast = dailyForecast.reduce((closest, item) => {
      const localHour = new Date((item.dt + timezoneOffset) * 1000).getUTCHours();
      const closestHour = new Date((closest.dt + timezoneOffset) * 1000).getUTCHours();
      return Math.abs(localHour - 12) < Math.abs(closestHour - 12) ? item : closest;
    });

    const averageTemperature = dailyForecast.reduce((sum, item) => sum + item.main.temp, 0)
      / dailyForecast.length;

    return response.json({
      ok: true,
      fecha,
      ubicacion: 'Tibás, Costa Rica',
      temperatura: Math.round(averageTemperature),
      minima: Math.round(Math.min(...dailyForecast.map((item) => item.main.temp_min))),
      maxima: Math.round(Math.max(...dailyForecast.map((item) => item.main.temp_max))),
      descripcion: middayForecast.weather[0].description,
    });
  } catch (error) {
    console.error('No se pudo consultar OpenWeather:', error.message);
    return response.status(502).json({
      ok: false,
      error: 'No se pudo obtener el pronóstico en este momento.',
    });
  }
});

app.post('/solicitudes', async (request, response) => {
  const { nombre, contacto, fecha_hora } = request.body;

  if (!nombre || !contacto || !fecha_hora) {
    return response.status(400).json({
      error: 'nombre, contacto y fecha_hora son obligatorios.',
    });
  }

  const codigoSeguimiento = `SOL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const nuevaSolicitud = {
    codigo_seguimiento: codigoSeguimiento,
    nombre,
    contacto,
    fecha_hora,
    estado: 'pendiente',
  };

  const { error } = await supabase
    .from('solicitudes')
    .insert(nuevaSolicitud);

  if (error) {
    console.error('No se pudo crear la solicitud:', error.message);
    return response.status(500).json({
      error: 'No se pudo crear la solicitud.',
    });
  }

  return response.status(201).json({
    mensaje: 'Solicitud creada correctamente.',
    solicitud: nuevaSolicitud,
  });
});

app.get('/solicitudes/:codigo', async (request, response) => {
  const { codigo } = request.params;

  const { data, error } = await supabase
    .from('solicitudes')
    .select('id, codigo_seguimiento, nombre, contacto, fecha_hora, estado, creado_en')
    .eq('codigo_seguimiento', codigo)
    .maybeSingle();

  if (error) {
    console.error('No se pudo consultar la solicitud:', error.message);
    return response.status(500).json({
      error: 'No se pudo consultar la solicitud.',
    });
  }

  if (!data) {
    return response.status(404).json({
      error: 'Solicitud no encontrada.',
    });
  }

  return response.json({ solicitud: data });
});

app.patch('/solicitudes/:codigo/confirmar', async (request, response) => {
  const { codigo } = request.params;

  const { data, error } = await supabase
    .from('solicitudes')
    .update({ estado: 'confirmada' })
    .eq('codigo_seguimiento', codigo)
    .select('id, codigo_seguimiento, nombre, contacto, fecha_hora, estado, creado_en')
    .maybeSingle();

  if (error) {
    console.error('No se pudo confirmar la solicitud:', error.message);
    return response.status(500).json({
      error: 'No se pudo confirmar la solicitud.',
    });
  }

  if (!data) {
    return response.status(404).json({
      error: 'Solicitud no encontrada.',
    });
  }

  return response.json({
    mensaje: 'Solicitud confirmada correctamente.',
    solicitud: data,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
