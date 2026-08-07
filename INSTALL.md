# Installing without the Chrome Web Store

Usage Monitor isn't published to the Chrome Web Store yet, so there's no
true "one click" install — Chrome only allows silent/one-click installs for
extensions listed there. Until that submission happens, this is the
closest thing: download a zip, then load it manually. It takes about a
minute.

## Steps

1. **Download** the zip from the
   [latest release](https://github.com/darkanon6/ai-usage-monitor/releases/latest)
   — look for `usage-monitor-vX.Y.Z.zip` under "Assets" — and unzip it. You
   should end up with a folder containing `manifest.json`.
2. Open a new tab and go to `chrome://extensions`.
3. Turn on **Developer mode** — the toggle is in the top-right corner.
4. Click **Load unpacked**.
5. Select the folder you unzipped in step 1 (the one with `manifest.json`
   in it directly, not a subfolder).
6. Usage Monitor's icon appears in your extensions list. Click the puzzle
   piece icon in Chrome's toolbar and pin it so it's always visible.

That's it — click the icon any time to check your Claude.ai usage.

## Why the extra steps?

Chrome deliberately blocks installing extensions from anywhere except the
Web Store (or an enterprise-managed policy). "Developer mode" +
"Load unpacked" is the one path Chrome leaves open for everyone else, and
it can't be automated or reduced to a single click from a web page — that
restriction exists to stop malicious sites from silently installing
extensions on people's browsers. A real Chrome Web Store listing is the
only way around this, and is on the roadmap (see `README.md`).

## Updating

Chrome doesn't auto-update unpacked extensions. To get a newer version,
download the new zip, remove the old one from `chrome://extensions`
(**Remove**), and load the new folder the same way.
