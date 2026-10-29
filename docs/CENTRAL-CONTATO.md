# JB Agent — Entrega 2: Central de Contato (primeiro módulo)

## Objetivo
Conectar cada oportunidade do pipeline ao preparo de uma abordagem comercial, com edição e registro manual de envio e resposta. **Não há integração de envio automático nesta entrega.**

## Fluxo
1. Abra `/operacao`, escolha uma empresa e clique em **Preparar abordagem** ou **Central de contato**.
2. A ficha `/comercial/[id]#central-contato` sugere um texto inicial com o nome e a cidade do lead, sem alegações não confirmadas. O texto sugerido é um modelo determinístico, **não** uma geração por IA.
3. Edite e clique **Salvar rascunho**. O conteúdo será registrado como evento `abordagem_rascunho` com `delivery=not_sent`. Nenhuma mensagem sai do sistema.
4. Com LP aprovada, clique **Copiar mensagem** e efetue o contato manualmente pelo canal permitido.
5. Somente depois do contato efetivo, use **Confirmar contato realizado**. Escolha o canal e, opcionalmente, registre a mensagem real. No canal WhatsApp é exigida a confirmação de consentimento.
6. O evento `contato` avança o CRM para `contatado` (se ainda estava em fase anterior).
7. Use **Salvar resposta recebida** para registrar a mensagem recebida. O evento `resposta` avança até `respondeu`, sem retroceder negociações ou vendas.
8. A coluna do pipeline se atualiza por meio do CRM e o histórico de eventos exibe os registros.

## Segurança
- Ações usam `requireUser`, controle de estado no servidor e transações de banco.
- Uma LP vinculada e ainda não aprovada impede o registro de contato ativo, inclusive se alguém tentar executar a ação sem clicar no botão.
- Não há disparos automáticos, acesso a WhatsApp/Instagram, coleta de inbox, envio de links de preview nem cobranças.
- Rascunhos nunca são registrados como enviados.
- A confirmação de consentimento é uma declaração do operador; não constitui comprovação técnica de autorização.
- Contatos já fechados ou perdidos não podem receber os registros ativos deste módulo.

## Validação manual
- Abrir a LP 6 via pipeline; entrar na ficha comercial e verificar a Central de Contato.
- Antes de aprovar, conferir se copiar e registrar contato estão bloqueados.
- Salvar rascunho; verificar histórico; nenhuma mensagem externa deve ser enviada.
- Após revisão e aprovação real da LP, conferir cópia e registro de contato manual, com avanço para `contatado`.
- Registrar resposta de teste em contato permitido e verificar `respondeu`.
- Verificar que histórico e próximos passos no CRM permanecem coerentes.

## Fora do escopo desta entrega
Geração de mensagens usando o modelo de IA, inbox bidirecional, envio por APIs, confirmação automática de recebimento, propostas, cobranças, contratos e entrega do site. Estes módulos continuam no roadmap.

## Deploy
Sem migração de banco nesta entrega: usa `jb_agent_contact_events` e `jb_agent_contacts` já existentes. Executar `npm run lint && npm run typecheck && npm test && npm run build` antes do deploy.
