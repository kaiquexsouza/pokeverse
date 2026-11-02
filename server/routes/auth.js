const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

function codificarCabecalho(valor) {
  return `=?UTF-8?B?${Buffer.from(valor, 'utf8').toString('base64')}?=`;
}

function codificarCorpo(valor) {
  return Buffer.from(valor, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
}

function criarEmailConvite({ nomeTexto, nomeHtml, link }) {
  const assunto = 'O Pokeverse foi lançado! Finalize seu cadastro';
  const texto = [
    `Olá, ${nomeTexto}!`,
    '',
    'O Pokeverse foi lançado e sua jornada está pronta para começar.',
    'Finalize seu cadastro pelo link abaixo:',
    link,
    '',
    'Se você não solicitou este convite, pode ignorar esta mensagem.',
  ].join('\n');
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Sua jornada no Pokeverse começa agora.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background:#182235;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="width:48px;height:48px;border-radius:50%;background:#ef4444;border:4px solid #ffffff;box-shadow:0 0 0 4px #fbbf24;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding-left:14px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-.5px;">Pokeverse</td>
                </tr>
              </table>
              <p style="margin:18px 0 0;color:#cbd5e1;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">Sua aventura começa agora</p>
            </td>
          </tr>
          <tr>
            <td style="height:7px;background:#ef4444;border-bottom:7px solid #fbbf24;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:40px 42px 32px;">
              <p style="margin:0 0 12px;color:#64748b;font-size:14px;">Olá, ${nomeHtml}!</p>
              <h1 style="margin:0 0 18px;color:#182235;font-size:30px;line-height:1.2;">O Pokeverse foi lançado!</h1>
              <p style="margin:0;color:#475569;font-size:16px;line-height:1.7;">
                Sua jornada está pronta para começar. Crie sua conta e venha fazer parte da comunidade de treinadores.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 28px;">
                <tr>
                  <td style="border-radius:10px;background:#2563eb;">
                    <a href="${link}" style="display:inline-block;padding:15px 25px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Criar minha conta</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Se o botão não funcionar, copie este endereço para o navegador:<br>
                <a href="${link}" style="color:#2563eb;word-break:break-all;">${link}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 42px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
              Você recebeu este e-mail porque se cadastrou para acompanhar o lançamento do Pokeverse.<br>
              Se você não solicitou este convite, pode ignorar esta mensagem.
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#94a3b8;font-size:11px;">Pokeverse · Uma comunidade feita para quem ama explorar</p>
      </td></tr>
    </table>
  </body>
</html>`;
  return { assunto, texto, html };
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
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET
    || !process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_USER) {
    throw new Error('Configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN e GMAIL_USER.');
  }

  if (envioEmAndamento) return envioEmAndamento;

  envioEmAndamento = (async () => {
    const tokenResposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    const tokenDados = await tokenResposta.json().catch(() => ({}));
    if (!tokenResposta.ok || !tokenDados.access_token) {
      throw new Error(`OAuth do Gmail HTTP ${tokenResposta.status}: ${tokenDados.error_description || tokenDados.error || 'resposta inválida'}`);
    }
    const accessToken = tokenDados.access_token;
    const { rows } = await db.query(
      'SELECT id, nome_completo, email FROM pre_cadastros WHERE convidado_em IS NULL ORDER BY id'
    );
    for (const interessado of rows) {
      const token = crypto.randomBytes(32).toString('hex');
      const link = `${URL_SITE}/cadastro.html?token=${token}`;
      const nome = escaparHtml(interessado.nome_completo);
      const { assunto, texto, html } = criarEmailConvite({
        nomeTexto: interessado.nome_completo,
        nomeHtml: nome,
        link: escaparHtml(link),
      });

      const mensagem = [
        `From: ${codificarCabecalho('Pokeverse')} <${process.env.GMAIL_USER}>`,
        `To: ${interessado.email}`,
        `Subject: ${codificarCabecalho(assunto)}`,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="pokeverse-boundary"',
        'X-Auto-Response-Suppress: All',
        '',
        '--pokeverse-boundary',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        codificarCorpo(texto),
        '',
        '--pokeverse-boundary',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        codificarCorpo(html),
        '',
        '--pokeverse-boundary--',
      ].join('\r\n');
      const mensagemCodificada = Buffer.from(mensagem, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const envioResposta = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: mensagemCodificada }),
        }
      );
      const envioDados = await envioResposta.json().catch(() => ({}));
      if (!envioResposta.ok) {
        throw new Error(`Gmail API HTTP ${envioResposta.status}: ${envioDados.error?.message || 'resposta inválida'}`);
      }
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
