# Configurar `sanova.com.br` no Registro.br

## Por que isso

GitHub Pages serve em `sanovaapp.github.io/sanova/`. Pra resolver em
`sanova.com.br`, o DNS do domínio precisa apontar pros servidores do
GitHub Pages. O arquivo `/CNAME` no repo já tem `sanova.com.br` — falta
configurar o DNS.

## Passos no painel do registro.br

1. Entra em https://registro.br → faz login → seleciona `sanova.com.br`
2. Clica em **DNS** ou **Configurar DNS**
3. Cria os 4 registros A pro **APEX** (sem nome de subdomínio):

| Tipo | Nome | Valor              | TTL  |
|------|------|--------------------|------|
| A    | @    | 185.199.108.153    | 3600 |
| A    | @    | 185.199.109.153    | 3600 |
| A    | @    | 185.199.110.153    | 3600 |
| A    | @    | 185.199.111.153    | 3600 |

4. Cria 1 registro CNAME pro **www**:

| Tipo  | Nome | Valor                  | TTL  |
|-------|------|------------------------|------|
| CNAME | www  | sanovaapp.github.io.   | 3600 |

(O ponto final do `.github.io.` é intencional.)

5. Salva.

## DNS propagar

Leva entre 10min e 24h. Pode checar quando ficou pronto em
https://dnschecker.org procurando por `sanova.com.br`.

## Depois que propagar

1. No GitHub: vai em **Settings → Pages → Custom domain**, coloca
   `sanova.com.br` e marca **Enforce HTTPS**. GitHub valida sozinho.
2. Eu atualizo o `manifest.json` e o `pro.html` pra apontarem pra
   `sanova.com.br` em vez de `sanovaapp.github.io/sanova`.
3. Eu finalizo o `assetlinks.json` em `/.well-known/` pro TWA do
   Play Console funcionar.

## TWA pra Play Console (depois da identidade verificada)

1. Você vai precisar gerar o APK assinado. Mais fácil: usa o
   PWABuilder (https://www.pwabuilder.com) — cola `https://sanova.com.br`,
   ele detecta o manifest e gera o pacote Android.
2. Faz o upload no Play Console. Cria um Release de teste interno.
3. O Play Console gera uma **SHA-256 fingerprint** do certificado de
   signing. Copia ela.
4. Me passa a fingerprint, eu substituo no `assetlinks.json` (linha 8).
5. Espera DNS resolver `https://sanova.com.br/.well-known/assetlinks.json`
   e o Android verifica o vínculo automaticamente.

## Resumo do que cada um faz

**Você (Bruno):**
- Configurar DNS no registro.br (5 min)
- Esperar propagar (passivo)
- No GitHub Pages: ativar custom domain + Enforce HTTPS (2 min)
- Quando Play Console aprovar identidade: gerar APK via PWABuilder,
  upload, copiar SHA-256, me passar.

**Eu (Code):**
- Já criei o `/CNAME` (commitado)
- Já criei o `/.well-known/assetlinks.json` placeholder
- Quando DNS resolver: atualizo manifest pra apontar pro domínio novo
- Quando você me passar a SHA-256: cravo no assetlinks
