// Landing page: contador de interessados e pré-cadastro.

const form = document.getElementById('join-form');
const success = document.getElementById('join-success');
const successTitle = document.getElementById('success-title');
const joinError = document.getElementById('join-error');
const joinSubmit = document.getElementById('join-submit');
const launchCountdown = document.getElementById('launch-countdown');
const launchPill = document.querySelector('.pill-red span:last-child');

// ===== Contadores (vêm do banco) =====
// Anima o número do valor atual até o novo
function animarContador(elemento, valorFinal) {
  const valorInicial = Number(elemento.dataset.valor) || 0;
  elemento.dataset.valor = valorFinal;
  const duracao = 800;
  const inicio = performance.now();

  function passo(agora) {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    const atual = Math.round(valorInicial + (valorFinal - valorInicial) * progresso);
    elemento.textContent = App.formatarNumero(atual);
    if (progresso < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

async function carregarEstatisticas() {
  try {
    const { membros, posts } = await App.api('/estatisticas');
    animarContador(document.getElementById('stat-membros'), membros);
    animarContador(document.getElementById('stat-posts'), posts);

    const cta = document.getElementById('cta-membros');
    if (membros === 0) cta.textContent = 'Seja uma das primeiras pessoas a receber o convite.';
    else if (membros === 1) cta.textContent = '1 pessoa já está na lista de espera.';
    else cta.textContent = `${App.formatarNumero(membros)} pessoas já estão na lista de espera.`;
  } catch {
    // Sem servidor: mantém os textos padrão
  }

  async function carregarLancamento() {
    try {
      const { launchAt, launched } = await App.api('/lancamento');
      if (!launchAt) {
        launchCountdown.textContent = 'Data em breve';
        return;
      }

      const data = new Date(launchAt);
      const atualizar = () => {
        const restante = data.getTime() - Date.now();
        if (restante <= 0 || launched) {
          launchCountdown.textContent = 'Já estamos no ar!';
          launchPill.textContent = 'Comunidade lançada';
          return;
        }
        const dias = Math.floor(restante / 86400000);
        const horas = Math.floor((restante % 86400000) / 3600000);
        const minutos = Math.floor((restante % 3600000) / 60000);
        const segundos = Math.floor((restante % 60000) / 1000);
        launchCountdown.textContent = `${dias}d ${horas}h ${minutos}min ${segundos}s`;
      };
      atualizar();
      setInterval(atualizar, 1000);
    } catch {
      launchCountdown.textContent = 'Data em breve';
    }
  }
}

// ===== Logado x deslogado =====
function atualizarTela() {
  const usuario = App.usuario;

  form.hidden = Boolean(usuario);
  success.hidden = !usuario;
  if (usuario) successTitle.textContent = `Você já está na comunidade, @${usuario.nome_usuario}!`;

  // Botões de chamada: deslogado vai para o cadastro, logado vai para o feed
  document.querySelectorAll('[data-cta]').forEach((link) => {
    link.href = usuario ? 'feed.html' : '#entrar';
  });
}

// ===== Cadastro =====
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  App.mostrarErro(joinError, '');

  joinSubmit.disabled = true;
  joinSubmit.textContent = 'Salvando seu interesse…';

  try {
    await App.api('/auth/pre-cadastro', {
      metodo: 'POST',
      corpo: {
        nome_completo: form.nome_completo.value.trim(),
        email: form.email.value.trim(),
      },
    });
    form.reset();
    form.hidden = true;
    success.hidden = false;
  } catch (err) {
    App.mostrarErro(joinError, err.message);
  } finally {
    joinSubmit.disabled = false;
    joinSubmit.textContent = 'Quero ser avisado';
  }
});

document.addEventListener('sessao', () => {
  atualizarTela();
  carregarEstatisticas();
  carregarLancamento();
});

atualizarTela();
carregarEstatisticas();
