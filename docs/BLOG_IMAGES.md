# Blog cover images

The Film/TV, Reading, and Games pages read their existing public Google Sheets every five minutes. Cover data is read by header name, so append these columns without moving the original review fields:

- `Image URL`: plain HTTPS image URL consumed by the website.
- `Image`: optional `IMAGE()` formula for a spreadsheet preview; not read by the website.
- `Image Source`: provider name, displayed in the review modal.
- `Image Source URL`: HTTPS link to the matching title/source page.
- `Image Status`: matching/review status, retained as metadata. Do not add an image URL until the title is confidently matched.
- `Image Attribution`: creator/required credit text, displayed in the review modal.
- `Image License`: license name or rights description, displayed in the modal.
- `Image License URL`: HTTPS license link, displayed with the license name.

The website does not search for artwork by itself. New spreadsheet rows need an `Image URL` populated by the image-enrichment workflow or an editor. Blank or broken images display a neutral placeholder. URLs must use HTTPS without embedded credentials; markup is escaped. Images load lazily, have fixed small dimensions, and do not send a referring-page header.

## Sources and rights

Link each image to its source. Source attribution is shown when opening the review. TVMaze-derived data also links to its CC BY-SA licensing information. Open Library allows cover hotlinks and encourages links back to its book pages. Wikipedia-hosted poster/cover rights vary and many posters are copyrighted editorial-use images, not freely licensed artwork. Source links are not a blanket rights clearance. Use only appropriately sourced, relevant artwork alongside its review and preserve any row-specific rights notes.

- https://www.tvmaze.com/api#licensing
- https://openlibrary.org/dev/docs/api/covers

## Validation

Run `node tests/blog-covers.test.cjs`, `node tests/lifting.test.cjs`, and `git diff --check`.

The cover regression suite checks named columns, URL filtering, escaping, lazy loading, missing and broken images, attribution, all three page integrations, search, modal open/close, stale fetch protection, and HTTP errors. Browser QA should additionally cover desktop and mobile widths, movie/TV switching, long titles, keyboard focus, Tab wrapping, Escape dismissal, and the live spreadsheet-to-image path.
