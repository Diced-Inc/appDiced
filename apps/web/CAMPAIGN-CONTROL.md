# Pausa e reativação de campanhas

Implementado em 08/09/2026. Na página Campanhas, cada campanha vinculada oferece Pausar campanha ou Reativar campanha conforme seu status configurado na Meta. O usuário confirma a ação; ao reativar, o orçamento existente pode voltar a ser consumido. A operação não muda orçamentos, anúncios ou conjuntos.

Conexões anteriores usavam apenas ads_read. Em Configurações, use Autorizar pausa e reativação para conceder ads_management. A permissão também depende do acesso do usuário e da configuração do aplicativo na Meta. Um token antigo não adquire a permissão apenas com o deploy.

POST /api/campaigns/[id]/status exige sessão Clerk, mesma origem e integração pertencente ao usuário autenticado. Conta e campanha vêm do vínculo salvo, nunca do corpo enviado pelo navegador. O servidor confere a conta na Meta, valida o estado atual, envia somente status e consulta a Meta novamente antes de confirmar. ACTIVE e PAUSED são os únicos estados permitidos. Falha de histórico não invalida uma mudança já confirmada.

Testes: 84 testes passaram; 10 cobrem o novo controle, incluindo autenticação, origem, propriedade, permissão, estados permitidos, conta divergente, confirmação e falha de histórico. Build de produção local passou. Testes de escrita na Meta usam mocks; nenhuma campanha real foi pausada/reativada para testar.

Referência do contrato de status: https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/campaign.py

Deploy de produção concluído: dpl_3z42R7oerTS93U2JnajYXAqyGgFU, alias https://app.diced.com.br. Botões Pausar campanha confirmados na interface autenticada para LoveMessage, VoiceNote e WaveRadio. Concessão OAuth ads_management e teste real de pausa/reativação permanecem pendentes; nenhuma campanha foi alterada durante a implementação.
