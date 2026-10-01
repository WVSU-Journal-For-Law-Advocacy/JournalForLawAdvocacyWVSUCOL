# Journal for Law Advocacy website

Website of the Journal for Law Advocacy, WVSU College of Law. Built with [Eleventy](https://www.11ty.dev/), edited with [Decap CMS](https://decapcms.org/), hosted on Netlify. Every push to `main` rebuilds the site.

## For editors

Go to `/admin` on the live site and sign in with GitHub. From there you can:

- **Articles**: add an article, upload its PDF, set volume, issue and first page. Tick *Draft* to hide it until it's ready.
- **Issues**: add an issue. Mark exactly one issue as *Current*; it appears on the home page.
- **Pages**: edit the About page, the submission guidelines and the editorial board.
- **Settings**: journal name, contact email, announcement banner, areas of law, social links.

Changes go live about a minute after you click *Publish*.

Manuscripts sent through the form on `/submit/` show up in the Netlify dashboard under **Forms → submission**.

## One-time setup (site admin)

1. **Enable forms**: Netlify → Project configuration → Forms → *Enable form detection*, then redeploy. Under *Form notifications*, add an email notification for the `submission` form so new manuscripts reach the journal inbox.
2. **Let editors sign in to /admin**:
   1. On GitHub, go to Settings → Developer settings → OAuth Apps → *New OAuth App*. Use the site URL as the homepage and set the callback URL to `https://api.netlify.com/auth/done`.
   2. In Netlify, go to Project configuration → Access & security → OAuth → *Install provider* → GitHub, and paste the client ID and secret.
   3. Add each editor as a collaborator with write access on the GitHub repository.
3. **Custom domain (optional)**: add it in Netlify → Domain management, then update *Site address* in CMS Settings.

## Project layout

```
src/
  _data/        site.json, board.json, guidelines.json (edited through the CMS)
  _includes/    layouts and partials
  articles/     one Markdown file per article
  issues/       one Markdown file per issue
  uploads/      PDFs uploaded through the CMS
  admin/        Decap CMS (config.yml holds the editor fields)
  assets/       CSS, JS, images
eleventy.config.js
netlify.toml
```

To change the citation format, edit the `cite` filter in `eleventy.config.js`.

## Local preview (optional)

Requires Node 20 or newer.

```bash
npm install
npm start
```
