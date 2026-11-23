const { el, icone, api, avatar, blocoData, TIPOS_ENCONTRO } = App;

const ICONES = {
  local:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  pessoa:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  mapa:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>',
};

const abas = document.getElementById('abas-encontros');
const filtroTipos = document.getElementById('filtro-tipos');
const filtroCidade = document.getElementById('filtro-cidade');
const botaoMarcar = document.getElementById('botao-marcar');
const areaFormulario = document.getElementById('area-formulario');
const lista = document.getElementById('lista-encontros');
const statusEncontros = document.getElementById('encontros-status');

let abaAtual = 'proximos';
let tipoAtual = '';
let carregamentoAtual = 0;
let esperaCidade = null;

function mostrarStatus(texto) {
  statusEncontros.textContent = texto || '';
  statusEncontros.hidden = !texto;
}

function atualizarAbas() {
  abas.querySelectorAll('.tab').forEach((aba) => {
    const ativa = aba.dataset.aba === abaAtual;
    aba.classList.toggle('tab-ativa', ativa);
    aba.setAttribute('aria-selected', ativa);
  });
  filtroTipos.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('chip-ativo', chip.dataset.tipo === tipoAtual);
    chip.setAttribute('aria-pressed', chip.dataset.tipo === tipoAtual);
  });
}

function renderizarFiltroTipos() {
  const opcoes = [['', { nome: 'Todos', emoji: '✨' }], ...Object.entries(TIPOS_ENCONTRO)];
  filtroTipos.replaceChildren(
    ...opcoes.map(([valor, tipo]) =>
      el('button', { type: 'button', class: 'chip', 'data-tipo': valor, style: { '--cor-tipo': tipo.cor || '#111827' } }, [
        el('span', { 'aria-hidden': 'true', text: tipo.emoji }),
        tipo.nome,
      ])
    )
  );
}

abas.addEventListener('click', (evento) => {
  const aba = evento.target.closest('.tab');
  if (!aba || aba.dataset.aba === abaAtual) return;
  if (aba.dataset.aba === 'meus' && !App.usuario) return App.abrirLogin();
  abaAtual = aba.dataset.aba;
  atualizarAbas();
  carregarEncontros();
});

filtroTipos.addEventListener('click', (evento) => {
  const chip = evento.target.closest('.chip');
  if (!chip || chip.dataset.tipo === tipoAtual) return;
  tipoAtual = chip.dataset.tipo;
  atualizarAbas();
  carregarEncontros();
});

filtroCidade.addEventListener('input', () => {
  clearTimeout(esperaCidade);
  esperaCidade = setTimeout(carregarEncontros, 350);
});

botaoMarcar.addEventListener('click', () => {
  if (!App.usuario) return App.abrirLogin();
  if (areaFormulario.firstChild) return fecharFormulario();
  abrirFormulario();
});

function campo(rotulo, controle, classe = '') {
  return el('div', { class: `field ${classe}`.trim() }, [el('label', { for: controle.id, text: rotulo }), controle]);
}

function dataLocal(data) {
  const ajustada = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return ajustada.toISOString().slice(0, 10);
}

function fecharFormulario() {
  areaFormulario.replaceChildren();
  botaoMarcar.textContent = '+ Marcar encontro';
}

function abrirFormulario() {
  botaoMarcar.textContent = 'Fechar';
  const hoje = new Date();
  const limite = new Date(hoje.getTime() + 180 * 86400000);

  const titulo = el('input', { id: 'enc-titulo', type: 'text', maxlength: 80, required: true, placeholder: 'Ex.: Troca de cartas no shopping' });
  const tipo = el(
    'select',
    { id: 'enc-tipo', required: true },
    Object.entries(TIPOS_ENCONTRO).map(([valor, t]) => el('option', { value: valor, text: `${t.emoji} ${t.nome}` }))
  );
  const data = el('input', { id: 'enc-data', type: 'date', required: true, min: dataLocal(hoje), max: dataLocal(limite) });
  const hora = el('input', { id: 'enc-hora', type: 'time', required: true, value: '15:00' });
  const local = el('input', {
    id: 'enc-local',
    type: 'text',
    maxlength: 160,
    required: true,
    placeholder: 'Ex.: Loja Cards & Cia, Rua das Flores, 123',
  });
  const cidade = el('input', { id: 'enc-cidade', type: 'text', maxlength: 60, required: true, placeholder: 'Ex.: São Paulo' });
  const vagas = el('input', { id: 'enc-vagas', type: 'number', min: 2, max: 500, placeholder: 'Sem limite' });
  const descricao = el('textarea', {
    id: 'enc-descricao',
    rows: 3,
    maxlength: 1000,
    placeholder: 'O que vai rolar? O que levar? Algum ponto de referência?',
  });
  const erro = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const botao = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Marcar encontro' });

  const form = el(
    'form',
    {
      class: 'encontro-form',
      onsubmit: async (evento) => {
        evento.preventDefault();
        App.mostrarErro(erro, '');
        const dataHora = new Date(`${data.value}T${hora.value}`);
        if (Number.isNaN(dataHora.getTime())) return App.mostrarErro(erro, 'Informe a data e a hora.');
        if (dataHora < new Date()) return App.mostrarErro(erro, 'A data do encontro precisa ser no futuro.');

        botao.disabled = true;
        botao.textContent = 'Marcando…';
        try {
          await api('/encontros', {
            metodo: 'POST',
            corpo: {
              titulo: titulo.value,
              tipo: tipo.value,
              data_hora: dataHora.toISOString(),
              local: local.value,
              cidade: cidade.value,
              vagas: vagas.value === '' ? null : Number(vagas.value),
              descricao: descricao.value,
            },
          });
          fecharFormulario();
          abaAtual = 'proximos';
          tipoAtual = '';
          filtroCidade.value = '';
          atualizarAbas();
          carregarEncontros();
        } catch (err) {
          App.mostrarErro(erro, err.message);
          botao.disabled = false;
          botao.textContent = 'Marcar encontro';
        }
      },
    },
    [
      el('h2', { class: 'composer-titulo font-outfit', text: 'Marcar um encontro' }),
      el('div', { class: 'encontro-form-grade' }, [
        campo('Título', titulo, 'campo-largo'),
        campo('Tipo', tipo),
        campo('Vagas (opcional)', vagas),
        campo('Data', data),
        campo('Hora', hora),
        campo('Local', local, 'campo-largo'),
        campo('Cidade', cidade, 'campo-largo'),
        campo('Descrição (opcional)', descricao, 'campo-largo'),
      ]),
      el('p', { class: 'form-sub', text: 'O local exato só aparece para quem tem conta. Visitantes veem apenas a cidade.' }),
      erro,
      el('div', { class: 'encontro-form-botoes' }, [
        el('button', { type: 'button', class: 'btn btn-outline', text: 'Cancelar', onclick: fecharFormulario }),
        botao,
      ]),
    ]
  );

  areaFormulario.replaceChildren(form);
  titulo.focus();
}

async function carregarEncontros() {
  const meuCarregamento = ++carregamentoAtual;
  lista.replaceChildren();
  mostrarStatus('Carregando encontros…');

  const parametros = new URLSearchParams();
  if (tipoAtual) parametros.set('tipo', tipoAtual);
  if (filtroCidade.value.trim()) parametros.set('cidade', filtroCidade.value.trim());
  if (abaAtual === 'meus') parametros.set('meus', '1');

  try {
    const encontros = await api(`/encontros?${parametros}`);
    if (meuCarregamento !== carregamentoAtual) return;
    if (!encontros.length) {
      mostrarStatus(
        abaAtual === 'meus'
          ? 'Você ainda não confirmou presença em nenhum encontro.'
          : 'Nenhum encontro encontrado. Que tal marcar o primeiro?'
      );
      return;
    }
    mostrarStatus('');
    lista.append(...encontros.map(cartaoEncontro));
  } catch (err) {
    if (meuCarregamento === carregamentoAtual) mostrarStatus(err.message);
  }
}

function linkMapa(encontro) {
  const busca = encodeURIComponent(`${encontro.local}, ${encontro.cidade}`);
  return el('a', {
    class: 'encontro-mapa',
    href: `https://www.google.com/maps/search/?api=1&query=${busca}`,
    target: '_blank',
    rel: 'noopener noreferrer',
  }, [icone(ICONES.mapa), 'Abrir no mapa']);
}

function cartaoEncontro(encontro) {
  const tipo = TIPOS_ENCONTRO[encontro.tipo];
  const usuario = App.usuario;
  const organizo = usuario && usuario.id === encontro.organizador_id;
  const comecou = new Date(encontro.data_hora) < new Date();
  const lotado = encontro.vagas !== null && encontro.participantes >= encontro.vagas;

  const linhaLocal = encontro.local
    ? el('p', { class: 'encontro-linha' }, [icone(ICONES.local), el('span', { text: `${encontro.local} · ${encontro.cidade}` })])
    : el('p', { class: 'encontro-linha' }, [
        icone(ICONES.local),
        el('span', { text: `${encontro.cidade} · ` }),
        el('button', { type: 'button', class: 'link', text: 'entre para ver o local', onclick: App.abrirLogin }),
      ]);

  const vagasTexto = encontro.vagas === null
    ? `${encontro.participantes} confirmado${encontro.participantes === 1 ? '' : 's'}`
    : `${encontro.participantes} de ${encontro.vagas} vagas preenchidas`;

  const barraVagas = encontro.vagas !== null &&
    el('div', { class: 'encontro-vagas-barra', 'aria-hidden': 'true' }, [
      el('span', { style: { width: `${Math.min(100, (encontro.participantes / encontro.vagas) * 100)}%` } }),
    ]);

  const nomes = encontro.nomes.length > 0 &&
    el('div', { class: 'encontro-pessoas', title: encontro.nomes.map((n) => `@${n}`).join(', ') }, [
      ...encontro.nomes.slice(0, 6).map(avatar),
      encontro.participantes > 6 && el('span', { class: 'encontro-mais', text: `+${encontro.participantes - 6}` }),
    ]);

  const acoes = [];
  if (comecou) {
    acoes.push(el('span', { class: 'encontro-selo encontro-selo-agora', text: 'Acontecendo agora' }));
  } else if (organizo) {
    acoes.push(el('span', { class: 'encontro-selo', text: 'Você organiza' }));
  } else {
    const botaoVou = el('button', {
      type: 'button',
      class: encontro.vou ? 'btn btn-outline btn-pequeno btn-vou-confirmado' : 'btn btn-primary btn-pequeno',
      disabled: lotado && !encontro.vou,
      'aria-pressed': encontro.vou,
    }, encontro.vou ? [el('span', { class: 'texto-vou', text: '✓ Vou' }), el('span', { class: 'texto-sair', text: 'Não vou mais' })] : lotado ? 'Lotado' : 'Eu vou!');
    botaoVou.addEventListener('click', async () => {
      if (!App.usuario) return App.abrirLogin();
      botaoVou.disabled = true;
      try {
        const atualizado = await api(`/encontros/${encontro.id}/participar`, { metodo: 'POST' });
        if (abaAtual === 'meus' && !atualizado.vou) {
          cartao.remove();
          if (!lista.children.length) mostrarStatus('Você ainda não confirmou presença em nenhum encontro.');
        } else {
          cartao.replaceWith(cartaoEncontro(atualizado));
        }
      } catch (err) {
        alert(err.message);
        botaoVou.disabled = false;
      }
    });
    acoes.push(botaoVou);
  }
  if (encontro.local) acoes.push(linkMapa(encontro));
  if (organizo) {
    const botaoCancelar = el('button', { type: 'button', class: 'encontro-cancelar', text: 'Cancelar encontro' });
    botaoCancelar.addEventListener('click', async () => {
      if (!confirm('Cancelar este encontro? Quem confirmou presença não verá mais ele na lista.')) return;
      botaoCancelar.disabled = true;
      try {
        await api(`/encontros/${encontro.id}`, { metodo: 'DELETE' });
        cartao.remove();
        if (!lista.children.length) mostrarStatus('Nenhum encontro encontrado. Que tal marcar o primeiro?');
      } catch (err) {
        alert(err.message);
        botaoCancelar.disabled = false;
      }
    });
    acoes.push(botaoCancelar);
  }

  const cartao = el('article', { class: 'encontro', style: { '--cor-tipo': tipo.cor, '--fundo-tipo': tipo.fundo } }, [
    blocoData(encontro.data_hora, encontro.tipo),
    el('div', { class: 'encontro-corpo' }, [
      el('span', { class: 'encontro-tipo' }, [el('span', { 'aria-hidden': 'true', text: tipo.emoji }), tipo.nome]),
      el('h3', { class: 'encontro-titulo font-outfit', text: encontro.titulo }),
      linhaLocal,
      el('p', { class: 'encontro-linha' }, [icone(ICONES.pessoa), el('span', { text: `Organizado por @${encontro.organizador}` })]),
      encontro.descricao && el('p', { class: 'encontro-descricao', text: encontro.descricao }),
      el('div', { class: 'encontro-vagas' }, [el('span', { text: vagasTexto }), barraVagas]),
      nomes,
      el('div', { class: 'encontro-acoes' }, acoes),
    ]),
  ]);

  return cartao;
}

document.addEventListener('sessao', () => {
  if (!App.usuario) {
    fecharFormulario();
    if (abaAtual === 'meus') abaAtual = 'proximos';
  }
  atualizarAbas();
  carregarEncontros();
});

renderizarFiltroTipos();
atualizarAbas();
carregarEncontros();
