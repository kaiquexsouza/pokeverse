// Controle do lançamento. A data vem da variável de ambiente LAUNCH_AT
// (ex.: 2026-11-30T03:00:00.000Z = 00:00 de 30/11 em Brasília).
// Sem LAUNCH_AT, ou com data inválida, o site fica no modo pré-cadastro.

function dataLancamento() {
  if (!process.env.LAUNCH_AT) return null;
  const data = new Date(process.env.LAUNCH_AT);
  return Number.isNaN(data.getTime()) ? null : data;
}

function lancado() {
  const data = dataLancamento();
  return Boolean(data && data <= new Date());
}

// Middleware: bloqueia a rota até o lançamento.
function exigirLancado(req, res, next) {
  if (lancado()) return next();
  res.status(403).json({ erro: 'O Pokeverse ainda não foi lançado.' });
}

module.exports = { dataLancamento, lancado, exigirLancado };
