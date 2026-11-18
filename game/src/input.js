// Keyboard + mouse input. Keys are tracked by code; the mouse position is
// kept in screen space and converted to a world aim point by the game.
export function makeInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0, mouseY: 0,
    mouseDown: false,
    clicked: false,      // set true for one frame after a click
    anyKey: false,
    down(code) { return keys.has(code); },
  };

  const onKeyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.anyKey = true;
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  const onMouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  };
  const onMouseDown = (e) => {
    if (e.button === 0) { input.mouseDown = true; input.clicked = true; }
  };
  const onMouseUp = (e) => { if (e.button === 0) input.mouseDown = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  input.endFrame = () => { input.clicked = false; input.anyKey = false; };
  return input;
}
