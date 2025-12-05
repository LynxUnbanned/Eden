const STORAGE_KEY = 'edenFestivalSchedule';
const TAG_STORAGE_KEY = 'edenFestivalTags';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const defaultSchedule = [
  {
    id: uuid(),
    day: 'Thursday',
    time: '2:00 PM',
    title: 'Emerging Voices Summit',
    description: 'Panel conversation with resident artists on collaborative practice and community impact.',
    tags: ['Talk', 'All Ages'],
  },
  {
    id: uuid(),
    day: 'Friday',
    time: '7:30 PM',
    title: 'Riverlight Night Walk',
    description: 'Guided tour of illuminated installations with live soundscapes by Eden composers.',
    tags: ['Installation', 'Accessible'],
  },
  {
    id: uuid(),
    day: 'Saturday',
    time: '11:00 AM',
    title: 'Family Print Lab',
    description: 'All-ages workshop with master printers. Limited capacity to keep the experience personal.',
    tags: ['Workshop', 'Kids'],
  },
];

const dedupeTags = (collection) => {
  const seen = new Set();
  const tags = [];
  collection.forEach((item) => {
    const normalised = String(item || '').trim().replace(/\s+/g, ' ');
    if (!normalised) return;
    const key = normalised.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(normalised);
  });
  return tags;
};

const sortTags = (tags) => tags.slice().sort((a, b) => a.localeCompare(b));

const defaultTags = sortTags(
  dedupeTags(defaultSchedule.flatMap((event) => (Array.isArray(event.tags) ? event.tags : [])))
);

const HALF_HOUR_TIMES = (() => {
  const times = [];
  const format = (h, m) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = ((h + 11) % 12) + 1;
    const minutes = m.toString().padStart(2, '0');
    return `${hour}:${minutes} ${period}`;
  };

  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      times.push(format(hour, minute));
    }
  }

  return times;
})();

const form = document.getElementById('event-form');
const formFields = {
  id: document.getElementById('event-id'),
  day: document.getElementById('event-day'),
  time: document.getElementById('event-time'),
  title: document.getElementById('event-title'),
  description: document.getElementById('event-description'),
  tags: document.getElementById('event-tags'),
};
const timeInput = formFields.time;
const timeMenu = document.querySelector('[data-time-menu]');
const tagMenu = document.querySelector('[data-tag-menu]');
const tagPrompt = document.getElementById('tag-prompt');
const tagPromptText = document.getElementById('tag-prompt-text');
const tagPromptAddBtn = document.getElementById('tag-prompt-add');
const tagPromptDismissBtn = document.getElementById('tag-prompt-dismiss');
const scheduleRows = document.getElementById('schedule-rows');
const exportBtn = document.getElementById('export-json');
const importBtn = document.getElementById('import-json');
const applyJsonBtn = document.getElementById('apply-json');
const copyJsonBtn = document.getElementById('copy-json');
const resetDefaultsBtn = document.getElementById('reset-defaults');
const resetFormBtn = document.getElementById('reset-form');
const downloadBtn = document.getElementById('download-json');
const jsonOutput = document.getElementById('json-output');

let availableTimes = [...HALF_HOUR_TIMES];
let tagStorePrimed = false;

function loadSharedTags() {
  try {
    const raw = localStorage.getItem(TAG_STORAGE_KEY);
    if (!raw) {
      const initial = sortTags([...defaultTags]);
      try {
        localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(initial));
        tagStorePrimed = true;
      } catch (storageError) {
        console.warn('Unable to persist default shared tags.', storageError);
      }
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      const fallback = sortTags([...defaultTags]);
      try {
        localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(fallback));
        tagStorePrimed = true;
      } catch (storageError) {
        console.warn('Unable to persist fallback shared tags.', storageError);
      }
      return fallback;
    }
    tagStorePrimed = true;
    return sortTags(dedupeTags(parsed));
  } catch (error) {
    console.error('Unable to parse stored tags, falling back to defaults.', error);
    try {
      localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(defaultTags));
    } catch (storageError) {
      console.warn('Unable to persist default shared tags after parse failure.', storageError);
    }
    return [...defaultTags];
  }
}

let sharedTags = loadSharedTags();
let sharedTagKeys = new Set(sharedTags.map((tag) => tag.toLowerCase()));
let dismissedTagKey = null;
let tagPromptTimer = null;

const parseTags = (value) =>
  String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const stringifyTags = (tags) => (Array.isArray(tags) ? tags.join(', ') : '');

const normaliseEvent = (event) => ({
  id: event.id || uuid(),
  day: event.day?.trim() || 'TBA',
  time: event.time?.trim() || 'TBA',
  title: event.title?.trim() || 'Untitled Event',
  description: event.description?.trim() || 'Details forthcoming.',
  tags: dedupeTags(Array.isArray(event.tags) ? event.tags : parseTags(event.tags)),
});

const clearTagPromptTimer = () => {
  if (tagPromptTimer) {
    clearTimeout(tagPromptTimer);
    tagPromptTimer = null;
  }
};

const hideTagPrompt = () => {
  if (!tagPrompt) return;
  tagPrompt.hidden = true;
  if (tagPromptText) {
    tagPromptText.textContent = '';
  }
  delete tagPrompt.dataset.tagCandidate;
};

const showTagPrompt = (candidate) => {
  if (!tagPrompt || !tagPromptText) return;
  tagPromptText.textContent = `Add "${candidate}" to shared tags for everyone?`;
  tagPrompt.hidden = false;
  tagPrompt.dataset.tagCandidate = candidate;
};

const persistSharedTags = () => {
  try {
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(sharedTags));
    tagStorePrimed = true;
  } catch (error) {
    console.error('Unable to persist shared tags.', error);
  }
};

const updateSharedTags = (nextTags, { persist = true } = {}) => {
  const next = sortTags(dedupeTags(Array.isArray(nextTags) ? nextTags : []));
  const changed =
    next.length !== sharedTags.length || next.some((tag, index) => tag !== sharedTags[index]);

  sharedTags = next;
  sharedTagKeys = new Set(sharedTags.map((tag) => tag.toLowerCase()));

  if (persist && (changed || !tagStorePrimed)) {
    persistSharedTags();
  }

  return changed;
};

function addSharedTags(tags, { persist = true } = {}) {
  if (!Array.isArray(tags) || !tags.length) {
    return false;
  }

  const seen = new Set(sharedTagKeys);
  const next = [...sharedTags];
  let changed = false;

  tags.forEach((tag) => {
    const normalised = String(tag || '').trim().replace(/\s+/g, ' ');
    if (!normalised) return;
    const key = normalised.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    next.push(normalised);
    changed = true;
  });

  if (!changed) {
    return false;
  }

  return updateSharedTags(next, { persist });
}

function removeSharedTag(tag, { persist = true } = {}) {
  const key = String(tag || '').trim().toLowerCase();
  if (!key || !sharedTagKeys.has(key)) {
    return false;
  }
  const next = sharedTags.filter((existing) => existing.toLowerCase() !== key);
  return updateSharedTags(next, { persist });
}

function renameSharedTag(oldTag, newTag, { persist = true } = {}) {
  const oldKey = String(oldTag || '').trim().toLowerCase();
  if (!oldKey || !sharedTagKeys.has(oldKey)) {
    return false;
  }

  const normalised = String(newTag || '').trim().replace(/\s+/g, ' ');
  if (!normalised) {
    return removeSharedTag(oldTag, { persist });
  }

  const newKey = normalised.toLowerCase();
  if (newKey === oldKey) {
    return false;
  }

  if (sharedTagKeys.has(newKey)) {
    return false;
  }

  const next = sharedTags.map((tag) => (tag.toLowerCase() === oldKey ? normalised : tag));
  return updateSharedTags(next, { persist });
}

const applyTagChangeToForm = (oldTag, replacement) => {
  if (!formFields.tags) return;
  const oldKey = String(oldTag || '').trim().toLowerCase();
  if (!oldKey) return;

  const tags = parseTags(formFields.tags.value);
  if (!tags.length) return;

  const normalisedReplacement = replacement
    ? String(replacement || '').trim().replace(/\s+/g, ' ')
    : '';
  const replacementKey = normalisedReplacement.toLowerCase();
  const seen = new Set();
  const updated = [];
  let changed = false;

  tags.forEach((tag) => {
    const key = tag.toLowerCase();
    if (key === oldKey) {
      changed = true;
      if (normalisedReplacement && !seen.has(replacementKey)) {
        updated.push(normalisedReplacement);
        seen.add(replacementKey);
      }
      return;
    }
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    updated.push(tag);
  });

  if (changed) {
    formFields.tags.value = stringifyTags(updated);
  }
  syncTagChipSelection();
};

const getSelectedTagKeys = () => {
  if (!formFields.tags) return new Set();
  return new Set(parseTags(formFields.tags.value).map((tag) => tag.toLowerCase()));
};

const syncTagChipSelection = () => {
  if (!tagMenu) return;
  const selectedKeys = getSelectedTagKeys();
  tagMenu.querySelectorAll('[data-tag-suggestion]').forEach((chip) => {
    const value = chip.dataset.tagSuggestion;
    if (!value) return;
    chip.classList.toggle('tag-chip--selected', selectedKeys.has(value.toLowerCase()));
  });
};

const evaluateTagPrompt = () => {
  if (!tagPrompt || !formFields.tags) return;
  clearTagPromptTimer();
  hideTagPrompt();

  tagPromptTimer = setTimeout(() => {
    tagPromptTimer = null;
    const rawValue = String(formFields.tags.value || '');
    const segments = rawValue.split(',').map((segment) => segment.trim());
    let candidate = '';
    let candidateIndex = -1;

    for (let i = segments.length - 1; i >= 0; i -= 1) {
      if (segments[i]) {
        candidate = segments[i].replace(/\s+/g, ' ');
        candidateIndex = i;
        break;
      }
    }

    if (!candidate) {
      hideTagPrompt();
      return;
    }

    const candidateKey = candidate.toLowerCase();
    if (dismissedTagKey && candidateKey !== dismissedTagKey) {
      dismissedTagKey = null;
    }
    if (candidateKey === dismissedTagKey) {
      hideTagPrompt();
      return;
    }

    if (sharedTagKeys.has(candidateKey)) {
      hideTagPrompt();
      return;
    }

    const previousSegments = segments.slice(0, candidateIndex).filter(Boolean);
    if (previousSegments.some((segment) => segment.toLowerCase() === candidateKey)) {
      hideTagPrompt();
      return;
    }

    if (candidate.length < 2) {
      hideTagPrompt();
      return;
    }

    showTagPrompt(candidate);
  }, 350);
};

const handleTagPromptAdd = () => {
  if (!tagPrompt || !formFields.tags) return;
  const candidate = tagPrompt.dataset.tagCandidate;
  const normalised = String(candidate || '').trim().replace(/\s+/g, ' ');
  if (!normalised) {
    hideTagPrompt();
    return;
  }

  addSharedTags([normalised]);
  const tags = parseTags(formFields.tags.value);
  if (tags.length) {
    tags[tags.length - 1] = normalised;
    formFields.tags.value = stringifyTags(tags);
  } else {
    formFields.tags.value = normalised;
  }
  dismissedTagKey = null;
  hideTagPrompt();
  updatePrefillOptions(getStoredSchedule());
  formFields.tags.focus();
};

const handleTagPromptDismiss = () => {
  if (!tagPrompt) return;
  const candidate = tagPrompt.dataset.tagCandidate;
  dismissedTagKey = candidate ? candidate.toLowerCase() : null;
  hideTagPrompt();
};

const getStoredSchedule = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSchedule.map(normaliseEvent);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultSchedule.map(normaliseEvent);
    }
    return parsed.map(normaliseEvent);
  } catch (error) {
    console.error('Unable to parse stored schedule, falling back to defaults.', error);
    return defaultSchedule.map(normaliseEvent);
  }
};

const refreshTimeOptions = (query = '', { openMenu = false } = {}) => {
  if (!timeMenu) return;
  const trimmed = String(query || '').trim().toLowerCase();
  const options = availableTimes
    .filter((time) => !trimmed || time.toLowerCase().includes(trimmed))
    .slice(0, 50);

  if (options.length) {
    timeMenu.innerHTML = options
      .map((time) => `<button type="button" class="time-option" data-time-option="${time}">${time}</button>`)
      .join('');
    timeMenu.dataset.hasOptions = 'true';
  } else {
    timeMenu.innerHTML = '<p class="time-menu__hint">No saved start times yet. Keep typing to use your custom time.</p>';
    timeMenu.dataset.hasOptions = 'false';
  }

  timeMenu.hidden = !openMenu;
};

const hideTimeMenu = () => {
  if (timeMenu) {
    timeMenu.hidden = true;
  }
};

const updatePrefillOptions = (events) => {
  const timesFromEvents = events.map((event) => event.time).filter(Boolean);
  availableTimes = Array.from(new Set([...HALF_HOUR_TIMES, ...timesFromEvents])).sort((a, b) => a.localeCompare(b));
  refreshTimeOptions(timeInput ? timeInput.value : '');

  if (!tagMenu) return;

  if (!sharedTags.length) {
    tagMenu.innerHTML = '<p class="admin__hint">No shared tags yet. Add tags to make them available here.</p>';
    tagMenu.dataset.hasTags = 'false';
    tagMenu.hidden = true;
    return;
  }

  const selectedKeys = getSelectedTagKeys();

  tagMenu.innerHTML = `
    <p class="tag-menu__title">Shared tags</p>
    <div class="tag-menu__chips">
      ${sharedTags
        .map((tag) => {
          const key = tag.toLowerCase();
          const chipClass = selectedKeys.has(key) ? 'tag-chip tag-chip--selected' : 'tag-chip';
          return `<button type="button" class="${chipClass}" data-tag-suggestion="${tag}">${tag}</button>`;
        })
        .join('')}
    </div>
  `;
  tagMenu.dataset.hasTags = 'true';
  syncTagChipSelection();
};

const renderTable = (data) => {
  const fragment = document.createDocumentFragment();

  if (!data.length) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'No events scheduled yet. Add your first event above.';
    cell.className = 'admin__hint';
    emptyRow.appendChild(cell);
    fragment.appendChild(emptyRow);
  } else {
    data
      .slice()
      .sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time))
      .forEach((event) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${event.day}</td>
          <td>${event.time}</td>
          <td>
            <strong>${event.title}</strong>
            <p class="admin__hint">${event.description}</p>
          </td>
          <td>${stringifyTags(event.tags)}</td>
          <td class="admin-table__actions">
            <button type="button" data-action="edit" data-id="${event.id}">Edit</button>
            <button type="button" data-action="delete" data-id="${event.id}">Delete</button>
          </td>
        `;
        fragment.appendChild(row);
      });
  }

  scheduleRows.replaceChildren(fragment);
};

const setStoredSchedule = (data) => {
  const normalised = data.map(normaliseEvent);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalised));
  } catch (error) {
    console.error('Unable to persist schedule to storage.', error);
  }
  renderTable(normalised);
  if (jsonOutput) {
    jsonOutput.value = JSON.stringify(normalised, null, 2);
  }
  addSharedTags(
    normalised.flatMap((event) => (Array.isArray(event.tags) ? event.tags : []))
  );
  updatePrefillOptions(normalised);
};

function updateTagInSchedule(tag, replacement) {
  const targetKey = String(tag || '').trim().toLowerCase();
  if (!targetKey) {
    return false;
  }

  const schedule = getStoredSchedule();
  if (!schedule.length) {
    return false;
  }

  const normalisedReplacement = replacement
    ? String(replacement || '').trim().replace(/\s+/g, ' ')
    : '';
  const replacementKey = normalisedReplacement.toLowerCase();

  let changed = false;

  const updated = schedule.map((event) => {
    const tags = Array.isArray(event.tags) ? [...event.tags] : [];
    const filtered = tags.filter((existing) => existing.toLowerCase() !== targetKey);
    if (filtered.length === tags.length) {
      return event;
    }

    changed = true;

    if (normalisedReplacement && !filtered.map((existing) => existing.toLowerCase()).includes(replacementKey)) {
      filtered.push(normalisedReplacement);
    }

    return { ...event, tags: filtered };
  });

  if (changed) {
    setStoredSchedule(updated);
  }

  return changed;
}

const loadEventIntoForm = (event) => {
  formFields.id.value = event.id;
  formFields.day.value = event.day;
  formFields.title.value = event.title;
  formFields.description.value = event.description;
  formFields.tags.value = stringifyTags(event.tags);
  syncTagChipSelection();
  formFields.time.value = event.time;
  refreshTimeOptions(event.time);
  hideTimeMenu();
  hideTagPrompt();
  dismissedTagKey = null;
  formFields.day.focus();
};

const clearForm = () => {
  if (!form) return;
  form.reset();
  formFields.id.value = '';
  syncTagChipSelection();
  refreshTimeOptions('');
  hideTimeMenu();
  hideTagPrompt();
  dismissedTagKey = null;
  if (tagMenu) {
    tagMenu.hidden = true;
  }
  formFields.day.focus();
};

const handleFormSubmit = (event) => {
  event.preventDefault();
  const schedule = [...getStoredSchedule()];

  const timeValue = formFields.time.value.trim();
  const newEvent = normaliseEvent({
    id: formFields.id.value || uuid(),
    day: formFields.day.value,
    time: timeValue,
    title: formFields.title.value,
    description: formFields.description.value,
    tags: parseTags(formFields.tags.value),
  });

  if (!newEvent.day || !newEvent.time || !newEvent.title || !newEvent.description) {
    alert('Day, time, title, and description are required.');
    return;
  }

  const existingIndex = schedule.findIndex((item) => item.id === newEvent.id);
  if (existingIndex >= 0) {
    schedule[existingIndex] = newEvent;
  } else {
    schedule.push(newEvent);
  }

  setStoredSchedule(schedule);
  clearForm();
};

const handleTableClick = (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const action = button.dataset.action;
  const eventId = button.dataset.id;
  if (!eventId) return;

  const schedule = getStoredSchedule();
  const scheduleEvent = schedule.find((item) => item.id === eventId);
  if (!scheduleEvent) return;

  if (action === 'edit') {
    loadEventIntoForm(scheduleEvent);
  }

  if (action === 'delete' && confirm(`Remove "${scheduleEvent.title}" from the schedule?`)) {
    const updated = schedule.filter((item) => item.id !== eventId);
    setStoredSchedule(updated);
  }
};

const exportSchedule = () => {
  const schedule = getStoredSchedule();
  if (jsonOutput) {
    jsonOutput.value = JSON.stringify(schedule, null, 2);
    jsonOutput.focus();
    jsonOutput.select();
  }
};

const copySchedule = async () => {
  if (!jsonOutput) return;
  if (!jsonOutput.value) {
    exportSchedule();
  }
  try {
    await navigator.clipboard.writeText(jsonOutput.value);
    alert('Schedule JSON copied to clipboard.');
  } catch (error) {
    console.error('Clipboard error', error);
    alert('Unable to copy. Please select the text and copy manually.');
  }
};

const importSchedule = () => {
  exportSchedule();
  alert('Paste JSON into the field below, make your changes, then click Apply JSON.');
};

const applyJson = () => {
  if (!jsonOutput || !jsonOutput.value.trim()) {
    alert('Paste JSON into the field before applying.');
    return;
  }

  try {
    const parsed = JSON.parse(jsonOutput.value);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON must describe an array of events.');
    }
    const normalised = parsed.map(normaliseEvent);
    setStoredSchedule(normalised);
    alert('Schedule updated from JSON.');
  } catch (error) {
    console.error('Invalid JSON', error);
    alert(`Could not apply JSON: ${error.message}`);
  }
};

const resetToDefaults = () => {
  if (confirm('Reset schedule to default events? This cannot be undone.')) {
    setStoredSchedule([...defaultSchedule]);
    clearForm();
  }
};

const downloadJson = () => {
  const blob = new Blob([JSON.stringify(getStoredSchedule(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'eden-festival-schedule.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

if (form) {
  form.addEventListener('submit', handleFormSubmit);
}
if (scheduleRows) {
  scheduleRows.addEventListener('click', handleTableClick);
}
if (resetFormBtn) {
  resetFormBtn.addEventListener('click', clearForm);
}
if (resetDefaultsBtn) {
  resetDefaultsBtn.addEventListener('click', resetToDefaults);
}
if (exportBtn) {
  exportBtn.addEventListener('click', exportSchedule);
}
if (importBtn) {
  importBtn.addEventListener('click', importSchedule);
}
if (applyJsonBtn) {
  applyJsonBtn.addEventListener('click', applyJson);
}
if (copyJsonBtn) {
  copyJsonBtn.addEventListener('click', copySchedule);
}
if (downloadBtn) {
  downloadBtn.addEventListener('click', downloadJson);
}
if (tagPromptAddBtn) {
  tagPromptAddBtn.addEventListener('click', handleTagPromptAdd);
}
if (tagPromptDismissBtn) {
  tagPromptDismissBtn.addEventListener('click', handleTagPromptDismiss);
}

if (tagMenu) {
  const showTagMenu = () => {
    if (tagMenu.dataset.hasTags === 'true') {
      tagMenu.hidden = false;
    }
  };

  if (formFields.tags) {
    formFields.tags.addEventListener('focus', showTagMenu);
    formFields.tags.addEventListener('click', showTagMenu);
    formFields.tags.addEventListener('input', () => {
      evaluateTagPrompt();
      syncTagChipSelection();
    });
    formFields.tags.addEventListener('blur', () => {
      clearTagPromptTimer();
      hideTagPrompt();
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target === formFields.tags || tagMenu.contains(event.target)) {
      return;
    }
    tagMenu.hidden = true;
  });

  tagMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tag-suggestion]');
    if (!button) return;
    const value = button.dataset.tagSuggestion;
    if (!value || !formFields.tags) return;
    const existing = parseTags(formFields.tags.value);
    if (!existing.map((tag) => tag.toLowerCase()).includes(value.toLowerCase())) {
      existing.push(value);
      formFields.tags.value = stringifyTags(existing);
    }
    syncTagChipSelection();
    clearTagPromptTimer();
    hideTagPrompt();
    dismissedTagKey = null;
    formFields.tags.focus();
  });

  tagMenu.addEventListener('contextmenu', (event) => {
    const button = event.target.closest('[data-tag-suggestion]');
    if (!button) return;
    event.preventDefault();

    const currentTag = button.dataset.tagSuggestion;
    if (!currentTag) return;

    const nextValue = window.prompt(
      'Edit tag label (leave blank to remove it for everyone).',
      currentTag
    );

    if (nextValue === null) {
      return;
    }

    const trimmed = nextValue.trim();
    if (!trimmed) {
      if (!window.confirm(`Remove "${currentTag}" from shared tags and all events?`)) {
        return;
      }
      const listChanged = removeSharedTag(currentTag);
      const scheduleChanged = updateTagInSchedule(currentTag, null);
      applyTagChangeToForm(currentTag, null);
      if (!scheduleChanged) {
        updatePrefillOptions(getStoredSchedule());
      }
      return;
    }

    const normalised = trimmed.replace(/\s+/g, ' ');
    const nextKey = normalised.toLowerCase();
    if (nextKey === currentTag.toLowerCase()) {
      applyTagChangeToForm(currentTag, normalised);
      return;
    }

    if (sharedTagKeys.has(nextKey)) {
      alert('A shared tag with that name already exists.');
      return;
    }

    const listChanged = renameSharedTag(currentTag, normalised);
    const scheduleChanged = updateTagInSchedule(currentTag, normalised);
    applyTagChangeToForm(currentTag, normalised);
    if (!scheduleChanged) {
      updatePrefillOptions(getStoredSchedule());
    }
  });
} else if (formFields.tags) {
  formFields.tags.addEventListener('input', () => {
    evaluateTagPrompt();
    syncTagChipSelection();
  });
  formFields.tags.addEventListener('blur', () => {
    clearTagPromptTimer();
    hideTagPrompt();
  });
}

if (timeInput && timeMenu) {
  const openTimeMenu = () => {
    refreshTimeOptions(timeInput.value, { openMenu: true });
  };

  timeInput.addEventListener('focus', openTimeMenu);
  timeInput.addEventListener('input', () => {
    refreshTimeOptions(timeInput.value, { openMenu: true });
  });
  timeInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      const firstOption = timeMenu.querySelector('[data-time-option]');
      if (firstOption) {
        event.preventDefault();
        timeMenu.hidden = false;
        firstOption.focus();
      }
    }
    if (event.key === 'Escape') {
      hideTimeMenu();
    }
  });

  timeMenu.addEventListener('click', (event) => {
    const option = event.target.closest('[data-time-option]');
    if (!option) return;
    const value = option.dataset.timeOption || option.textContent;
    if (value) {
      timeInput.value = value;
    }
    hideTimeMenu();
    timeInput.focus();
  });

  timeMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideTimeMenu();
      timeInput.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target === timeInput || timeMenu.contains(event.target)) {
      return;
    }
    hideTimeMenu();
  });
} else if (timeInput) {
  timeInput.addEventListener('input', () => {
    refreshTimeOptions(timeInput.value);
  });
}

if (formFields.day) {
  formFields.day.addEventListener('change', () => {
    const selectedDay = formFields.day.value.trim();
    if (!selectedDay) return;
    const match = getStoredSchedule().find((event) => event.day === selectedDay);
    if (match && match.time) {
      formFields.time.value = match.time;
      refreshTimeOptions(match.time);
      hideTimeMenu();
    }
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === TAG_STORAGE_KEY) {
    sharedTags = loadSharedTags();
    sharedTagKeys = new Set(sharedTags.map((tag) => tag.toLowerCase()));
    updatePrefillOptions(getStoredSchedule());
  }

  if (event.key === STORAGE_KEY) {
    const schedule = getStoredSchedule();
    renderTable(schedule);
    if (jsonOutput) {
      jsonOutput.value = JSON.stringify(schedule, null, 2);
    }
    updatePrefillOptions(schedule);
  }
});

const initialSchedule = getStoredSchedule();
if (!tagStorePrimed) {
  addSharedTags(initialSchedule.flatMap((event) => event.tags || []));
}
renderTable(initialSchedule);
if (jsonOutput) {
  jsonOutput.value = JSON.stringify(initialSchedule, null, 2);
}
updatePrefillOptions(initialSchedule);

