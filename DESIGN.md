# Qilin Cards — Design System

## Color Strategy
- **Homepage hero panels**: Committed (brand color fills 50%+ of the hero surface per zone)
- **Product cards / catalog**: Restrained (clean white cards, product imagery speaks)
- **Collection banners**: Committed (full brand color header per collection)
- **Product pages**: Restrained with Committed accent (white canvas, brand color accents)

## Color Palette (OKLCH)

### Base (shared)
```
--bg:          oklch(98.5% 0.003 90)   /* barely-warm near-white */
--bg-subtle:   oklch(96% 0.004 90)     /* section backgrounds */
--fg:          oklch(11% 0.010 270)    /* blue-tinted near-black for text */
--fg-muted:    oklch(45% 0.008 270)    /* secondary text */
--border:      oklch(88% 0.005 270)    /* subtle borders */
--surface:     oklch(99.5% 0.002 90)   /* card surfaces */
```

### Pokémon Zone
```
--poke-red:    oklch(51% 0.265 27)     /* vivid Pokémon red */
--poke-yellow: oklch(87% 0.195 94)     /* Pokémon yellow */
--poke-blue:   oklch(44% 0.225 264)    /* Pokémon blue */
--poke-dark:   oklch(10% 0.015 27)     /* near-black with red tint */
```

### One Piece Zone
```
--op-red:      oklch(47% 0.235 27)     /* One Piece red (slightly deeper) */
--op-blue:     oklch(37% 0.185 263)    /* deep navy */
--op-gold:     oklch(62% 0.090 78)     /* warm gold */
--op-dark:     oklch(9% 0.012 263)     /* near-black with blue tint */
```

### Grade Badges
```
--psa-bg:      oklch(38% 0.175 253)    /* PSA blue */
--bgs-bg:      oklch(15% 0.008 270)    /* BGS near-black */
--bgs-fg:      oklch(83% 0.155 95)     /* BGS gold text */
--cgc-bg:      oklch(30% 0.130 17)     /* CGC burgundy */
```

## Typography

### Fonts
- **Display/headings**: Bebas Neue — used for all hero headings, section titles, product names on hero
- **Body/UI**: Inter — used for all body text, labels, buttons, prices, navigation
- Load via Google Fonts (preconnect)

### Scale
```
Display:   5rem / 6rem (hero headings, Bebas Neue)
H1:        2.5rem (page titles, Bebas Neue)
H2:        1.75rem (section headings, Bebas Neue)
H3:        1.25rem (card titles, Inter 600)
Body:      1rem / 1.125rem
Small:     0.875rem
Micro:     0.75rem
```

### Rules
- Cap body line length at 65ch
- Hierarchy ratio ≥ 1.25 between scale steps
- Hero headings: letter-spacing -0.02em at large sizes (Bebas Neue tightens nicely)

## Layout & Spacing

### Grid
- Max content width: 1320px
- Gutter: 1.5rem mobile, 2rem desktop
- Columns: 4 (product grid), 2 (featured sets), 1 (mobile)
- Breakpoints: 375 / 640 / 1024 / 1440

### Spacing scale (8px base)
```
xs:  0.25rem (4px)
sm:  0.5rem  (8px)
md:  1rem    (16px)
lg:  1.5rem  (24px)
xl:  2rem    (32px)
2xl: 3rem    (48px)
3xl: 4rem    (64px)
4xl: 6rem    (96px)
```

## Shape & Elevation
```
--radius-sm:  0.375rem
--radius:     0.75rem
--radius-lg:  1.25rem
--radius-pill: 9999px
--shadow-sm:  0 1px 3px oklch(0% 0 0 / 8%)
--shadow:     0 4px 16px oklch(0% 0 0 / 10%)
--shadow-lg:  0 8px 32px oklch(0% 0 0 / 14%)
```

## Component Patterns

### Product Card
- White surface, `--shadow-sm`
- Image: 1:1 aspect ratio (sealed), 3:4 (graded slabs)
- Set name pill below image (muted, small)
- Product title: Inter 600, 0.9rem, 2 lines max
- Price: Inter 700, slightly larger
- Hover: `translateY(-4px)`, shadow deepens
- Grade badge: overlaid top-right corner on image

### Brand Zone Containers
- `.zone-pokemon` injects Pokémon color tokens as scoped CSS vars
- `.zone-one-piece` injects One Piece color tokens
- Hero panels use the zone's full gradient treatment

### Badges
- Set name: `--bg-subtle` background, `--fg-muted` text, pill shape
- Edition: tinted border + text (no filled background for 1st ed, to keep it subtle)
- CN Exclusive: `--poke-red` or `--op-red` background, white text, pill
- Grade badge: company-branded background, large grade number

## Design Laws (enforced)
- All colors in OKLCH — never raw hex #000 or #fff
- No gradient text (background-clip: text)
- No side-stripe borders as accents
- No glassmorphism decoration
- No identical card grids — cards vary by product type
- Animation: transform/opacity only, ease-out-quart, 150–300ms
- AI slop test: if it looks like a Shopify template, redesign it
