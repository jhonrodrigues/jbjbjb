# Operação

## Primeiro deploy

1. Provisione PostgreSQL com backup automático.
2. Configure as variáveis de `.env.example` no provedor.
3. Faça o build da imagem e publique atrás de HTTPS.
4. Rode as migrações, a verificação do legado e o catálogo de agentes.
5. Crie o primeiro administrador.
6. Verifique `GET /api/health`; ele deve retornar HTTP 200 com `checks.database.ok = true`.
7. Configure o n8n com o mesmo `INTERNAL_API_SECRET`.

## Atualização

```bash
docker compose build app
docker compose up -d app
```

O entrypoint aplica migrações com advisory lock antes de iniciar o servidor. Faça backup antes de mudanças de schema. A aplicação não deve ser reiniciada várias vezes em paralelo sem esse lock.

## Healthcheck

`GET /api/health` retorna:

- `200` quando o banco responde;
- `503` quando o banco não está configurado ou inacessível.

O n8n é apenas informado como configurado; ele não bloqueia a saúde do painel.

## Backup

- Use `pg_dump` diário do banco.
- Persista `/app/uploads` se uploads forem habilitados.
- Guarde cópias fora do servidor.
- Teste a restauração periodicamente.

## Diagnóstico do legado

```bash
npm run db:inspect
npm run db:verify
```

`db:inspect` mostra somente tabelas, colunas e contagens. Não imprime amostras: dados sensíveis podem existir dentro de JSON/HTML. `db:verify` verifica presença e tipos essenciais; não substitui teste das consultas com schema/dados do destino.

## Segurança operacional

- Troque `AUTH_SECRET` e `INTERNAL_API_SECRET` de qualquer ambiente exposto.
- Não reutilize o segredo interno no frontend.
- Restrinja o endpoint interno no proxy de borda quando possível.
- Mantenha o n8n em rede privada ou com autenticação.
- Não desative o `X-Frame-Options` das páginas do painel.
- Revise usuários e logs de acesso após incidentes.
- Se um usuário for desativado, a sessão deixa de ser aceita na próxima requisição.
- Troca de senha pela administração ou CLI incrementa `session_version` e invalida JWTs anteriores, inclusive no endpoint de renovação. Migração 0001 requer novo login de sessões antigas.
- Alterações de papel/ativação serializam a validação e a gravação em transação com advisory lock para manter pelo menos um administrador ativo, inclusive em requisições concorrentes.

## Limitações atuais

- Não há envio de e-mail, WhatsApp ou cobrança.
- A publicação de LP usa URL privada com token; não há domínio público por cliente.
- A integração de IA e prospecção vive nos workflows n8n.
- Testes de banco real ainda precisam ser executados com `DATABASE_URL` no ambiente de destino.
- O rate limit é por processo, em memória; múltiplas réplicas precisam de proteção compartilhada no proxy. O provider de credenciais também valida o limite, inclusive em chamadas diretas ao Auth.js.
- Orçamento mensal/custo estimado são informativos. Quotas diárias cobrem novos jobs admitidos; retries e efeitos externos não representam orçamento financeiro garantido.
- Pausa bloqueia novos claims/admissões, não interrompe execuções nem reverte efeitos externos. Ainda não há heartbeat de lease: ajuste timeout e idempotência no consumidor.

## Conexão Compose e atualização do worker

Compose usa `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` e `PGPASSWORD` literal e sobrescreve `DATABASE_URL` com vazio. Não aplique URL-encoding à senha do PostgreSQL. Aplicação e scripts aceitam esses campos; fora do Compose, `DATABASE_URL` continua tendo precedência e sua senha precisa de percent-encoding se necessário.

Migração 0001 adiciona `lease_token` e `session_version`, sem alterar tabelas legadas. Antes de publicar, drene/pare consumidores antigos e confirme suporte ao contrato obrigatório `leaseToken` descrito em N8N.md. Não publique app novo com worker antigo. Nenhuma verificação local prova compatibilidade dos workflows externos.

Rollback operacional exige imagem anterior retida e coordenação dos workers. As duas colunas novas são aditivas: não remova dados/colunas para voltar imagem. Restaurar versão antiga de app também restaura suas limitações de segurança; prefira corrigir para frente.

## Verificação local descartável

Use Node.js 22.12+ e um PostgreSQL local com migrações aplicadas. A suíte de integração exige `TEST_DATABASE_URL` explícita, host `localhost`/`127.0.0.1` e nome de banco terminado em `_test` ou `_verify`:

```bash
TEST_DATABASE_URL=postgresql://usuario:senha@127.0.0.1:55432/autopilot_verify npm run test:integration
```

Ela insere e remove tarefas artificiais, testa claim concorrente, propriedade do lock, conclusão idempotente, retry e esgotamento de tentativas. Use banco exclusivo e sem workers concorrentes. Sem essa variável, o teste fica ignorado; isso não comprova integração. Nunca use banco de produção.
