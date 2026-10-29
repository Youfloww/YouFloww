# Study Desk credits

Libraries (already in package.json, loaded only when a file of that kind is opened):
- **pdf.js** (`pdfjs-dist`), Mozilla: Apache-2.0. PDF rendering and the selectable text layer. The text-layer CSS in
  `studydesk.css` is a trimmed copy of `pdfjs-dist/web/pdf_viewer.css` (Apache-2.0).
- **docx-preview**, Volodymyr Baydalka: Apache-2.0. Word (.docx) rendering.
- **pptx-preview**: ISC. PowerPoint (.pptx) rendering. Its README allows free personal and commercial use of the npm package.
- **JSZip**: dual MIT / GPL-3.0; used under MIT. Reads .pptx/.docx parts for slide sizes, the simple slide view and thumbnails.
- **idb-keyval**, Jake Archibald: Apache-2.0. Recent files in IndexedDB.

Art: the cat is the app's own sprite strips (`public/img/cat`). The desk hero (books, mug, plant) is drawn with CSS and emoji;
no new image files.
