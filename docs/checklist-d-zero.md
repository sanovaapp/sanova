# 🌿 Checklist D-ZERO — o dia em que a transferência/aprovação sair

> T70 (Fable/CEO): "quando sair, publicamos em HORAS". Este arquivo é o
> roteiro exato desse dia. Cada bloco diz QUEM executa (Bruno / Chrome /
> Code) e o que já está pronto.
>
> Estado de referência (05/08/2026): conta org MEDFAST 100% verificada;
> transferência do `br.app.sanova` enviada, aguardando aceite do destino.

---

## Cenário A — Transferência concluiu (app aparece na conta org)

A ficha, declarações, faixa de teste e AAB **migram juntos**. O que NÃO migra:
lista de testadores (recadastrar) e associações de service account (criar).

### Passo 1 — Conferir o que chegou (Chrome, 5 min)
- [ ] App `br.app.sanova` listado na conta org (ID 8754701096507326927)
- [ ] Ficha da loja intacta (título, descrições, screenshots, feature graphic)
- [ ] Declarações de saúde/privacidade/data safety migradas
- [ ] Faixa de teste fechado existe (era "Teste interno" na pessoal)

### Passo 2 — Recadastrar testadores (Chrome + Bruno, 10 min)
- [ ] Faixa de teste fechado → lista de testadores → criar lista "Piloto Sanova"
- [ ] Adicionar e-mails dos testadores (Bruno tem a lista do recrutamento)
- [ ] Salvar. O link de opt-in só nasce APÓS aprovação da revisão.

### Passo 3 — Reenviar pra revisão (Bruno, 2 cliques)
- [ ] Painel de publicação → "Enviar alterações pra revisão"
- [ ] Nada precisa ser refeito — as "14 mudanças" do envio de 18/07 seguem válidas
- [ ] Prazo esperado: 1-7 dias (app de saúde, mas conta org agora é compatível
      com a política que causou a rejeição)

### Passo 4 — Enquanto a revisão roda (paralelo, sem esperar)
- [ ] **Bruno**: criar service account na conta org — guia completo em
      `docs/publish-play-setup.md` (seção 1). Cravar os 4 secrets:
      `PLAY_SERVICE_ACCOUNT_JSON`, `TWA_UPLOAD_KEYSTORE_B64`,
      `TWA_UPLOAD_STORE_PWD`, `TWA_UPLOAD_KEY_PWD`
- [ ] **Code**: smoke test do pipeline — `Actions → Publish TWA to Google Play
      → Run workflow` (track internal, status draft) e conferir que o upload
      autentica
- [ ] **Bruno**: grupo WhatsApp (kit 100% pronto desde T60) se ainda não criou

### Passo 5 — Aprovação chegou (e-mail no contatosanovaapp)
- [ ] Copiar o **link de opt-in** da faixa de teste fechado
- [ ] Bruno cola o link no grupo/testadores → **relógio dos 14 dias LIGA**
- [ ] Registrar data de início na Sala #148 (o prazo de 14 dias conta a partir
      de 12 testadores ativos)

### Passo 6 — Durante os 14 dias
- [ ] 2-3 releases pequenos via pipeline (bugs P2 são candidatos) — Google
      valoriza atividade de teste
- [ ] Grok: auditoria paciente-espião nas builds
- [ ] Code: monitorar crash/ANR no Play Console via Chrome

---

## Cenário B — Transferência falhou/travou (fallback)

Só executar com decisão explícita na Sala (Fable ou Bruno cravam a troca de rota).

- [ ] Criar app NOVO na conta org: "Criar app" → Sanova → pt-BR → App → Grátis
- [ ] Re-preencher ficha: copiar de `store-assets/ficha-loja.md` (canônica T44)
- [ ] Screenshots + feature graphic: `store-assets/*.png`
- [ ] Data safety: copiar respostas de `docs/data-safety-form.md`
- [ ] Declarações de app de saúde: refazer (categoria Saúde e fitness,
      público 18+, sem anúncios)
- [ ] URL da política de privacidade: `https://sanova.app.br/privacidade.html`
- [ ] AAB: baixar artifact do workflow `Build TWA AAB` (ou rodar de novo) e
      subir manualmente na 1ª vez — próximas vão pelo pipeline
- [ ] ⚠️ Package name `br.app.sanova` pode estar RESERVADO pelo app da conta
      pessoal — se der conflito, precisa deletar o draft da pessoal primeiro
      (ato irreversível → Bruno decide)

---

## Referências rápidas

| O quê | Onde |
|---|---|
| Ficha da loja (canônica) | `store-assets/ficha-loja.md` |
| Data safety pré-respondido | `docs/data-safety-form.md` |
| Guia service account + secrets | `docs/publish-play-setup.md` |
| Pipeline de publish | `.github/workflows/publish-play.yml` |
| Build avulso do AAB | `.github/workflows/build-twa-aab.yml` (dispatch, commit_assetlinks=false) |
| Screenshots + feature graphic | `store-assets/*.png` |
| Política de privacidade | `https://sanova.app.br/privacidade.html` |
| Exclusão de conta (exigência Play) | `https://sanova.app.br/exclusao.html` |
