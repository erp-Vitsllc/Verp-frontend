export function resolveAssetPrimaryPhoto(asset) {
    if (!asset) return null;
    const galleryFirst =
        Array.isArray(asset.images) && asset.images.length
            ? asset.images[0]?.url || asset.images[0]
            : null;
    return asset.imagePreview || asset.photo || asset.assetPhoto || galleryFirst || null;
}

export function buildAssetGalleryImages(asset) {
    const mainUrl = resolveAssetPrimaryPhoto(asset);
    const galleryImages = Array.isArray(asset?.images) ? asset.images : [];
    const mainEntry = mainUrl
        ? [{ _id: '__main__', url: mainUrl, caption: 'Main photo', date: asset.createdAt }]
        : [];
    const extraImages = galleryImages.filter((img) => !mainUrl || img?.url !== mainUrl);
    return [...mainEntry, ...extraImages];
}
