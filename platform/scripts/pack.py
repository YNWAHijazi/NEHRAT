"""Where the pack lives. See lib/handoff-pack.ts -- one declaration, both languages."""
from pathlib import Path
import re

def pack_dir(platform: Path) -> Path:
    """Reads the pack name from lib/handoff-pack.ts so the two can never drift."""
    src = (platform / "lib" / "handoff-pack.ts").read_text(encoding="utf-8")
    m = re.search(r"HANDOFF_PACK\s*=\s*'([^']+)'", src)
    if not m:
        raise SystemExit("lib/handoff-pack.ts no longer declares HANDOFF_PACK.")
    return platform.parent / m.group(1)
