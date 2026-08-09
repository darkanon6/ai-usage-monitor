# Installing without the Chrome Web Store

Usage Monitor isn't published to the Chrome Web Store yet, so there's no
true "one click" install — Chrome only allows silent/one-click installs for
extensions listed there. Until that submission happens, this is the
closest thing: download a zip, then load it manually. It takes about a
minute.

## Steps

1. **Download** the zip from the
   [latest release](https://github.com/darkanon6/ai-usage-monitor/releases/latest).
   Under **Assets**, click **`usage-monitor-vX.Y.Z.zip`** — then unzip it.
   You should end up with a folder containing `manifest.json`, an `icons/`
   folder, and a `dist/` folder.

   > ⚠️ **Don't** click "Source code (zip)" or "Source code (tar.gz)" —
   > those links are added automatically by GitHub to every release and
   > only contain the raw source code, not the built extension. Loading
   > that one gives a "Could not load background script" / "Could not
   > load manifest" error in Chrome, because the `dist/` folder the
   > extension needs isn't in it.
2. Open a new tab and go to `chrome://extensions`.
3. Turn on **Developer mode** — the toggle is in the top-right corner.
4. Click **Load unpacked**.
5. Select the folder you unzipped in step 1 (the one with `manifest.json`
   in it directly, not a subfolder).
6. Usage Monitor's icon appears in your extensions list. Click the puzzle
   piece icon in Chrome's toolbar and **pin it** so it's always visible —
   pinned, the badge shows your highest usage percentage in real time
   (color-coded green/orange/red) without needing to open the popup at all.

That's it — click the icon any time to check your Claude.ai usage. By
default it only checks when you open it; if you'd rather it check
automatically in the background every 5 minutes, turn that on in the
extension's options page under **Advanced**.

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

## Troubleshooting

**"Failed to load extension" / "Could not load background script ''." /
"Could not load manifest."** — this means the folder you selected doesn't
have a `dist/` folder in it. The almost-certain cause is downloading
GitHub's automatic "Source code (zip)" link instead of the actual release
asset (see the warning in step 1 above) — its folder is named something
like `ai-usage-monitor-0.3.0` rather than `usage-monitor-v0.3.0`. Delete
that folder, go back to the
[latest release](https://github.com/darkanon6/ai-usage-monitor/releases/latest),
and download `usage-monitor-vX.Y.Z.zip` from **Assets** instead.
