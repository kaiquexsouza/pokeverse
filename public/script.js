// Landing page: contador de interessados e pré-cadastro.

const form = document.getElementById('join-form');
const success = document.getElementById('join-success');
const successTitle = document.getElementById('success-title');
const joinError = document.getElementById('join-error');
const joinSubmit = document.getElementById('join-submit');

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
}

async function carregarLancamento() {
  try {
    const { launchAt, launched } = await App.api('/lancamento');
    if (!launchAt) {
      return;
    }

    const data = new Date(launchAt);
    const campos = {
      dias: document.getElementById('cd-dias'),
      horas: document.getElementById('cd-horas'),
      minutos: document.getElementById('cd-minutos'),
      segundos: document.getElementById('cd-segundos'),
    };
    const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(data);
    document.getElementById('launch-date').textContent =
      `${dataFormatada[0].toUpperCase()}${dataFormatada.slice(1)} · ${data.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })}h (horário de Brasília)`;

    function doisDigitos(numero) {
      return String(numero).padStart(2, '0');
    }

    let intervalo;
    const atualizar = () => {
      const restante = data.getTime() - Date.now();
      const totalSegundos = Math.max(0, Math.floor(restante / 1000));
      campos.dias.textContent = doisDigitos(Math.floor(totalSegundos / 86400));
      campos.horas.textContent = doisDigitos(Math.floor((totalSegundos % 86400) / 3600));
      campos.minutos.textContent = doisDigitos(Math.floor((totalSegundos % 3600) / 60));
      campos.segundos.textContent = doisDigitos(totalSegundos % 60);

      if (restante <= 0 || launched) {
        clearInterval(intervalo);
        document.getElementById('launch-title').replaceChildren(
          'O Pokeverse ',
          App.el('span', { class: 'text-yellow', text: 'chegou!' })
        );
        document.getElementById('launch-desc').textContent =
          'O lançamento oficial já aconteceu. Entre, crie seu post e encontre outros treinadores.';
      }
    };
    atualizar();
    intervalo = setInterval(atualizar, 1000);
  } catch {
    document.getElementById('launch-date').textContent = 'Data de lançamento em breve';
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
carregarLancamento();
