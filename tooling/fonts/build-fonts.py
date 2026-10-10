#!/usr/bin/env python3
"""Build full-repertoire Atlassian WOFF2 assets and verify their font tables."""

import argparse
import hashlib
import io
import json
import sys
from importlib.metadata import version
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.woff2 import compress

FACES = (
    ("AtlassianSans.v3.ttf", "Atlassian Sans", "normal"),
    ("AtlassianSansItalic.v3.ttf", "Atlassian Sans", "italic"),
    ("AtlassianMono.v2.ttf", "Atlassian Mono", "normal"),
    ("AtlassianMonoItalic.v2.ttf", "Atlassian Mono", "italic"),
)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def name_values(font, name_id):
    return sorted({
        record.toUnicode()
        for record in font["name"].names
        if record.nameID == name_id
    })


def comparable_table(font, tag):
    data = bytearray(font.reader[tag])
    if tag == "head":
        # Container checksums can differ after WOFF2 compression.
        data[8:12] = b"\0" * 4
        # FontTools marks the lossless compression transform with bit 11.
        flags = int.from_bytes(data[16:18], "big") & ~(1 << 11)
        data[16:18] = flags.to_bytes(2, "big")
    return bytes(data)


def build_face(path, expected_family, style):
    original_bytes = path.read_bytes()

    with TTFont(io.BytesIO(original_bytes), recalcTimestamp=False) as original:
        family = (
            original["name"].getDebugName(16)
            or original["name"].getDebugName(1)
        )
        if family != expected_family:
            raise ValueError(f"{path.name}: unexpected family {family!r}")

        if "DSIG" in original:
            raise ValueError(
                f"{path.name}: contains DSIG; review signature handling "
                "rather than silently removing it"
            )

        if "fvar" not in original:
            raise ValueError(f"{path.name}: expected a variable font")

        axes = {
            axis.axisTag: {
                "min": axis.minValue,
                "default": axis.defaultValue,
                "max": axis.maxValue,
            }
            for axis in original["fvar"].axes
        }
        if "wght" not in axes:
            raise ValueError(f"{path.name}: missing weight axis")

        is_italic = bool(original["OS/2"].fsSelection & 1)
        if is_italic != (style == "italic"):
            raise ValueError(f"{path.name}: italic metadata disagrees with filename")

        notices = {
            str(name_id): name_values(original, name_id)
            for name_id in (0, 7, 13, 14)
        }
        if "open font license" not in " ".join(notices["13"]).lower():
            raise ValueError(f"{path.name}: expected OFL declaration not found")

        buffer = io.BytesIO()
        compress(
            io.BytesIO(original_bytes),
            buffer,
            transform_tables=set(),
        )
        output_bytes = buffer.getvalue()

        with TTFont(io.BytesIO(output_bytes), recalcTimestamp=False) as result:
            original_tags = set(original.reader.keys())
            result_tags = set(result.reader.keys())
            if original_tags != result_tags:
                raise ValueError(f"{path.name}: conversion changed the table set")

            changed = [
                tag for tag in sorted(original_tags)
                if comparable_table(original, tag) != comparable_table(result, tag)
            ]
            if changed:
                raise ValueError(
                    f"{path.name}: unexpected table changes: {', '.join(changed)}"
                )

        output_name = path.with_suffix(".woff2").name
        weight = axes["wght"]

        css = (
            "@font-face {\n"
            f'  font-family: "{expected_family}";\n'
            f'  src: url("./files/{output_name}") format("woff2");\n'
            f'  font-weight: {weight["min"]:g} {weight["max"]:g};\n'
            f"  font-style: {style};\n"
            "  font-display: swap;\n"
            "}\n"
        )

        record = {
            "source": path.name,
            "sourceSha256": sha256(original_bytes),
            "sourceBytes": len(original_bytes),
            "output": f"files/{output_name}",
            "outputSha256": sha256(output_bytes),
            "outputBytes": len(output_bytes),
            "family": expected_family,
            "style": style,
            "axes": axes,
            "glyphCount": len(original.getGlyphOrder()),
            "unicodeCodepointCount": len(original.getBestCmap() or {}),
            "embeddingFlags": original["OS/2"].fsType,
            "nameRecords": notices,
        }

    return output_name, output_bytes, css, record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, default=Path("apps/assets/fonts"))
    parser.add_argument(
        "--out", type=Path,
        default=Path("packages/design-system/src/fonts"),
    )
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--subset", action="store_true")
    args = parser.parse_args()

    if args.subset:
        parser.error(
            "Subsetting is deliberately disabled for this baseline. "
            "Remove --subset; preserve names and multilingual coverage first."
        )

    license_path = Path(__file__).resolve().with_name("OFL-1.1.txt")
    if not license_path.is_file():
        raise ValueError(
            f"Missing {license_path}. Complete the license-text setup first."
        )

    license_bytes = license_path.read_bytes()
    if b"SIL OPEN FONT LICENSE Version 1.1" not in license_bytes:
        raise ValueError("The license file is not the expected OFL 1.1 text")

    outputs = {}
    records = []
    css_blocks = []
    notice_blocks = []

    # Validate every input before writing anything into the output directory.
    for filename, family, style in FACES:
        source = args.src / filename
        if not source.is_file():
            raise ValueError(f"Missing source font: {source}")

        name, payload, css, record = build_face(source, family, style)
        outputs[f"files/{name}"] = payload
        records.append(record)
        css_blocks.append(css)

        lines = [filename]
        for name_id, label in (
            ("0", "Copyright"),
            ("7", "Trademark"),
            ("13", "License"),
            ("14", "License URL"),
        ):
            for value in record["nameRecords"][name_id]:
                lines.append(f"{label}: {value}")
        notice_blocks.append("\n".join(lines))

        print(
            f"{filename}: {record['sourceBytes']:,} -> "
            f"{record['outputBytes']:,} bytes; table verification PASS"
        )

    manifest = {
        "schemaVersion": 1,
        "mode": "full-repertoire",
        "fonttools": version("fonttools"),
        "brotli": version("brotli"),
        "licenseSha256": sha256(license_bytes),
        "fonts": records,
    }

    outputs["fonts.css"] = (
        "/* Generated by tooling/fonts/build-fonts.py; do not hand-edit. */\n\n"
        + "\n".join(css_blocks)
    ).encode("utf-8")
    outputs["manifest.json"] = (
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    outputs["FONT-NOTICES.txt"] = (
        "\n\n".join(notice_blocks) + "\n"
    ).encode("utf-8")
    outputs["OFL-1.1.txt"] = license_bytes

    if args.check:
        mismatches = [
            relative for relative, payload in outputs.items()
            if not (args.out / relative).is_file()
            or (args.out / relative).read_bytes() != payload
        ]
        if mismatches:
            raise ValueError(
                "Generated files missing or different: " + ", ".join(mismatches)
            )
        print("CHECK PASS: generated outputs match this toolchain and inputs")
        return

    for relative, payload in outputs.items():
        destination = args.out / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.read_bytes() != payload:
            destination.write_bytes(payload)

    print(f"BUILD PASS: generated {len(outputs)} files under {args.out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FONT BUILD FAILED: {error}", file=sys.stderr)
        sys.exit(1)
