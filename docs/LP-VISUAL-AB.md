# Comparação visual e refinamento controlado

Workflow n8n: JB AGENT | 08AB - COMPARADOR VISUAL (`gli5Co0fL1wWuQFx`). Escopo atual: LP 2, lead 49, Agropet Calais. Execução manual; nenhum agendamento, publicação ou promoção automática.

A primeira comparação recebe 4 PNGs com matriz completa de duas versões × desktop/mobile. Valida assinatura PNG, versões, dispositivo e hashes; envia uma única chamada multimodal. A decisão exige confiança >=0,8, ganho médio >=0,3, ausência de perda >0,5 por critério, nenhum dispositivo perdedor e ausência de regressões médias/altas/críticas. Empate mantém a referência.

As comparações são append-only em `jb_agent_lp_ab_comparisons`, com parecer, modelo, rubrica, hashes, notas, política e identidade da resposta. A gravação confere novamente os hashes dos snapshots no banco. Respostas repetidas não duplicam registros. Preferência visual permanece pendente de validação técnica e comercial.

08R consulta críticas individuais visuais/técnicas e brief; gera até 12 ajustes de estilo em esquema estrito. Apenas seletores e propriedades permitidos; bloqueia HTML, URLs externas, conteúdo CSS, display e fontes ilegíveis. O HTML original deve ser recuperável byte a byte removendo apenas o style acrescentado. Não corrige copy nem cria serviços ou dados comerciais. Versões novas recebem status draft, source 08R e evaluation_status pending; snapshots anteriores e LP legada não são atualizados. Limite atual de três versões 08R por LP.

08RC captura novamente referência e candidata e registra outra comparação usando a mesma política. Candidatas empatadas ou com regressão não são promovidas. Não há laço infinito; cada disparo realiza um ciclo limitado.

Validação local: `node --test scripts/test-refine-validator.cjs` (10 testes). Os dois TSX foram transpilados com esbuild; build Next/checagem de tipos e verificação visual do novo painel aguardam implantação. A atualização de main foi bloqueada pela revisão automática por possível implantação em produção. O PR não deve ser apresentado como dashboard já implantado.

A direção de arte nesta etapa é refinamento de estilo da página existente, com conteúdo preservado; uma reconstrução estrutural ampla ainda exige outro fluxo e validações equivalentes.
