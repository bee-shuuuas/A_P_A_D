# A_P_A_D

A_P_A_D means "A Paper A Day": a small GitHub Pages site for keeping a daily research paper reading list, tags, notes, and reading progress.

## What is included

- A static dashboard at `index.html`
- A searchable paper library at `papers.html`
- A generated tag page at `tags.html`
- A paper detail page at `paper.html?id=paper-id`
- A local add/log workflow at `add.html`
- Published paper data in `data/papers.json`

The site is intentionally static so it can be published with GitHub Pages. Papers in `data/papers.json` are public site content. Papers added through the web form are saved in the current browser with `localStorage`; export the data if you want to move it into `data/papers.json` later.

## Publish on GitHub Pages

1. Push this repo to GitHub.
2. Open the repository settings.
3. Go to **Pages**.
4. Set the source to the `main` branch and the root folder.
5. Visit `https://bee-shuuuas.github.io/A_P_A_D/` after GitHub finishes deploying.

## Edit published papers

Update `data/papers.json` with entries like this:

```json
{
  "id": "attention-is-all-you-need",
  "title": "Attention Is All You Need",
  "authors": "Ashish Vaswani et al.",
  "venue": "NeurIPS 2017",
  "published": "2017-06-12",
  "targetDate": "2026-04-29",
  "status": "queued",
  "tags": ["transformers", "nlp", "deep-learning"],
  "link": "https://arxiv.org/abs/1706.03762",
  "summary": "Introduces the Transformer architecture and self-attention as a replacement for recurrence in sequence modeling."
}
```
