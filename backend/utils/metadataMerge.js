// Catalog matches are discovery hints. They must not replace reviewed bylines,
// transcript provenance or other metadata established from a publication page.
function protectedMetadata(entry = {}) {
  return entry.bylineVerified === true || Boolean(entry.verification) ||
    (Array.isArray(entry.authors) && entry.metadataSource !== 'catalog-match') || Boolean(entry.interview) || Boolean(entry.sourceType);
}
function mergeCatalogMetadata(prior, candidate) {
  if (protectedMetadata(prior)) return { ...prior };
  const output = { ...prior };
  for (const [key, value] of Object.entries(candidate)) {
    if (value !== undefined && value !== null && value !== '') output[key] = value;
  }
  return output;
}
function mergePublicationMetadata(prior = {}, candidate) {
  const output = { ...prior, ...candidate };
  if (protectedMetadata(prior) && candidate.dateVerified !== true && Object.hasOwn(prior, 'date')) {
    output.date = prior.date;
    if (Object.hasOwn(prior, 'dateVerified')) output.dateVerified = prior.dateVerified;
    else delete output.dateVerified;
  }
  if (protectedMetadata(prior) && !candidate.bylineVerified) {
    for (const key of ['title', 'url', 'date', 'eventDate', 'authors', 'author', 'bylineVerified', 'metadataSource', 'verification', 'metadataReview']) {
      if (Object.hasOwn(prior, key)) output[key] = prior[key];
    }
  } else if (candidate.bylineVerified && prior.verification && !candidate.verification) {
    // An old saved-text hash cannot certify newly fetched article text.
    delete output.verification;
  }
  return output;
}
module.exports = { protectedMetadata, mergeCatalogMetadata, mergePublicationMetadata };
