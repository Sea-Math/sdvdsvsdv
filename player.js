(function() {
  'use strict';

  var controlsReady = false;
  var hideControlsTimer;
  var HIDE_CONTROLS_DELAY = 4000;
  var pointerHovering = false;
  var current = { id: '', season: '', episode: '' };

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return mins + ':' + String(secs).padStart(2, '0');
  }

  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  function setIcon(el, name) {
    el.innerHTML = '<i data-lucide="' + name + '"></i>';
    refreshIcons();
  }

  function ensureOverlay(player) {
    if (document.getElementById('overlay')) return;

    player.insertAdjacentHTML('beforeend', [
      '<div id="overlay" aria-label="Video controls">',
      '  <button id="center-play" type="button" aria-label="Play or pause"><i data-lucide="play"></i></button>',
      '  <input id="progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek">',
      '  <div id="controls">',
      '    <button id="play-toggle" class="control-btn" type="button" aria-label="Play"><i data-lucide="play"></i></button>',
      '    <button id="back" class="control-btn" type="button" aria-label="Back 10 seconds"><i data-lucide="rotate-ccw"></i></button>',
      '    <button id="forward" class="control-btn" type="button" aria-label="Forward 10 seconds"><i data-lucide="rotate-cw"></i></button>',
      '    <div id="volume-wrap">',
      '      <button id="mute" class="control-btn" type="button" aria-label="Mute"><i data-lucide="volume-2"></i></button>',
      '      <input id="volume" type="range" min="0" max="1" value="1" step="0.05" aria-label="Volume">',
      '    </div>',
      '    <span id="time">0:00</span>',
      '    <div id="spacer"></div>',
      '    <button id="next-episode" class="control-btn" type="button" aria-label="Next episode"><i data-lucide="skip-forward"></i><span>Next Episode</span></button>',
      '    <button id="fullscreen" class="control-btn" type="button" aria-label="Fullscreen"><i data-lucide="maximize"></i></button>',
      '  </div>',
      '</div>',
    ].join(''));
  }

  function hideControls() {
    var player = document.getElementById('player');
    if (!player) return;

    player.classList.remove('controls-visible');
  }

  function scheduleHideControls() {
    clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(hideControls, HIDE_CONTROLS_DELAY);
  }

  function showControls() {
    var player = document.getElementById('player');
    if (!player) return;

    player.classList.add('controls-visible');
    if (pointerHovering) clearTimeout(hideControlsTimer);
    else scheduleHideControls();
  }

  function updatePlayIcons() {
    var video = document.getElementById('v');
    var playToggle = document.getElementById('play-toggle');
    var centerPlay = document.getElementById('center-play');
    if (!video || !playToggle || !centerPlay) return;

    var icon = video.paused ? 'play' : 'pause';
    setIcon(playToggle, icon);
    setIcon(centerPlay, icon);
    playToggle.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
    centerPlay.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
  }

  function init(options) {
    current = options || current;

    var player = document.getElementById('player');
    var video = document.getElementById('v');
    if (!player || !video) return;

    ensureOverlay(player);
    player.classList.add('controls-visible');
    scheduleHideControls();

    var nextEpisode = document.getElementById('next-episode');
    if (current.season) nextEpisode.classList.add('show');
    else nextEpisode.classList.remove('show');

    if (controlsReady) {
      refreshIcons();
      showControls();
      return;
    }
    controlsReady = true;

    var playToggle = document.getElementById('play-toggle');
    var centerPlay = document.getElementById('center-play');
    var progress = document.getElementById('progress');
    var time = document.getElementById('time');
    var mute = document.getElementById('mute');
    var volume = document.getElementById('volume');
    var fullscreen = document.getElementById('fullscreen');

    function togglePlay() {
      if (video.paused) video.play().catch(function(){});
      else video.pause();
    }

    playToggle.addEventListener('click', togglePlay);
    centerPlay.addEventListener('click', togglePlay);
    video.addEventListener('click', function() {
      showControls();
      togglePlay();
    });
    document.getElementById('back').addEventListener('click', function() {
      video.currentTime = Math.max(0, video.currentTime - 10);
    });
    document.getElementById('forward').addEventListener('click', function() {
      video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10);
    });

    video.addEventListener('play', updatePlayIcons);
    video.addEventListener('pause', updatePlayIcons);
    video.addEventListener('timeupdate', function() {
      progress.value = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      time.textContent = formatTime(video.currentTime);
    });
    video.addEventListener('loadedmetadata', function() {
      time.textContent = formatTime(video.currentTime);
    });

    progress.addEventListener('input', function() {
      if (video.duration) video.currentTime = (Number(progress.value) / 100) * video.duration;
    });

    mute.addEventListener('click', function() {
      video.muted = !video.muted;
      setIcon(mute, video.muted || video.volume === 0 ? 'volume-x' : 'volume-2');
    });
    volume.addEventListener('input', function() {
      video.volume = Number(volume.value);
      video.muted = video.volume === 0;
      setIcon(mute, video.muted ? 'volume-x' : 'volume-2');
    });

    nextEpisode.addEventListener('click', function() {
      if (!current.season) return;
      var next = Number(current.episode || '1') + 1;
      location.href = location.pathname + '?id=' + encodeURIComponent(current.id) + '&s=' + encodeURIComponent(current.season) + '&e=' + next;
    });

    fullscreen.addEventListener('click', function() {
      if (document.fullscreenElement) document.exitFullscreen();
      else player.requestFullscreen().catch(function(){});
    });

    player.addEventListener('click', function() {
      showControls();
      scheduleHideControls();
    });
    player.addEventListener('mouseenter', function() {
      pointerHovering = true;
      showControls();
    });
    player.addEventListener('mousemove', function() {
      pointerHovering = true;
      showControls();
    });
    player.addEventListener('mouseleave', function() {
      pointerHovering = false;
      scheduleHideControls();
    });
    player.addEventListener('touchstart', function() {
      pointerHovering = false;
      showControls();
      scheduleHideControls();
    }, { passive: true });
    player.addEventListener('keydown', function(ev) {
      if (ev.key === ' ' || ev.key === 'k') { ev.preventDefault(); togglePlay(); }
      if (ev.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
      if (ev.key === 'ArrowRight') video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10);
    });
    player.tabIndex = 0;
    refreshIcons();
    updatePlayIcons();
    showControls();
  }

  window.StreamPlayer = {
    init: init,
    showControls: showControls,
  };
})();
