# portfolio-web

The frontend of my personal portfolio: a single static page written in plain HTML, CSS and JavaScript, with no framework and no build step. It lists who I am, what I'm working on, my certifications, and a set of projects that it loads from a small API of my own. If that API is unreachable, it quietly falls back to a bundled list, so the page never shows an error to a visitor.

The backend lives in a separate repository: [portfolio-api](https://github.com/scxbrian/portfolio-api).

**Status:** the frontend is complete and works on its own. The API is in development, so for now the page runs entirely from the bundled project list.

## Contents

1. [How it works](#how-it-works)
2. [Repository layout](#repository-layout)
3. [Running it locally](#running-it-locally)
4. [Configuration](#configuration)
5. [The data contract](#the-data-contract)
6. [Design decisions](#design-decisions)
7. [Trade-offs and known limitations](#trade-offs-and-known-limitations)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Testing checklist](#testing-checklist)
10. [Updating the content](#updating-the-content)
11. [Roadmap](#roadmap)
12. [Licence and reuse](#licence-and-reuse)

## How it works

The site is split in two on purpose. The **page itself**, meaning the text, layout and certificates, is static files served from Vercel's CDN. The **project list** is the only dynamic part, and it comes from an API that runs on my own home server.

```
                    visitor's browser
                          |
          +---------------+----------------+
          |                                |
   static files (Vercel)          GET /api/projects
   index.html, css, js            (home server, via a tunnel)
                                           |
                              fails, times out or unset?
                                           |
                                  data/projects.json
```

On every page load, `js/app.js` does the following:

1. Reads the API address from `js/config.js`.
2. If an address is set, requests `/api/projects` with a five-second timeout.
3. If that request fails for any reason, or no address is set, it loads `data/projects.json` instead.
4. Groups the projects by language and builds the cards on the page.
5. Only if both sources fail does it show a short "temporarily unavailable" message with a pointer to my GitHub.

Because the first-choice source is a computer in my house, the second-choice source is the point of the design. Power cuts and router reboots happen, and the page has to hold up through them.

## Repository layout

```
portfolio-web/
├── index.html           # all page content and structure
├── css/
│   └── style.css        # design tokens, layout, dark mode
├── js/
│   ├── config.js        # the backend address, the only setting
│   └── app.js           # loads projects, falls back to the bundled list
├── data/
│   └── projects.json    # fallback project list
├── assets/              # portrait, CV and certificate PDFs
├── README.md
└── .gitignore
```

Each file has one job. Changing the wording means editing `index.html`. Changing the look means editing the variables at the top of `style.css`. Pointing the site at a different backend means editing one line in `config.js`. Nothing needs to be changed in more than one place.

## Running it locally

There is nothing to install. You only need a static file server, because the page uses `fetch`, and browsers block `fetch` for files opened directly from disk (`file://`).

**VS Code:** install the Live Server extension, right-click `index.html`, and choose Open with Live Server.

**Any terminal with Python:**

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

To test against a local copy of the API, set `apiBase` in `js/config.js` to `http://127.0.0.1:8000`. One detail catches people out: the API only accepts requests from origins it has been told about, and `http://localhost:5500` and `http://127.0.0.1:5500` count as different origins. Whichever one you use in the browser must be listed in the API's `ALLOWED_ORIGINS` setting.

## Configuration

There is exactly one setting, in `js/config.js`:

```js
window.PORTFOLIO_CONFIG = { apiBase: "" };
```

| Value | Behaviour |
| :--- | :--- |
| `""` (empty) | Use only `data/projects.json`. |
| `"https://api.example.com"` | Try the API first, then fall back to the bundled list. No trailing slash. |

In production the address must be HTTPS. A page served over HTTPS cannot call an HTTP address, because browsers block that as mixed content, so the home server has to be exposed through something that provides TLS, such as a Cloudflare Tunnel.

## The data contract

The API and the fallback file return the same thing: a JSON array of objects, so the page needs only one code path for both.

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `repo_name` | string | Card title. |
| `repo_url` | string | Link target. Only `https:` URLs are ever linked. |
| `language` | string or null | Decides the group: `Python`, `Go`, or anything else under "Other projects". |
| `summary` | string or null | One-line description. Shown as plain text. |
| `updated_at` | string | ISO 8601 timestamp. Used for ordering by the API, not displayed. |

A group with no projects is not drawn, so a "Go projects" heading appears automatically once the first Go project is published.

Because the two repositories are separate, this table is the agreement between them. If the API's response shape changes, this file and the fallback data must change with it.

## Design decisions

### Plain HTML, CSS and JavaScript

A portfolio is mostly static text with one small dynamic part. A framework such as React or Next.js earns its place when an interface has a lot of changing state, and this one doesn't. Static-site generators such as Astro or Hugo are a closer fit, and they are good tools, but they add a build step, a dependency tree and a toolchain to keep updated for a page of five sections.

Without a framework there is nothing to upgrade, no advisories to track, and nothing that can stop building in two years. The page loads fast, and Vercel deploys it by serving the files exactly as they are. The cost is real: the content lives in one long HTML file and there are no reusable components. At this size that is easier to live with than the alternative.

### Design tokens and dark mode

Every colour is a CSS variable defined once at the top of `style.css`. Dark mode is the same variables redefined inside a `prefers-color-scheme: dark` block, so the page follows the visitor's system setting with no JavaScript and no toggle to maintain. Changing the accent colour or doing a rebrand means editing a handful of lines.

### System fonts

The font stack uses whatever the visitor's device already has. It is less distinctive than a web font, but it adds no extra request, no third-party dependency, and no flash of unstyled text while a font downloads. For a page that is often read for under a minute, loading speed matters more than typography.

### The fallback layer

This is the most important decision in the project. Self-hosting means the backend will sometimes be down, and the cost of that must not fall on the visitor. The bundled `data/projects.json` is the same data in static form, served from the CDN that is almost never down. The five-second timeout handles the nastier failure mode: a server that accepts the connection but never answers would otherwise leave "Loading projects…" on the screen for the browser's default wait, which can be a minute or more.

### Treating all outside data as untrusted

Project summaries come from GitHub descriptions and README text, so they are not fully under my control. The script therefore never writes them as HTML. Every value is set with `textContent`, so the browser treats it as plain text and cannot run anything embedded in it. Links are only created for `https:` URLs, which rules out `javascript:` addresses. Neither measure is complicated, and both close off a whole category of problem.

### Classic scripts, not modules

`config.js` and `app.js` are ordinary scripts loaded in order, and `config.js` sets one global. ES modules would work in modern browsers, but they add cross-origin quirks to local testing for no benefit at this size.

### Accessibility

The page uses proper landmarks (`header`, `nav`, `main`, `footer`), a skip-to-content link, visible keyboard focus outlines, an `aria-live` region for the project list, alt text on the portrait, and no smooth scrolling for visitors who have asked their system for reduced motion. The colours were chosen for readable contrast in both themes, and I verify that with Lighthouse and not by assumption.

## Trade-offs and known limitations

- **The fallback list is maintained by hand,** so it can go out of date. A small script that regenerates it from the live API is on the roadmap.
- **Project cards need JavaScript.** The main content is in the static HTML, so search engines and link previews see it, but the project list appears only when the script runs.
- **No contact form.** A static site cannot receive form submissions on its own, so contact is by email link. A form is possible once the API supports it.
- **No analytics.** The site records nothing about visitors.
- **No automated tests yet.** The testing checklist below is manual.
- **Dependence on the home server for freshness.** Visitors always get a working page, but new projects only appear on the site while the API is reachable.

## Deploying to Vercel

1. Import this repository in Vercel as a new project.
2. Set the framework preset to **Other**, and leave the build command and output directory empty. Vercel serves the files in the repository root as they are.
3. Deploy. Every push to `main` publishes to production, and every push to any other branch gets its own preview URL, which is the safe place to review a change.
4. To use a custom domain, add it under the project's Domains settings. If the same address is attached to an older project, remove it there first, because an address can belong to only one project.

File names are case-sensitive on Vercel, which runs on Linux, even though Windows ignores case. `assets/Postgresql.pdf` and `assets/postgresql.pdf` are different files there. The links in `index.html` match the file names in `assets/` exactly, and any file added later must do the same.

## Testing checklist

Before merging a change to `main`:

- [ ] The page renders in a narrow window (about 375 px wide): the navigation wraps and the hero stacks.
- [ ] Both colour schemes look right (switch the system theme between light and dark).
- [ ] Every navigation link scrolls to its section, and the heading is not hidden behind the header.
- [ ] The photo shows, "Download CV" saves the PDF, and all four certificate links open.
- [ ] Fallback works: set `apiBase` to `"http://127.0.0.1:9"` (a closed port), reload, and confirm the projects still appear. Then restore the empty value.
- [ ] The whole page can be used with the keyboard alone.
- [ ] Lighthouse (Chrome DevTools) scores are good for performance, accessibility and best practices.
- [ ] No errors in the browser console on a normal load.

## Updating the content

- **Text and sections:** edit `index.html`.
- **Appearance:** edit the variables at the top of `css/style.css`.
- **Featured projects when the API is offline:** edit `data/projects.json`, keeping the shape described above.
- **Certificates or the CV:** add the file to `assets/`, then link to it with exactly the same capitalisation.
- **Switching the backend address:** edit `apiBase` in `js/config.js`.

## Roadmap

- Open Graph tags and a preview image for nicer link sharing.
- A script that regenerates `data/projects.json` from the live API.
- A contact form and a private visit counter, once the API supports them.
- A link checker and Lighthouse run in CI on every push.
- A pass over contrast and keyboard behaviour with a screen reader.

## Licence and reuse

The code is public so that it can be read and reviewed. The text, portrait, CV and certificates are personal and are not licensed for reuse.
