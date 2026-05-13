(function() {
  'use strict';

  var controlsReady = false;
  var hideControlsTimer;
  var HIDE_CONTROLS_DELAY = 4000;
  var current = { id: '', season: '', episode: '' };
  var captionsEnabled = false;
  var activeHls = null;

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
      '    <button id="captions" class="control-btn" type="button" aria-label="Toggle captions" aria-pressed="false"><i data-lucide="captions"></i></button>',
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

  function controlsVisible() {
    var player = document.getElementById('player');
    return !!(player && player.classList.contains('controls-visible'));
  }

  function showControls() {
    var player = document.getElementById('player');
    if (!player) return;

    player.classList.add('controls-visible');
    scheduleHideControls();
  }


  function getCaptionTracks() {
    var video = document.getElementById('v');
    if (!video || !video.textTracks) return [];

    return Array.prototype.slice.call(video.textTracks).filter(function(track) {
      return track.kind === 'subtitles' || track.kind === 'captions';
    });
  }

  function hasHlsCaptions() {
    return !!(activeHls && activeHls.subtitleTracks && activeHls.subtitleTracks.length);
  }

  function updateCaptionsButton() {
    var captions = document.getElementById('captions');
    if (!captions) return;

    var tracks = getCaptionTracks();
    var hasCaptions = tracks.length > 0 || hasHlsCaptions();
    captions.disabled = !hasCaptions;
    captions.classList.toggle('active', captionsEnabled && hasCaptions);
    captions.setAttribute('aria-pressed', captionsEnabled && hasCaptions ? 'true' : 'false');
    captions.setAttribute('title', hasCaptions ? 'Toggle captions' : 'No captions available');
  }

  function setCaptions(enabled) {
    var tracks = getCaptionTracks();
    var hasCaptions = tracks.length > 0 || hasHlsCaptions();
    captionsEnabled = enabled && hasCaptions;

    if (activeHls && activeHls.subtitleTracks) activeHls.subtitleTrack = captionsEnabled ? 0 : -1;
    tracks.forEach(function(track, index) {
      track.mode = captionsEnabled && index === 0 ? 'showing' : 'disabled';
    });
    updateCaptionsButton();
  }

  function toggleCaptions() {
    setCaptions(!captionsEnabled);
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
    var captions = document.getElementById('captions');
    var fullscreen = document.getElementById('fullscreen');

    function togglePlay() {
      if (video.paused) video.play().catch(function(){});
      else video.pause();
    }

    playToggle.addEventListener('click', togglePlay);
    centerPlay.addEventListener('click', togglePlay);
    video.addEventListener('click', function() {
      if (!controlsVisible()) {
        showControls();
        return;
      }

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
      setCaptions(captionsEnabled);
      updateCaptionsButton();
    });
    if (video.textTracks && video.textTracks.addEventListener) {
      video.textTracks.addEventListener('addtrack', updateCaptionsButton);
      video.textTracks.addEventListener('change', updateCaptionsButton);
    }

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

    captions.addEventListener('click', toggleCaptions);

    fullscreen.addEventListener('click', function() {
      if (document.fullscreenElement) document.exitFullscreen();
      else player.requestFullscreen().catch(function(){});
    });

    player.addEventListener('click', function() {
      showControls();
      scheduleHideControls();
    });
    player.addEventListener('mouseenter', showControls);
    player.addEventListener('mousemove', showControls);
    player.addEventListener('mouseleave', hideControls);
    player.addEventListener('touchstart', showControls, { passive: true });
    player.addEventListener('keydown', function(ev) {
      if (ev.key === ' ' || ev.key === 'k') { ev.preventDefault(); togglePlay(); }
      if (ev.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
      if (ev.key === 'ArrowRight') video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10);
    });
    player.tabIndex = 0;
    refreshIcons();
    updatePlayIcons();
    updateCaptionsButton();
    showControls();
  }

  function proxyStreamUrl(rawUrl, options) {
    if (options && options.proxy === false) return rawUrl;
    return (options && options.proxyPrefix ? options.proxyPrefix : '/api?url=') + encodeURIComponent(rawUrl);
  }

  function load(rawUrl, options) {
    options = options || {};
    current = options;

    var video = document.getElementById('v');
    if (!video) return Promise.reject(new Error('Video element #v not found'));

    var src = proxyStreamUrl(rawUrl, options);
    if (activeHls && activeHls.destroy) activeHls.destroy();
    activeHls = null;

    return new Promise(function(resolve, reject) {
      function ready() {
        init(options);
        if (typeof options.onReady === 'function') options.onReady(video);
        video.play().catch(function(){});
        resolve(video);
      }

      function fail(error) {
        if (typeof options.onError === 'function') options.onError(error.message || error);
        reject(error);
      }

      if (window.Hls && Hls.isSupported()) {
        activeHls = new Hls({ enableWorker: true });
        activeHls.loadSource(src);
        activeHls.attachMedia(video);
        activeHls.on(Hls.Events.MANIFEST_PARSED, ready);
        if (Hls.Events.SUBTITLE_TRACKS_UPDATED) {
          activeHls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, function() {
            setCaptions(captionsEnabled);
            updateCaptionsButton();
          });
        }
        activeHls.on(Hls.Events.ERROR, function(_, data) {
          if (data.fatal) fail(new Error(data.details || 'HLS fatal error'));
        });
      } else {
        video.src = src;
        video.addEventListener('canplay', ready, { once: true });
        video.addEventListener('error', function() {
          fail(new Error('Video playback error'));
        }, { once: true });
      }
    });
  }

  window.StreamPlayer = {
    init: init,
    load: load,
    setCaptions: setCaptions,
    showControls: showControls,
  };
})();
