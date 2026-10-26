# Arquitetura

## Divisão de responsabilidades

O painel não executa prospecção, IA ou publicação diretamente. Ele mantém estado, regras, permissões, fila e auditoria. O n8n consome a fila e devolve resultado ou erro.

```
Painel Next.js  ──enqueue──▶  PostgreSQL (jb_agent_jobs)  ◀──claim──  n8n / agentes
      │                              │
      └──────── leitura/UI ◀─────────┘
```

## Camadas

- `src/app`: páginas, layouts e rotas HTTP. Páginas autenticadas são dinâmicas.
- `src/actions`: Server Actions com validação Zod e autorização.
- `src/components`: UI reutilizável, sem acesso direto ao banco.
- `src/lib`: regras de domínio, consultas, fila, segurança e integrações.
- `src/db`: schema Drizzle e pool PostgreSQL preguiçoso.
- `drizzle`: migrações SQL versionadas.
- `scripts`: migração, inspeção, verificação, administrador e catálogo.

## Banco

Tabelas novas usam o prefixo `jb_agent_`. A aplicação convive com as tabelas legadas:

- `jb_agent_leads`
- `jb_agent_lps`

O schema legado é somente leitura estruturalmente. IDs e colunas são descobertos pelo `information_schema`; o painel não executa `ALTER TABLE` nelas. `lead_id` e `lp_id` são `text` para aceitar UUID, inteiro ou texto sem cast inseguro.

Migrações novas incluem usuários, campanhas, vínculo campanha/lead, metadados de lead, brand profiles, versões de LP, contatos, eventos, jobs, eventos de job, auditoria, configurações e catálogo de agentes.

## Fila de jobs

Estados: `pending`, `processing`, `completed`, `failed`, `cancelled`.

Fluxo:

1. O painel enfileira com `idempotency_key` opcional.
2. O worker chama `claim`. A query usa `FOR UPDATE SKIP LOCKED`.
3. Jobs `processing` com lock vencido voltam para `pending` ou falham ao atingir o máximo de tentativas.
4. O worker chama `complete` ou `fail` com `workerId` e `leaseToken` obrigatório retornado pelo claim. Claims expirados/substituídos são rejeitados, inclusive se o worker tiver o mesmo nome.
5. Todo evento é registrado em `jb_agent_job_events`; toda ação relevante vai para a auditoria.

O `complete` é idempotente para o mesmo lease já concluído. Claims de agentes pausados/campanhas inativas são bloqueados; tarefas em execução continuam. Retry manual aceita somente falha/cancelamento e cancelamento nunca altera uma conclusão. Eventos dessas transições e estado são atômicos.

Limites diários serializam admissão de **novos jobs** em transação. Não medem quantidade de tentativas, custos externos ou retries manuais. Orçamento mensal e custo estimado são informativos, não um teto financeiro.

## Landing pages

Cada geração deve criar uma linha em `jb_agent_lp_versions` pelo workflow externo. Status canônico é o da última versão, com fallback legado. Filtros, badges e contador de publicadas usam essa regra. Alteração de status sincroniza versão e legado na mesma transação quando a coluna existe; erros não são ignorados. O preview:

- exige token HMAC curto;
- busca exatamente a versão assinada, nunca um rascunho mais novo; token sem versão permite somente HTML legado;
- sanitiza HTML;
- responde com CSP, `noindex` e `no-store`;
- é renderizado em iframe com `sandbox` e sem `allow-same-origin`.

## Decisões de UI

- Português do Brasil, moeda BRL e timezone configurável em `APP_TIMEZONE`, com padrão `America/Sao_Paulo`.
- Light mode como padrão e dark mode opcional.
- Layout denso inspirado em ferramentas operacionais premium, sem depender de imagens externas.
- Estados vazios são explícitos; nenhuma métrica é estimada quando o banco não fornece dados.

## Sessões e dados compartilhados

JWT mantém `maxAge=8h`. Navegação via `auth()` sem argumentos em Server Components não encaminha cookie renovado. `updateAge` não agenda renovação JWT. `/api/auth/session` pode emitir cookie renovado quando chamado; portanto, 8h não é um limite absoluto global contra renovação deliberada. Não há polling nem renovação deslizante adicionados pelo painel.

`session_version` é incrementada na troca de senha por action ou CLI. JWT é validado contra versão e ativação no banco também no callback Auth.js de renovação. Migração exige novo login para tokens antigos sem versão.

Aplicação é uma operação compartilhada entre membros, sem isolamento por tenant/owner. CRM busca no banco antes de paginar; mudanças de etapa e eventos usam transação e lock de linha. Inserção manual é serializada por lead, preservando comportamento atual sem criar regra de unicidade ou remover duplicatas existentes.
