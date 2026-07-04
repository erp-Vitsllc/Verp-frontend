export function resolveAssetPrimaryPhoto(asset) {
    if (!asset) return null;
    return asset.imagePreview || asset.photo || asset.assetPhoto || null;
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
