# JB Agent — Pipeline LP → CRM (Entrega 1)

## Objetivo
Conectar a geração n8n (05LP) ao CRM do dashboard, com revisão humana antes de qualquer contato.

## Fluxo implementado
1. O painel enfileira `generate_lp` como antes.
2. O worker 05LP pesquisa e grava `jb_agent_lps` e `jb_agent_lp_versions` em transação, mantendo `status=draft` na versão.
3. A migração `0003_lp_crm_pipeline.sql` instala o trigger de INSERT da versão, que cria ou vincula uma oportunidade em `jb_agent_contacts` com `stage=aguardando_aprovacao`, sem disparo externo.
4. A nova tela `/operacao` exibe as oportunidades por etapa e liga cada uma ao lead, à LP e ao CRM. Também mostra oportunidades anteriores via backfill da migração.
5. Ao clicar em **Aprovada** na LP, `setLpStatus` atualiza o status e, na mesma transação, avança a oportunidade ainda inicial para `pronto_para_contato`, registrando o evento.
6. Contatos em andamento, propostas e vendas fechadas nunca são regredidos por novos rascunhos. Voltar uma LP aprovada a draft retira a disponibilidade de contato apenas quando a oportunidade ainda está em `pronto_para_contato`.
7. O botão **Publicar** exige aprovação anterior; esta fase não implementa domínio, publicação externa, mensagem, cobrança nem entrega.

## Segurança e idempotência
- Trigger usa `pg_advisory_xact_lock(hashtext('crm-lead:' || lead_id))`, consistente com a criação manual do CRM.
- Reaproveita um contato existente e nunca envia mensagens.
- Status da LP e transição do CRM ocorrem juntos no painel; falha gera rollback.
- A migração backfill cria vínculo para leads que já têm versão da LP, evitando perder a LP #6.
- Publicação requer status `approved` antes da transição.
- O worker n8n 05LP e suas credenciais permanecem intocados.

## Implantação (requires deployment)
1. Faça backup do PostgreSQL.
2. Pause o 05LP durante o deploy da migração para evitar corridas no backfill.
3. Integre a branch após revisão; o entrypoint executa migrações via `scripts/migrate.mjs`.
4. Abra `/operacao`, verifique se a LP 6 aparece em **Revisão da LP**.
5. Abra a LP 6, valide fotos/textos/CTA e, se estiver adequada, clique **Aprovada**. Verifique que a oportunidade aparece em **Pronto para contato**.
6. Confirme que `/comercial` exibe o contato vinculado e que nenhuma comunicação foi enviada.
7. Reative o worker 05LP.

## Restrições e próximas etapas
- Esta entrega não automatiza mensagens, propostas, pagamentos, publicação ou entrega. Esses são módulos subsequentes.
- O pipeline mostra até 500 contatos recentes; ampliar paginação antes de escalar.
- Empresas sem dados comerciais confirmados exigem revisão humana; aprovar a estrutura visual não confirma telefone/endereço.
- O SQL de trigger está versionado com a migração; verifique primeiro em homologação com uma cópia anonimizada do banco.
