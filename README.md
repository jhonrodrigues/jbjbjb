# JB Agent Autopilot

Painel operacional para prospecção, qualificação, geração de landing pages, publicação e acompanhamento comercial. A aplicação é o cérebro de controle: o n8n executa os agentes, enquanto este painel mantém o estado, a fila, as aprovações e a auditoria.

## O que já existe

- Autenticação por credenciais com sessão JWT, rate limit no login e criação de administrador via CLI.
- Dashboard com período, métricas reais, gráfico de leads, funil, prioridades e atividades.
- Campanhas com criação, edição, status, execução e vínculo com leads legados.
- Leads legados com filtros, paginação, análise, pesquisa de marca, LPs, jobs e ações comerciais.
- Landing pages com versões, template, preview privado, aprovação/publicação e histórico.
- CRM com funil, contatos, valores, próxima ação e linha do tempo.
- Catálogo de agentes, observabilidade da fila e detalhe de tarefas com payload, resultado, erro e eventos.
- Configurações da operação, limites de custo e gestão de usuários.
- Fila PostgreSQL com claim concorrente seguro, retry, timeout de lock, cancelamento e idempotência.
- API interna autenticada para workers n8n e healthcheck para container.
- Execução de campanha sinaliza webhook n8n configurável por administrador; segredo criptografado, timeout de 5s e fallback para Schedule existente.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Auth.js v5, Drizzle ORM, PostgreSQL, Zod, Recharts e Vitest unificado ao painel.

## Requisitos

- Node.js **22.12+** (o Docker já usa a versão correta).
- PostgreSQL 15+.
- `DATABASE_URL` disponível para migrações e uso real.
- `AUTH_SECRET` e `INTERNAL_API_SECRET` fortes em produção.

## Rodando localmente

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run db:verify
npm run admin:create
npm run dev
```

Gere os segredos com:

```bash
openssl rand -base64 32
```

A aplicação abre em `http://localhost:3000`. Sem `DATABASE_URL`, o painel inicia e exibe estados vazios, mas login, migrações e dados reais não funcionam.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | sim, ou campos PG* | Conexão PostgreSQL; tem precedência sobre campos PG*. |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | alternativa | Compose fornece campos separados, sem interpolar senha em URI. |
| `AUTH_SECRET` | sim | Assinatura das sessões e fallback do token de preview. |
| `APP_URL` | sim | URL pública, usada em origem e links. |
| `INTERNAL_API_SECRET` | sim | Bearer token dos endpoints de jobs do n8n. |
| `N8N_BASE_URL` | não | Exibição do estado de integração. |
| `N8N_WEBHOOK_SECRET` | não | Alternativa ao bearer via `x-jb-signature`. |
| `AI_API_KEY` | não | Chave server-side usada pelos workers. |
| `LP_PREVIEW_SECRET` | recomendado | Segredo dedicado do preview; usa `AUTH_SECRET` se ausente. |
| `DATABASE_SSL` | não | `true` para conexões TLS. |
| `UPLOAD_DIR` | não | Diretório de uploads; padrão `/app/uploads`. |
| `JOB_LOCK_TIMEOUT_SECONDS` | não | Tempo até liberar um job travado; padrão `900`. |
| `APP_TIMEZONE` | não | Timezone de períodos, quotas e datas comerciais; padrão `America/Sao_Paulo`. |
| `LOG_LEVEL` | não | Nível do pino; padrão `info` em produção. |

Nunca exponha `DATABASE_URL`, `AUTH_SECRET`, `INTERNAL_API_SECRET` ou chaves de IA no cliente.

## Scripts

```bash
npm run dev              # desenvolvimento em 0.0.0.0:3000
npm run build            # build de produção
npm run lint             # ESLint
npm run typecheck        # TypeScript
npm test                 # testes unitários
npm run db:generate      # gera nova migração Drizzle
npm run db:migrate       # aplica migrações com advisory lock
npm run db:inspect       # mostra somente metadados e contagens, sem amostras
npm run db:verify        # falha se o schema legado essencial estiver incompatível
npm run db:seed:catalog  # sincroniza o catálogo de agentes
npm run admin:create     # cria administrador; --update para alterar um existente
npm run test:integration # PostgreSQL local descartável; exige TEST_DATABASE_URL
```

`npm run admin:create` solicita e-mail, nome e senha interativamente. Evite passar senha como argumento ou variável de ambiente para não deixá-la no histórico/process list.

## Deploy com Docker

1. Copie `.env.example` para `.env` e preencha os segredos.
2. Defina `POSTGRES_PASSWORD` no `.env` para o compose local.
3. Suba os containers:

```bash
docker compose up -d --build
```

4. Verifique o legado, sincronize o catálogo e crie o administrador dentro do container:

```bash
docker compose exec app node scripts/verify-legacy.mjs
docker compose exec app node scripts/seed-catalog.mjs
docker compose exec -it app node scripts/create-admin.mjs
```

O container aplica migrações antes de iniciar o servidor e expõe `GET /api/health`. Em EasyPanel, use o Dockerfile, monte um volume persistente em `/app/uploads` e configure as mesmas variáveis. Use HTTPS na borda e mantenha `APP_URL` com a URL pública final.

## Integração n8n

A API interna está documentada em [docs/N8N.md](docs/N8N.md). Ela não usa cookies: o worker envia `Authorization: Bearer $INTERNAL_API_SECRET` (ou `x-jb-signature` com `N8N_WEBHOOK_SECRET`).

Para disparo pelo botão da campanha, configure URL completa e Header Auth em **Configurações → Webhook n8n**. O segredo fica criptografado com chave derivada de `AUTH_SECRET` e não retorna ao navegador; vazio preserva, remoção explícita limpa. Isso só desperta o workflow: Schedule de 5 minutos e claim da pendência mais antiga permanecem iguais. Nenhum workflow externo é criado/publicado pelo painel. Consulte contrato e rotação de chave em [docs/N8N.md](docs/N8N.md).

Endpoints:

- `POST /api/internal/jobs/claim`
- `POST /api/internal/jobs/{id}/complete`
- `POST /api/internal/jobs/{id}/fail`
- `GET /api/health`

## Segurança e limites conhecidos

- Senhas usam bcrypt com custo 12; a sessão é revalidada contra o banco a cada uso.
- Sessão JWT mantém 8h; navegação RSC não renova cookie. Troca de senha revoga sessões por versão, inclusive no endpoint Auth.js de renovação. Não foi adicionado polling/renovação deslizante.
- Workers precisam enviar `leaseToken` obrigatório de cada claim em complete/fail; contrato antigo não é aceito. Consulte plano de atualização em [operação](docs/OPERATIONS.md).
- Orçamento monetário é informativo; limites diários serializam novos jobs, não garantem custo de retries/serviços externos. Pausa bloqueia novos claims, mas não interrompe jobs em execução.
- Preview de LP usa sanitização server-side, HMAC de curta duração, iframe `sandbox` sem `allow-same-origin` e CSP restritiva.
- O schema legado não é alterado. As tabelas novas usam `text` para IDs legados e verificam colunas em runtime.
- Dados de negócio só aparecem quando existem no banco; não há métricas inventadas.
- Não há integração real com Google Places nem envio de WhatsApp neste repositório: isso pertence aos workflows n8n.
- Há testes unitários e uma suíte de integração para PostgreSQL local descartável. Execute os checks no ambiente atual; banco sintético não comprova compatibilidade com dados de produção. Consulte [operação](docs/OPERATIONS.md) para executar a integração com segurança.

Mais detalhes: [arquitetura](docs/ARCHITECTURE.md) e [operação](docs/OPERATIONS.md).
