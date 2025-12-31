# WhatsApp Snippet Manager Extension

## Load unpacked in Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `extension/` folder in this repository.
5. Click the Snippet Manager icon in the toolbar to manage snippets.

## How to use

1. Add a snippet trigger (for example, `;addr`) and the text you want to insert.
2. Open WhatsApp Web and click into the message composer.
3. Type your trigger and press **Space** or **Enter**.

## Known limitations & troubleshooting

- This extension only runs on `https://web.whatsapp.com/` and ignores other sites.
- WhatsApp Web can change its DOM structure. If triggers stop expanding, reload the extension and refresh the page.
- Make sure the cursor is inside the message composer (not the search box or another input).
- If sync storage is unavailable, the extension falls back to `chrome.storage.local`.
