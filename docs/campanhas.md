# Campanhas

A área mantém a rota `/acquisition` para preservar links existentes, com o nome Campanhas no menu, título e configurações. Usa períodos próprios (hoje, ontem, últimos sete dias, mês e datas personalizadas); os períodos financeiros continuam mensais.

Status e orçamento são consultados na Meta na abertura da página. Uma falha nessa consulta não remove as métricas salvas. O status é da campanha, não a aprovação individual dos anúncios. Orçamento sem valor na campanha deve ser consultado no Meta, pois pode estar nos conjuntos; não é inferido como zero. A conversão do orçamento foi limitada a BRL/USD/EUR/GBP; outras moedas exibem consulta no Meta até validar sua unidade.

## Atribuição

O fallback `apps.facebook.com / fb4a` identifica o fluxo GA4, não uma campanha. Se houver vários vínculos no mesmo property/stream, ele fica excluído dos totais exibidos para todas essas campanhas, inclusive ao filtrar só uma delas. Não há repartição arbitrária. Dados históricos armazenados permanecem preservados.

UTMs idênticas no mesmo fluxo (comparação sem diferenciar maiúsculas) também são excluídas e sinalizadas como indisponíveis. Gasto Meta permanece preservado. Corrigir os vínculos é necessário para comparar retorno. Com um só vínculo, o fallback permanece uma estimativa, não prova de atribuição exclusiva.

Ausência de gasto não produz rótulo positivo. Falhas de leitura/sincronização e UTMs conflitantes não produzem saldo/ROAS de campanha apresentado como comprovado. Integração conectada não implica validação dos eventos ou do Install Referrer.

## Criativos, diagnóstico, coortes e histórico

O botão de detalhes abre quatro seções. Criativos consulta anúncios e insights no nível anúncio para o período selecionado, incluindo miniatura, texto, status, gasto, instalações, CPI e CTR. A prévia completa abre no Meta. Não há pausa/ativação automática nem atribuição de receita por criativo.

Rastreamento consulta 28 dias de eventos no fluxo inteiro e, separadamente, novos usuários e receita com UTM exata. Ausência de evento não prova falha; os limites de privacidade e o fuso retornados pelo GA4 são exibidos. Receita usa métricas padrão, sem somar `ad_paid`.

Retorno permite escolher um dia de primeiro acesso nos últimos 366 dias. Filtra `firstSessionDate` e UTM exclusiva e soma receita por data até D1/D7/D30, incluindo D0. Janelas abertas são parciais; sem novos usuários identificados, retorna desconhecido, não zero. O denominador de ROAS é o gasto Meta de todo o dia da coorte. Não há rateio do gasto para usuários sem UTM. A janela encerrada continua sujeita a atraso/ajustes do GA4. Fontes: [dimensões GA4](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [relatórios GA4](https://developers.google.com/analytics/devguides/reporting/data/v1/basics), [campos de criativo Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreative.py).

Histórico guarda decisões manuais e configurações observadas. Sincronização e registro manual de configuração detectam mudanças de status, orçamento e IDs de criativo. A função SQL serializa observações por integração e evita repetições consecutivas. O horário é da observação, não o horário real da alteração. Não inventa ator ou histórico anterior. Registros não executam decisões nos anúncios.

## Banco

Despesas manuais BRL/USD, categorias e cancelamento reversível ficam em `bank_expenses`. A cotação de referência USD/BRL é informada por mês e fica em `bank_month_rates`. Gastos Meta vêm das campanhas vinculadas; não equivalem à fatura inteira da conta. A agregação evita repetir campanha/conta/dia/moeda e mantém a linha com sincronização mais recente. O usuário não deve lançar novamente essas despesas de mídia.

O saldo mensal usa receita AdMob gerada, não recebimentos. Cotação ausente/moeda sem conversão mantém saldo indisponível. Não altera o bruto a receber do AdMob nem marca pagamentos. Meses antigos não são recalculados com cotação atual automaticamente.

## Migrações e validação

As migrações `20260908034809_campaign_decisions.sql` e `20260908035312_bank_expenses.sql` foram aplicadas no projeto DicedDb via SQL Editor. RLS habilitado nas três tabelas, sem acesso anon/authenticated; acesso server-side com ownership Clerk validado nas rotas. Aplique essas migrações em outros ambientes antes de publicar o código; não execute novamente em um banco já migrado.

Testes cobrem datas, coortes, atribuição duplicada, validação de decisões e despesas, moedas sem cotação, cancelamentos e autorização das rotas. O build completo foi validado com configuração local ignorada pelo Git.

Não há alteração de orçamento ou veiculação por estas funcionalidades. Para executar o app/build completo, configurar as variáveis previstas em `apps/web/.env.example`, incluindo Clerk. Não versionar credenciais.
