require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL y SUPABASE_KEY deben estar definidas.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
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
