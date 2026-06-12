# Configurar `sanova.app.br` no Registro.br

> **Domínio registrado**: `sanova.app.br` (registro.br, titular Bruno,
> 12/06/2026, expira 12/06/2028). `.app.br` é a categoria do registro.br
> pra aplicativos.
>
> **Pacote Android (Play Console)**: `br.app.sanova` (reverse-DNS,
> permanente — usar em TODO build TWA/Bubblewrap).

---

## TAREFA 1 — DNS no Registro.br (5 min)

1. Entra em https://registro.br → login → seleciona `sanova.app.br`
2. Clica em **DNS** ou **Configurar DNS**
3. Cria os 4 registros **A** pro APEX (sem nome de subdomínio):

| Tipo | Nome | Valor              | TTL  |
|------|------|--------------------|------|
| A    | @    | 185.199.108.153    | 3600 |
| A    | @    | 185.199.109.153    | 3600 |
| A    | @    | 185.199.110.153    | 3600 |
| A    | @    | 185.199.111.153    | 3600 |

4. Cria 1 registro **CNAME** pro `www`:

| Tipo  | Nome | Valor                  | TTL  |
|-------|------|------------------------|------|
| CNAME | www  | sanovaapp.github.io.   | 3600 |

(O ponto final em `.github.io.` é intencional — sintaxe FQDN.)

5. Salva.

---

## TAREFA 2 — Esperar DNS propagar

Leva entre 10 min e 24h. Checagem rápida:
- https://dnschecker.org → busca por `sanova.app.br` → tipo A
- Deve aparecer os 4 IPs `185.199.108-111.153`

---

## TAREFA 3 — Ativar Custom Domain no GitHub Pages

1. Vai em https://github.com/sanovaapp/sanova/settings/pages
2. Em **Custom domain** coloca: `sanova.app.br`
3. GitHub verifica automaticamente (precisa do DNS já propagado).
4. Quando aparecer o ✓ verde: marca **Enforce HTTPS**.

---

## TAREFA 4 — TWA / Play Console (quando você gerar o APK)

A conta Play Console **já está verificada** (Bruno Glp1) e o app
**`br.app.sanova`** já foi criado. O caminho:

1. **Gerar o pacote Android** via PWABuilder:
   - https://www.pwabuilder.com
   - Cola `https://sanova.app.br`
   - Ele detecta o `manifest.json` (já apontando pro domínio novo)
   - Gera o pacote TWA assinado (AAB)
2. **Upload no Play Console** → Release de **teste interno**.
3. O Play Console gera uma **SHA-256 fingerprint** do certificado de
   signing. **Copia ela.**
4. **Me passa a fingerprint** no chat — eu cravo no
   `/.well-known/assetlinks.json` (linha 8, substitui o placeholder).
5. Espera DNS resolver `https://sanova.app.br/.well-known/assetlinks.json`
   — o Android verifica o vínculo automaticamente e o app deixa de
   mostrar a barra do Chrome.

---

## O que cada um faz

**Você (Bruno):**
- ✅ Domínio registrado, conta Play verificada, app criado, 2FA ativo
- ⏳ Colar os 6 registros DNS no registro.br (5 min)
- ⏳ Após DNS propagar (10min–24h): ativar Custom Domain + HTTPS no GitHub
- ⏳ Gerar APK via PWABuilder, upload Play Console (teste interno)
- ⏳ Copiar SHA-256 do Play Console e me mandar

**Eu (Code) — já cravado:**
- ✅ `/CNAME` = `sanova.app.br`
- ✅ `manifest.json` com `id/start_url/scope` apontando pra `https://sanova.app.br/`
- ✅ Worker `wrangler.toml`: `ALLOWED_ORIGINS` inclui `sanova.app.br`
- ✅ Worker URLs MP backUrl, Supabase magic link → `sanova.app.br`
- ✅ Worker `admin-set-auth-urls`: `site_url` primário = `sanova.app.br`,
  `uri_allow_list` inclui `sanova.app.br` + github.io durante transição
- ✅ `/.well-known/assetlinks.json` placeholder com pacote `br.app.sanova`

**Eu (depois) — bloqueado pela DNS/SHA-256:**
- ⏳ Quando DNS propagar e Bruno confirmar: atualizar SANOVA_ORIGIN do
  workflow de prints pra `https://sanova.app.br`
- ⏳ Quando SHA-256 chegar: substituir no `assetlinks.json`
