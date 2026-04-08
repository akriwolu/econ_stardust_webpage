# Alexander Kriwoluzky — Academic Website

Academic webpage of Alexander Kriwoluzky, built with <a href="https://gohugo.io">Hugo</a> using the <a href="https://github.com/adityatelange/hugo-PaperMod">PaperMod</a> theme, based on <a href="https://github.com/pmichaillat/hugo-website">Pascal Michaillat's minimalist academic template</a>.

## Setup

### Prerequisites
- <a href="https://gohugo.io/installation/">Hugo Extended</a> v0.147.2 or later
- Git

### Local development

```bash
# Clone the repo
git clone --recurse-submodules https://github.com/akriwolu/econ_stardust_webpage.git
cd econ_stardust_webpage

# Start local server
hugo server
```

Then open http://localhost:1313/econ_stardust_webpage/ in your browser.

### Adding the PaperMod theme (first time only)

```bash
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
git submodule update --init --recursive
```

## Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions on every push to `main`.

## Content structure

| Section | Directory |
|---|---|
| Working Papers | `content/working-papers/` |
| Publications | `content/publications/` |
| Writing for General Public | `content/writing/` |
| Teaching | `content/teaching/` |
| Location | `content/location.md` |

## Adding a new paper

1. Create a new directory under `content/working-papers/` or `content/publications/`
2. Add an `index.md` with front matter (title, date, tags, author, description, abstract)
3. Place PDF and any figures in the same directory
4. Push to `main` — the site will rebuild automatically
