/* =============================================================
   Dra. Claudia Cogo · Geriatria — scripts do site
   Sem dependências. Vanilla JS.
   ============================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------------
     CONFIG — dados de contato (TODO: substituir pelos reais)
     Centralizado aqui para facilitar a atualização.
     ----------------------------------------------------------- */
  var CONFIG = {
    // Número no formato internacional, só dígitos: 55 + DDD + número
    whatsapp: "55XXXXXXXXXXX", // TODO: substituir pelo número real
    mensagemPadrao:
      "Olá! Vim pelo site e gostaria de agendar uma consulta com a Dra. Claudia Cogo."
  };

  /* Monta um link wa.me com mensagem opcional */
  function waLink(mensagem) {
    var texto = encodeURIComponent(mensagem || CONFIG.mensagemPadrao);
    return "https://wa.me/" + CONFIG.whatsapp + "?text=" + texto;
  }

  /* Aplica o número/mensagem real a todos os links marcados com [data-wa] */
  function aplicarLinksWhatsApp() {
    var links = document.querySelectorAll("[data-wa]");
    links.forEach(function (el) {
      var msg = el.getAttribute("data-wa-msg");
      el.setAttribute("href", waLink(msg));
    });
  }

  /* -----------------------------------------------------------
     Menu mobile (hambúrguer)
     ----------------------------------------------------------- */
  function initMenu() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Fecha ao clicar num link do menu
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    // Fecha com ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    // Reseta ao voltar para desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1000) setOpen(false);
    });
  }

  /* -----------------------------------------------------------
     Formulário de contato → abre o WhatsApp preenchido
     ----------------------------------------------------------- */
  function initForm() {
    var form = document.getElementById("contato-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = (form.nome.value || "").trim();
      var telefone = (form.telefone.value || "").trim();
      var mensagem = (form.mensagem.value || "").trim();

      var partes = ["Olá! Meu nome é " + (nome || "(não informado)") + "."];
      if (telefone) partes.push("Meu telefone: " + telefone + ".");
      if (mensagem) partes.push(mensagem);
      else partes.push("Gostaria de agendar uma consulta com a Dra. Claudia Cogo.");

      window.open(waLink(partes.join(" ")), "_blank", "noopener");
    });
  }

  /* -----------------------------------------------------------
     Carrossel de depoimentos (home)
     ----------------------------------------------------------- */
  function initCarousel() {
    var carousel = document.querySelector("[data-carousel]");
    if (!carousel) return;
    var track = carousel.querySelector(".carousel__track");
    var prev = carousel.querySelector("[data-carousel-prev]");
    var next = carousel.querySelector("[data-carousel-next]");
    if (!track) return;

    function step() {
      var first = track.firstElementChild;
      if (!first) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
      return first.getBoundingClientRect().width + gap;
    }
    if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
    if (next) next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
  }

  /* -----------------------------------------------------------
     Revelar elementos ao rolar
     ----------------------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* -----------------------------------------------------------
     Ano no rodapé
     ----------------------------------------------------------- */
  function initYear() {
    var y = document.querySelector("[data-year]");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* -----------------------------------------------------------
     Init
     ----------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    aplicarLinksWhatsApp();
    initMenu();
    initForm();
    initCarousel();
    initReveal();
    initYear();
  });
})();
