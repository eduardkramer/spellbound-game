(() => {
  const hotbar = document.getElementById('hotbar');
  const sceneView = document.getElementById('scene-view');

  function alignDialogue() {
    const hotbarTop = hotbar.getBoundingClientRect().top;
    const bottom = Math.max(0, window.innerHeight - Math.max(100, hotbarTop));
    document.documentElement.style.setProperty('--hotbar-bottom', `${bottom}px`);
  }

  const observer = new ResizeObserver(alignDialogue);
  observer.observe(sceneView);
  observer.observe(hotbar);
  window.addEventListener('resize', alignDialogue);
  window.addEventListener('scroll', alignDialogue, { passive: true });
  alignDialogue();
})();
