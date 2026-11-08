import { weaponArray } from '../array';
import { installArsenal, weaponDetails } from './browser';
import { fitWeaponName, weaponIconTexture } from './presentation';

// Draft rows remain in their existing containers, so online arrayIndex and pick
// messages stay unchanged. Mouse hover and the first touch both reveal tactics.
export const attachDraftPreview = (scene, pickableArray) => {
    if (!scene.draftWeaponPreview) {
        installArsenal(scene, {x: scene.renderer.width - 180, y: 50});
        const panel = scene.add.rectangle(scene.renderer.width / 2, 641, 1110, 65, 0x102a34, .98).setStrokeStyle(1, 0x54736e).setDepth(11);
        const text = scene.add.text(57, 616, 'Inspect a weapon to see its effect and risk before drafting it.', {
            fontFamily: 'Arial', fontSize: 14, color: '#c5dacf', wordWrap: {width: 1080}, lineSpacing: 3
        }).setDepth(12);
        scene.draftWeaponPreview = {panel, text};
        scene.events.once('shutdown', () => { scene.draftWeaponPreview = null; });
    }
    pickableArray.forEach(pickable => {
        if (pickable.getData('draftPreviewAttached')) return;
        pickable.setData('draftPreviewAttached', true);
        const weapon = weaponArray[pickable.weaponIndex];
        if (!weapon) return;
        const text = pickable.list.find(child => child.type === 'Text');
        if (text) fitWeaponName(text, 210, 18, 11);
        const image = pickable.list.find(child => child.type === 'Image');
        if (image) image.setTexture(weaponIconTexture(scene, weapon)).setDisplaySize(25, 25);
        const preview = () => {
            const details = weaponDetails(weapon);
            scene.draftWeaponPreview?.text.setText(`${weapon.name} · ${details.category} · ${details.origin}\n${details.description}  Risk: ${details.warning}`);
        };
        pickable.rect.on('pointerover', preview);
        pickable.rect.on('pointerdown', preview);
    });
};
