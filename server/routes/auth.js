const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { gerarToken, exigirLogin } = require('../auth');

const router = express.Router();

const NOME_USUARIO_VALIDO = /^[a-zA-Z0-9_.]{3,20}$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function respostaComToken(usuario) {
  return {
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome_usuario: usuario.nome_usuario, email: usuario.email },
  };
}

// POST /api/auth/cadastro  { nome_usuario, email, senha }
router.post('/cadastro', async (req, res) => {
  const nome_usuario = String(req.body.nome_usuario || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');

  if (!NOME_USUARIO_VALIDO.test(nome_usuario)) {
    return res.status(400).json({ erro: 'Nome de usuário deve ter de 3 a 20 caracteres: letras, números, "_" ou ".".' });
  }
  if (!EMAIL_VALIDO.test(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  // PROVISÓRIO: reserva o nome/e-mail da conta de visitante
  if (nome_usuario.toLowerCase() === NOME_VISITANTE || email === EMAIL_VISITANTE) {
    return res.status(409).json({ erro: 'Este nome de usuário já está cadastrado.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const senha_hash = await bcrypt.hash(senha, 10);

  try {
    const { rows } = await db.query(
      `INSERT INTO usuarios (nome_usuario, email, senha_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nome_usuario, email`,
      [nome_usuario, email, senha_hash]
    );
    res.status(201).json(respostaComToken(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      const campo = err.constraint === 'usuarios_email_unico' ? 'Este e-mail' : 'Este nome de usuário';
      return res.status(409).json({ erro: `${campo} já está cadastrado.` });
    }
    throw err;
  }
});

// POST /api/auth/login  { login, senha }  (login = nome de usuário ou e-mail)
router.post('/login', async (req, res) => {
  const login = String(req.body.login || '').trim();
  const senha = String(req.body.senha || '');

  if (!login || !senha) {
    return res.status(400).json({ erro: 'Informe usuário (ou e-mail) e senha.' });
  }

  const { rows } = await db.query(
    `SELECT id, nome_usuario, email, senha_hash
       FROM usuarios
      WHERE LOWER(nome_usuario) = LOWER($1) OR LOWER(email) = LOWER($1)
      LIMIT 1`,
    [login]
  );

  const usuario = rows[0];
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: 'Usuário/e-mail ou senha incorretos.' });
  }

  res.json(respostaComToken(usuario));
});

// ===== PROVISÓRIO: acesso sem login (conta de visitante compartilhada) =====
// Para remover: apague este bloco, o NOME_VISITANTE na validação do cadastro
// e as partes marcadas com "PROVISÓRIO" em public/app.js, public/feed.js e public/style.css.
const NOME_VISITANTE = 'visitante';
const EMAIL_VISITANTE = 'visitante@pokeverse.local';

router.post('/visitante', async (req, res) => {
  let { rows } = await db.query(
    'SELECT id, nome_usuario, email FROM usuarios WHERE LOWER(email) = $1',
    [EMAIL_VISITANTE]
  );

  if (!rows[0]) {
    // Senha aleatória: ninguém entra nessa conta pelo login normal
    const senha_hash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);
    ({ rows } = await db.query(
      `INSERT INTO usuarios (nome_usuario, email, senha_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nome_usuario, email`,
      [NOME_VISITANTE, EMAIL_VISITANTE, senha_hash]
    ));
  }

  res.json(respostaComToken(rows[0]));
});
// ===== fim do PROVISÓRIO =====

// GET /api/auth/eu  -> dados do usuário logado
router.get('/eu', exigirLogin, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, nome_usuario, email, criado_em FROM usuarios WHERE id = $1',
    [req.usuario.id]
  );
  if (!rows[0]) return res.status(401).json({ erro: 'Usuário não encontrado.' });
  res.json(rows[0]);
});

module.exports = router;
