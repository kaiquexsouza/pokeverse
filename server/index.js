require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const db = require('./db');
const { limiteGeral } = require('./limites');
const { dataLancamento, lancado, exigirLancado } = require('./lancamento');
const {
  router: authRoutes,
  iniciarAgendamentoLancamento,
  notificarLancamento,
} = require('./routes/auth');
const postRoutes = require('./routes/posts');
const encontroRoutes = require('./routes/encontros');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCAO = process.env.NODE_ENV === 'production';
const PUBLIC = path.join(__dirname, '..', 'public');

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
// Até o lançamento, o site completo (posts e encontros) fica fechado.
app.use('/api/posts', exigirLancado, postRoutes);
app.use('/api/encontros', exigirLancado, encontroRoutes);

app.get('/api/estatisticas', async (req, res) => {
  const launched = lancado();
  // Antes do lançamento conta os interessados; depois, os usuários.
  const { rows } = await db.query(
    `SELECT (SELECT COUNT(*) FROM ${launched ? 'usuarios' : 'pre_cadastros'})::int AS membros,
            (SELECT COUNT(*) FROM posts)::int AS posts`
  );
  res.json({ ...rows[0], launched });
});

app.get('/api/lancamento', (req, res) => {
  const data = dataLancamento();
  const launched = lancado();
  if (launched) {
    notificarLancamento()
      .then(({ enviados }) => {
        if (enviados) console.log(`Convites enviados após verificação de lançamento: ${enviados}.`);
      })
      .catch((err) => console.error('Falha ao enviar convites após o lançamento:', err.message));
  }
  res.json({ launchAt: data ? data.toISOString() : null, launched });
});

app.get('/api/saude', (req, res) => res.json({ ok: true }));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// ===== Site (HTML, CSS e JS) =====
// Antes do lançamento, qualquer página do site mostra o pré-cadastro.
// Depois do lançamento, o site completo (public/index.html) assume sozinho.
const ARQUIVOS_PRE_LANCAMENTO = new Set([
  '/pre-cadastro.js',
  '/pre-cadastro-app.js',
  '/style.css',
  '/favicon.svg',
]);

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  if (lancado()) {
    // A tela de pré-cadastro não existe mais depois do lançamento.
    if (req.path === '/pre-cadastro.html') return res.redirect('/');
    return next();
  }

  if (ARQUIVOS_PRE_LANCAMENTO.has(req.path)) return next();
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC, 'pre-cadastro.html'));
});

app.use(express.static(PUBLIC, { extensions: ['html'] }));

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
    iniciarAgendamentoLancamento();
    app.listen(PORT, () => console.log(`Pokeverse rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Não foi possível conectar ao banco de dados:', err.message);
    process.exit(1);
  });
