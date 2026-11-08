// Fullscreen/orientation changes can update the parent after Phaser's resize
// event. Read the new parent bounds before fitting the canvas, then position
// native controls from that same fitted rectangle. Logical game size stays fixed.
export const installViewportResize = game => {
    let frame = 0, disposed = false;
    const viewport = window.visualViewport;
    const refresh = () => {
        frame = 0;
        if (disposed || !game.scale.parent) return;
        game.scale.getParentBounds();
        game.scale.refresh();
        game.scene.getScene('main-scene')?.HUD?.mobileAim?.refresh();
        game.fullscreenControl?.sync();
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(refresh); };
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    document.addEventListener('fullscreenchange', schedule);
    document.addEventListener('webkitfullscreenchange', schedule);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(game.scale.parent);
    const destroy = () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer?.disconnect();
        window.removeEventListener('resize', schedule);
        viewport?.removeEventListener('resize', schedule);
        document.removeEventListener('fullscreenchange', schedule);
        document.removeEventListener('webkitfullscreenchange', schedule);
    };
    game.events.once('destroy', destroy);
    schedule();
};
