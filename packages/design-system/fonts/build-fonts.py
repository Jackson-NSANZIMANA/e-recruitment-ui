    #!/usr/bin/env python3
    """
    USRP font pipeline: Atlassian variable TTF -> WOFF2 + fonts.css + provenance.

    Reads each TTF's real fvar axes and italic flag, so the generated
    @font-face weight ranges are measured, never assumed.

    Usage:
    python3 tooling/fonts/build-fonts.py \
        --src apps/assets/fonts \
        --out packages/design-system/src/fonts [--subset]

    --subset is OFF by default and prints an OFL warning when used:
    subsetting is a modification under OFL 1.1; if the upstream fonts declare
    Reserved Font Names, a modified build may not ship under the same name.
    Plain WOFF2 recompression (the default) keeps glyph data intact.
    """
    import argparse
    import hashlib
    import sys
    from datetime import date, timezone, datetime
    from pathlib import Path

    from fontTools.ttLib import TTFont

    # Latin + Latin-1/Extended (covers en/fr/rw), punctuation, currency, arrows.
    SUBSET_UNICODES = (
        "U+0000-00FF,U+0100-017F,U+0180-024F,U+1E00-1EFF,"
        "U+2000-206F,U+20A0-20CF,U+2190-2199,U+2212,U+FEFF,U+FFFD"
    )


    def sha256(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()


    def inspect(font: TTFont) -> dict:
        name = font["name"]
        fam = name.getDebugName(16) or name.getDebugName(1)
        italic = bool(font["post"].italicAngle) or bool(
            font["OS/2"].fsSelection & 0x01
        )
        axes = {}
        if "fvar" in font:
            for a in font["fvar"].axes:
                axes[a.axisTag] = (a.minValue, a.maxValue)
        return {
            "family": fam,
            "italic": italic,
            "axes": axes,
            "fsType": font["OS/2"].fsType,
            "license": (name.getDebugName(13) or "")[:200],
        }


    def maybe_subset(font: TTFont) -> TTFont:
        from fontTools.subset import Subsetter, Options, parse_unicodes

        opts = Options()
        opts.layout_features = ["*"]          # keep kerning, ligatures, locl
        opts.name_IDs = ["*"]                 # keep license/copyright records
        opts.notdef_outline = True
        opts.recalc_bounds = True
        sub = Subsetter(options=opts)
        sub.populate(unicodes=parse_unicodes(SUBSET_UNICODES))
        sub.subset(font)
        return font


    def css_face(meta: dict, filename: str) -> str:
        lo, hi = meta["axes"].get("wght", (400, 400))
        style = "italic" if meta["italic"] else "normal"
        opsz = (
            "\n  font-optical-sizing: auto;" if "opsz" in meta["axes"] else ""
        )
        return (
            "@font-face {\n"
            f"  font-family: '{meta['family']}';\n"
            f"  src: url('./files/{filename}') format('woff2');\n"
            f"  font-weight: {lo:g} {hi:g};\n"
            f"  font-style: {style};\n"
            "  font-display: swap;"
            f"{opsz}\n"
            "}\n"
        )


    def main() -> int:
        ap = argparse.ArgumentParser()
        ap.add_argument("--src", required=True, type=Path)
        ap.add_argument("--out", required=True, type=Path)
        ap.add_argument("--subset", action="store_true")
        args = ap.parse_args()

        ttfs = sorted(args.src.glob("*.ttf"))
        if not ttfs:
            print(f"ERROR: no .ttf files under {args.src}", file=sys.stderr)
            return 1
        if args.subset:
            print(
                "WARNING: --subset modifies the fonts. Under OFL 1.1, modified\n"
                "versions may not use any Reserved Font Name. Confirm the\n"
                "upstream OFL header before shipping a subset build.\n",
                file=sys.stderr,
            )

        files_dir = args.out / "files"
        files_dir.mkdir(parents=True, exist_ok=True)

        faces, prov = [], []
        for ttf in ttfs:
            font = TTFont(str(ttf))
            meta = inspect(font)
            if meta["fsType"] != 0:
                print(
                    f"ERROR: {ttf.name} fsType={meta['fsType']} "
                    "(not installable-embedding). Stop and review license.",
                    file=sys.stderr,
                )
                return 1
            if args.subset:
                font = maybe_subset(font)
            font.flavor = "woff2"
            out = files_dir / (ttf.stem + ".woff2")
            font.save(str(out))

            faces.append(css_face(meta, out.name))
            prov.append(
                f"{ttf.name}  sha256={sha256(ttf)}\n"
                f"  -> {out.name}  sha256={sha256(out)}\n"
                f"  family='{meta['family']}' axes={meta['axes']} "
                f"italic={meta['italic']} subset={args.subset}\n"
                f"  license: {meta['license']}\n"
            )
            print(
                f"  {ttf.name:34s} {ttf.stat().st_size//1024:4d}KB -> "
                f"{out.stat().st_size//1024:4d}KB  "
                f"[{meta['family']}, wght {meta['axes'].get('wght')}, "
                f"{'italic' if meta['italic'] else 'normal'}]"
            )

        header = (
            "/*\n"
            " * GENERATED by tooling/fonts/build-fonts.py — do not hand-edit.\n"
            f" * Generated: {datetime.now(timezone.utc).isoformat()}\n"
            " *\n"
            " * Family names must match the first entry of the installed\n"
            " * @atlaskit/tokens font.family.* stacks. Verify before upgrade:\n"
            " *   node -e \"console.log(require('@atlaskit/tokens').token("
            "'font.family.body'))\"\n"
            " */\n\n"
        )
        (args.out / "fonts.css").write_text(header + "\n".join(faces))
        (args.out / "PROVENANCE.txt").write_text(
            f"Generated {date.today().isoformat()}\n\n" + "\n".join(prov)
        )
        print(f"\nWrote {args.out}/fonts.css and PROVENANCE.txt")
        return 0


    if __name__ == "__main__":
        sys.exit(main())