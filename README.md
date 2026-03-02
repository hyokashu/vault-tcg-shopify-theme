# Vault TCG — Shopify Theme

A bold, vibrant Shopify 2.0 theme built for a mixed TCG sealed product store (booster boxes, ETBs, packs).

## Design
- **Dark base** (`#0B0B1A`) with electric purple, cyan, and gold accents
- **Fonts:** Bebas Neue (headings) + Inter (body)
- Bold card hover effects, glow states, scroll-triggered fade-in animations

## Features
- ⚡ AJAX slide-out cart drawer with free-shipping progress bar
- 🔍 Quick View modal (no page leave needed)
- 🛒 Add to cart with live feedback & toast notifications
- 📱 Fully responsive — mobile hamburger nav
- 🔎 Search overlay
- 🎨 Fully customisable via Shopify theme editor

## Pages
| Template | Description |
|---|---|
| `index.json` | Homepage — hero, featured product, grid, testimonials, newsletter |
| `product.json` | Product page — gallery, variants, trust badges, info tabs |
| `collection.json` | Collection — sortable grid, badges, quick view |
| `cart.json` | Cart page with quantity controls & order notes |
| `page.about.json` | About / Our Story |
| `page.faq.json` | FAQ accordion |
| `blog.json` / `article.json` | Blog & article pages |
| `search.json` | Search results |
| `404.json` | 404 page |

## Branches
| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code |
| `develop` | Active development — make edits here |

## How to install
1. In Shopify Admin → **Online Store → Themes → Add theme → Upload zip**
2. Upload `vault-tcg-theme.zip`
3. Customise via the Theme Editor

## How to edit with Shopify CLI
```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Connect to your store
shopify theme dev --store your-store.myshopify.com

# Push changes
shopify theme push
```

## File structure
```
tcg-theme/
├── assets/          # theme.css, theme.js
├── config/          # settings_schema.json, settings_data.json
├── layout/          # theme.liquid
├── locales/         # en.default.json
├── sections/        # All page sections + header/footer groups
├── snippets/        # product-card, cart-drawer, quick-view, pagination
└── templates/       # JSON templates for all page types
```
