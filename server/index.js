require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const db = require('./db');
const { limiteGeral } = require('./limites');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCAO = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': PRODUCAO ? [] : null,
      },
    },
  })
);

app.post('/api/posts', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '20kb' }));

// API
app.use('/api', limiteGeral);
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

app.get('/api/estatisticas', async (req, res) => {
  const { rows } = await db.query(
    `SELECT (SELECT COUNT(*) FROM usuarios)::int AS membros,
            (SELECT COUNT(*) FROM posts)::int    AS posts`
  );
  res.json(rows[0]);
});

app.get('/api/saude', (req, res) => res.json({ ok: true }));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Site (HTML, CSS e JS)
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// JSON inválido no corpo ou erro inesperado
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Conteúdo grande demais. Tente uma imagem menor.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

db.initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Pokeverse rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Não foi possível conectar ao banco de dados:', err.message);
    process.exit(1);
  });
