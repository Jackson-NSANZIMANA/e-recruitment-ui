# National emblem assets — provenance

These files are national and agency symbols of the Republic of Rwanda. They are
shipped **only** because the programme owner directed their use on 2026-10-26
for this Government of Rwanda platform (ADR-FE-020). Each file below records
where it came from, what was done to it, and the SHA-256 of the shipped bytes,
so an auditor can trace every pixel back to an official source.

**Rules (ADR-FE-020):**

- Never redraw, recolour, crop, stretch, rotate, or add effects to an emblem.
  Scale proportionally only. A watermark may lower opacity and desaturate; it
  may not alter the drawing.
- Replace a file only with a newer official master, update this table in the
  same commit, and record the new hash.
- The masters for the agency emblems are kept unmodified in
  `apps/assets/logo&graphics/`. The files here are web renditions of them.

| Shipped file | Source | Retrieved | Processing | SHA-256 (shipped) |
|---|---|---|---|---|
| `coat-of-arms.svg` | Government of Rwanda, `https://www.gov.rw/fileadmin/gov/resources/public/images/Coat_of_arms_of_Rwanda.svg` (source SHA-256 `9d043313…f49d`) | 2026-10-26 | Editor metadata, ids and namespaces removed; numbers rounded to 3 decimals; checked free of scripts, event handlers, external references, `<image>`, `<use>` and `<foreignObject>`. Rendered and compared visually with the source. | `d9dcf70f99b19319819d395358667d9640476f3f40a571db19f8230e55f2ad03` |
| `coat-of-arms-128.webp` | rendered from `coat-of-arms.svg` | 2026-10-26 | Proportional scale to 128 px height, WebP q90 with alpha | `bbe23f967fce2c49fa15b7052f7d599b1c084254256e3ff0d429eaa3a7893a76` |
| `coat-of-arms-512.webp` | rendered from `coat-of-arms.svg` | 2026-10-26 | Proportional scale to 512 px height, WebP q90 with alpha | `30f6e902b730764a5135596e207ea5a50c901ea6ed074ac15348ce757790f127` |
| `rdf-emblem-128.webp` / `-512.webp` | Rwanda Defence Force emblem, owner-supplied master `apps/assets/logo&graphics/RDF-LOGO.png` (2359×2250, SHA-256 `0a345edc…7f27`) | master committed 2026-10-09 | Proportional scale, WebP q90 with alpha | `f0dc8003…42eb` / `9a23c6df…8798` |
| `rnp-emblem-128.webp` / `-512.webp` | Rwanda National Police emblem, owner-supplied master `apps/assets/logo&graphics/RNP-LOGO.png` (800×800, SHA-256 `4c50b037…a5f`). Matches the emblem on `police.gov.rw`. | master committed 2026-10-09 | Proportional scale, WebP q90 with alpha | `cd10e12b…5c66` / `209257cc…7592` |
| `rcs-emblem-128.webp` / `-512.webp` | Rwanda Correctional Service emblem, owner-supplied master `apps/assets/logo&graphics/RCS-LOGO.png` (600×600, SHA-256 `7718c83a…57de`), byte-identical to `https://www.rcs.gov.rw/fileadmin/user_upload/RCS/Icon_and_logo/RCS-LOGO.png` | 2026-10-26 (verified) | Proportional scale, WebP q90 with alpha | `0469a27d…147a` / `e71cdf40…794a` |

**Open items for the owner:**

1. **Written clearance.** Law N° 42/2018 creates offences for unlawful use of
   the national flag and official emblems of sovereignty. The owner's direction
   is recorded here; the written authorisation from the competent authority
   (and from RDF, RNP and RCS for their emblems) should be filed with this
   record before production (S07).
2. **Vector masters for the agency emblems.** RDF, RNP and RCS each publish
   raster artwork only. The RNP master shows signs of having been upscaled from a smaller raster.
   Request SVG/PDF masters from each agency's communications office; until then,
   do not render an agency emblem larger than 512 px.
3. **RCS colour codes.** RCS flag and logo colour codes are fixed by an Order
   published in the Official Gazette (Special) of 20/10/2023. The document was
   not retrievable (HTTP 403) on 2026-10-26; nothing here re-derives RCS
   colours, so nothing depends on it yet.
