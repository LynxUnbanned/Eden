(function () {
  const root = document.documentElement;
  root.classList.add('js-enabled');

  const yearTarget = document.querySelector('[data-year]');
  if (yearTarget) {
    yearTarget.textContent = String(new Date().getFullYear());
  }

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const heroVideo = document.querySelector('[data-hero-video]');
  if (heroVideo instanceof HTMLVideoElement) {
    heroVideo.muted = true;
    heroVideo.defaultMuted = true;

    const playSilently = () => {
      const playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          heroVideo.controls = true;
        });
      }
    };

    if (prefersReducedMotion) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.removeAttribute('loop');
      heroVideo.pause();
      heroVideo.controls = true;
    } else if (heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      playSilently();
    } else {
      heroVideo.addEventListener('loadeddata', playSilently, { once: true });
    }
  }

  const scheduleDefaults = [
    {
      id: 'emerging-voices',
      day: 'Thursday',
      time: '2:00 PM',
      title: 'Emerging Voices Summit',
      description: 'Panel conversation with resident artists on collaborative practice and community impact.',
      tags: ['Talk', 'All Ages'],
    },
    {
      id: 'riverlight-walk',
      day: 'Friday',
      time: '7:30 PM',
      title: 'Riverlight Night Walk',
      description: 'Guided tour of illuminated installations with live soundscapes by Eden composers.',
      tags: ['Installation', 'Accessible'],
    },
    {
      id: 'family-print-lab',
      day: 'Saturday',
      time: '11:00 AM',
      title: 'Family Print Lab',
      description: 'All-ages workshop with master printers. Limited capacity to keep the experience personal.',
      tags: ['Workshop', 'Kids'],
    },
  ];

  const scheduleList = document.querySelector('[data-schedule-list]');
  const scheduleEmpty = document.querySelector('[data-schedule-empty]');
  const STORAGE_KEY = 'edenFestivalSchedule';

  const parseTags = (tags) => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.filter(Boolean);
    return String(tags)
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const normaliseEvent = (event) => ({
    id: event.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    day: event.day ? String(event.day).trim() : 'TBA',
    time: event.time ? String(event.time).trim() : 'TBA',
    title: event.title ? String(event.title).trim() : 'Untitled Event',
    description: event.description ? String(event.description).trim() : 'Details forthcoming.',
    tags: parseTags(event.tags),
  });

  const renderTags = (tags) => {
    if (!tags.length) {
      return '';
    }
    const items = tags.map((tag) => `<li>${tag}</li>`).join('');
    return `<ul class="schedule-card__tags" aria-label="Session tags">${items}</ul>`;
  };

  const renderSchedule = (data) => {
    if (!scheduleList) return;

    const events = data
      .slice()
      .sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time));

    if (!events.length) {
      scheduleList.innerHTML = '';
      if (scheduleEmpty) {
        scheduleEmpty.hidden = false;
      }
      return;
    }

    const fragment = document.createDocumentFragment();

    events.forEach((event) => {
      const card = document.createElement('article');
      card.className = 'schedule-card reveal';
      card.setAttribute('role', 'listitem');
      card.innerHTML = `
        <header>
          <p class="schedule-card__day">${event.day}</p>
          <p class="schedule-card__time">${event.time}</p>
        </header>
        <div class="schedule-card__body">
          <h3>${event.title}</h3>
          <p>${event.description}</p>
        </div>
        ${renderTags(event.tags)}
      `;
      fragment.appendChild(card);
    });

    scheduleList.innerHTML = '';
    scheduleList.appendChild(fragment);
    scheduleList.setAttribute('role', 'list');
    if (scheduleEmpty) {
      scheduleEmpty.hidden = true;
    }
  };

  const loadSchedule = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return scheduleDefaults.map(normaliseEvent);
    }

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return scheduleDefaults.map(normaliseEvent);
      }
      return parsed.map(normaliseEvent);
    } catch (error) {
      console.error('Unable to parse stored schedule. Using defaults.', error);
      return scheduleDefaults.map(normaliseEvent);
    }
  };

  renderSchedule(loadSchedule());

  const setupReveal = () => {
    const revealElements = document.querySelectorAll('.reveal');
    if (!revealElements.length) return;

    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.25,
      });

      revealElements.forEach((element) => {
        observer.observe(element);
      });
    } else {
      revealElements.forEach((element) => {
        element.classList.add('is-visible');
      });
    }
  };

  setupReveal();

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      renderSchedule(loadSchedule());
      setupReveal();
    }
  });
})();
