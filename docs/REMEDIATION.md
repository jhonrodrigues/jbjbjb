# Correções da revisão — 2026-10-26

Escopo autorizado: correções locais e verificações, sem Git, produção ou publicação.

## Plano e critérios

1. Sessões: manter 8h; revogar JWT após troca de senha ou desativação, inclusive na renovação Auth.js.
2. Fila: token único obrigatório por claim; callbacks antigos rejeitados; transições validadas no servidor; pausa bloqueia novos claims, não interrompe execução em andamento.
3. Admissão: serializar contagem/inserção de jobs novos; orçamento monetário informativo, sem promessa de teto de gastos ou tentativas.
4. Preview/LP: fixar versão assinada; status canônico da última versão com fallback legado; sincronização transacional quando suportada.
5. Dados/UI: SQL compatível com colunas opcionais; timezone explícito; busca CRM no banco com paginação; eventos e mudanças comerciais atômicos.
6. Operação: inspeção sem amostras; conexão compose por campos separados; documentação e regressões.
7. Executar lint, typecheck, testes, build e Docker se disponível; autorrevisão final e registrar limitações.

## Decisões

- Não há workflows n8n neste workspace nem evidência local de consumidor implantado. Implementar contrato novo obrigatório, sem fallback inseguro. Workflows externos não serão alterados; implantação exige confirmar migração dos consumidores.
- Não criar índice único de contatos: regra por lead/campanha ainda não foi definida. Serializar inserção manual por lead preserva comportamento atual sem eliminar dados existentes.
- Sem ferramenta de subagentes/revisão independente disponível. Autorrevisão não substitui revisão de segurança independente antes da liberação.

## Progresso

- Estado atual conferido; Node padrão 20, Node 22.23.1 disponível; nenhuma alteração preexistente descartada.
- Correções de P1/P2 implementadas; novas regressões inicialmente falharam para versão de sessão, lease antigo, timezone, conexão PG*, SQL mínimo, status LP e contratos CRM; rodadas posteriores ficaram verdes.
- Checks finais Node 22: lint/typecheck/test/build com código 0; 14 arquivos/55 testes sem skip, incluindo 8 integrações PostgreSQL. Docker reconstruído e runtime/Chromium verificados; detalhes e limites em `docs/VERIFICATION.md`.
- Autorrevisão final executada; revisão independente indisponível. Publicação bloqueada por revisão de segurança e confirmação de atualização dos consumidores externos.
