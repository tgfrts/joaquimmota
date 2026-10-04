/** Attach the desktop source only when visible, so phones never fetch the video. */
export function bindDesktopHeroVideo(video: HTMLVideoElement) {
  const desktop = window.matchMedia('(min-width: 768px)');
  const source = video.dataset.desktopVideo;
  if (!source) return;
  const update = () => {
    if (desktop.matches) {
      if (video.hasAttribute('src')) return;
      video.muted = true;
      video.src = source;
      video.load();
      void video.play().catch(() => {});
    } else if (video.hasAttribute('src')) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
  desktop.addEventListener('change', update);
  update();
}
