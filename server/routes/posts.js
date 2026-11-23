const express = require('express');
const db = require('../db');
const { exigirLogin, loginOpcional } = require('../auth');
const { limitePosts, limiteInteracoes } = require('../limites');

const router = express.Router();

const CATEGORIAS = ['jogos', 'animes', 'cards', 'gerais'];

const TAMANHO_MAXIMO_IMAGEM = 1.5 * 1024 * 1024;
const ASSINATURAS_IMAGEM = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

function lerImagem(valor) {
  const partes = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(valor));
  if (!partes) return null;
  const [, tipo, base64] = partes;
  const dados = Buffer.from(base64, 'base64');
  if (dados.length === 0 || dados.length > TAMANHO_MAXIMO_IMAGEM) return null;
  if (!ASSINATURAS_IMAGEM[tipo](dados)) return null;
  return { tipo, dados };
}

// Campos de um post como o front espera; $1 = id do usuário logado (ou null)
const SELECT_POST = `
  SELECT p.id, p.categoria, p.conteudo, p.criado_em,
         CASE WHEN p.imagem IS NULL THEN NULL ELSE '/api/posts/' || p.id || '/imagem' END AS imagem,
         u.id AS autor_id, u.nome_usuario AS autor,
         (SELECT COUNT(*) FROM curtidas c WHERE c.post_id = p.id)::int AS curtidas,
         (SELECT COUNT(*) FROM comentarios c WHERE c.post_id = p.id)::int AS comentarios,
         EXISTS (SELECT 1 FROM curtidas c WHERE c.post_id = p.id AND c.usuario_id = $1::int) AS curtido
    FROM posts p
    JOIN usuarios u ON u.id = p.usuario_id`;

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/posts?categoria=animes&depois=42
router.get('/', loginOpcional, async (req, res) => {
  const categoria = CATEGORIAS.includes(req.query.categoria) ? req.query.categoria : null;
  const depois = idValido(req.query.depois);

  const { rows } = await db.query(
    `${SELECT_POST}
      WHERE ($2::text IS NULL OR p.categoria = $2)
        AND ($3::int IS NULL OR p.id > $3)
      ORDER BY p.criado_em DESC
      LIMIT 100`,
    [req.usuario?.id ?? null, categoria, depois]
  );
  res.json(rows);
});

// POST /api/posts  { categoria, conteudo, imagem }
router.post('/', exigirLogin, limitePosts, async (req, res) => {
  const corpo = req.body || {};
  const categoria = String(corpo.categoria || '');
  const conteudo = String(corpo.conteudo || '').trim();
  const imagem = corpo.imagem ? lerImagem(corpo.imagem) : null;

  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ erro: 'Escolha uma categoria válida.' });
  }
  if (corpo.imagem && !imagem) {
    return res.status(400).json({ erro: 'Imagem inválida. Use JPG, PNG ou WEBP de até 1,5 MB.' });
  }
  if (!conteudo && !imagem) {
    return res.status(400).json({ erro: 'Escreva algo ou escolha uma imagem.' });
  }
  if (conteudo.length > 1000) {
    return res.status(400).json({ erro: 'O post deve ter no máximo 1000 caracteres.' });
  }

  const { rows } = await db.query(
    'INSERT INTO posts (usuario_id, categoria, conteudo, imagem, imagem_tipo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [req.usuario.id, categoria, conteudo, imagem?.dados ?? null, imagem?.tipo ?? null]
  );
  const post = await db.query(`${SELECT_POST} WHERE p.id = $2`, [req.usuario.id, rows[0].id]);
  res.status(201).json(post.rows[0]);
});

router.get('/:id/imagem', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Imagem não encontrada.' });

  const { rows } = await db.query('SELECT imagem, imagem_tipo FROM posts WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].imagem) return res.status(404).json({ erro: 'Imagem não encontrada.' });

  res.set('Content-Type', rows[0].imagem_tipo);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(rows[0].imagem);
});

// DELETE /api/posts/:id  (só o autor)
router.delete('/:id', exigirLogin, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Post não encontrado.' });

  const { rows } = await db.query('SELECT usuario_id FROM posts WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Post não encontrado.' });
  if (rows[0].usuario_id !== req.usuario.id) {
    return res.status(403).json({ erro: 'Você só pode apagar seus próprios posts.' });
  }

  await db.query('DELETE FROM posts WHERE id = $1', [id]);
  res.status(204).end();
});

// POST /api/posts/:id/curtir  -> curte ou descurte
router.post('/:id/curtir', exigirLogin, limiteInteracoes, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Post não encontrado.' });

  let curtido;
  try {
    const inserido = await db.query(
      'INSERT INTO curtidas (usuario_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING post_id',
      [req.usuario.id, id]
    );
    curtido = inserido.rowCount > 0;
    if (!curtido) {
      await db.query('DELETE FROM curtidas WHERE usuario_id = $1 AND post_id = $2', [req.usuario.id, id]);
    }
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ erro: 'Post não encontrado.' });
    throw err;
  }

  const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM curtidas WHERE post_id = $1', [id]);
  res.json({ curtido, curtidas: rows[0].total });
});

// GET /api/posts/:id/comentarios
router.get('/:id/comentarios', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Post não encontrado.' });

  const { rows } = await db.query(
    `SELECT c.id, c.conteudo, c.criado_em, u.id AS autor_id, u.nome_usuario AS autor
       FROM comentarios c
       JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.post_id = $1
      ORDER BY c.criado_em ASC`,
    [id]
  );
  res.json(rows);
});

// POST /api/posts/:id/comentarios  { conteudo }
router.post('/:id/comentarios', exigirLogin, limiteInteracoes, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Post não encontrado.' });

  const conteudo = String((req.body || {}).conteudo || '').trim();
  if (!conteudo || conteudo.length > 500) {
    return res.status(400).json({ erro: 'O comentário deve ter entre 1 e 500 caracteres.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO comentarios (post_id, usuario_id, conteudo)
       VALUES ($1, $2, $3)
       RETURNING id, conteudo, criado_em, usuario_id AS autor_id`,
      [id, req.usuario.id, conteudo]
    );
    res.status(201).json({ ...rows[0], autor: req.usuario.nome_usuario });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ erro: 'Post não encontrado.' });
    throw err;
  }
});

module.exports = router;
