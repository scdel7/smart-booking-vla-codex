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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
