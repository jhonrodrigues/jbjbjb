# JB Agent — Entrega 6: Aquisição Híbrida (Cloud API + CRM + CAC)

## Arquitetura implementada
- **Meta Ads / WhatsApp oficial**: webhook público GET+POST em `/api/webhooks/meta/whatsapp`. Requer assinatura HMAC `X-Hub-Signature-256` do App Secret da Meta. Só aceita mensagens **text** recebidas no `phone_number_id` configurado. Ignora callbacks de status, mídia e números que não correspondem.
- **Entrada de formulário / canais B2B**: `POST /api/internal/acquisition/leads` autenticado pelo `INTERNAL_API_SECRET`. Registra a oportunidade e a origem, **não envia e-mail ou WhatsApp**. Uma solicitação é deduplicada por `submissionId`.
- **Resolução de identidade**: `jb_agent_acquisition_identities` vincula o identificador autenticado no canal ao `contactId`, com transação + lock por identidade. Cria uma oportunidade no CRM quando o remetente é desconhecido, sem inferir fusão com outras pessoas.
- **Atribuição**: `jb_agent_acquisition_contacts` guarda origem inicial e display name/e-mail de formulário. `jb_agent_acquisition_events` registra eventos deduplicados. No caso de anúncio click-to-WhatsApp, o `source_id` é registrado como `ad_key` quando disponível; **não inventamos `campaign_key`** (é necessário mapear ad→campanha via ferramenta de anúncios em futura etapa).
- **Conversa e memória**: a mensagem recebida passa pelo `ingestSalesInbound` do Autopilot V1, alimenta o histórico `jb_agent_sales_messages`, abre/atualiza `jb_agent_sales_threads` e movimenta contato para `respondeu`. A IA responde só quando o worker está liberado; não envia mensagens fria.
- **Saída oficial opcional**: `POST /api/internal/acquisition/whatsapp/send` funciona como gateway protegido pelo `JB_SALES_OUTBOUND_SECRET`, valida link exato com mensagem recebida, janela de 24h, status da conversa, opt-out, modo humano, pausa geral e limites. Usa Graph API oficial.
- **Idempotência durável**: `jb_agent_whatsapp_delivery_attempts` registra a tentativa ANTES de chamar a Meta. Em caso de falha/incerteza, bloqueia reenvio automático. A resposta da Graph API confirma aceitação, **não entrega ou leitura**.
- **Painel `/aquisicao`**: origem, conversas iniciadas, propostas, vendas, receita, custo por conversa, CAC de mídia, taxa de conversão e investimento informado manualmente. Filtros 7/30/90 dias.

## Configuração Meta (EasyPanel, serviço do painel)
```text
META_WHATSAPP_APP_SECRET=<App Secret do aplicativo Meta>
META_WHATSAPP_VERIFY_TOKEN=<um token forte gerado por você para o callback>
META_WHATSAPP_PHONE_NUMBER_ID=<ID do número conectado à Cloud API>
META_WHATSAPP_ACCESS_TOKEN=<token de acesso permanente de System User>
META_GRAPH_API_VERSION=<versão atual da Graph API, por exemplo v23.0>
```

Configure no painel Meta Developers o callback HTTPS:
`https://DOMINIO_DO_SEU_PAINEL/api/webhooks/meta/whatsapp`

Use o mesmo Verify Token do EasyPanel. Ative a assinatura/subscrição do objeto WhatsApp Business Account para mensagens. O `GET` verifica `hub.verify_token` e devolve o `hub.challenge`. O `POST` só processa corpo assinado pelo App Secret; **assinatura opcional não é permitida**.

A versão Graph é configurável por variável, para não depender de uma versão antiga fixa. Verifique a versão suportada na sua conta antes de ativar envio.

## Integração n8n e habilitação gradual
O n8n existente executa `POST /api/internal/sales/tick` conforme `n8n/JB-Agent-Motor-Comercial-Tick.json`. **Nenhuma mudança no gerador de LP.**

Variáveis do motor (já existentes na V1):
```text
OPENAI_API_KEY=<chave API da OpenAI>
INTERNAL_API_SECRET=<segredo interno forte>
JB_SALES_WORKER_ENABLED=false
JB_SALES_AUTOSEND_ENABLED=false
JB_SALES_OUTBOUND_URL=https://DOMINIO_DO_SEU_PAINEL/api/internal/acquisition/whatsapp/send
JB_SALES_OUTBOUND_SECRET=<segredo forte, pelo menos 24 caracteres>
JB_SALES_MAX_PER_HOUR=30
```

Ativação segura:
1. Realizar backup e deploy. A migração `0005_acquisition_channels.sql` roda na inicialização, criando tabelas sem disparar nenhum contato.
2. Confirmar que **a chave geral em `/autopilot` está PAUSADA** e que as duas flags estão `false`.
3. Registrar webhook na Meta e mandar **uma mensagem de teste de um número controlado por você** para o número Business oficial. Confirmar que cria contato no CRM/Autopilot.
4. Reenviar o mesmo webhook assinado em homologação: **não criar contato nem mensagem duplicada**.
5. Liberar apenas `JB_SALES_WORKER_ENABLED=true` e o kill switch para gerar respostas como `draft`, sem envio.
6. Confirmar opt-out, takeover humano, comportamento do modelo, links bloqueados, limites e janela 24h.
7. Só com o gateway testado e autorização/qualidade verificadas, avaliar liberar `JB_SALES_AUTOSEND_ENABLED=true` com baixo volume. A conta Meta e as políticas podem impor restrições adicionais.

## Evento interno para formulário ou mídia B2B

Envie pelo n8n servidor, não pelo navegador público:
```http
POST /api/internal/acquisition/leads
Authorization: Bearer <INTERNAL_API_SECRET>
Content-Type: application/json

{
  "submissionId":"form-unique-123456",
  "name":"Pessoa Interessada",
  "email":"cliente@example.com",
  "source":"form",
  "utmSource":"instagram",
  "utmMedium":"social",
  "utmCampaign":"sites_barbeiros",
  "marketingOptIn":false
}
```
A resposta contém `contactId` e `created`. O lead entra no CRM, mas **não entra na fila de envio**. `marketingOptIn` registra apenas a declaração recebida; não comprova consentimento e não habilita mensagem externa. Guarde evidência e texto da autorização em processo apropriado, antes de iniciar qualquer contato.

## Métricas e interpretação
- Período selecionado = **coorte dos contatos criados** entre as datas. O gasto é registrado por dia/calendário, podendo não coincidir com o momento em que esses clientes compram; análise de CAC deve considerar essa defasagem.
- Conversas = contatos com pelo menos uma mensagem inbound no histórico.
- Propostas = contatos atualmente em `proposta_enviada` ou `fechado`; é um indicador operacional, não contador de propostas históricas.
- Vendas/receita = CRM `fechado` e `closed_value` **registrados**, ainda não conciliação bancária.
- CAC de mídia = investimento lançado / clientes fechados da coorte. Não inclui custos de IA, equipe, hospedagem ou taxas.
- O investimento pode ser lançado em `/aquisicao` por administradores com canal, campanha, data e valor. Não está sincronizado à Meta Ads.

## O que NÃO foi automatizado nesta entrega
- Criação/gestão de campanhas na Meta Ads e sincronização de gastos da Marketing API.
- Envio frio de WhatsApp/Instagram ou cadências automáticas para listas.
- Envio de e-mails B2B, integração de uma caixa de e-mail, reputação/opt-out de e-mail.
- Hospedagem de uma landing page pública da JB Agent e coleta pública de formulários (a API interna está pronta para conectar uma página).
- Atribuição de campanhas completa a partir do ID de anúncio; requer API Meta Marketing para mapear anúncio→campanha.
- Cadastro de ofertas/preços aprovados para negociação autônoma, pagamento e geração de propostas automatizadas. A IA continua repassando preço/desconto para humano.
- Registro de confirmação de leitura/entrega por status callbacks e ferramentas de privacidade (retenção, exportação e apagamento) para produção escalada.

## Critérios de validação
`npm run lint && npm run typecheck && npm test && npm run build`

Integração real em homologação:
- Webhook sem assinatura: 401; assinatura válida: 200.
- Mesmo `wamid` duas vezes: contato único e mensagem única.
- Mensagem de anúncio com referral: `meta_ads` com `ad_key` quando oferecido.
- Texto com "não me contate": opt-out imediatamente, nenhuma resposta automática.
- Mensagem de origem não reconhecida (número Meta diferente): ignorada.
- Formulário: cria lead/identidade/atribuição, **não** dispara mensagem.
- Envio com worker ou autosend desligado: 409 sem chamada Graph.
- Caso de erro/timeout do Graph: tentativa marcada `uncertain`, sem retry cego.
- Painel mostra métricas somente com dados reais e gastos lançados.
