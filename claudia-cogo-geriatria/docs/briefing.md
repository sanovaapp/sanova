# Briefing — Site Dra. Claudia Cogo · Geriatria

## 1. Objetivo

Site institucional para o consultório da Dra. Claudia Cogo, médica geriatra.
Objetivo principal: **gerar agendamentos de consulta via WhatsApp** e transmitir
credibilidade para quem pesquisa a médica no Google ou chega pelo Instagram.

## 2. Público-alvo

- **Primário:** filhos e familiares adultos (40–65 anos) que buscam um geriatra
  para os pais — decidem e agendam a consulta.
- **Secundário:** pacientes idosos autônomos (65+) que pesquisam por conta própria.

Implicações: linguagem acolhedora e sem jargão médico; letras grandes; caminhos
de contato muito visíveis; conteúdo que responda "por que meu pai/minha mãe
precisa de um geriatra?".

## 3. Identidade visual (sugestão inicial — ajustar com materiais da cliente)

- **Paleta:** verde-petróleo/verde-salvia como cor principal (saúde, calma),
  tons de areia/creme no fundo, um tom de destaque quente (terracota ou âmbar)
  para botões de ação. Evitar vermelho hospitalar e azul genérico de clínica.
- **Tipografia:** serifada elegante para títulos (ex.: Lora, Playfair Display) +
  sans-serif muito legível para o corpo (ex.: Inter, Source Sans 3), via Google Fonts.
- **Tom das imagens:** fotos reais da médica e do consultório quando disponíveis;
  clima humano e caloroso, não "hospitalar".
- Logo e cores oficiais serão enviados em `assets/logo/` — se existirem, têm
  prioridade sobre esta sugestão.

## 4. Páginas e seções

### Home (`index.html`)
- **Hero:** foto da Dra. Claudia + frase de valor (ex.: "Cuidado médico dedicado
  a quem você mais ama") + botão "Agendar pelo WhatsApp".
- **O que faz um geriatra:** bloco curto educativo (3–4 parágrafos ou cards).
- **Serviços em destaque:** 3–4 cards com link para a página de serviços.
- **Mini-bio:** foto + 2 parágrafos + link para "Sobre".
- **Depoimentos:** 2–3 em carrossel ou grade, link para a página completa.
- **Chamada final:** bloco de contato com WhatsApp, telefone e endereço resumido.

### Sobre (`sobre.html`)
- Trajetória da Dra. Claudia: formação, CRM/RQE (placeholder até envio),
  experiência, filosofia de cuidado.
- Foto profissional em destaque.
- Bloco "Por que a geriatria" — abordagem humana da especialidade.

### Serviços (`servicos.html`)
Cards/seções para (ajustar conforme a cliente confirmar):
- Consulta geriátrica ampla (avaliação geriátrica ampla)
- Acompanhamento de doenças crônicas (hipertensão, diabetes, etc.)
- Saúde da memória / avaliação cognitiva (demências, Alzheimer)
- Prevenção de quedas e fragilidade
- Revisão de medicamentos (polifarmácia)
- Cuidados paliativos / diretivas antecipadas (se aplicável)
- Atendimento domiciliar e/ou telemedicina (confirmar se oferece)

Cada serviço: título, descrição em linguagem leiga (2–3 frases), "para quem é indicado".

### Depoimentos (`depoimentos.html`)
- Grade de depoimentos (placeholder com 4–6 exemplos marcados como TODO).
- Nota sobre conformidade: sem promessas de resultado, respeitando o CFM.

### Contato (`contato.html`)
- Botão grande de WhatsApp (link `https://wa.me/55XXXXXXXXXXX` — TODO número real)
- Telefone clicável (`tel:`), e-mail
- Endereço completo + mapa incorporado (Google Maps embed — TODO endereço real)
- Horários de atendimento (TODO)
- Formulário simples (nome, telefone, mensagem) — pode abrir o WhatsApp com a
  mensagem preenchida, já que o site é estático
- Convênios aceitos ou "consulta particular" (TODO confirmar)

## 5. Elementos globais

- Cabeçalho fixo: logo + menu (Home, Sobre, Serviços, Depoimentos, Contato)
- Menu hambúrguer no mobile
- Botão flutuante de WhatsApp em todas as páginas
- Rodapé: nome completo + CRM/RQE, endereço, telefone, links do menu,
  Instagram (TODO @), aviso "Este site não substitui consulta médica"

## 6. Pendências de conteúdo (a cliente vai enviar)

| Item | Onde entra | Status |
|---|---|---|
| Fotos profissionais | `assets/images/` | pendente |
| Logo | `assets/logo/` | pendente |
| CRM / RQE | Sobre + rodapé | pendente |
| Número de WhatsApp | botões de contato | pendente |
| Endereço do consultório | Contato + rodapé | pendente |
| Horários de atendimento | Contato | pendente |
| Convênios | Contato | pendente |
| Instagram | rodapé | pendente |
| Lista final de serviços | Serviços | pendente |
| Depoimentos reais | Depoimentos | pendente |
