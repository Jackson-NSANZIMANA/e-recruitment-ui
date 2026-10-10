
---

# PR 1 — The ADS platform (Compiled + fonts + runtime)

## 1.1 — Convert fonts (reproducible script)

Save as `tooling/fonts/convert-fonts.sh`:

```bash
#!/usr/bin/env bash
# Convert the four Atlassian OFL variable TTFs to WOFF2.
# Preserves axes (wght, opsz). Reproducible.
# Requires: python3, fonttools, brotli.
set -euo pipefail

SRC="apps/assets/fonts"
DEST="packages/design-system/src/fonts/files"

mkdir -p "$DEST"

python3 <<'PY'
from pathlib import Path
from fontTools.ttLib import TTFont

src_dir  = Path("apps/assets/fonts")
dest_dir = Path("packages/design-system/src/fonts/files")
dest_dir.mkdir(parents=True, exist_ok=True)

for ttf in sorted(src_dir.glob("*.ttf")):
    font = TTFont(str(ttf))
    font.flavor = "woff2"
    out = dest_dir / (ttf.stem + ".woff2")
    font.save(str(out))
    orig_kb = ttf.stat().st_size // 1024
    new_kb  = out.stat().st_size // 1024
    print(f"  {ttf.name:38s} {orig_kb:4d}KB → {new_kb:4d}KB  {out.name}")
PY

# Preserve license and provenance alongside the font files.
cp -v apps/assets/fonts/*.ttf "$DEST/../source-ttf/" 2>/dev/null || true
cat > "$DEST/../LICENSE-FONTS.md" <<'MD'
# Fonts in this directory

Four Atlassian-authored variable fonts, licensed under the
SIL Open Font License, Version 1.1. See `OFL.txt` for the full text.

| File | Family | Axes | Based on |
|---|---|---|---|
| AtlassianSans.v3.woff2 | Atlassian Sans | wght 100-900, opsz 14-32 | Inter |
| AtlassianSansItalic.v3.woff2 | Atlassian Sans | wght 100-900, opsz 14-32 | Inter |
| AtlassianMono.v2.woff2 | Atlassian Mono | wght 100-800 | JetBrains Mono |
| AtlassianMonoItalic.v2.woff2 | Atlassian Mono | wght 100-800 | JetBrains Mono |

Copyright: Portions Copyright 2025 Atlassian Pty Ltd.
Atlassian Sans: Copyright 2016 The Inter Project Authors.
Atlassian Mono: Copyright 2020 The JetBrains Mono Project Authors.

OFL permits embedding, modification, and redistribution bundled with
software, provided the Reserved Font Name is preserved and this license
accompanies the font files.
MD

# Fetch official OFL text alongside.
curl -fsSL -o "$DEST/../OFL.txt" https://openfontlicense.org/documents/OFL.txt

echo "Done. Generated files under $DEST/"