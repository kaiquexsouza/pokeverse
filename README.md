# Pokeverse

Pokeverse é uma comunidade para fãs de Pokémon, com conteúdo sobre jogos,
animes, cards e assuntos gerais. Atualmente o site está em fase de lançamento:
visitantes fazem um pré-cadastro e recebem um convite por e-mail quando a
plataforma for liberada.

## Funcionalidades

- Landing page de lançamento com status da comunidade e contador de interessados.
- Contador regressivo até a data/hora oficial de lançamento.
- Pré-cadastro com nome completo e e-mail, sem criação de senha.
- Envio automático dos convites quando o contador chega a zero.
- Página de conclusão do cadastro acessada por link exclusivo.
- Cadastro real com nome de usuário e senha.
- Login com nome de usuário ou e-mail.
- Feed com filtros por categoria: Jogos, Animes, Trading Cards e Assuntos Gerais.
- Criação, curtida, remoção dos próprios posts e comentários.

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript puro em [`public/`](./public/).
- **Back-end:** Node.js + Express em [`server/`](./server/).
- **Banco:** PostgreSQL.
- **Senhas:** bcrypt.
- **Sessão:** JWT.
- **E-mail:** Gmail API com OAuth2 via HTTPS.
- **Deploy:** Render, configurado em [`render.yaml`](./render.yaml).

## Estrutura

```text
public/index.html       landing page e pré-cadastro
public/script.js        contador e envio do pré-cadastro
public/cadastro.html    página de cadastro real por convite
public/cadastro.js      validação do convite e criação da conta
public/feed.html        feed da comunidade
public/app.js           API, sessão, header e modal de login
server/index.js         servidor Express e inicialização do banco
server/routes/auth.js   cadastro, login, pré-cadastro e convites
server/routes/posts.js  posts, curtidas e comentários
server/schema.sql       tabelas criadas automaticamente
render.yaml             Blueprint do Render
```

## Banco de dados

Ao iniciar, o servidor executa [`server/schema.sql`](./server/schema.sql).
As tabelas principais são:

- `usuarios`: contas reais, com senha armazenada como hash.
- `pre_cadastros`: interessados que ainda não criaram uma conta.
- `posts`, `curtidas` e `comentarios`: conteúdo da comunidade.

O pré-cadastro não cria uma conta em `usuarios` e não armazena senha.

## Rodando localmente

1. Instale o [Node.js 20+](https://nodejs.org) e o PostgreSQL.
2. Crie um banco chamado `pokeverse`.
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL`.
4. Na pasta do projeto, instale as dependências:

   ```bash
   npm install
   ```

5. Inicie o servidor:

   ```bash
   npm run dev
   ```

6. Abra <http://localhost:3000>.

O site deve ser acessado pelo servidor Express. Abrir o HTML diretamente ou
usar apenas um Live Server não fornece a API nem o PostgreSQL.

## Variáveis de ambiente

| Variável | Obrigatória | Finalidade |
|---|---:|---|
| `DATABASE_URL` | Sim | URL de conexão com o PostgreSQL |
| `JWT_SECRET` | Sim em produção | Assinatura dos tokens de sessão |
| `NODE_ENV` | Recomendada | Use `production` no Render |
| `PORT` | Não | Porta do servidor; o Render fornece automaticamente |
| `SITE_URL` | Recomendada | URL pública usada nos links dos convites |
| `LAUNCH_AT` | Para contador e automação | Data/hora do lançamento em ISO 8601 UTC |
| `LAUNCH_ADMIN_TOKEN` | Para convites | Protege a rota de disparo dos e-mails |
| `GMAIL_CLIENT_ID` | Para convites | Client ID OAuth2 do Google Cloud |
| `GMAIL_CLIENT_SECRET` | Para convites | Client secret OAuth2 |
| `GMAIL_REFRESH_TOKEN` | Para convites | Refresh token com escopo `gmail.send` |
| `GMAIL_USER` | Para convites | Conta Gmail que envia as mensagens |

Nunca coloque senhas, tokens SMTP ou `LAUNCH_ADMIN_TOKEN` no GitHub ou no
`.env.example`.

### Gmail API no Render

O envio usa a Gmail API por HTTPS, portanto não depende de conexão SMTP. A
conta Gmail que enviará os convites precisa de um projeto no Google Cloud com
a **Gmail API habilitada** e um cliente OAuth2 configurado para acesso
offline. O refresh token precisa ter o escopo:

```text
https://www.googleapis.com/auth/gmail.send
```

Configure no Render:

```text
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER=seuemail@gmail.com
```

Para obter as credenciais:

1. Abra o Google Cloud Console e crie ou selecione um projeto.
2. Em **APIs e serviços → Biblioteca**, habilite **Gmail API**.
3. Em **Tela de consentimento OAuth**, configure o aplicativo.
4. Em **Credenciais**, crie um **ID do cliente OAuth** do tipo aplicativo para computador.
5. Use o OAuth 2.0 Playground do Google com seu `Client ID` e `Client secret`.
6. Adicione o escopo `https://www.googleapis.com/auth/gmail.send`.
7. Autorize com a conta que enviará os e-mails e troque o authorization code por um refresh token.
8. Coloque o refresh token somente nas variáveis do Render.

Não use senha de aplicativo nesse fluxo. O `GMAIL_REFRESH_TOKEN` substitui a
senha SMTP e não deve ser commitado no repositório.

## Deploy no Render

O projeto já está publicado como Web Service. Não é necessário criar outro
serviço nem apagar o banco existente.

### 1. Enviar o código atualizado

Faça commit e push das alterações para a mesma branch conectada ao serviço
(na imagem, `main`). O Render fará o deploy automático se o Auto-Deploy estiver
habilitado. Caso contrário, use **Manual Deploy → Deploy latest commit**.

O serviço usa:

```text
Build Command: npm install
Start Command: npm start
Health Check: /api/saude
```

### 2. Atualizar as variáveis no Web Service existente

No Render, abra o Web Service **pokeverse-30es** → **Environment** → **Edit**
e mantenha as três variáveis atuais:

- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV=production`

Adicione:

```text
SITE_URL=https://pokeverse-30es.onrender.com
LAUNCH_AT=2026-12-01T18:00:00.000Z
LAUNCH_ADMIN_TOKEN=<um-token-aleatorio-e-secreto>
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER=seuemail@gmail.com
```

Use **Generate** para criar `LAUNCH_ADMIN_TOKEN`, se essa opção aparecer.
O valor de `SITE_URL` deve ser exatamente a URL pública atual do serviço,
incluindo `https://`, sem barra no final.

As credenciais da Gmail API não são necessárias para receber pré-cadastros.
Elas precisam estar preenchidas antes de executar o disparo dos convites.

`LAUNCH_AT` é a data/hora oficial do lançamento em UTC. A landing page exibe
o contador regressivo calculado no navegador. Quando o horário chega, o
servidor verifica automaticamente os pré-cadastros pendentes e envia os
convites usando a Gmail API. Se o serviço do Google estiver indisponível, o
servidor tenta novamente a cada minuto enquanto permanecer ativo.

### 3. Salvar e redeployar

Clique em **Save Changes**. O Render normalmente inicia um novo deploy
automaticamente. Se não iniciar, use **Manual Deploy → Deploy latest commit**.

Depois, valide:

```bash
curl https://pokeverse-30es.onrender.com/api/saude
```

O retorno esperado é:

```json
{"ok":true}
```

Também faça um pré-cadastro de teste pela página pública e confirme que ele
aparece no contador. Não execute o disparo de lançamento durante o teste.

### 4. Configurar a Gmail API

O envio usa OAuth2 e HTTPS. Não use senha de aplicativo neste fluxo. O
`GMAIL_REFRESH_TOKEN` é o credencial de longa duração que autoriza o servidor
a enviar pela conta definida em `GMAIL_USER`.

Depois de salvar as variáveis e confirmar que o serviço está saudável, envie
um convite de teste somente se houver um pré-cadastro de teste:

```bash
curl -X POST https://pokeverse-30es.onrender.com/api/auth/notificar-lancamento \
  -H "X-Launch-Token: SEU_LAUNCH_ADMIN_TOKEN"
```

A rota manual só envia depois que `LAUNCH_AT` chega e envia apenas registros ainda não convidados. Cada registro é marcado
como enviado somente depois que o SMTP confirma o envio. Se o SMTP falhar,
ele poderá ser tentado novamente.

A resposta manual inclui `enviados` e `pendentes`. Se já houver uma tentativa
automática em andamento, a chamada manual aguarda essa mesma tentativa em vez
de retornar falsamente `enviados: 0`. Erros de autenticação ou conexão SMTP
retornam HTTP 502 e também aparecem nos Logs do Render.

> Essa rota deve ser executada apenas no lançamento. O token administrativo
> nunca deve ser colocado no front-end.

### Usando `render.yaml`

O [`render.yaml`](./render.yaml) já declara as novas variáveis. Como o serviço
atual é **Blueprint managed**, um push que altere esse arquivo pode solicitar
sincronização do Blueprint no Render. Revise as mudanças antes de aplicar.

Para um serviço já existente, a forma mais simples e segura é adicionar as
variáveis manualmente pelo painel, conforme a seção anterior. Não altere
`DATABASE_URL` nem recrie o banco.

## Rotas da API

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/pre-cadastro` | Não | Salva `{ nome_completo, email }` |
| `GET` | `/api/auth/pre-cadastro/:token` | Não | Valida o convite |
| `POST` | `/api/auth/pre-cadastro/finalizar` | Não | Cria a conta com `{ token, nome_usuario, senha }` |
| `POST` | `/api/auth/notificar-lancamento` | `X-Launch-Token` | Envia os convites pendentes |
| `POST` | `/api/auth/cadastro` | Não | Cadastro legado direto |
| `POST` | `/api/auth/login` | Não | Login por usuário/e-mail e senha |
| `GET` | `/api/auth/eu` | Bearer JWT | Dados da sessão atual |
| `GET` | `/api/estatisticas` | Não | Contador de interessados antes do lançamento ou usuários cadastrados depois dele, além de posts |
| `GET` | `/api/posts?categoria=` | Opcional | Lista posts |
| `POST` | `/api/posts` | Bearer JWT | Cria um post |
| `DELETE` | `/api/posts/:id` | Bearer JWT | Remove o próprio post |
| `POST` | `/api/posts/:id/curtir` | Bearer JWT | Alterna curtida |
| `GET` | `/api/posts/:id/comentarios` | Não | Lista comentários |
| `POST` | `/api/posts/:id/comentarios` | Bearer JWT | Cria comentário |

## Observações do plano gratuito

- O Web Service pode dormir após um período sem acesso.
- O primeiro acesso depois disso pode demorar.
- O PostgreSQL gratuito do Render pode ter limitações ou prazo de validade;
  confira as condições atuais no painel.
- Faça backup antes de alterações importantes no banco.
