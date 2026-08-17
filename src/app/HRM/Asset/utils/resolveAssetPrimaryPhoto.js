function pickCategoryPhoto(asset) {
    const category = asset?.categoryId;
    if (category && typeof category === 'object') {
        return category.imagePreview || category.photo || null;
    }
    return null;
}

export function resolveAssetPrimaryPhoto(asset) {
    if (!asset) return null;
    const categoryPhoto = pickCategoryPhoto(asset);
    if (categoryPhoto) return categoryPhoto;
    const galleryFirst =
        Array.isArray(asset.images) && asset.images.length
            ? asset.images[0]?.url || asset.images[0]
            : null;
    return asset.imagePreview || asset.photo || asset.assetPhoto || galleryFirst || null;
}

export function buildAssetGalleryImages(asset) {
    const galleryImages = Array.isArray(asset?.images) ? asset.images : [];
    return galleryImages.filter((img) => img && (img.url || typeof img === 'string'));
}
