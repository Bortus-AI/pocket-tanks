// Texture keys are stable and created lazily. A match with hundreds of weapons
// should not allocate another icon texture on every turn or selection.
export const weaponIconTexture = (scene, weapon) => {
    const key = `arsenal-icon-${weapon.id}`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, weapon.logoCanvas);
    return key;
};

export const fitWeaponName = (text, availableWidth, maxSize = 18, minSize = 11) => {
    text.setWordWrapWidth?.(0);
    text.setFontSize(maxSize);
    if (text.width > availableWidth) {
        text.setFontSize(Math.max(minSize, Math.floor(maxSize * availableWidth / text.width)));
    }
    if (text.width > availableWidth) text.setWordWrapWidth?.(availableWidth, true);
    return text;
};
