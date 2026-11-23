const express = require('express');
const db = require('../db');
const { exigirLogin, loginOpcional } = require('../auth');
const { limiteEncontros, limiteInteracoes } = require('../limites');

const router = express.Router();

const TIPOS = ['batalha', 'troca', 'torneio', 'anime', 'papo'];
const DIAS_MAXIMOS = 180;
const ACENTOS = 'áàâãäéèêëíìîïóòôõöúùûüç';
const SEM_ACENTOS = 'aaaaaeeeeiiiiooooouuuuc';

const SELECT_ENCONTRO = `
  SELECT e.id, e.tipo, e.titulo, e.descricao, e.data_hora, e.cidade, e.vagas,
         CASE WHEN $1::int IS NULL THEN NULL ELSE e.local END AS local,
         u.id AS organizador_id, u.nome_usuario AS organizador,
         (SELECT COUNT(*) FROM encontro_participantes p WHERE p.encontro_id = e.id)::int AS participantes,
         EXISTS (
           SELECT 1 FROM encontro_participantes p WHERE p.encontro_id = e.id AND p.usuario_id = $1::int
         ) AS vou,
         CASE WHEN $1::int IS NULL THEN '[]'::json ELSE COALESCE((
           SELECT json_agg(x.nome_usuario ORDER BY x.criado_em)
             FROM (
               SELECT u2.nome_usuario, p.criado_em
                 FROM encontro_participantes p
                 JOIN usuarios u2 ON u2.id = p.usuario_id
                WHERE p.encontro_id = e.id
                ORDER BY p.criado_em
                LIMIT 12
             ) x
         ), '[]'::json) END AS nomes
    FROM encontros e
    JOIN usuarios u ON u.id = e.organizador_id`;

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function semAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function texto(valor) {
  return String(valor ?? '').trim();
}

async function buscarEncontro(id, usuarioId) {
  const { rows } = await db.query(`${SELECT_ENCONTRO} WHERE e.id = $2`, [usuarioId ?? null, id]);
  return rows[0];
}

router.get('/', loginOpcional, async (req, res) => {
  const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : null;
  const cidade = texto(req.query.cidade).slice(0, 60);
  const meus = req.query.meus === '1';
  const limite = Math.min(idValido(req.query.limite) ?? 100, 100);

  if (meus && !req.usuario) return res.status(401).json({ erro: 'Faça login para ver seus encontros.' });

  const padraoCidade = cidade ? `%${semAcentos(cidade).replace(/[\\%_]/g, '\\$&')}%` : null;

  const { rows } = await db.query(
    `${SELECT_ENCONTRO}
      WHERE e.data_hora > NOW() - INTERVAL '3 hours'
        AND ($2::text IS NULL OR e.tipo = $2)
        AND ($3::text IS NULL OR translate(LOWER(e.cidade), '${ACENTOS}', '${SEM_ACENTOS}') LIKE $3)
        AND (NOT $4::boolean OR EXISTS (
          SELECT 1 FROM encontro_participantes p WHERE p.encontro_id = e.id AND p.usuario_id = $1::int
        ))
      ORDER BY e.data_hora ASC
      LIMIT $5`,
    [req.usuario?.id ?? null, tipo, padraoCidade, meus, limite]
  );
  res.json(rows);
});

router.post('/', exigirLogin, limiteEncontros, async (req, res) => {
  const corpo = req.body || {};
  const tipo = texto(corpo.tipo);
  const titulo = texto(corpo.titulo);
  const descricao = texto(corpo.descricao);
  const local = texto(corpo.local);
  const cidade = texto(corpo.cidade);
  const vagas = corpo.vagas === null || corpo.vagas === undefined || corpo.vagas === '' ? null : Number(corpo.vagas);
  const dataHora = new Date(corpo.data_hora);

  if (!TIPOS.includes(tipo)) return res.status(400).json({ erro: 'Escolha o tipo do encontro.' });
  if (titulo.length < 3 || titulo.length > 80) {
    return res.status(400).json({ erro: 'O título deve ter de 3 a 80 caracteres.' });
  }
  if (Number.isNaN(dataHora.getTime())) return res.status(400).json({ erro: 'Informe a data e a hora.' });
  if (dataHora.getTime() < Date.now()) return res.status(400).json({ erro: 'A data do encontro precisa ser no futuro.' });
  if (dataHora.getTime() > Date.now() + DIAS_MAXIMOS * 86400000) {
    return res.status(400).json({ erro: `Marque o encontro para no máximo ${DIAS_MAXIMOS} dias a partir de hoje.` });
  }
  if (local.length < 3 || local.length > 160) {
    return res.status(400).json({ erro: 'Informe o local (de 3 a 160 caracteres).' });
  }
  if (cidade.length < 2 || cidade.length > 60) {
    return res.status(400).json({ erro: 'Informe a cidade (de 2 a 60 caracteres).' });
  }
  if (vagas !== null && (!Number.isInteger(vagas) || vagas < 2 || vagas > 500)) {
    return res.status(400).json({ erro: 'As vagas devem ser um número de 2 a 500 (ou deixe em branco).' });
  }
  if (descricao.length > 1000) {
    return res.status(400).json({ erro: 'A descrição deve ter no máximo 1000 caracteres.' });
  }

  const id = await db.transacao(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO encontros (organizador_id, tipo, titulo, descricao, data_hora, local, cidade, vagas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [req.usuario.id, tipo, titulo, descricao, dataHora, local, cidade, vagas]
    );
    await cliente.query('INSERT INTO encontro_participantes (encontro_id, usuario_id) VALUES ($1, $2)', [
      rows[0].id,
      req.usuario.id,
    ]);
    return rows[0].id;
  });

  res.status(201).json(await buscarEncontro(id, req.usuario.id));
});

router.delete('/:id', exigirLogin, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Encontro não encontrado.' });

  const { rows } = await db.query('SELECT organizador_id FROM encontros WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Encontro não encontrado.' });
  if (rows[0].organizador_id !== req.usuario.id) {
    return res.status(403).json({ erro: 'Só quem organizou pode cancelar o encontro.' });
  }

  await db.query('DELETE FROM encontros WHERE id = $1', [id]);
  res.status(204).end();
});

router.post('/:id/participar', exigirLogin, limiteInteracoes, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ erro: 'Encontro não encontrado.' });

  const erro = await db.transacao(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT organizador_id, vagas, data_hora FROM encontros WHERE id = $1 FOR UPDATE',
      [id]
    );
    const encontro = rows[0];
    if (!encontro) return [404, 'Encontro não encontrado.'];
    if (encontro.data_hora < new Date()) return [400, 'Esse encontro já começou.'];
    if (encontro.organizador_id === req.usuario.id) {
      return [400, 'Quem organiza não pode sair. Se precisar, cancele o encontro.'];
    }

    const removido = await cliente.query(
      'DELETE FROM encontro_participantes WHERE encontro_id = $1 AND usuario_id = $2 RETURNING usuario_id',
      [id, req.usuario.id]
    );
    if (removido.rowCount > 0) return null;

    const { rows: contagem } = await cliente.query(
      'SELECT COUNT(*)::int AS total FROM encontro_participantes WHERE encontro_id = $1',
      [id]
    );
    if (encontro.vagas !== null && contagem[0].total >= encontro.vagas) return [409, 'As vagas desse encontro acabaram.'];

    await cliente.query('INSERT INTO encontro_participantes (encontro_id, usuario_id) VALUES ($1, $2)', [id, req.usuario.id]);
    return null;
  });

  if (erro) return res.status(erro[0]).json({ erro: erro[1] });
  res.json(await buscarEncontro(id, req.usuario.id));
});

module.exports = router;
