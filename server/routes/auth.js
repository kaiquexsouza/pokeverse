const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');
const { gerarToken, exigirLogin } = require('../auth');

const router = express.Router();

const NOME_USUARIO_VALIDO = /^[a-zA-Z0-9_.]{3,20}$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SITE = process.env.SITE_URL || 'http://localhost:3000';
const DATA_LANCAMENTO = process.env.LAUNCH_AT ? new Date(process.env.LAUNCH_AT) : null;
let envioEmAndamento = null;

function escaparHtml(valor) {
  return valor.replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[caractere]));
}

function respostaComToken(usuario) {
  return {
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome_usuario: usuario.nome_usuario, email: usuario.email },
  };
}

// POST /api/auth/cadastro  { nome_usuario, email, senha }
router.post('/cadastro', async (req, res) => {
  const nome_completo = String(req.body.nome_completo || '').trim();
  const nome_usuario = String(req.body.nome_usuario || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');

  if (nome_completo && (nome_completo.length < 2 || nome_completo.length > 120)) {
    return res.status(400).json({ erro: 'Informe um nome completo válido.' });
  }
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
      `INSERT INTO usuarios (nome_completo, nome_usuario, email, senha_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome_usuario, email`,
      [nome_completo || null, nome_usuario, email, senha_hash]
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

// POST /api/auth/pre-cadastro { nome_completo, email }
router.post('/pre-cadastro', async (req, res) => {
  const nome_completo = String(req.body.nome_completo || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();

  if (nome_completo.length < 2 || nome_completo.length > 120) {
    return res.status(400).json({ erro: 'Informe seu nome completo.' });
  }
  if (!EMAIL_VALIDO.test(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }

  try {
    await db.query(
      `INSERT INTO pre_cadastros (nome_completo, email)
       VALUES ($1, $2)
       ON CONFLICT ((LOWER(email))) DO UPDATE
       SET nome_completo = EXCLUDED.nome_completo`,
      [nome_completo, email]
    );
    res.status(201).json({ mensagem: 'Pré-cadastro confirmado.' });
  } catch (err) {
    throw err;
  }
});

router.get('/pre-cadastro/:token', async (req, res) => {
  const { rows } = await db.query(
    `SELECT nome_completo, email
       FROM pre_cadastros
      WHERE token_convite = $1 AND convidado_em IS NOT NULL`,
    [req.params.token]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Link de cadastro inválido ou expirado.' });
  res.json(rows[0]);
});

router.post('/pre-cadastro/finalizar', async (req, res) => {
  const token = String(req.body.token || '');
  const nome_usuario = String(req.body.nome_usuario || '').trim();
  const senha = String(req.body.senha || '');
  const { rows: interessados } = await db.query(
    `SELECT id, nome_completo, email
       FROM pre_cadastros
      WHERE token_convite = $1 AND convidado_em IS NOT NULL`,
    [token]
  );
  const interessado = interessados[0];
  if (!interessado) return res.status(404).json({ erro: 'Link de cadastro inválido ou expirado.' });
  if (!NOME_USUARIO_VALIDO.test(nome_usuario)) {
    return res.status(400).json({ erro: 'Nome de usuário deve ter de 3 a 20 caracteres: letras, números, "_" ou .'
    });
  }
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });

  const senha_hash = await bcrypt.hash(senha, 10);
  try {
    const { rows } = await db.query(
      `INSERT INTO usuarios (nome_completo, nome_usuario, email, senha_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome_usuario, email`,
      [interessado.nome_completo, nome_usuario, interessado.email, senha_hash]
    );
    await db.query('DELETE FROM pre_cadastros WHERE id = $1', [interessado.id]);
    res.status(201).json(respostaComToken(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      const campo = err.constraint === 'usuarios_email_unico' ? 'Este e-mail' : 'Este nome de usuário';
      return res.status(409).json({ erro: `${campo} já está cadastrado.` });
    }
    throw err;
  }
});

async function notificarLancamento() {
  if (!DATA_LANCAMENTO || DATA_LANCAMENTO > new Date()) return { enviados: 0 };
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Configure SMTP_USER e SMTP_PASS com o Gmail e a senha de aplicativo.');
  }

  if (envioEmAndamento) return envioEmAndamento;

  envioEmAndamento = (async () => {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const configuracoes = [
      {
        port: Number(process.env.SMTP_PORT || 465),
        secure: process.env.SMTP_SECURE !== 'false',
      },
      { port: 587, secure: false },
    ];
    let transporter;
    let ultimoErro;
    for (const configuracao of configuracoes) {
      transporter = nodemailer.createTransport({
        host,
        ...configuracao,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      try {
        await transporter.verify();
        break;
      } catch (err) {
        ultimoErro = err;
        transporter.close();
        transporter = null;
      }
    }
    if (!transporter) {
      throw new Error(`Não foi possível conectar ao Gmail por SMTP: ${ultimoErro.message}`);
    }
    const { rows } = await db.query(
      'SELECT id, nome_completo, email FROM pre_cadastros WHERE convidado_em IS NULL ORDER BY id'
    );
    for (const interessado of rows) {
      const token = crypto.randomBytes(32).toString('hex');
      const link = `${URL_SITE}/cadastro.html?token=${token}`;
      const nome = escaparHtml(interessado.nome_completo);
      const assunto = 'O Pokeverse foi lançado! Finalize seu cadastro';
      const texto = `Olá, ${interessado.nome_completo}! Finalize seu cadastro no Pokeverse: ${link}`;
      const html = `<p>Olá, ${nome}!</p><p>O Pokeverse foi lançado. Finalize seu cadastro pelo link abaixo:</p><p><a href="${link}">Criar minha conta</a></p>`;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: interessado.email,
        subject: assunto,
        text: texto,
        html,
      });
      await db.query(
        'UPDATE pre_cadastros SET token_convite = $1, convidado_em = NOW() WHERE id = $2',
        [token, interessado.id]
      );
    }
    return { enviados: rows.length };
  })();

  try {
    return await envioEmAndamento;
  } finally {
    envioEmAndamento = null;
  }
}

router.post('/notificar-lancamento', async (req, res) => {
  if (!process.env.LAUNCH_ADMIN_TOKEN || req.get('x-launch-token') !== process.env.LAUNCH_ADMIN_TOKEN) {
    return res.status(401).json({ erro: 'Não autorizado.' });
  }
  try {
    const resultado = await notificarLancamento();
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS pendentes FROM pre_cadastros WHERE convidado_em IS NULL'
    );
    res.json({ ...resultado, pendentes: rows[0].pendentes });
  } catch (err) {
    console.error('Falha no disparo manual dos convites:', err);
    res.status(502).json({ erro: `Não foi possível enviar os convites: ${err.message}` });
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

function iniciarAgendamentoLancamento() {
  if (!DATA_LANCAMENTO || Number.isNaN(DATA_LANCAMENTO.getTime())) return;
  const verificar = async () => {
    if (new Date() < DATA_LANCAMENTO) return;
    try {
      const resultado = await notificarLancamento();
      if (resultado.enviados) console.log(`Convites de lançamento enviados: ${resultado.enviados}.`);
    } catch (err) {
      console.error('Não foi possível enviar os convites de lançamento:', err.message);
    }
  };
  verificar();
  setInterval(verificar, 60_000);
}

module.exports = { router, iniciarAgendamentoLancamento, notificarLancamento };
