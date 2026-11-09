// Shared cover-image contract for the Film/TV, Reading, and Games Google Sheets.
// Keep URLs as plain text in `Image URL`; IMAGE() cells are only sheet previews.
export function safeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch {
        return '';
    }
}

function escapeMarkup(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

export function createImageFieldReader(columns = []) {
    const indexes = new Map(columns.map((column, index) => [
        String(column.label || '').trim().toLowerCase(), index
    ]));
    return (cells = []) => {
        const value = name => cells[indexes.get(name)]?.v ?? '';
        return {
            imageUrl: safeImageUrl(value('image url')),
            imageFullUrl: safeImageUrl(value('image full url')),
            imageAlt: String(value('image alt')),
            imageSource: String(value('image source')),
            imageSourceUrl: safeImageUrl(value('image source url')),
            imageStatus: String(value('image status')),
            imageAttribution: String(value('image attribution')),
            imageLicense: String(value('image license')),
            imageLicenseUrl: safeImageUrl(value('image license url'))
        };
    };
}

export function renderCoverTitle(entry) {
    const imageUrl = safeImageUrl(entry.imageUrl);
    // The title is the accessible name; the cover and fallback are decorative.
    return `<button type="button" class="review-title-button" data-id="${escapeMarkup(entry.id)}">
        <span class="blog-cover" aria-hidden="true">
            <svg class="blog-cover-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" focusable="false"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m4 16 5-5 4 4 3-3 4 4"/><circle cx="15" cy="8" r="1.5"/></svg>
            ${imageUrl ? `<img class="blog-cover-image" src="${escapeMarkup(imageUrl)}" alt="" width="32" height="48" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}
        </span>
        <span class="blog-title-text">${escapeMarkup(entry.title)}</span>
    </button>`;
}

export function bindCoverFallbacks(container) {
    container.querySelectorAll('.blog-cover-image').forEach(image => {
        const showFallback = () => { image.hidden = true; };
        image.addEventListener('error', showFallback, { once: true });
        // Handle cached failures that occurred before the listener was attached.
        if (image.complete && image.naturalWidth === 0) showFallback();
    });
}

export function renderImageAttribution(entry) {
    if (!safeImageUrl(entry.imageUrl)) return '';
    const sourceName = String(entry.imageSource || '');
    const attribution = String(entry.imageAttribution || '');
    const sourceUrl = safeImageUrl(entry.imageSourceUrl);
    if (!sourceName && !sourceUrl && !attribution && !entry.imageLicense) return '';
    const label = escapeMarkup(sourceName || 'Image source');
    const source = sourceUrl
        ? `<a href="${escapeMarkup(sourceUrl)}" target="_blank" rel="noopener noreferrer">${label}<span class="blog-sr-only"> (opens in a new tab)</span></a>`
        : label;
    let licenseName = String(entry.imageLicense || '');
    let licenseUrl = safeImageUrl(entry.imageLicenseUrl);
    if (!licenseName && sourceName.trim().toLowerCase() === 'tvmaze') {
        licenseName = 'TVMaze data: CC BY-SA';
        licenseUrl = 'https://www.tvmaze.com/api#licensing';
    }
    const license = licenseName
        ? `<span class="blog-image-license">${licenseUrl ? `<a href="${escapeMarkup(licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeMarkup(licenseName)}<span class="blog-sr-only"> (opens in a new tab)</span></a>` : escapeMarkup(licenseName)}</span>`
        : '';
    const credit = attribution ? `<span class="blog-image-attribution">${escapeMarkup(attribution)}</span>` : '';
    return `<div class="modal-meta-item blog-image-credit"><span class="modal-meta-label">Cover source</span><span class="modal-meta-value">${source}</span>${credit}${license}</div>`;
}

// Full-size artwork is requested only after a thought is opened.
export function renderThoughtImage(entry) {
    const imageUrl = safeImageUrl(entry.imageFullUrl) || safeImageUrl(entry.imageUrl);
    if (!imageUrl) return '';
    const alt = entry.imageAlt || `Conceptual illustration for ${entry.thought || entry.title || 'this thought'}`;
    return `<img class="thought-modal-image" src="${escapeMarkup(imageUrl)}" alt="${escapeMarkup(alt)}" decoding="async" referrerpolicy="no-referrer"><figcaption>AI-generated conceptual illustration</figcaption>`;
}
