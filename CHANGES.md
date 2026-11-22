# Changes (dashboard + website)

## Dashboard (separate app: `projects/admin`)
- **Product code (SKU)**: Automatic / Manual switch. Automatic = server generates `PREFIX-00001, 00002 ...` (prefix editable in Site settings). Editing a product keeps its code.
- **Brands**: new *Brands* page. The product form picks a brand from a list.
- **Sort order**: ties are handled. Leave 0 = last; a taken number inserts there and pushes the others down by one (products inside their category, categories globally). Lists use a stable tie-break.
- **Featured products**: the home page shows a fixed number (Site settings -> Catalog, default 8). The products page and dashboard warn when more are marked featured.
- **Product form order**: 1) Classification & code, 2) Names / description / slug / **main image**, 3) Specifications, 4) Gallery.
- **Specifications**: one small form (fills, clears) + a table of rows with edit / move / delete.
- **Slug** comes after the names and is generated from the English name automatically (editable).
- **Data tables** (search, sort on every column, filter on every column, paging) for products, categories, brands and site content.
- **Gallery**: one row per image (thumbnail, URL, alt, order, upload, remove) and multi-file upload.
- **Pop-ups** for every add / edit form.
- **Site content**: the form only shows the inputs that item type uses; icons are chosen from an **icon picker** (no typing).
- **Company profile**: mission, vision, working hours, Google Map, and a **social links table** (platform, link, show/hide, order).
- **Site settings** (new): colors + presets, fonts, corner roundness, hero darkness, header style, favicon, which home sections show, header / footer blocks, featured limit, code prefix, **email (SMTP)** with a test button, new-inquiry notifications and auto-reply.

## Website (`projects/website`)
- No admin link anywhere. Header and footer list the sections that exist (About, Services, Why us, How we work ...).
- Everything (colors, fonts, radius, sections, footer, social icons) follows the dashboard settings.
- Built-in SVG icon set replaces emoji; proper social media icons.
- Contact page: working hours, map.

---
# v3

## Dashboard
- Input boxes: English always on the left, Arabic always on the right (in every form, whatever the dashboard language).
- Brands have an English + Arabic name like everything else.
- Sort order: empty / 0 = last in every list (also for existing items stored as 0).
- Collapsible sidebar with animation (icon rail on desktop, slide-in drawer on mobile).
- Colors, fonts and the favicon from Site settings now apply to the dashboard too. The favicon bug is fixed (the API address was missing from its URL).
- Site settings: font picker that shows every font in its own style, text-size slider, animations switch, brands-strip switch.
- Company profile: map = type an address or paste any Google Maps link (live preview). Direction fix for the text boxes.
- Site content: Market = pick a country (pin on the world map), Certification = picture only, the "New" button remembers the last type you used.
- Inquiries: reply by email from the dashboard (needs Email enabled in Site settings).

## Website
- Categories: small cards in one horizontal strip (drag / swipe, soft arrows only where more items are hidden). Related products use the same strip.
- New brands strip (click a brand = products of that brand).
- Certifications: own section with a card per certificate. Markets: world map with a pin per country.
- Animations: reveal on scroll, hover lift/zoom, number counters, hero entrance, page fade. Can be switched off in Site settings.
- Product gallery: arrows, swipe, thumbnails, hover zoom and a full-screen viewer with zoom.

## Backend (needs a new migration)
`BrandTranslations`, `Brands.Name` removed, `SiteSettings.ShowBrands/FontScale/EnableAnimations`, `Inquiries.ReplyText/RepliedAtUtc`.
New endpoints: `POST /api/admin/inquiries/{id}/reply`, `GET /api/public/products?brand=ID`. `GET /api/public/home` now includes `brands`.

---
# v4

## Code structure
Every component now has its own files, like the Angular default: `name.component.ts` (logic), `name.component.html` (template) and, where the component has its own styles, `name.component.css`
(icon, slider, splash). Shared page-level styles stay in `projects/shared/src/styles/base.css` and each app's `styles.css`.
Angular 17 compatibility: no bare `$index` in `track` / bindings (use `let i = $index`), no `@let`.

## Website
- Endless 360° carousel (no arrows) for categories, brands and related products: drifts slowly, stops on hover, drag / swipe, loops from last to first.
- Opening screen with the logo on the site colors (once per session).
- Section transitions: wavy edges, headings that draw an underline, reveal from the left / right, parallax background pictures, reading-progress bar, header that shrinks, current section highlighted in the menu, smooth scroll.
- Footer redesigned: map square next to the address from the dashboard; click = bigger map + "Open in Google Maps".
- Background picture for any home section (veil strength + dark / light), set in the dashboard.
- More micro-interactions (button shine / press, icon motion, link slide, focus ring).

## Dashboard
- Sign-in page uses the site theme, logo and favicon.
- Collapsed sidebar: icons centred in their buttons.
- Pop-up windows: header and footer stay fixed, only the content scrolls.
- Field labels follow the dashboard language ("Name (English)" / "الاسم (بالإنجليزية)"); typing direction stays English-left / Arabic-right.
- Site settings -> Home sections: background picture per section.

## Backend (new migration needed)
`SiteSettings.SectionBackgrounds` (JSON text).

---
# v5
- Markets map: a market can be a **country** (pin) or a whole **continent** (lights up); each can be **exporter / importer / both** and curved animated route lines join exporters to importers. Four looks (dotted, solid, leaves, circuit) chosen in Site settings. The map is a stylised world map (approximate shapes and pin positions), not an accurate border map.
- Carousels: categories and related products are a static endless wheel (turn it by dragging, no automatic drifting); brands keep the slow drift. In Arabic the first card starts at the right edge.
- Hero highlights (original / fast delivery / support) animate in and react to the pointer; counters count slowly; mission / vision cards animate.
- "My default theme": save the current colors / fonts / roundness as your default and restore it any time (Site settings -> Appearance).
- Built-in illustrations follow the chosen main color (they were always orange); warning toasts (e.g. "session expired") follow the theme.
- Backend: `SiteSettings.MapStyle`, `MapShowLines`, `DefaultTheme` (new migration).

---
# v6
- Categories: a plain row (nothing repeated). Only when there are more cards than the screen holds, two soft arrows and one dot per position appear (press a dot = that card comes to the front). Mouse drag still works. Arabic starts at the right.
- Related products: ordinary cards in a grid (no slider), right-to-left in Arabic. Brands keep the slow endless strip.
- Markets map: detailed continent outlines (about 1 degree accuracy), dotted land like a navigation chart, faint grid, continent names, glow around exporters, thin routes with moving dots, ring + dot places with their names.
- Leaf style redesigned: the real continent shapes textured like leaves (midrib + veins clipped to the outline), not loose leaves.

---
# v5 (fixes)

- **Strips (categories / related products)**: the arrows are now drawn chevrons, so in Arabic they point outwards (the text glyph was being mirrored twice). Dots are counted from the real scroll length, so there is no extra dot that does nothing, and pressing a dot always scrolls to it (LTR and RTL).
- **Markets map, "Leaves" look**: each continent is now a simple smooth leaf (a few points, no bays or peninsulas) with a midrib and curved veins, instead of the full geographic outline. The other map looks are unchanged. Every country pin still lands on its leaf.

# v6 (fixes)
- Opening screen now shows on every page load (not once per session).
- No more orange flash: the built-in colors are now the green preset, and the last saved theme is cached in the browser and applied before the app starts (then refreshed from the API).
- Markets map: the default "dots" look (and solid / circuit) now use the simple continent blobs; exporters are gold with gold moving dots on the routes, importers are white rings.

# v7 (map rebuilt with d3-geo)
- Needs `npm install` (new packages: d3-geo, topojson-client, world-atlas + their types; tsconfig gets resolveJsonModule).
- Markets map now uses **d3-geo** (Natural Earth projection) with the country shapes from **world-atlas**. New file `projects/website/src/app/world-geo.ts`.
  - "dots": the land is sampled on a regular grid, so each continent is a soft dotted shape (like the reference picture). Grid spacing / dot size: `DOT_STEP`, `DOT_SIZE` in `world-geo.ts`.
  - "solid" / "circuit": real country shapes. "leaf": the simple leaves, projected the same way.
  - Pins, routes and continent names all use the same projection, so they always line up.

# v8 (online store - step 1: customer accounts)
Pairs with the API's "Phase 3 - step 1" (see the API README; run the `CustomerAccounts` migration).
- Pages: `/login`, `/register`, `/verify-email` (6-digit code, auto-submits, resend timer), `/forgot-password` (code + new password), `/account` (details, saved addresses, change password).
- Header: "Sign in" / "My account" link. `AuthService` knows `isCustomer`; `customerGuard` / `guestGuard`; a login that answers 403 `email_not_verified` goes to the code page.
- EN + AR texts for all of it.

# v9 (online store - step 2: prices, stock, cart)
Pairs with the API's "Phase 3 - step 2".
- Fixed the admin build error (TS2345 on `defaultTheme` in the settings form).
- Dashboard: product form has "Price and stock" (price, old price, stock, track stock); the products table shows price and stock.
- Website: price (+ old price and discount %) on product cards and pages, "Add to cart" (cards and product page with quantity), out-of-stock / "only N left".
- **Guest mode:** shopping needs no account. `/cart` page, cart icon with a badge in the header. The guest cart lives in the browser (token) and is merged into the account when the shopper signs in or signs up.
- The "Proceed to checkout" button is a placeholder until the next step (checkout + orders).

# v10 (warehouses + variants + guest checkout)
Pairs with the API's "Phase 3 - step 3". Run `npm install` is not needed (no new packages); run the new API migration.
- **Dashboard - Inventory** (menu group "Inventory"): overview, stock (receive / adjust / transfer / low-stock level), history + batches (cost, expiry), stock counts, purchase orders (send / receive), warehouses + warehouse employees, suppliers. A warehouse employee signs in to the same dashboard and only sees the inventory pages of their own warehouses.
- **Dashboard - products:** "Options and variants" editor (add Size / Color options, generate variants, price / SKU / pre-order per variant). Dashboard - Orders: status, payment, "take the goods out of the warehouse" (gives the real cost and profit).
- **Shop:** option buttons (size, colour) on the product page, "from" prices on cards, pre-order and "notify me when back", the **cart opens as a side drawer** when something is added (RTL aware), and a **light guest checkout** (name, e-mail, phone, address, payment method; no account, no code) with an order confirmation page. Signed-in customers get the form pre-filled and a "My orders" tab.
- Payment methods are listed (cash on delivery works; Card, Tabby, Tamara, Fawry, wallets, Paymob show "coming soon" until their gateways are connected).

# v10.1
- Fixed the admin build errors: `track $index` in the variants editor / purchase-order lines (now tracked by the row object) and the create-or-update `subscribe` of suppliers, warehouses, employees and purchase orders (same pattern as brands).

## Round 3 — dashboard, inventory, orders, website

- Drop-downs: the list colors no longer depend on the site theme (they were white on white).
- Warehouse employee: the shell no longer calls the administrator-only settings endpoint (that 403 caused the
  "no permission" message on every page). Temporary password (default 123456) + forced change at first sign-in.
- Inventory menu: numbered steps in data-entry order; "Overview" renamed "Inventory dashboard".
- Orders: draft + Save button (with confirmation for shipped/delivered/cancelled/paid), status e-mails controlled from
  "Order e-mails" (on/off, subject, text, per language, {days} and {note}), "Return to stock" puts goods back on the batches they left from.
- New pages: Order e-mails, Returns policy (+ public /returns page).
- Low-stock level: per product (variants table), default in Settings, still overridable per warehouse.
- Expiry dates in the past are refused (screen and API).
- Warehouse names in Arabic and English. Server messages are translated in the dashboard.
- Website: quick "add to cart" box (variant + quantity) on every product card.

NEW DATABASE COLUMNS (see the API README): regenerate the migration.

## Round 4 — roles and permissions, product options, users

- Roles: Admin (everything), Warehouse keeper, Accountant, and any role you create. Each role = the screens ticked for it
  (Dashboard > Users and roles > Roles). The menu, the routes and the API follow the ticks. A change works at once.
- Users: created with a role, a temporary password (default 123456, replaced at the first sign-in) and the warehouses they
  work with. The account is created in one step (nothing is left behind when something fails).
- Product options: ready-made colors (swatches) and sizes (volume / weight / length / clothes / shoes / pack), plus "another value".
  The SKU is generated by the system and shown read-only.
- Arabic is the default language of the data entry forms (Arabic on the right, English on the left).

## Round 5

- Saving a user: the API answered with a bare string, the browser failed to read it as JSON and showed an error although
  the account WAS created (so the second try said "e-mail exists"). It now answers with an object.
- Product form: product data and main image first; options, items and prices last (step 5).
- Arabic terms instead of "variants"; explanations for "price before discount", "low-stock alert level" and "item code (SKU)".
- Warehouse form: each label sits on the side of its own input (English left, Arabic right).
- Purchase orders: the expected date cannot be in the past; the items table has an entry row that stays ready for the next item;
  the unit cost is required; short explanations of "send to supplier" and "receive goods".
- Tables: numbers and codes line up with their headers in Arabic.

## Round 5b
- Supplier names in Arabic and English (Arabic required, English optional, labels on the side of their input),
  shown in the language of the dashboard (list, purchase orders, supplier e-mail).

## Round 6 — discounts and coupons (phase 1 of the offers system)

- Discounts: percent / fixed amount / new selling price; on everything, a category, a product or one item; for a period.
  The lowest price wins when two discounts cover the same item. Prices on the website, in the cart and in orders follow them.
- Coupons: code, percent or amount, minimum order, cap, period, total and per-customer limits, audience (everyone / new customers /
  specific e-mails), a category or product only, "not on discounted items", usage list. Coupon box in the cart; the total follows.
- New permissions: discounts, coupons (give them to a role in Users and roles).

## Round 7 — offers (promotions) and shipping fee

- Offers: buy something -> a gift; buy a quantity -> a percent / amount off; spend an amount -> a gift; free shipping (above an amount or always).
  They apply to the cart by themselves. Gifts are real order lines with price 0 (they leave the stock); a gift that is out of stock is not given.
- Shipping fee: one flat fee in Settings, added to every order unless an offer makes it free.
- Cart, checkout and orders show the gifts, the offer discount and the shipping.

## Round 8 — packages, auctions, fixes

- Fix: `productId` is optional on VariantPick (build error in inventory-stock).
- Fix: mail server certificate (RemoteCertificateNameMismatch): clear message + "Accept any certificate" setting.
- Packages (bundles): a product made of other items at one price, with images/specifications like any product. No stock of its own:
  availability = complete sets its components allow; a sale reserves / issues / returns the components.
- Auctions: opening price, smallest raise, lowest accepted price, end time; bids from signed-in customers; the winner is told by e-mail.

## Round 9 — Packages as their own screen

- New menu item "Packages" (permission: products): name, description, gallery, specifications, price and the items inside. No category,
  brand, featured switch or options. Packages are put in a "Packages" category automatically and are not listed in the Products screen.
- The Products screen lists products only (the package switch was removed from it).

## Round 10 — steps bar in the product / package form

- A numbered bar (1 Basic data · 2 Images · 3 Specifications · 4 Options and prices) with Back / Next. Next checks the open step first.
  The main image moved to the Images step (with the gallery). Enter in a field goes to the next step instead of saving.
- Editing an existing product: every step is open at once and Save is always available.

## Round 11 — wheel of fortune + coupon box in the website

- The coupon box is now a component used in the cart page, the mini cart and the checkout (it was only in the cart page).
- Wheel of fortune: campaigns in the dashboard (slices, chances = 100%, audience, timing, spins per visitor / internet address,
  coupon validity and cap, dates, results). The WINNER IS DRAWN BY THE SERVER; the prize is a real coupon created by the server.
- New coupon type: free shipping.

## Round 12 — side dock wheel, side auth drawer, themes by business, hero slider

- The wheel is a dock on the side of the screen (never a pop-up): 2/3 of the wheel peek from the edge, press = panel, x = tucks into a small tab.
- Sign in / create account open in a side drawer (like the cart); /login and /register open it over the home page.
- Themes: choose the business (16 categories) -> one of 3 shades -> edit any color or make all lighter / darker. Five colors: primary,
  secondary, accent, background, text (+ dark surface). A palette whose text color is white gets a readable dark text automatically.
- Cover: one picture or a slider (arrows, dots, auto-play, up to 10 pictures), chosen in Settings.
- Animations are postponed (to be designed from the reference website).

## Round 13 — motion, hero arrows, shop density, product tabs, palette contrast

- Hero: full-height edge strips with a soft shadow and arrows pointing outward (correct in Arabic and English); dots moved above the statistics;
  entrance motion (text rises in, replayed for every slide) and a slow zoom on the picture.
- Shop: choose 2 / 3 / 4 / 5 cards per row (remembered). Product page: tabs (package contents, description, specifications, related products).
- Themes: the primary color is darkened just enough for white button labels (WCAG 4.5); labels on the accent color are white or dark automatically (--on-accent).
- Fix: heroMode typing in settings-admin.

## Round 14

- Colors: three colors are chosen by hand (main, highlight, background); the rest is derived (advanced section for manual). New categories: Women's beauty (pink), Kids & baby.
- Opening (logo) screen: OFF by default, switch on + seconds from Settings. Cover text animation waits for it.
- "Request a quote" / "Shop now" buttons switched from Settings. Cover slider: its own title, text and button per slide.
- Product page tabs fixed (full width). Shop: side filters (price, categories, brands, every option, in stock, on sale) + sort, in the address bar.
- Reviews: customers rate and comment (stars summary, verified purchase), owner approves / hides / replies in "Reviews"; switches in Settings.
