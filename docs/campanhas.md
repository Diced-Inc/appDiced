# Campanhas — primeira etapa

A área mantém a rota `/acquisition` para preservar links existentes, com o nome Campanhas no menu, título e configurações. Usa períodos próprios (hoje, ontem, últimos sete dias, mês e datas personalizadas); os períodos financeiros continuam mensais.

Status e orçamento são consultados na Meta na abertura da página. Uma falha nessa consulta não remove as métricas salvas. O status é da campanha, não a aprovação individual dos anúncios. Orçamento sem valor na campanha deve ser consultado no Meta, pois pode estar nos conjuntos; não é inferido como zero. A conversão do orçamento foi limitada a BRL/USD/EUR/GBP; outras moedas exibem consulta no Meta até validar sua unidade.

## Atribuição

O fallback `apps.facebook.com / fb4a` identifica o fluxo GA4, não uma campanha. Se houver vários vínculos no mesmo property/stream, ele fica excluído dos totais exibidos para todas essas campanhas, inclusive ao filtrar só uma delas. Não há repartição arbitrária. Dados históricos armazenados permanecem preservados.

UTMs idênticas no mesmo fluxo (comparação sem diferenciar maiúsculas) também são excluídas e sinalizadas como indisponíveis. Gasto Meta permanece preservado. Corrigir os vínculos é necessário para comparar retorno. Com um só vínculo, o fallback permanece uma estimativa, não prova de atribuição exclusiva.

Ausência de gasto não produz rótulo positivo. Falhas de leitura/sincronização e UTMs conflitantes não produzem saldo/ROAS de campanha apresentado como comprovado. Integração conectada não implica validação dos eventos ou do Install Referrer.

## Validação e próximos passos

Testes cobrem janelas entre meses/anos, datas impossíveis/invertidas/futuras, receita duplicada entre campanhas, UTMs compartilhadas e estados sem dados. Ainda faltam comparação por criativo, coortes D1/D7/D30 e validação visual autenticada com ambiente local configurado.

Esta etapa não altera campanhas, orçamento de mídia, permissões Meta nem banco de produção. Para executar o app/build completo, configurar as variáveis previstas em `apps/web/.env.example`, incluindo Clerk. Não versionar credenciais.
