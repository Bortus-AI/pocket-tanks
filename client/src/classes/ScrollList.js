import { socket } from '../socket';
import { weaponArray } from '../weapons/array';
import { fitWeaponName, weaponIconTexture } from '../weapons/expansion/presentation';

export class ScrollList {
    constructor(scene, selected, selectedDisplay, weaponLogo) {
        Object.assign(this, {scene, selected, selectedDisplay, weaponLogo});
        this.scrollBox = null;
        this.scrollBackground = null;
        this.scrollList = null;
        this.tileHeight = 40;
        this.tileWidth = 0;
        this.visible = false;
        this.toShow = false;
        this.toHide = false;
        this.activeItem = null;
        this.weapons = [];
        this.rows = [];
        this.offset = 0;
        this.drag = null;
        this.skipRelease = false;
    }

    create = () => {
        this.tileWidth = this.scrollBackground.width;
        this.x = this.scrollBackground.parentContainer.x + this.scrollBackground.x;
        this.y = this.scrollBackground.parentContainer.y + this.scrollBackground.y;
        this.scrollList = this.scene.add.group();
        this.maskGraphics = this.scene.make.graphics({x: 0, y: 0, add: false});
        this.maskGraphics.fillRect(this.x - this.tileWidth / 2, this.y - this.scrollBackground.height / 2, this.tileWidth, this.scrollBackground.height);
        this.mask = this.maskGraphics.createGeometryMask();
        const poolSize = Math.ceil(this.scrollBackground.height / this.tileHeight) + 2;
        for (let index = 0; index < poolSize; index++) {
            const row = this.scene.add.container(this.x, this.y).setDepth(32).setMask(this.mask);
            const icon = this.scene.add.image(-this.tileWidth / 2 + 6, 0, weaponIconTexture(this.scene, weaponArray[0])).setOrigin(0, .5);
            const text = this.scene.add.text(-this.tileWidth / 2 + this.tileHeight, 0, '', {fontFamily: 'Arial', fontSize: 17, color: '#d4e0d2'}).setOrigin(0, .5);
            row.add([icon, text]);
            Object.assign(row, {weaponIcon: icon, weaponText: text, weaponIndex: -1});
            this.scrollList.add(row);
            this.rows.push(row);
        }

        this.openHandler = () => {
            if (this.scene.HUD.mouseLocked || !this.weapons.length) return;
            this.scene.HUD.mouseLocked = true;
            this.scene.hideTurnPointer();
            this.scene.sound.play('click', {volume: .3});
            this.skipRelease = true;
            this.offset = this.clampOffset((this.currentTank()?.selectedWeapon || 0) * this.tileHeight);
            this.show();
        };
        this.selectedDisplay.setInteractive().on('pointerdown', this.openHandler);
        this.pointerDown = pointer => {
            if (!this.visible) return;
            this.drag = {startY: pointer.y, offset: this.offset, distance: 0};
        };
        this.pointerMove = pointer => {
            if (!this.visible || !this.drag || !pointer.isDown) return;
            const delta = pointer.y - this.drag.startY;
            this.drag.distance = Math.max(this.drag.distance, Math.abs(delta));
            this.offset = this.clampOffset(this.drag.offset - delta);
            this.renderRows();
        };
        this.pointerUp = pointer => {
            if (!this.visible) return;
            if (this.skipRelease) { this.skipRelease = false; this.drag = null; return; }
            const inside = pointer.x >= this.x - this.tileWidth / 2 && pointer.x <= this.x + this.tileWidth / 2
                && pointer.y >= this.y - this.scrollBackground.height / 2 && pointer.y <= this.y + this.scrollBackground.height / 2;
            if (!this.drag || this.drag.distance < 6) {
                if (inside) {
                    const index = Math.round((pointer.y - this.y + this.offset) / this.tileHeight);
                    if (index >= 0 && index < this.weapons.length) this.setActive(index);
                }
                this.hide();
            }
            this.drag = null;
        };
        this.wheel = (pointer, objects, dx, dy) => {
            if (!this.visible) return;
            this.offset = this.clampOffset(this.offset + dy * .45);
            this.renderRows();
        };
        this.opponentChange = ({index}) => {
            if(this.scene.sceneData.gameType!==3)return
            const tank = this.currentTank();
            if (tank?.active && tank === this.scene.tank2) this.setActive(index);
        };
        this.scene.input.on('pointerdown', this.pointerDown);
        this.scene.input.on('pointermove', this.pointerMove);
        this.scene.input.on('pointerup', this.pointerUp);
        this.scene.input.on('wheel', this.wheel);
        socket.on('opponentWeaponChange', this.opponentChange);
        this.scene.events.once('shutdown', this.destroy);
        this.hide();
    }

    currentTank = () => this.scene.activeTank === 2 ? this.scene.tank2 : this.scene.tank1;
    clampOffset = offset => Math.max(0, Math.min(offset, Math.max(0, this.weapons.length - 1) * this.tileHeight));

    setActive = index => {
        const tank = this.currentTank();
        const item = tank?.weapons?.[index];
        if (!item || !weaponArray[item.id]) {
            if (!tank?.weapons?.length) { this.selected.setText('No weapons'); this.weaponLogo.setVisible(false); }
            return;
        }
        tank.selectedWeapon = index;
        this.selected.setText(item.name);
        fitWeaponName(this.selected, this.selected.getData('maxWidth') || 145, this.scene.game.device.os.desktop ? 18 : 24);
        this.weaponLogo.setTexture(weaponIconTexture(this.scene, weaponArray[item.id])).setVisible(true);
        this.weaponLogo.setDisplaySize(this.tileHeight * .72, this.tileHeight * .72);
        this.activeItem = index;
        if (this.scene.sceneData.gameType === 3 && tank === this.scene.tank1 && tank.active) socket.emit('weaponChange', {index});
        this.renderRows();
    }

    reset = tank => {
        this.weapons = tank.weapons;
        this.offset = this.clampOffset((tank.selectedWeapon || 0) * this.tileHeight);
        this.hide();
        this.setActive(tank.selectedWeapon);
        this.renderRows();
    }

    renderRows = () => {
        const first = Math.max(0, Math.floor((this.offset - this.scrollBackground.height / 2) / this.tileHeight) - 1);
        this.rows.forEach((row, poolIndex) => {
            const index = first + poolIndex;
            const weapon = this.weapons[index];
            if (!weapon) { row.setVisible(false); row.weaponIndex = -1; return; }
            row.setPosition(this.x, this.y + index * this.tileHeight - this.offset).setVisible(this.visible);
            row.weaponIndex = index;
            row.weaponIcon.setTexture(weaponIconTexture(this.scene, weaponArray[weapon.id])).setDisplaySize(this.tileHeight * .72, this.tileHeight * .72);
            row.weaponText.setText(weapon.name).setColor(index === this.currentTank()?.selectedWeapon ? '#f4ce9c' : '#c8dcd1');
            fitWeaponName(row.weaponText, this.tileWidth - this.tileHeight - 10, this.scene.game.device.os.desktop ? 17 : 23);
        });
    }

    hide = () => {
        this.visible = false;
        this.scrollList?.setVisible(false);
        this.scrollBox?.setVisible(false);
        this.scrollBackground?.setVisible(false);
        this.drag = null;
        if (this.scene.HUD) this.scene.HUD.mouseLocked = false;
    }

    show = () => {
        this.visible = true;
        this.scrollBox.setVisible(true);
        this.scrollBackground.setVisible(true);
        this.renderRows();
    }

    update = () => {
        if (this.toHide) { this.hide(); this.toHide = false; }
        if (this.toShow) { this.show(); this.toShow = false; }
    }

    destroy = () => {
        socket.off('opponentWeaponChange', this.opponentChange);
        this.scene.input.off('pointerdown', this.pointerDown);
        this.scene.input.off('pointermove', this.pointerMove);
        this.scene.input.off('pointerup', this.pointerUp);
        this.scene.input.off('wheel', this.wheel);
        this.mask?.destroy();
        this.maskGraphics?.destroy();
        this.rows = [];
    }
}
