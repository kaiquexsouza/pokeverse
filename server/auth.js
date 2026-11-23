const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-desenvolvimento';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Defina a variável JWT_SECRET em produção.');
    process.exit(1);
  }
  console.warn('JWT_SECRET não definido: usando um segredo de desenvolvimento.');
}

function gerarToken(usuario) {
  return jwt.sign({ id: usuario.id, nome_usuario: usuario.nome_usuario }, JWT_SECRET, { expiresIn: '7d' });
}

function lerUsuario(req) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) return null;

  try {
    const { id, nome_usuario } = jwt.verify(token, JWT_SECRET);
    return { id, nome_usuario };
  } catch {
    return null;
  }
}

// Rotas que exigem login
async function exigirLogin(req, res, next) {
  const doToken = lerUsuario(req);
  if (!doToken) return res.status(401).json({ erro: 'Faça login para continuar.' });

  const { rows } = await db.query('SELECT id, nome_usuario FROM usuarios WHERE id = $1', [doToken.id]);
  if (!rows[0]) return res.status(401).json({ erro: 'Sua conta não foi encontrada. Faça login de novo.' });

  req.usuario = rows[0];
  next();
}

// Rotas públicas que mudam a resposta se houver login (ex.: "curtido por mim")
function loginOpcional(req, res, next) {
  req.usuario = lerUsuario(req);
  next();
}

module.exports = { gerarToken, exigirLogin, loginOpcional };
