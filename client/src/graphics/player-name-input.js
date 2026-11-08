// Native text entry is required for phone keyboards, paste, selection and IME.
// Phaser positions/scales the element with the canvas; the browser edits text.
export const PLAYER_NAME_LIMIT = 15;
export const normalizePlayerName = value => String(value ?? '')
    .replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, PLAYER_NAME_LIMIT);

export const createPlayerNameInput = (scene, x, y, initialValue, {label='Player name'} = {}) => {
    const fallback = normalizePlayerName(initialValue).trim() || 'Player';
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'playerName';
    input.className = 'player-name-input';
    input.setAttribute('aria-label', label);
    input.setAttribute('autocomplete', 'nickname');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('enterkeyhint', 'done');
    input.setAttribute('inputmode', 'text');
    input.maxLength = PLAYER_NAME_LIMIT;
    input.spellcheck = false;
    input.value = fallback;
    input.placeholder = 'Tap to enter a name';
    Object.assign(input.style, {
        boxSizing:'border-box',width:'440px',height:'68px',padding:'10px 14px',
        border:'2px solid #6caaa0',borderRadius:'8px',outline:'none',
        color:'#f0ead8',background:'#17323d',font:'32px Arial, sans-serif',
        pointerEvents:'auto',touchAction:'manipulation',caretColor:'#f0c28d',
    });
    const dom = scene.add.dom(x, y, input).setOrigin(0, 0).setDepth(12);
    let keyboardWasEnabled = true;
    let focused = false;
    const keyboard = scene.input.keyboard;
    const sanitize = () => {
        const value = normalizePlayerName(input.value);
        if(value === input.value) return;
        const caret = input.selectionStart;
        input.value = value;
        if(caret !== null)input.setSelectionRange(Math.min(caret,value.length), Math.min(caret,value.length));
    };
    const onInput = event => { if(!event.isComposing)sanitize(); };
    const onCompositionEnd = () => sanitize();
    const onFocus = () => {
        if(focused)return;
        focused = true;
        keyboardWasEnabled = keyboard.enabled;
        keyboard.resetKeys?.();
        keyboard.enabled = false;
        input.style.borderColor = '#f0c28d';
    };
    const onBlur = () => {
        sanitize();
        input.value = input.value.trim() || fallback;
        if(focused){keyboard.resetKeys?.();keyboard.enabled = keyboardWasEnabled;focused=false;}
        input.style.borderColor = '#6caaa0';
    };
    const stop = event => event.stopPropagation();
    const onKeyDown = event => {
        event.stopPropagation();
        if(event.key === 'Enter' && !event.isComposing){event.preventDefault();input.blur();}
    };
    input.addEventListener('input',onInput);
    input.addEventListener('compositionend',onCompositionEnd);
    input.addEventListener('focus',onFocus);
    input.addEventListener('blur',onBlur);
    input.addEventListener('keydown',onKeyDown);
    input.addEventListener('keyup',stop);
    input.addEventListener('pointerdown',stop);
    let disposed = false;
    const destroy = () => {
        if(disposed)return;
        disposed = true;
        onBlur();
        input.removeEventListener('input',onInput);
        input.removeEventListener('compositionend',onCompositionEnd);
        input.removeEventListener('focus',onFocus);
        input.removeEventListener('blur',onBlur);
        input.removeEventListener('keydown',onKeyDown);
        input.removeEventListener('keyup',stop);
        input.removeEventListener('pointerdown',stop);
        scene.events.off('shutdown',destroy);
        dom.destroy();
    };
    scene.events.once('shutdown',destroy);
    return {
        get text(){return normalizePlayerName(input.value).trim() || fallback;},
        setText(value){input.value=normalizePlayerName(value);return this;},
        element:input,gameObject:dom,destroy,
    };
};
