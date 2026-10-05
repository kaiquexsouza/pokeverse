const express = require('express');
const db = require('../db');
const { exigirLogin, loginOpcional } = require('../auth');

const router = express.Router();

const CATEGORIAS = ['jogos', 'animes', 'cards', 'gerais'];

// Campos de um post como o front espera; $1 = id do usuário logado (ou null)
const SELECT_POST = `
  SELECT p.id, p.categoria, p.conteudo, p.criado_em,
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

// GET /api/posts?categoria=animes
router.get('/', loginOpcional, async (req, res) => {
  const categoria = CATEGORIAS.includes(req.query.categoria) ? req.query.categoria : null;

  const { rows } = await db.query(
    `${SELECT_POST}
      WHERE ($2::text IS NULL OR p.categoria = $2)
      ORDER BY p.criado_em DESC
      LIMIT 100`,
    [req.usuario?.id ?? null, categoria]
  );
  res.json(rows);
});

// POST /api/posts  { categoria, conteudo }
router.post('/', exigirLogin, async (req, res) => {
  const categoria = String(req.body.categoria || '');
  const conteudo = String(req.body.conteudo || '').trim();

  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ erro: 'Escolha uma categoria válida.' });
  }
  if (!conteudo || conteudo.length > 1000) {
    return res.status(400).json({ erro: 'O post deve ter entre 1 e 1000 caracteres.' });
  }

  const { rows } = await db.query(
    'INSERT INTO posts (usuario_id, categoria, conteudo) VALUES ($1, $2, $3) RETURNING id',
    [req.usuario.id, categoria, conteudo]
  );
  const post = await db.query(`${SELECT_POST} WHERE p.id = $2`, [req.usuario.id, rows[0].id]);
  res.status(201).json(post.rows[0]);
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
router.post('/:id/curtir', exigirLogin, async (req, res) => {
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
router.post('/:id/comentarios', exigirLogin, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Post não encontrado.' });

  const conteudo = String(req.body.conteudo || '').trim();
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
