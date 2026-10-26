# Webhook de execução n8n — 2026-10-26

Escopo da implementação: configuração administrativa e sinal backend ao executar campanha, sem publicação nessa etapa. Autorização posterior mantém commit/push desta funcionalidade para `origin/main` (`https://github.com/jhonrodrigues/jbjbjb.git`), sem deploy ou mudanças em workflows externos.

## Contrato e decisões

- Dedicated setting `n8n_webhook`, sem migração de schema e sem alteração de `PlatformSettings`.
- AES-256-GCM com HKDF de `AUTH_SECRET`; projeção explícita somente de metadados para UI; segredo vazio preserva, remoção explícita elimina.
- Header Auth somente server-side. URL HTTP(S) sem credenciais/query/fragmento; redirects desabilitados. Destinos internos são permitidos para n8n privado, sob responsabilidade administrativa/egress do ambiente.
- POST após enqueue, janela de 5s, qualquer 2xx confirma apenas aceitação. Falha não altera estado do job; Schedule continua fallback. Idempotência campanha/hora preservada.
- Nenhuma seleção especial por job sinalizado: claim continua pegando pendência elegível mais antiga.
- Interface reaproveita identidade e componentes atuais. Sem nova dependência, arquitetura de fila ou movimento.

## Evidência

- Estado atual e chamadores conferidos antes de editar; alterações anteriores preservadas.
- Testes iniciais falharam por ausência do helper/action; após implementação, criptografia/validação, HTTP local real (202, redirect e timeout de 5s) e autorização administrativa passaram.
- PostgreSQL descartável com migrações existentes: teste integrado verificou ciphertext em repouso, projeção sem segredo, preservação/remoção, falha HTTP/timeout sem perder pendência e cliques concorrentes com um único job.
- Checks finais: lint/typecheck/test/build com código 0; 17 arquivos / 75 testes aprovados, sem skip, incluindo 9 integrações PostgreSQL. Nenhuma mudança em schema/lockfile/dependências.
- Smoke final em Chromium com build de produção aprovou salvar/preservar/remover segredo, projeção sem plaintext/ciphertext, isolamento de membro, POST real local, feedback 202/503 e cliques repetidos com um único job. Capturas desktop/mobile abertas; detalhes e falhas do harness anteriores ao verde em `docs/VERIFICATION.md`.
- Revisão independente indisponível nesta ferramenta; autorrevisão não é aprovação de segurança/produção.
