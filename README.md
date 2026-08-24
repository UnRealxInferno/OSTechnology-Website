# OS Technology

Static marketing site for [ostechnology.uk](https://ostechnology.uk/). Plain
HTML, CSS and JavaScript, served by IIS behind Cloudflare. There is no build
step for the site itself.

## Markdown for agents

Every `.html` page has a `.md` twin alongside it. `web.config` serves the
markdown version when a request carries `Accept: text/markdown`, so automated
agents get clean text while browsers keep getting HTML. The URL is unchanged —
it is an internal rewrite, not a redirect.

**The `.md` files are generated and committed. They do not update themselves.**
After changing any page content, regenerate them and commit the result:

```
python3 tools/generate-markdown.py
```

The script is stdlib-only, reads every `.html` file in the repository, and
rewrites the matching `.md`. Check the diff before committing — if a page gains
an unusual layout, the extracted markdown is worth a skim.

## Crawl-control files

- `robots.txt` — permits all crawlers, names the major AI crawlers explicitly,
  and keeps the `.md` twins out of conventional search indexes.
- `llms.txt` — structured site summary for large language models.
- `sitemap.xml` — all indexable pages, extensionless canonical URLs.

When adding a page, update `sitemap.xml` and `llms.txt` by hand.
