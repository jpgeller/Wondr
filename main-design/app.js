// Standalone visual prototype. Generation uses fixed sample places.
const form = document.querySelector('form');
const button = document.querySelector('.generate');
const error = document.querySelector('#form-error');
const results = document.querySelector('.results');
const status = document.querySelector('.status');
const dialog = document.querySelector('dialog');
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
document.querySelector('#date').value = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');

const places = [
  { name: 'Mission Dolores Park', hint: 'Comfortable shoes', image: 'park.jpg', alt: 'People on a grassy hillside in San Francisco', description: 'An easy walk and some time outside, with a view across the city.', address: 'Dolores Street & 19th Street', url: 'https://www.google.com/maps/search/?api=1&query=Mission+Dolores+Park+San+Francisco', travel: '12 min walk · 0.6 mi' },
  { name: 'Souvla, Valencia Street', hint: 'Casual clothes', image: 'restaurant.jpg', alt: 'A softly lit restaurant interior', description: 'A relaxed lunch stop. Take your time and try something new.', address: '758 Valencia Street', url: 'https://www.souvla.com/location/the-mission/', travel: '8 min drive · 1.8 mi' },
  { name: 'Alamo Square Park', hint: 'Bring a light layer', image: 'chess.jpg', alt: 'Chess pieces on a board', description: 'An afternoon in the park. Bring a chessboard and leave some time to look around.', address: 'Steiner Street & Hayes Street', url: 'https://www.google.com/maps/search/?api=1&query=Alamo+Square+Park+San+Francisco' },
];
let slots = [];
const minutes = value => value.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
const time = value => `${Math.floor(value / 60) % 12 || 12}:${String(value % 60).padStart(2, '0')} ${value < 720 ? 'am' : 'pm'}`;

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  const values = Object.fromEntries(new FormData(form));
  const start = minutes(values.start), span = minutes(values.end) - start;
  if (!values.location.trim() || span < 180) {
    error.textContent = !values.location.trim() ? 'Enter a location.' : 'Choose at least three hours, ending after the start time.';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  button.disabled = true;
  button.textContent = 'Generating…';
  results.setAttribute('aria-busy', 'true');
  status.textContent = 'Generating a sample plan.';
  await new Promise(resolve => setTimeout(resolve, 900));

  slots = [[0, .22], [.32, .53], [.68, 1]].map(range => range.map(fraction => start + Math.floor(span * fraction / 5) * 5));
  document.querySelector('#result-date').textContent = new Date(`${values.date}T12:00:00`).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
  document.querySelector('#result-location').textContent = values.location.trim();
  document.querySelector('#stops').innerHTML = places.map((place, index) => `
    <button class="stop" type="button" data-stop="${index}" aria-label="Reveal stop ${index + 1}, ${time(slots[index][0])} to ${time(slots[index][1])}">
      <span class="stop-time">${time(slots[index][0])} – ${time(slots[index][1])}</span>
      <span class="stop-arrow" aria-hidden="true">↗</span>
      <span class="stop-hint">${place.hint}</span>
    </button>
    ${place.travel ? `<p class="travel">${place.travel}</p>` : ''}
  `).join('');
  results.hidden = false;
  results.setAttribute('aria-busy', 'false');
  button.disabled = false;
  button.innerHTML = 'Generate again <span aria-hidden="true">↗</span>';
  status.textContent = 'Sample plan ready. Three stops. Open a stop to see the place.';
  if (matchMedia('(max-width: 760px)').matches) results.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
});

document.querySelector('#stops').addEventListener('click', event => {
  const trigger = event.target.closest('[data-stop]');
  if (!trigger) return;
  const index = Number(trigger.dataset.stop), place = places[index];
  document.querySelector('#place-name').textContent = place.name;
  document.querySelector('#place-time').textContent = `${time(slots[index][0])} – ${time(slots[index][1])}`;
  document.querySelector('#place-description').textContent = place.description;
  document.querySelector('#place-address').textContent = place.address;
  document.querySelector('#place-link').href = place.url;
  document.querySelector('#place-image').src = `assets/${place.image}`;
  document.querySelector('#place-image').alt = place.alt;
  dialog.showModal();
});
document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
