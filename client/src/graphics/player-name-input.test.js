import { EventEmitter } from 'events';
import { createPlayerNameInput, normalizePlayerName, PLAYER_NAME_LIMIT } from './player-name-input';
const fixture = enabled => {
    const scene={input:{keyboard:{enabled,resetKeys:jest.fn()}},events:new EventEmitter(),add:{dom:jest.fn((x,y,node)=>{
        document.body.append(node);
        return {setOrigin(){return this;},setDepth(){return this;},destroy:jest.fn(()=>node.remove())};
    })}};
    return {scene,field:createPlayerNameInput(scene,600,194,'DefaultName',{label:'Player 1 name'})};
};
afterEach(()=>document.body.replaceChildren());
test('native field exposes a visible accessible name, nickname hints and an editing limit',()=>{
    const {field}=fixture(true);expect(field.element.tagName).toBe('INPUT');expect(field.element.getAttribute('aria-label')).toBe('Player 1 name');
    expect(field.element.maxLength).toBe(PLAYER_NAME_LIMIT);expect(field.element.autocomplete).toBe('nickname');expect(field.text).toBe('DefaultName');
});
test('focus suspends game key capture and Enter blurs/restores keyboard',()=>{
    const {scene,field}=fixture(true);field.element.focus();expect(scene.input.keyboard.enabled).toBe(false);
    const windowKey=jest.fn();window.addEventListener('keydown',windowKey);
    field.element.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));expect(windowKey).not.toHaveBeenCalled();
    field.element.value='Phone Pilot';field.element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    expect(document.activeElement).not.toBe(field.element);expect(scene.input.keyboard.enabled).toBe(true);expect(field.text).toBe('Phone Pilot');window.removeEventListener('keydown',windowKey);
});
test('native input sanitizes pasted values, preserves Unicode names and falls back when blank',()=>{
    const {field}=fixture(true);field.element.value='Éowyn 7<script>';field.element.dispatchEvent(new Event('input',{bubbles:true}));
    expect(field.text).toBe('Éowyn 7script');expect(normalizePlayerName('a'.repeat(30))).toHaveLength(15);
    field.element.value='   ';expect(field.text).toBe('DefaultName');field.setText('New_Name-7');expect(field.text).toBe('New_Name-7');
});
test('shutdown removes the input and restores the previous keyboard state',()=>{
    const {scene,field}=fixture(false);field.element.focus();scene.events.emit('shutdown');expect(scene.input.keyboard.enabled).toBe(false);
    expect(field.gameObject.destroy).toHaveBeenCalledTimes(1);expect(document.querySelector('.player-name-input')).toBe(null);
    field.destroy();expect(field.gameObject.destroy).toHaveBeenCalledTimes(1);
});

test('IME composition is left intact until the committed text is available',()=>{
    const {field}=fixture(true);field.element.value='玩家!';
    field.element.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
    expect(field.element.value).toBe('玩家!');
    field.element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
    expect(field.element.value).toBe('玩家');
});
