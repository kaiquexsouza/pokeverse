const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { gerarToken, exigirLogin } = require('../auth');
const { limiteLogin, limiteCadastro } = require('../limites');

const router = express.Router();

const NOME_USUARIO_VALIDO = /^[a-zA-Z0-9_.]{3,20}$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', 10);

function respostaComToken(usuario) {
  return {
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome_usuario: usuario.nome_usuario, email: usuario.email },
  };
}

// POST /api/auth/cadastro  { nome_usuario, email, senha }
router.post('/cadastro', limiteCadastro, async (req, res) => {
  const corpo = req.body || {};
  const nome_usuario = String(corpo.nome_usuario || '').trim();
  const email = String(corpo.email || '').trim().toLowerCase();
  const senha = String(corpo.senha || '');

  if (!NOME_USUARIO_VALIDO.test(nome_usuario)) {
    return res.status(400).json({ erro: 'Nome de usuário deve ter de 3 a 20 caracteres: letras, números, "_" ou ".".' });
  }
  if (!EMAIL_VALIDO.test(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  if (senha.length < 6 || senha.length > 72) {
    return res.status(400).json({ erro: 'A senha deve ter de 6 a 72 caracteres.' });
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
router.post('/login', limiteLogin, async (req, res) => {
  const corpo = req.body || {};
  const login = String(corpo.login || '').trim();
  const senha = String(corpo.senha || '');

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
  const senhaConfere = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);
  if (!usuario || !senhaConfere) {
    return res.status(401).json({ erro: 'Usuário/e-mail ou senha incorretos.' });
  }

  res.json(respostaComToken(usuario));
});

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
