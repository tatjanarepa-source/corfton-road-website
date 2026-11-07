// Action hub: fills the ready-made emails from what the reader types,
// and wires up "Open in email", "Copy text" and the share buttons.
// Nothing is stored or sent anywhere; the reader sends the emails from their own app.
(function () {
  // Always open at the top unless the link points to a section (stops browsers restoring an old scroll position).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  var FACTS =
    "It can house up to 22 men assessed as high risk of serious harm, including MAPPA Level 2 and 3 cases. " +
    "It is under 400 metres from Ada Lovelace CE High School, with five schools and nurseries within 800 metres.\n\n" +
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
    },
    school: {
      subject: "Probation hostel at 2 Corfton Road, W5: a safeguarding question for {school}",
      body:
        "Dear Headteacher,\n\n" +
        "I am the parent of a child in {year} at {school}. I'm writing to make sure the school knows about the probation hostel (Approved Premises) at 2 Corfton Road, W5 2HS{distance}.\n\n" +
        "It can house up to 22 men assessed as high risk of serious harm, including MAPPA Level 2 and 3 cases. " +
        "Five schools and nurseries are within 800 metres of it.\n\n" +
        "On 23 July 2026 HMPPS told our MP, Dr Rupa Huq, that it \"cannot provide confirmation that child sex offenders will be excluded\". " +
        "Its own policy says some Approved Premises near schools are unsuitable for people convicted of sexual offences against children. " +
        "Residents have asked since December 2025 whether this site was assessed under that policy. They have had no answer.\n\n" +
        "{consulted}\n\n" +
        "Could the school please:\n" +
        "1. Tell parents whether HMPPS, the council or the police told the school about the hostel, and whether it has had any information since.\n" +
        "2. Write to HMPPS asking whether the site was assessed under its near-schools policy and whether there is a placement restriction for people convicted of offences against children. Please also ask to be told directly about anything that affects pupils' safety.\n" +
        "3. Raise it with the Ealing Safeguarding Children Partnership and the local Safer Neighbourhood Team (police), and consider whether arrangements such as pupils walking to and from school need reviewing.\n\n" +
        "I'm not asking the school to take a position on rehabilitation, and I'm not making claims about any individual. " +
        "Parents want to know that the people responsible for our children's safety have the information they need.\n\n" +
        "The full case file, with sources, is here: https://2corftonroad.co.uk/\n\n" +
        "Please forward this to the Designated Safeguarding Lead and the Chair of Governors.\n\n" +
        "Kind regards,\n{name}\nParent of a child in {year}, {school}"
    }
  };

  // School picker for the schools email: the list and distances come from map.js.
  var schoolSel = document.getElementById("school-pick");
  var SCHOOLS = window.CORFTON_SCHOOLS || [];
  function roundM(m) { return Math.round(m / 10) * 10; }
  if (schoolSel) {
    SCHOOLS.forEach(function (sc, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = sc.name + " (" + roundM(sc.m) + " m)";
      schoolSel.appendChild(o);
    });
    var other = document.createElement("option");
    other.value = "other"; other.textContent = "Another school";
    schoolSel.appendChild(other);
  }
  function pickedSchool() {
    if (!schoolSel || schoolSel.value === "" || schoolSel.value === "other") return null;
    return SCHOOLS[+schoolSel.value] || null;
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  // Values for each template's placeholders. Blanks show as [brackets] so they're easy to spot.
  function values(key) {
    if (key === "school") {
      var sc = pickedSchool();
      var montpelier = sc && /Montpelier/.test(sc.name);
      return {
        name: val("parent-name") || "[Your name]",
        year: val("parent-year") || "[year group]",
        school: sc ? sc.name : "[school name]",
        distance: sc ? ", about " + roundM(sc.m) + " metres from the school in a straight line" : "",
        consulted: montpelier
          ? "HMPPS did not consult or inform local schools before reopening the hostel. I understand the school confirmed this in writing to residents on 7 October 2026."
          : "HMPPS did not consult or inform local schools before reopening the hostel. At least one nearby primary school has confirmed in writing that it was not told."
      };
    }
    return {
      name: val("your-name") || "[Your name]",
      address: val("your-address") || "[Your street and postcode]"
    };
  }

  function fill(key, text) {
    var v = values(key);
    return text.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : m; });
  }

  function missingDetails(key) {
    if (key === "school") return !val("parent-name") || !pickedSchool();
    return !val("your-name") || !val("your-address");
  }

  var areas = document.querySelectorAll("textarea[data-template]");

  function render(force) {
    areas.forEach(function (ta) {
      if (ta.dataset.edited && !force) return;
      ta.value = fill(ta.dataset.template, TEMPLATES[ta.dataset.template].body);
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
      ta.value = fill(ta.dataset.template, TEMPLATES[ta.dataset.template].body);
      btn.closest(".edited-note").hidden = true;
    });
  });
  ["your-name", "your-address", "parent-name", "parent-year", "school-pick"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () { render(false); });
  });
  render(true);

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

  document.querySelectorAll("[data-mailto]").forEach(function (a) {
    var to = a.getAttribute("href").replace(/^mailto:/, "");
    a.addEventListener("click", function (e) {
      var ta = document.getElementById(a.dataset.mailto);
      var key = ta.dataset.template;
      var subject = fill(key, TEMPLATES[key].subject);
      a.setAttribute("href", "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(ta.value));
      if (missingDetails(key)) status(a, key === "school" ? "Tip: pick your school and add your name first." : "Tip: add your name and address at the top first.");
      else status(a, key === "school" ? "Opening your email app… Add the school office's email address in the To line." : "Opening your email app…");
    });
  });

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ta = document.getElementById(btn.dataset.copy);
      var key = ta.dataset.template;
      var subject = fill(key, TEMPLATES[key].subject);
      copy("Subject: " + subject + "\n\n" + ta.value).then(
        function () { status(btn, missingDetails(key) ? "Copied. Remember to fill in the [brackets]." : "Copied. Paste it into a new email."); },
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
