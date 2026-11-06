// Action hub: fills the MP email from the reader's name and address,
// and wires up "Open in email", "Copy text" and the share buttons.
// Nothing is stored or sent anywhere; the reader sends the emails from their own app.
(function () {
  // Always open at the top unless the link points to a section (stops browsers restoring an old scroll position).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  var FACTS =
    "It can house up to 22 men assessed as high risk of serious harm, including MAPPA Level 2 and 3 cases. " +
    "It is under 400 metres from Ada Lovelace CE High School, with six schools and nurseries within 800 metres.\n\n" +
    "On 23 July 2026 HMPPS told Dr Huq it \"cannot provide confirmation that child sex offenders will be excluded\", " +
    "although its own policy says some Approved Premises near schools are unsuitable for them.\n\n" +
    "Residents have asked HMPPS eight questions since autumn 2025. None has been answered in full, " +
    "and HMPPS won't confirm whether the hostel is open.";

  var TEMPLATES = {
    mp: {
      subject: "2 Corfton Road Approved Premises: please table a written parliamentary question",
      body:
        "Dear Dr Huq,\n\n" +
        "I live locally and am writing about the probation hostel (Approved Premises) at 2 Corfton Road, W5 2HS.\n\n" +
        FACTS.replace("told Dr Huq", "told you") + "\n\n" +
        "Residents have tried letters, a formal complaint and Freedom of Information requests. " +
        "The Ministry of Justice refused our FOI requests on cost grounds on 2 November 2026.\n\n" +
        "Please table a written parliamentary question to the Minister responsible for prisons and probation, asking:\n" +
        "1. Whether 2 Corfton Road has a placement restriction for people convicted of sexual offences against children, under HMPPS's own policy on Approved Premises near schools.\n" +
        "2. Whether a site safeguarding assessment was carried out before it reopened, and whether it considered nearby schools.\n" +
        "3. Whether the premises is currently accommodating residents.\n\n" +
        "A written answer would give residents a clear, public reply. " +
        "I would also be grateful if you could ask HMPPS to set up a residents' liaison forum.\n\n" +
        "Please let me know what you will do.\n\n" +
        "Yours sincerely,\n{name}\n{address}"
    },
    cllr: {
      subject: "2 Corfton Road Approved Premises: residents need answers",
      body:
        "Dear Councillors,\n\n" +
        "I live locally and am writing about the probation hostel (Approved Premises) at 2 Corfton Road, W5 2HS, in Hanger Hill ward.\n\n" +
        FACTS.replace("told Dr Huq", "told our MP, Dr Rupa Huq,") + "\n\n" +
        "Please:\n" +
        "1. Press HMPPS to confirm whether the site was assessed under its near-schools policy, and to share its safeguarding assessment.\n" +
        "2. Ask HMPPS for a residents' liaison forum, a site visit and a way to tell the community about serious incidents.\n" +
        "3. Tell residents what HMPPS has told the council, including whether it is occupied.\n" +
        "4. Make sure local schools and nurseries are kept informed.\n\n" +
        "Please let me know what you will do.\n\n" +
        "Yours sincerely,\n{name}\n{address}"
    }
  };

  var nameEl = document.getElementById("your-name");
  var addrEl = document.getElementById("your-address");
  var areas = document.querySelectorAll("textarea[data-template]");

  function fill(text) {
    var name = nameEl.value.trim() || "[Your name]";
    var addr = addrEl.value.trim() || "[Your street and postcode]";
    return text.replace("{name}", name).replace("{address}", addr);
  }

  function render(force) {
    areas.forEach(function (ta) {
      if (ta.dataset.edited && !force) return;
      ta.value = fill(TEMPLATES[ta.dataset.template].body);
    });
  }

  areas.forEach(function (ta) {
    ta.addEventListener("input", function () {
      ta.dataset.edited = "1";
      ta.closest(".step").querySelector(".edited-note").hidden = false;
    });
  });
  document.querySelectorAll("[data-reset]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ta = document.getElementById(btn.dataset.reset);
      delete ta.dataset.edited;
      ta.value = fill(TEMPLATES[ta.dataset.template].body);
      btn.closest(".edited-note").hidden = true;
    });
  });
  if (nameEl && addrEl) {
    nameEl.addEventListener("input", function () { render(false); });
    addrEl.addEventListener("input", function () { render(false); });
    render(true);
  }

  function status(fromEl, msg) {
    var s = fromEl.closest(".step, .more-step").querySelector(".status");
    if (!s) return;
    s.textContent = msg;
    clearTimeout(s._t);
    s._t = setTimeout(function () { s.textContent = ""; }, 4000);
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(t);
    });
  }

  function missingDetails() {
    return !nameEl.value.trim() || !addrEl.value.trim();
  }

  document.querySelectorAll("[data-mailto]").forEach(function (a) {
    var to = a.getAttribute("href").replace(/^mailto:/, "");
    a.addEventListener("click", function (e) {
      var ta = document.getElementById(a.dataset.mailto);
      var subject = TEMPLATES[ta.dataset.template].subject;
      a.setAttribute("href", "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(ta.value));
      if (missingDetails()) status(a, "Tip: add your name and address at the top first.");
      else status(a, "Opening your email app…");
    });
  });

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ta = document.getElementById(btn.dataset.copy);
      var subject = TEMPLATES[ta.dataset.template].subject;
      copy("Subject: " + subject + "\n\n" + ta.value).then(
        function () { status(btn, missingDetails() ? "Copied. Remember to add your name and address." : "Copied. Paste it into a new email."); },
        function () { ta.focus(); ta.select(); status(btn, "Couldn't copy automatically. The text is selected: copy it manually."); }
      );
    });
  });

  // Share the Case file page, not this one.
  var home = new URL("index.html", location.href).href;
  var shareText = "A probation hostel for high-risk offenders, under 400 metres from a school, and HMPPS won't answer residents' questions. 2 Corfton Road, Ealing W5:";
  var wa = document.getElementById("share-wa");
  if (wa) wa.href = "https://wa.me/?text=" + encodeURIComponent(shareText + " " + home);

  var native = document.getElementById("share-native");
  if (native && navigator.share) {
    native.hidden = false;
    var wrap = document.getElementById("share-native-wrap");
    if (wrap) wrap.hidden = false;
    native.addEventListener("click", function () {
      navigator.share({ title: "2 Corfton Road: residents want answers", text: shareText, url: home }).catch(function () {});
    });
  }
  var copyLink = document.getElementById("copy-link");
  if (copyLink) copyLink.addEventListener("click", function () {
    copy(home).then(
      function () { status(copyLink, "Link copied."); },
      function () { status(copyLink, home); }
    );
  });
})();
