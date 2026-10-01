# Journal for Law Advocacy website

Website of the Journal for Law Advocacy, WVSU College of Law. Built with [Eleventy](https://www.11ty.dev/), edited with [Decap CMS](https://decapcms.org/), hosted on Netlify. Every push to `main` rebuilds the site.

## For editors

Go to `/admin` on the live site and sign in with GitHub. From there you can:

- **Volumes**: add a volume and upload the complete volume PDF exactly as published (the historical copy). Mark exactly one volume as *Current*; it appears on the home page.
- **Articles**: add one entry per piece in the volume and upload that article's own PDF. Fill in the *printed* first page (used in the citation) and the *page in the volume PDF* (powers the "View in the original volume" link). Tick *Draft* to hide it until it's ready.
- **Pages**: edit the About page, the submission guidelines and the editorial board.
- **Settings**: journal name, contact email, announcement banner, areas of law, social links.

Changes go live about a minute after you click *Publish*.

The abstracts for Volumes 1, 4 and 5 were drafted from each author's opening paragraph. Replace them with the authors' own abstracts where available.

### PDFs

- `src/uploads/volumes/`: the original full-volume PDFs, unchanged.
- `src/uploads/articles/v<N>/`: one PDF per article. Volumes 4 and 5 were split from the originals by page range. Volume 1 was published as separate files.

To split a new volume, any PDF tool works (for example *Print → Save as PDF* with a page range, or `qpdf in.pdf --pages . 12-25 -- out.pdf`). Upload each piece in the article's *Article PDF* field.

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
  issues/       one Markdown file per volume
  uploads/      PDFs (volumes/ = originals, articles/ = per-article)
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
