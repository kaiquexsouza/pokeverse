require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./db');
const {
  router: authRoutes,
  iniciarAgendamentoLancamento,
  notificarLancamento,
} = require('./routes/auth');
const postRoutes = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20kb' }));

// API
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

app.get('/api/estatisticas', async (req, res) => {
  const { rows } = await db.query(
    `SELECT (SELECT COUNT(*) FROM pre_cadastros)::int AS membros,
            (SELECT COUNT(*) FROM posts)::int    AS posts`
  );
  res.json(rows[0]);
});

app.get('/api/lancamento', (req, res) => {
  const lancamento = process.env.LAUNCH_AT ? new Date(process.env.LAUNCH_AT) : null;
  const launched = Boolean(lancamento && lancamento <= new Date());
  if (launched) {
    notificarLancamento()
      .then(({ enviados }) => {
        if (enviados) console.log(`Convites enviados após verificação de lançamento: ${enviados}.`);
      })
      .catch((err) => console.error('Falha ao enviar convites após o lançamento:', err.message));
  }
  res.json({
    launchAt: lancamento && !Number.isNaN(lancamento.getTime()) ? lancamento.toISOString() : null,
    launched,
  });
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
