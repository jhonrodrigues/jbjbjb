# JB Agent Autopilot — Motor Comercial V1

## Situação e limites
Primeira implementação do motor de **respostas automáticas a conversas iniciadas pelo cliente**, ligada a contatos existentes no PostgreSQL. **Não** faz prospecção fria em WhatsApp/Instagram, não envia mensagens espontâneas, não cria pagamentos, não publica sites e não se passa por humano. O prompt é natural, mas declara assistente virtual.

A implementação requer um **gateway n8n de entrada** que valide mensagens reais do provedor e aponte o `contactId` do CRM. O fluxo outbound também depende de um gateway com confirmação real de envio. **Nenhum canal real é conectado por este PR.**

## Arquitetura
- `jb_agent_sales_threads`: modo `ai` ou `human`, `opted_out` e timestamp do último inbound.
- `jb_agent_sales_messages`: inbox/outbox, idempotência de mensagens de entrada por canal+ID do provedor e de saídas por mensagem originária, status e log.
- `POST /api/internal/sales/inbound`: recebe somente payload de um integrador interno autenticado e já validado contra assinatura do provedor.
- `POST /api/internal/sales/tick`: executa **1** mensagem por chamada; lock PostgreSQL previne múltiplos workers simultâneos. n8n agenda um tick por minuto.
- `src/lib/sales-ai.ts`: modelo OpenAI com contexto do CRM, últimas 16 mensagens e regras de vendas/handoff. Resposta validada em JSON.
- `/autopilot`: painel de supervisão com fila, rascunhos, histórico, kill switch e handoff humano.
- `/autopilot/[id]`: diálogo por contato, possibilidade de assumir o atendimento e registrar opt-out.

## Migração
A migration `drizzle/0004_sales_autopilot.sql` é executada automaticamente pelo comando de startup em Docker. **O valor inicial de `sales_autopilot.paused` é true**, então o deploy por si só não responde a ninguém. O snapshot 0004 continua com as tabelas Drizzle usuais porque as novas tabelas são acessadas por SQL parametrizado (sem schema Drizzle nesta etapa).

## Variáveis no EasyPanel
- `INTERNAL_API_SECRET` — já existente, usada pela integração n8n para inbound e tick.
- `OPENAI_API_KEY` — necessária para a IA.
- `JB_SALES_WORKER_ENABLED=true` — habilita processamento dos inbounds na fila.
- `JB_SALES_MODEL=gpt-4.1-mini` — opcional.
- `JB_SALES_MAX_PER_HOUR=30` — máximo de mensagens processadas por hora (1–100).
- `JB_SALES_AUTOSEND_ENABLED=false` — **deixe false até validar outbound real e políticas**.
- `JB_SALES_OUTBOUND_URL` — URL HTTPS do webhook outbound n8n, opcional; deve aceitar POST JSON e agir com idempotência.
- `JB_SALES_OUTBOUND_SECRET` — segredo do webhook outbound, mínimo de 24 caracteres.

O **kill switch do painel** também deve estar liberado (`paused=false`) para processar mensagens. Um ambiente com apenas a variável do worker definida não faz envio externo.

## Integração de entrada do provedor
Na integração n8n, **verifique a assinatura/callback do provedor** e faça o mapeamento da conversa para um `contactId` pré-existente do CRM. NÃO aceite `contactId` alegado por terceiros nem marque `customerInitiated=true` sem comprovar que a mensagem veio do cliente.

Faça então:
```http
POST https://SEU_DOMINIO_DO_PAINEL/api/internal/sales/inbound
Authorization: Bearer SEU_INTERNAL_API_SECRET
Content-Type: application/json

{
  "contactId": "uuid-da-oportunidade",
  "channel": "whatsapp",
  "providerMessageId": "mensagem-real-id-unico-do-provedor",
  "text": "Olá, quero saber mais sobre o site.",
  "customerInitiated": true
}
```
O endpoint retorna 202 (novo) ou 200 (duplicado). Um opt-out é bloqueado no banco imediatamente.

**Não existe conector de WhatsApp pronto** no repo nem auto-descoberta de novos contatos por telefone. O integrador de entrada deverá fazer essas duas coisas a partir de dados confiáveis antes de ativar a automação.

## Worker n8n
Importe `n8n/JB-Agent-Motor-Comercial-Tick.json`.
1. Ajuste a URL do HTTP Request para o domínio real do painel.
2. Configure `JB_INTERNAL_API_SECRET` no ambiente n8n (mesmo valor de `INTERNAL_API_SECRET` no dashboard) ou substitua a expressão por uma credencial protegida do n8n.
3. Primeiro faça o POST manual com o workflow inativo e confirme resposta `paused` ou `disabled`.
4. Valide com uma conversa fictícia em homologação, só depois habilite `JB_SALES_WORKER_ENABLED=true` e libere o painel.
5. Ative o schedule no n8n apenas quando o fluxo inbound estiver validado.

Cada tick processa uma mensagem; mensagens com falha de IA têm no máximo duas tentativas, sem despacho de resposta antes da conclusão. Mensagens antigas (>24h), opt-outs, handoffs ou conversas em modo humano ficam `held`. Não são reativadas automaticamente.

## Outbound (somente quando provedor estiver conectado)
Se `JB_SALES_AUTOSEND_ENABLED=true`, `JB_SALES_OUTBOUND_URL` e segredo estiverem configurados e a conversa for elegível, o worker faz POST:
```json
{
  "idempotencyKey": "uuid-da-mensagem-de-resposta",
  "contactId": "uuid-do-contato",
  "channel": "whatsapp",
  "text": "Resposta curta do assistente virtual...",
  "replyToProviderMessageId": "id-do-inbound"
}
```
O gateway só deve devolver HTTP 2xx com `{"sent":true,"providerMessageId":"id-confirmado-do-provedor"}` **depois** de confirmação real do provedor. O webhook n8n deve deduplicar por `idempotencyKey` no provedor/banco, não apenas em memória.

Se não houver confirmação ou se ocorrer erro, a resposta permanece em `draft` para revisão humana. **Nunca há reenvio automático de despacho incerto.** Não se cria contato externo a partir do motor; todo envio é resposta à conversa autenticada iniciada pelo usuário, dentro da janela conservadora de 24 horas.

## Segurança e operação
- Não existe iniciação de mensagens frias no worker.
- A UI permite pausa geral, handoff por contato e opt-out. Somente administradores alteram esses controles.
- O prompt determina identificação como assistente virtual e proíbe falsidade, pressão, preços não confirmados e links automáticos.
- Quando surgirem preços, descontos, contratos, pagamento ou solicitação de humano, o agente deve marcar `handoff=true` e parar o automotor naquela conversa.
- Nenhum endereço, telefone, preço ou conteúdo privado extenso é enviado ao modelo: apenas nome/segmento/cidade e histórico curto daquela conversa.
- Proteções determinísticas independem do LLM: opt-out, janela, kill switch, autenticação, locks, idempotência, limites e modo humano.
- Não há chave de API no browser nem segredo embutido nos workflows.
- Para mensagens recebidas em múltiplos canais da mesma empresa, **verifique correspondência do destinatário**: o contato vinculado não pode ser decidido apenas pela IA.

## Validação antes do deploy
1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. Backup do PostgreSQL e validação da migration em homologação.
6. Com tudo desligado: abrir `/autopilot` e verificar `Pausado`.
7. Inserir inbound fictício pelo endpoint autenticado e repetir o mesmo `providerMessageId`: deve deduplicar.
8. Executar tick ainda pausado: não deve gerar resposta nem chamar IA.
9. Liberar só geração em homologação: resposta deve aparecer como `draft`, sem mensagem externa.
10. Usar palavras de opt-out: conversa deve ficar bloqueada imediatamente.
11. Assumir atendimento humano: não permitir novas respostas automáticas.
12. Somente após conector com confirmação e requisitos de canal testados: avaliar habilitar outbound real com baixo volume.

## Não implementado
- Descoberta de interlocutores novos a partir do telefone/perfil; gateway precisará associar contato.
- Templates aprovados para início de conversa; **o motor não inicia mensagens**.
- Cobrança automática, negociação de preços, contratos eletrônicos e publicação.
- Respostas com anexos, áudio, imagens e botões.
- Retry manual supervisionado de drafts, dashboard financeiro detalhado de tokens e retenção/expurgo automático.
