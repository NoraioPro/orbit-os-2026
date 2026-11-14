#!/usr/bin/env python3
"""ORBIT OS voice box — generate narration MP3s from .md scripts via edge-tts.

Usage:
    python scripts/voicebox.py <script.md> <output.mp3>
    python scripts/voicebox.py --all        # regenerate every audio/*.md -> audio/*.mp3

Voice matches the asset-pack manifest: en-US-GuyNeural, -8% rate, -2Hz pitch.
"""
import asyncio
import pathlib
import re
import sys

import edge_tts

VOICE = "en-US-GuyNeural"
RATE = "-8%"
PITCH = "-2Hz"

AUDIO_DIR = pathlib.Path(__file__).resolve().parent.parent / "public" / "assets" / "audio"


def strip_markdown(text: str) -> str:
    """Turn a narration .md into clean speakable text (no #, *, -, links)."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # [text](url) -> text
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)        # images
    text = re.sub(r"`([^`]+)`", r"\1", text)                 # inline code
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)       # headings
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)     # bullets
    text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)  # bold/italic
    text = re.sub(r">\s*", "", text)                          # blockquote
    text = re.sub(r"\|", " ", text)                           # table pipes
    text = re.sub(r"\s+", " ", text).strip()
    return text


async def synth(text: str, out: pathlib.Path) -> None:
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await comm.save(str(out))


def one(script: pathlib.Path, out: pathlib.Path) -> None:
    text = strip_markdown(script.read_text(encoding="utf-8"))
    if not text:
        print(f"SKIP {script.name}: empty"); return
    asyncio.run(synth(text, out))
    print(f"OK {out.name} ({len(text)} chars)")


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 1 and args[0] == "--all":
        scripts = sorted(AUDIO_DIR.glob("*.md"))
        if not scripts:
            print(f"no .md scripts in {AUDIO_DIR}"); sys.exit(1)
        for s in scripts:
            one(s, s.with_suffix(".mp3"))
        print(f"\nDone: {len(scripts)} voice-overs regenerated.")
        return
    if len(args) == 2:
        one(pathlib.Path(args[0]), pathlib.Path(args[1]))
        return
    print(__doc__)
    sys.exit(1)


if __name__ == "__main__":
    main()
