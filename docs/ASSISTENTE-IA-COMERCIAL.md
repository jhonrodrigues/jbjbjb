# JB Agent — Assistente comercial com IA (Entrega 5, sob demanda)

## Objetivo
Usar IA **somente quando o operador clicar**, na ficha `/comercial/[id]`, para sugerir uma abordagem e estruturar escopo e prazo de proposta, com revisão e salvamento manuais. Complementa os PRs #9, #10 e #11.

## Configuração
No ambiente **servidor** do dashboard no EasyPanel:
- `OPENAI_API_KEY`: chave da conta de API OpenAI. O plano ChatGPT não fornece créditos para esta API.
- `JB_COMMERCIAL_AI_MODEL`: opcional; padrão `gpt-4.1-mini`. Precisa suportar modo de resposta JSON da API Chat Completions.

A seção **Configurações → Ambiente** indica agora **IA comercial configurada** apenas quando `OPENAI_API_KEY` estiver presente. Não cole a chave no cliente nem a salve na ficha do lead. Não há nova migration nesta etapa.

## Funcionalidade
- `Central de contato → Gerar com IA`: cria uma mensagem curta pedindo permissão para mostrar uma ideia, sem links; preenche campo editável, **não salva automaticamente**.
- `Proposta, venda e entrega → Sugerir escopo com IA`: sugere título, escopo e prazo; **não altera valores de implantação/mensalidade**.
- Ambos operam apenas com dados armazenados da empresa: nome, segmento, cidade, site conhecido e existência da demonstração. Não envia histórico de conversas, telefones, e-mail ou HTML.
- `Salvar rascunho` é um clique separado. Nada é enviado, publicado, cobrado ou aprovado em nome do cliente.

## Controle de custo e segurança
- Cada solicitação passa por autenticação.
- Reserva contagem no PostgreSQL ANTES da chamada externa com lock por operador.
- Limites: **2/minuto e 12/24h por contato, 40/24h por operador**. Tentativas que falham depois da reserva contam.
- Resposta exigida em JSON e validada por tamanho, formato e faixa de prazo. Dados desconhecidos, preços e informações não confirmadas devem ser revisados manualmente.
- Tempo limite da API: 20 segundos; máximo 800 tokens de saída por geração, no parâmetro da API.
- API externa: OpenAI Chat Completions, enviada a partir do servidor (nunca do navegador).
- Sem integração com o envio por WhatsApp nem n8n; o 05LP permanece inalterado.

## Checklist de homologação
1. Sem `OPENAI_API_KEY`, ambos os botões de IA devem aparecer desabilitados, com orientação de configuração.
2. Com a chave, clicar em **Gerar com IA** para lead de teste; mensagem sugerida aparece apenas no textarea. Verificar que não foi enviada e nem salva.
3. Salvar manualmente e ver histórico de rascunho existente.
4. Clicar em **Sugerir escopo com IA**. Revisar título, escopo, prazo e confirmar que preços não mudam.
5. Testar as cotas de 2/minuto e erros da API. O erro deve ser compreensível e não incluir chave ou prompt integral.
6. Rodar `npm run lint && npm run typecheck && npm test && npm run build` antes de integrar a PR.
7. Validar o comportamento de LP não aprovada: a IA pode preparar rascunho, mas copiar/registrar contato e marcar proposta enviada seguem condicionados às permissões anteriores.

## Próximas evoluções
- Exibir consumo/tokens reais em dashboard; cotas atuais limitam chamadas, mas não equivalem a teto financeiro exato.
- Sugestões com evidências de pesquisa verificadas e consentimento documentado.
- Aprovação formal de proposta com link, geração de PDF, assinatura, cobrança e publicação automatizada com autorização.
