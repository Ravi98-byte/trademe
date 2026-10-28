# TradeMe 0.4.1

- Adds **View full PDF · charts & layout** to imported PDF source details.
- Opens the preserved original PDF inside TradeMe at the selected physical page, including its charts, diagrams, images, and layout.
- Keeps searchable extracted text separate from the visual original. Existing imported PDFs need no re-import.
- Checks original-file integrity before opening. The PDF window has no application bridge or Node access; sandboxing stays enabled, external network requests and new windows are blocked.
- Adds a real desktop test that opens a two-page chart PDF, checks the selected page and preview security settings, and verifies rendered chart pixels. This runs in development and packaged Windows release checks.

This improves viewing, not AI understanding. Chart interpretation, OCR, and an AI engine are not implemented yet. If you need to see charts before updating, use the existing **Open original file** button to open your system PDF reader.

Export a backup before upgrading. This release is unsigned and the full Windows installer upgrade cycle still needs testing on the user's laptop.
