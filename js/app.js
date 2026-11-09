(function () {
  "use strict";

  var API_BASE = ((window.PORTFOLIO_CONFIG || {}).apiBase || "").replace(/\/+$/, "");
  var container = document.getElementById("projects");
  if (!container) return;

  var TITLES = { Python: "Python projects", Go: "Go projects" };
  var OTHER_TITLE = "Other projects";

  function fetchJSON(url) {
    return fetch(url, { signal: AbortSignal.timeout(5000) }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  // Try the live API first; if it is unset, down or slow, use the bundled list.
  function loadProjects() {
    var bundled = function () { return fetchJSON("data/projects.json"); };
    if (!API_BASE) return bundled();
    return fetchJSON(API_BASE + "/api/projects").catch(function (err) {
      console.warn("Backend unreachable, using bundled projects:", err);
      return bundled();
    });
  }

  // Only ever link to https URLs, whatever the data says.
  function safeUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch (e) {
      return null;
    }
  }

  function card(project) {
    var href = safeUrl(project.repo_url);
    var el = document.createElement(href ? "a" : "div");
    el.className = "card";
    if (href) {
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener";
    }

    var title = document.createElement("h4");
    title.textContent = project.repo_name || "Untitled";

    var text = document.createElement("p");
    text.textContent = project.summary || "No description yet.";

    el.append(title, text);
    if (project.language) {
      var tag = document.createElement("span");
      tag.textContent = project.language;
      el.append(tag);
    }
    return el;
  }

  function render(projects) {
    var groups = { Python: [], Go: [], Other: [] };
    projects.forEach(function (p) {
      var key = Object.prototype.hasOwnProperty.call(TITLES, p.language) ? p.language : "Other";
      groups[key].push(p);
    });

    container.textContent = "";
    ["Python", "Go", "Other"].forEach(function (key) {
      if (!groups[key].length) return;
      var heading = document.createElement("h3");
      heading.textContent = TITLES[key] || OTHER_TITLE;
      var grid = document.createElement("div");
      grid.className = "grid";
      groups[key].forEach(function (p) { grid.append(card(p)); });
      container.append(heading, grid);
    });

    if (!container.children.length) container.textContent = "No projects published yet.";
  }

  loadProjects()
    .then(function (data) {
      if (!Array.isArray(data)) throw new Error("Unexpected data format");
      render(data);
    })
    .catch(function (err) {
      console.error(err);
      container.textContent = "Projects are temporarily unavailable. You can find everything on my GitHub.";
    });
})();