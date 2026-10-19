const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function limite(minutos, maximo, mensagem, opcoes = {}) {
  return rateLimit({
    ...opcoes,
    windowMs: minutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { erro: mensagem },
  });
}

const porUsuario = {
  keyGenerator: (req) => (req.usuario ? `usuario-${req.usuario.id}` : ipKeyGenerator(req.ip)),
};

const porUsuarioSoSucessos = { ...porUsuario, skipFailedRequests: true };

module.exports = {
  limiteGeral: limite(15, 1500, 'Muitas requisições. Espere alguns minutos e tente de novo.'),
  limiteLogin: limite(15, 20, 'Muitas tentativas de login. Espere 15 minutos e tente de novo.', {
    skipSuccessfulRequests: true,
  }),
  limiteCadastro: limite(60, 30, 'Muitos cadastros feitos daqui. Espere uma hora e tente de novo.'),
  limitePosts: limite(10, 10, 'Você publicou muitos posts seguidos. Espere alguns minutos.', porUsuarioSoSucessos),
  limiteEncontros: limite(60, 5, 'Você marcou muitos encontros seguidos. Espere um pouco.', porUsuarioSoSucessos),
  limiteInteracoes: limite(1, 30, 'Calma, treinador! Espere um pouco antes de continuar.', porUsuario),
};
