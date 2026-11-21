# Taste plugin design check

GATE: OPEN 37 (rounds used up)

Kind: software editor. Palette: existing Opaline. Typography: local system sans.
Voice: direct, technical, dimensional. Real visuals: original procedural lamp and printable geometry.
No stock photography, invented proof, client image slots, external fonts or assumed business facts.
No waivers were applied. The kit files were not edited.

The gate was run three times (68, 43, then 37 open findings). Its marketing-page
screen/hero/moment and `.wrap` rules do not fit the explicitly requested three-column
CAD workspace. The project requirements take precedence. Independent screenshots
were inspected at 1440, 1024, 768 and 390 pixels, and the mobile workflow is automated.
The shader finding treats Three.js `#include <common>` as a reserved variable;
Three.js resolves this include before compilation. The real preview renders in Chrome.
The application gives a visible WebGL failure message and retains geometry/export.
The gate still requires a still-image fallback, so that finding remains open.

The checker also counts scroll-clipped sidebar content as overlap and imposes
marketing heading/section sizes. These remain reported rather than hidden. Actual
contrast and field-label issues found in early rounds were corrected. The gate is
not recorded as passed. Layout/performance checks outside the gate were not run
separately; production workflow tests and built-asset checks are the functional evidence.

## Open findings

1. **shader-lint** — deps/chunk-IT3TP6RZ.js "common"

   a shader uses "common" as a name (line 7: #include <common>): GLSL ES reserves it, so a strict GPU rejects the whole shader and the picture stays empty

2. **hero-fill** — main#workspace > section.stage "Honeycomb assembly"

   the next section shows on the first screen: it starts at 163px on a 900px screen (the hero ends at 861px)

3. **flush** — main#workspace > aside.model-panel.sidebar > details.projects-section > summary "Local projects 0"

   aside.model-panel.sidebar and section.stage run together: -687px between their content, on one ground

4. **flush** — main#workspace > section.stage > div.stage-footnote > span:nth-of-type(1) "Orbit to inspect · scroll to zoom"

   section.stage and aside.settings-panel.sidebar run together: -682px between their content, on one ground

5. **overlap-text** — div#app > div.app-shell > footer.status-bar "Print geometry ready · 50 ms · 1 connect"

   lies over the text "Project name" (details.projects-section > label.project-name-label)

6. **cta** — main#workspace > aside.settings-panel.sidebar "Honeycomb"

   the last section before the footer ends with no button

7. **heading-scale** — main#workspace > aside.model-panel.sidebar > section.setup-section:nth-of-type(3) > h2.section-heading "Attachment"

   an h2 at 12px, as large as the h1 (12px) or larger (and 2 more like it: "Mount", "Honeycomb assembly")

8. **heading-scale** — section.stage > div.stage-header > div > h2 "Honeycomb assembly"

   h2 headings in 3 sizes, 12px ("Attachment") to 24px (x2.00)

9. **fold-action** — main#workspace > aside.model-panel.sidebar > details.projects-section > button.full-width

   the hero's main button "Save locally" starts 42px below the first screen (900px tall): it is not seen on load

10. **moment-none** — (the page)

   a software page (--type) deals no moment: every kind carries one, two on a long page (moments.md)

11. **gl-fallback** — main#workspace > section.stage > div.viewport "Honeycomb assembly"

   with its shader rejected (as a strict GPU rejects a reserved word) the WebGL picture shows only its ground (100% one colour, #ececee): it needs a still fallback picture

12. **hero-screen** — main#workspace > aside.model-panel.sidebar "Design setup01 / 03 LampSmallRig P96L110"

   the hero ends at 861px on a 900px screen, 39px above the fold: it ends at the fold, 1px either way (SR-1)

13. **hero-screen** — main#workspace > section.stage "P96L / HoneycombHoneycomb assemblyProtot"

   767px of the next section shows on the first screen (from 133px on a 900px screen): nothing below the hero shows at load (SR-1)

14. **section-height** — div#app > div.app-shell > footer.status-bar "Print geometry ready· 43 ms · 1 connecte"

   the section is 39px tall (0 screens), 861px short of one screen (900px): every section after the hero is one screen or two, 2px either way (SR-2)

15. **section-height** — main#workspace > section.stage "P96L / HoneycombHoneycomb assemblyProtot"

   the section is 728px tall (0.8 screens), 172px short of one screen (900px): every section after the hero is one screen or two, 2px either way (SR-2)

16. **section-air** — main#workspace > section.stage / main#workspace > aside.settings-panel.sidebar

   the content of these two sections overlaps by 691px: 128-480px of air between them (SR-3)

17. **section-air** — main#workspace > section.stage > div.dimension-strip "Width113.8 mmHeight63.8 mmDepth26.5 mmPr"

   a top border across 94% of the container, between the section's content: sections and their parts are told apart by air and ground, not lines (SR-3)

18. **one-section** — section.stage > div.stage-header > div > h2 "Honeycomb assembly"

   the screen at scroll 0px (stride 0) shows 728px of section 2 and the heading of section 2 whole and the content of 3 sections, over 24px each beside section 1: a screen shows one section (another may peek 8px, 24px WARN) (SR-4)

19. **one-section** — main#workspace > aside.model-panel.sidebar "Design setup01 / 03 LampSmallRig P96L110"

   a <aside> sits directly in <main>: every part of <main> is a <section> (SR-4)

20. **one-section** — aside.model-panel.sidebar > section.setup-section:nth-of-type(3) > div.attachment-list > button.attachment-option.selected "⬡HoneycombSpill control"

   a band: a box 83% of the section wide on a ground of its own that holds only text: the section's own ground is the band (SR-4)

21. **one-heading** — main#workspace > aside.model-panel.sidebar > section.setup-section:nth-of-type(3) > h2.section-heading "Attachment"

   the hero holds an h2 (2): its heading is the h1, and an h2 opens the next section (SR-5)

22. **one-heading** — section.stage > div.stage-header > div > h2 "Honeycomb assembly"

   headings of two sections show whole on one screen at 1 of 1 scroll positions (100%; at scroll 0px), here with "Attachment": at most 3% on a desktop (SR-5)

23. **container-edges** — main#workspace > section.stage "P96L / HoneycombHoneycomb assemblyProtot"

   the content of section 2 runs 230px from the left and 290px from the right (read from its outermost blocks: no .wrap): the page's container starts at 23px; 230 and 290px are not one margin; the margin is 64-120px at 1440px (one container, equal margins, 2px either way) (SR-6)

24. **container-edges** — div#app > div.app-shell > footer.status-bar "Print geometry ready· 43 ms · 1 connecte"

   the content of section 4 runs 23px from the left and 23px from the right (read from its outermost blocks: no .wrap): the margin is 64-120px at 1440px (one container, equal margins, 2px either way) (and 1 more like it: "B↗BeamKit /Lamp attachme") (SR-6)

25. **container-edges** — div#app "Skip to workspace B↗BeamKit /Lamp attach"

   a <div> at the top of the page, outside header.nav, main, footer.closing and nav.actionbar (SR-6)

26. **container-edges** — main#workspace > aside.model-panel.sidebar "Design setup01 / 03 LampSmallRig P96L110"

   the section needs exactly one in-flow child .wrap (it has 6 in-flow children, 0 .wrap) (and 3 more like it: "P96L / HoneycombHoneycom", "ParametersReset preset A", "Print geometry ready· 43") (SR-6)

27. **container-edges** — main#workspace > aside.model-panel.sidebar > div.panel-label > span:nth-of-type(1) "Design setup"

   "Design setup" runs 19-101px, outside the container lines of section 1 at 23-1417px: full width is for background layers and grounds only (SR-6)

28. **container-edges** — main#workspace > aside.model-panel.sidebar > section.setup-section:nth-of-type(1) > label.section-heading "Lamp"

   "Lamp" runs 19-52px, outside the container lines of section 1 at 23-1417px: full width is for background layers and grounds only (and 32 more like it: "SmallRig P96L", "110 × 60 × 11.5 mm Refer", "Output") (SR-6)

29. **container-edges** — main#workspace > aside.settings-panel.sidebar > div.panel-label > span "Parameters"

   9 text blocks start on a left line at x 1171, 1148px from the container's left: text starts on the container's left, or on one split line (x 614, 732, 850) (also "Honeycomb", "Restricts spill with open hexago", "Cell opening across flats") (and 8 more like it: "Honeycomb", x 165, x 134) (SR-6)

30. **container-edges** — main#workspace > section.stage > div.dimension-strip "Width113.8 mmHeight63.8 mmDepth26.5 mmPr"

   a box over half the container wide runs 256-1124px, not on the container's lines at 230-1150px (SR-6)

31. **row-lines** — main#workspace > section.stage > div.dimension-strip "Width113.8 mmHeight63.8 mmDepth26.5 mmPr"

   a row of 4 items: its first item starts at 256px, the container's left line at 230px; its last item ends at 1124px, the container's right line at 1150px (2px either way) (SR-7)

32. **row-lines** — main#workspace > aside.settings-panel.sidebar > div.panel-label > button.text-button "Reset preset"

   "Reset preset" ends at 1420px, past the container's right line at 1417px (SR-7)

33. **row-lines** — aside.settings-panel.sidebar > div.settings-body > div.parameter:nth-of-type(2) > input "Cell opening across flats slider"

   "Cell opening across flats slider" ends at 1420px, past the container's right line at 1417px (SR-7)

34. **row-lines** — aside.settings-panel.sidebar > div.settings-body > div.parameter:nth-of-type(3) > input "Depth slider"

   "Depth slider" ends at 1420px, past the container's right line at 1417px (and 4 more like it: "Wall thickness slider", "Frame width slider", "Aperture inset slider") (SR-7)

35. **cta** — main#workspace > section.stage

   the hero has no button (the nav's does not count)

36. **off-grid** — main#workspace > section.stage > div.view-options > label:nth-of-type(1) "Lamp reference"

   left edge at 35px, 19px off a common edge of its section at 16px (5 elements, like h2)

37. **container** — page

   no .wrap


## Warnings kept

The gate reports 16 non-blocking warnings. They include app control labels, multiple actions, section spacing, and button-style categories. These reflect the working editor rather than sales-page copy. Full checker warnings are reproduced below.

- button-styles: section.stage > div.view-toolbar > div.segmented > button.active "Assembled" — the selected tab "Assembled" is drawn as a filled soft in #ffffff, a fill none of the page's buttons use (#ff634a): it reads as one more button style
- copy-buttons: div.app-shell > div.command-bar > div.command-actions > button.primary "↓ Export STL" — "↓ Export STL" does not start with a verb (book, buy, try, start, get, see...)
- copy-actions: (the page) — the main action "Export STL" does not read word for word the same in the nav or hero and the closing section
- section-gaps: main#workspace > aside.model-panel.sidebar / main#workspace > section.stage — the sections overlap by 687px
- section-gaps: main#workspace > section.stage / main#workspace > aside.settings-panel.sidebar — the sections overlap by 682px
- nav-family: div#app > div.app-shell > div.command-bar > div.command-actions — the nav's links come in 2 sizes (19, 13px)
- one-screen: main#workspace > section.stage "Honeycomb assembly" — 1 section is shorter than the screen, so the next one's heading or picture shows with it: "Honeycomb assembly" is 728px of the 900px under the nav, and "Honeycomb" shows below it
- font-load: div.app-shell > header.app-header > div.header-context > h1 "Inter" — "Inter" is asked for by the h1, the h2s and the body text but never loaded (no font link or @font-face loads it): it shows in its fallback
- share-meta: head — the head lacks og:image, twitter:card: a shared link shows no picture or title of its own
- nav: div.app-shell > header.app-header > div.header-right > button.quiet "Install app" — the nav is lopsided: its last item ends 10px inside the content's edge (375px), while its first starts on the other edge
- tap-size: section.stage > div.view-toolbar > div.segmented > button.active "Assembled" — a 118x40px tap target: under the 44px a phone needs
- tap-size: section.stage > div.view-toolbar > div.segmented > button:nth-of-type(2) "Part only" — a 118x40px tap target (and 1 more like it on this screen): under the 44px a phone needs
- tap-size: section.stage > div.view-options > label:nth-of-type(1) > input — a 94x36px tap target (and 2 more like it on this screen): under the 44px a phone needs
- tap-size: div#app > div.app-shell > footer.status-bar > a "Generated output · CC0 1.0 ↗" — a 130x14px tap target: under the 44px a phone needs
- heading-scale: (the page) — the page has no visible h1
- copy-stat-strip: copy x1: "0 / 113.8 / 63.8 / 26..." — stat strip x1
