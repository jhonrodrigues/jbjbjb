# JB Agent — Entrega 3/4: Propostas, Vendas e Checklist de Entrega

## Objetivo
Dar continuidade à Central de Contato na ficha `/comercial/[id]`:
proposta → apresentação manual → aceite real → confirmação manual de pagamento integral → checklist de entrega.

## O que foi implementado
- Proposta comercial com título, escopo, preço de implantação, mensalidade e prazo. Valores guardados em centavos convertidos para texto decimal fixo.
- Proposta legível para copiar e apresentar externamente. Sem automação de envio nem contratos gerados.
- Registro de envio **somente após interesse do lead, aprovação da LP e confirmação manual**; fica em `proposta_enviada`.
- Aceite apenas após proposta enviada; operador deve informar a evidência do aceite.
- Confirmação do **pagamento integral da implantação**, com valor idêntico à proposta e referência de pagamento. O operador confirma recebimento real; não há integração bancária. Só nesse ponto o CRM passa para `fechado` e contabiliza receita.
- Checklist da entrega (materiais, personalização, domínio, hospedagem, revisão do cliente, autorização de publicação, publicação verificada, entrega dos acessos). Cada item é concluído manualmente com histórico; os itens mais sensíveis exigem evidência textual.
- Oportunidades passam pelas colunas `Venda fechada`, `Em entrega` e `Entregues`.
- Eventos persistem em `jb_agent_contact_events` com `proposal_id`, sem migração de banco, mantendo o histórico por proposta e seus estados.
- Os caminhos antigos de mover diretamente para `proposta_enviada` ou `fechado` foram bloqueados, exigindo o fluxo formal.

## Não incluído
- Envio de propostas por e-mail/WhatsApp, assinatura eletrônica ou aceite por link.
- Cobrança, geração de boleto, Pix, cartão ou conciliação bancária.
- Pagamentos parcelados ou parciais (somente o integral da implantação).
- Publicação automatizada, DNS/SSL ou deploy de cliente; checklist registra trabalho efetivamente feito fora do painel.
- Faturamento fiscal, nota fiscal, termos legais personalizados, renovação de assinatura ou suporte.
- Envio automático de mensagens e aprovação em nome do cliente.

## Regras de segurança
- Nenhuma operação externa é executada por estes eventos.
- Ações do servidor exigem autenticação e validam transições dentro de transações PostgreSQL com `FOR UPDATE`.
- Rascunhos não são considerados propostas enviadas; aceite e pagamento dependem de registro explícito.
- Registro de venda só acontece com aceite e pagamento integral confirmados pelo operador.
- Entrega só pode ser concluída após todas as etapas registradas.
- O histórico é limitado a 500 eventos para reconstrução do estado; revisar estratégia antes de operações muito longas.

## Teste antes de produção
1. Execute `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`.
2. Em homologação, crie uma proposta com valores e escopo completos para um contato que já respondeu.
3. Tente registrar envio com LP não aprovada: deve bloquear.
4. Aprove uma LP de teste e registre envio manual; confirme `proposta_enviada` no histórico e pipeline.
5. Registre um aceite real de teste e tente confirmar valor de pagamento diferente do total: deve bloquear.
6. Confirme pagamento *apenas* em conta/cadastro de teste com dados fictícios. Confirme `fechado` e `Em entrega`.
7. Faça checklist manual, registre a autorização do cliente e conclua. Confirme que passa para `Entregues`.
8. Verifique que nenhum e-mail, cobrança, publicação ou workflow n8n foi disparado por essas ações.

## Próxima evolução
Persistir propostas e contratos em tabelas dedicadas (especialmente para versionamento de assinaturas e parcelas), integração opcional com gateway de pagamentos após configuração segura, confirmação externa de aceite, gestão de projetos de entrega e publicador de LP com domínio do cliente e autorização explícita.
