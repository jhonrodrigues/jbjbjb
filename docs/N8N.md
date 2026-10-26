# Integração n8n

## Autenticação

Envie em todas as chamadas:

```http
Authorization: Bearer ${INTERNAL_API_SECRET}
Content-Type: application/json
```

Alternativa: `x-jb-signature: ${N8N_WEBHOOK_SECRET}`. Nunca coloque esses valores no navegador.

## Reivindicar tarefas

`POST /api/internal/jobs/claim`

```json
{
  "workerId": "n8n-worker-01",
  "limit": 3,
  "types": ["analyze_lead", "generate_lp"]
}
```

`limit` máximo é 20. `types` é opcional. A resposta retorna os jobs já marcados como `processing`:

```json
{
  "jobs": [
    {
      "id": "uuid",
      "type": "analyze_lead",
      "agent_slug": "analista-ia",
      "payload": {},
      "campaign_id": null,
      "lead_id": "123",
      "lp_id": null,
      "status": "processing",
      "attempts": 1,
      "max_attempts": 3,
      "locked_by": "n8n-worker-01"
    }
  ],
  "count": 1
}
```

Se não houver tarefas, `jobs` é `[]` e `count` é `0`.

## Concluir tarefa

### Contrato obrigatório de lease (2026-10-26)

Cada job retornado por `claim` inclui `lease_token` (UUID novo por tentativa). Envie esse valor como `leaseToken` em **complete e fail**. Não reutilize o token de outra tentativa. Chamadas antigas sem token retornam 422; não existe fallback por `workerId`.

Mudança incompatível: antes de implantar esta versão, pare/drene workers antigos, confirme atualização dos consumidores externos e só então retome claims. Nenhum workflow externo foi modificado ou validado neste repositório. Jobs em processamento sem lease após a migração precisam expirar/reentrar na fila; não devem ser concluídos pelo contrato antigo.

`POST /api/internal/jobs/{id}/complete`

```json
{
  "workerId": "n8n-worker-01",
  "leaseToken": "00000000-0000-4000-8000-000000000001",
  "result": {
    "summary": "Lead qualificado",
    "score": 87
  }
}
```

Regras:

- O job precisa estar em `processing`.
- O `workerId` deve ser o mesmo que fez o claim.
- O lease deve corresponder ao claim atual e não estar expirado. O mesmo `workerId` não autoriza callback de tentativa antiga.
- Repetir conclusão já aceita com o mesmo lease retorna o job sem duplicar eventos. O token da conclusão fica retido para essa verificação.

## Registrar falha

`POST /api/internal/jobs/{id}/fail`

```json
{
  "workerId": "n8n-worker-01",
  "leaseToken": "00000000-0000-4000-8000-000000000001",
  "error": "Timeout ao consultar o site do lead",
  "retryable": true
}
```

Com `retryable: true`, a tarefa volta para `pending` com atraso de 60 segundos enquanto houver tentativas. Com `false`, ou ao esgotar `maxAttempts`, o status final é `failed`.

Somente o worker que possui o claim de uma tarefa em `processing` pode registrar falha. Repetir `fail` depois de agendar retry retorna `409 JOB_NOT_PROCESSING`; tarefas canceladas ou com falha final não são reabertas por esse endpoint.

## Códigos de erro

| HTTP | Código | Significado |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Segredo ausente ou inválido. |
| 404 | `JOB_NOT_FOUND` | Job inexistente. |
| 409 | `JOB_LOCKED` | Outro worker possui o job. |
| 409 | `JOB_STALE_LEASE` | Claim expirado, ausente ou substituído. |
| 409 | `JOB_NOT_PROCESSING` | Job não está em processamento para concluir ou registrar falha. |
| 409 | `AGENT_PAUSED` | Agente pausado no painel. |
| 422 | `VALIDATION_ERROR` | Payload inválido. |
| 429 | `RATE_LIMITED` | Muitas chamadas por IP. |
| 429 | `JOB_LIMIT` | Limite diário da operação. |
| 503 | `NOT_CONFIGURED` | Segredo interno não configurado. |

## Tipos de job

`prospect_campaign`, `analyze_lead`, `research_brand`, `generate_lp`, `regenerate_lp`, `publish_lp`, `prepare_outreach`.

## Recomendações para o workflow

1. Use um nó HTTP Request com o bearer token vindo da credencial do n8n.
2. Faça claim de poucos jobs por ciclo para controlar concorrência.
3. Processe em `try/catch`; sempre chame `complete` ou `fail`.
4. Não reenvie o resultado para o navegador; o painel lê o banco.
5. Use um `workerId` estável e único por instância.
6. Respeite `max_attempts`; não implemente retry infinito no n8n.

## Pausa, duração e efeitos externos

- Pausa de agente bloqueia admissão de novos jobs e claim de pendentes. Campanha não ativa também impede admissão/claim. Execuções já reivindicadas não são interrompidas; cancelamento no painel não desfaz efeito externo.
- Ainda não há heartbeat. Configure `JOB_LOCK_TIMEOUT_SECONDS` acima da duração máxima esperada e reivindique lotes pequenos. Callback depois do timeout é rejeitado mesmo antes de outro claim.
- Fencing protege estado da fila, não torna chamadas externas exatamente uma vez. Workflows devem persistir efeitos de forma idempotente, usando ID do job e identidade da tentativa quando aplicável.
- `complete` grava somente `jobs.result` e eventos. Leads, brand profiles, versões/HTML e demais efeitos de domínio continuam responsabilidade do workflow; enviar JSON de resultado não atualiza essas tabelas automaticamente.
