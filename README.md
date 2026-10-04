# Journal for Law Advocacy website

Website of the Journal for Law Advocacy, WVSU College of Law. Built with [Eleventy](https://www.11ty.dev/), edited with [Decap CMS](https://decapcms.org/), hosted on Netlify. Every push to `main` rebuilds the site.

## For editors

Go to `/admin` on the live site and sign in with GitHub. From there you can:

- **Volumes**: add a volume and upload the complete volume PDF exactly as published (the historical copy). Mark exactly one volume as *Current*; it appears on the home page.
- **Articles**: add one entry per piece in the volume and upload that article's own PDF. Fill in the *printed* first page (used in the citation) and the *page in the volume PDF* (powers the "View in the original volume" link). Tick *Draft* to hide it until it's ready.
- **News**: post announcements, calls for papers and events. The newest three appear on the home page. Fill in **Milestone** with one line to put a post on the history page's timeline. Tick **Exact day unknown** to show only the month and year. Paste the **Original Facebook post** link to credit the source.
- **Policies**: the peer review, ethics, open access, copyright and citation policies. They're drafts: once the board approves one, untick *Show draft notice*.
- **Pages**: edit the About page, the submission guidelines and the editorial board. Add each new academic year's board at the top of the list; earlier years move to *Past boards* automatically.
- **Settings**: journal name, contact email, announcement banner, areas of law, ISSN, analytics code, social links.

Changes go live about a minute after you click *Publish*.

The abstracts for Volumes 1, 4 and 5 were drafted from each author's opening paragraph. Replace them with the authors' own abstracts where available.

### Sharing and author pages

- Every article gets ready-made share images, built automatically on each deploy: a link-preview card (`/og/<article>.png`), an Instagram/Facebook post (`/share/<article>-post.png`, 4:5) and a story (`/share/<article>-story.png`, 9:16). Authors find them under **Share** on their article page; on a phone, **Share image** sends the picture straight to Instagram, Facebook, or Messenger and copies a suggested caption.
- Each author has a page at `/authors/<name>/`. To add a photo, affiliation, bio, or links, add a profile under **Pages → Author profiles** in `/admin` (the "page address" is the last part of the author's page URL). Board members automatically use their board photo.
- **Certificates of publication** (off for now: turn on "Show certificates of publication" in Site settings once the board approves) are generated for every author of every piece (`/certificates/<article>--<author>.pdf` and `.png`), shown in the article's Share panel and on the author's page. Signature lines are left blank for the Executive Editor and Faculty Adviser to sign; editorials signed by the editors get none.
- **LinkedIn:** the Share panel has a one-click "Add certificate to LinkedIn" (Licenses & certifications) and copy-ready fields for the Publications section.
- **Quote cards:** readers can select a passage of an article's text and tap **Share quote** to get a framed quote image and a copy-ready quote with citation.
- **Share studio:** every article's Share panel has **Make a Story**, **Make a post** and **Use my photo**. They open a full-screen studio where readers swipe through six designs (Classic, Midnight, Highlights, Editorial, Your photo, Sticker), switch between Story (9:16) and Post (4:5), then tap **Share** to send the image straight to Instagram, Facebook or Messenger. The caption is copied for them. Images are drawn on the reader's device; photos are never uploaded. The Sticker is a transparent PNG to paste onto your own Story.
- **Launch kit:** each volume page has an Instagram carousel (`/share/volume-<n>/slide-NN.png`: cover, contents, closing) with "Share all slides" on phones and a ready caption.
- Tick **Featured on the home page** on one article of the current volume to make it the lead piece on the home page.

### PDFs

- `src/uploads/volumes/`: the original full-volume PDFs, unchanged.
- `src/uploads/articles/v<N>/`: one PDF per article. Volumes 4 and 5 were split from the originals by page range. Volume 1 was published as separate files.

To split a new volume, any PDF tool works (for example *Print → Save as PDF* with a page range, or `qpdf in.pdf --pages . 12-25 -- out.pdf`). Upload each piece in the article's *Article PDF* field.

Manuscripts sent through the form on `/submit/` show up in the Netlify dashboard under **Forms → submission**. Newsletter signups show up under **Forms → newsletter**; export them as CSV when a new volume comes out.

### Full text on the web (optional)

An article's *Full text* field shows the article as a web page under the abstract, with numbered footnotes (`text[^1]` … `[^1]: The footnote.`) and a table of contents built from its headings. The best source is the author's Word file: paste it into the CMS editor. Text copied out of a PDF needs careful proofreading. Set *Full text status* to *Proofread* once checked.

## One-time setup (site admin)

1. **Enable forms**: Netlify → Project configuration → Forms → *Enable form detection*, then redeploy. Under *Form notifications*, add an email notification for the `submission` form so new manuscripts reach the journal inbox.
2. **Let editors sign in to /admin**:
   1. On GitHub, go to Settings → Developer settings → OAuth Apps → *New OAuth App*. Use the site URL as the homepage and set the callback URL to `https://api.netlify.com/auth/done`.
   2. In Netlify, go to Project configuration → Access & security → OAuth → *Install provider* → GitHub, and paste the client ID and secret.
   3. Add each editor as a collaborator with write access on the GitHub repository.
3. **Custom domain (optional)**: add it in Netlify → Domain management, then update *Site address* in CMS Settings.
4. **Analytics (optional, free)**: create a site at [goatcounter.com](https://www.goatcounter.com/) (free for non-commercial sites). Enter its code (the part before `.goatcounter.com`) in CMS Settings → *GoatCounter code*. Page views and PDF downloads (listed as `download/…` events) then appear in the GoatCounter dashboard. It uses no cookies, so no consent banner is needed.
5. **Google Scholar and Search Console**: verify the site in [Google Search Console](https://search.google.com/search-console) and submit `/sitemap.xml`. Article pages already carry the `citation_*` tags Google Scholar reads.
6. **ISSN**: the print edition has ISSN **1908-532X** ([ISSN Portal record](https://portal.issn.org/resource/ISSN/1908-532X)), already entered in CMS Settings. The website counts as a separate medium: to get an online ISSN, apply to the National Library of the Philippines (ISSN National Centre) and enter it as *ISSN (online)*.
7. **DOIs**: either join Crossref (ask whether WVSU already has membership; fees apply per DOI) or deposit each article in [Zenodo](https://zenodo.org/) (free) to get a DOI. Enter the DOI on each article in the CMS (just `10.xxxx/…`); it's added to the citation and metadata.

## Project layout

```
src/
  _data/        site.json, board.json, guidelines.json, authorAliases.json
  _includes/    layouts and partials
  _og/fonts/    fonts for the share images (not published)
  articles/     one Markdown file per article
  issues/       one Markdown file per volume
  news/         news posts
  policies/     journal policies
  uploads/      PDFs (volumes/ = originals, articles/ = per-article) and news images
  admin/        Decap CMS (config.yml holds the editor fields)
  assets/       CSS, JS, images
eleventy.config.js   collections, filters, build hooks
og-cards.js          builds the 1200×630 share images in _site/og/
netlify.toml
```

- **Citation format**: the house style is the `cite` filter in `eleventy.config.js`. The other formats and BibTeX/RIS export are in `src/assets/js/site.js`.
- **Author pages**: if one person appears under two spellings, map the variant to the preferred name in `src/_data/authorAliases.json`.
- **Search**: built by [Pagefind](https://pagefind.app/) after Eleventy (`npm run build`), so it only works on the deployed site or after a full local build.

## Local preview (optional)

Requires Node 20 or newer.

```bash
npm install
npm start
```
