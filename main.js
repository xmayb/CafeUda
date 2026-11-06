// === Загрузка данных: переводы + меню, параллельно ===
// Promise.all запускает оба fetch ОДНОВРЕМЕННО, не по очереди —
// не ждём переводы, чтобы только потом начать грузить меню.
// .then(([a, b]) => ...) — деструктуризация массива результатов в порядке, как они были переданы в Promise.all
Promise.all([
  fetch('translations.json').then(res => res.json()),
  fetch('menu.json').then(res => res.json())
]).then(([translationsData, menuData]) => {
  window.translations = translationsData;
  window.menuData = menuData;

  const startLang = localStorage.getItem('lang') || 'pl';
  setLanguage(startLang);
  updateLangButtonLabel(startLang);
  renderMenu(startLang);
});

function getCurrentLang() {
  return localStorage.getItem('lang') || 'pl';
}

function setLanguage(lang) {
  if (!window.translations || !window.translations[lang]) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (window.translations[lang][key]) el.innerHTML = window.translations[lang][key];
  });
  document.documentElement.lang = lang;
  localStorage.setItem('lang', lang);
}

function updateLangButtonLabel(lang) {
  const labels = { pl: 'PL', en: 'EN', ru: 'RU' };
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = labels[lang];
}

const languageCycle = ['pl', 'en', 'ru'];

function nextLanguage() {
  const current = getCurrentLang();
  const currentIndex = languageCycle.indexOf(current);
  const nextIndex = (currentIndex + 1) % languageCycle.length;
  const next = languageCycle[nextIndex];
  setLanguage(next);
  updateLangButtonLabel(next);
  renderMenu(next); // язык переключился — перерисовываем и меню тоже, не только статичный текст
}

// "28 pozycji" / "28 items" / "28 позиций" — с правильным склонением через Intl.PluralRules
const ITEM_WORDS = {
  pl: { one: 'pozycja', few: 'pozycje', many: 'pozycji', other: 'pozycji' },
  en: { one: 'item', other: 'items' },
  ru: { one: 'позиция', few: 'позиции', many: 'позиций', other: 'позиции' }
};
function itemsLabel(n, lang) {
  const words = ITEM_WORDS[lang] || ITEM_WORDS.pl;
  const form = new Intl.PluralRules(lang).select(n);
  return `${n} ${words[form] || words.other}`;
}
function formatPrice(price, lang) {
  if (price === 0) return { pl: 'gratis', en: 'free', ru: 'бесплатно' }[lang] || 'gratis';
  return `${price} zł`;
}

// === Рендер карточек категорий меню из menu.json ===
function renderMenu(lang) {
  const container = document.getElementById('menu-grid');
  if (!container || !window.menuData) return;
  container.innerHTML = '';

  window.menuData.categories.forEach(category => {
    const totalItems = category.subcategories.reduce((sum, sub) => sum + sub.items.length, 0);
    const card = document.createElement('div');
    card.className = 'reveal relative bg-card rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl transition-all duration-300';
    card.innerHTML = `
  <button type="button" onclick="openCategoryModal('${category.id}')" aria-label="${category.name[lang]}" class="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"></button>
  <div class="w-full h-40 rounded-xl mb-4 overflow-hidden">
    <img src="${category.image}" alt="${category.name[lang]}" class="w-full h-full object-cover">
  </div>
  <h3 class="font-display text-xl mb-2">${category.name[lang]}</h3>
  <p class="text-sm text-ink/60">${itemsLabel(totalItems, lang)}</p>
`;
    container.appendChild(card);
    revealObserver.observe(card); // новая карточка тоже должна получить scroll-reveal анимацию
  });
}

// === Рендер содержимого модалки по клику на категорию ===
function openCategoryModal(categoryId) {
  const category = window.menuData.categories.find(c => c.id === categoryId);
  const lang = getCurrentLang();
  const modalBody = document.getElementById('category-modal-body');

  const nonEmptySubcats = category.subcategories.filter(sub => sub.items.length > 0);

  modalBody.innerHTML = `
    <h3 class="font-display text-2xl text-ink mb-6">${category.name[lang]}</h3>
    ${nonEmptySubcats.map(sub => `
      <div class="mb-6">
        <p class="font-eyebrow text-xs tracking-[0.2em] text-celadon uppercase mb-3">${sub.name[lang]}</p>
        ${sub.items.map(item => `
          <div class="bg-paper rounded-xl p-4 mb-3">
            <div class="flex justify-between items-start gap-3">
            
              <p class="font-medium text-ink">${item.name[lang]}</p>
              <span class="font-eyebrow text-amber-ink whitespace-nowrap text-sm">${formatPrice(item.price, lang)}</span>
            </div>
            ${item.desc[lang] ? `<p class="text-sm text-ink/60 mt-1">${item.desc[lang]}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;

  const modal = document.getElementById('category-modal');
  modal.showModal();
  modal.scrollTop = 0; // каждая категория открывается с начала списка
  lockPageScroll();
}

// === Блокировка прокрутки страницы под открытой модалкой ===
// overflow:hidden на body не спасает в iOS Safari — страница всё равно тянется пальцем.
// Надёжный способ: зафиксировать body на месте (position:fixed) и запомнить, где был скролл,
// а при закрытии вернуть всё как было и прокрутить обратно в ту же точку.
let lockedScrollY = null;

function lockPageScroll() {
  if (lockedScrollY !== null) return;
  lockedScrollY = window.scrollY;
  document.documentElement.classList.add('modal-open');
  const scrollbar = window.innerWidth - document.documentElement.clientWidth; // чтобы страница не "прыгала" на ПК, когда исчезает полоса прокрутки
  Object.assign(document.body.style, {
    position: 'fixed', top: `-${lockedScrollY}px`, left: '0', right: '0',
    width: '100%', paddingRight: scrollbar ? `${scrollbar}px` : ''
  });
}

function unlockPageScroll() {
  if (lockedScrollY === null) return;
  const y = lockedScrollY;
  lockedScrollY = null;
  document.documentElement.classList.remove('modal-open');
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '', width: '', paddingRight: '' });
  document.documentElement.style.scrollBehavior = 'auto'; // иначе html{scroll-behavior:smooth} будет "доезжать" до места
  window.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = '';
}

{
  const modal = document.getElementById('category-modal');
  // 'close' срабатывает при любом закрытии: крестик, Esc, кнопка «назад» на Android
  modal.addEventListener('close', unlockPageScroll);
  // Тап по затемнённому фону вокруг окна тоже закрывает его
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  // Третья линия защиты (Safari на iPhone, Samsung Internet, Firefox):
  // жесты и колесо вне списка блюд глушим вручную, а у самого списка не даём
  // прокрутке "перетечь" на страницу, когда он докручен до верха или до низа.
  let touchY = 0;
  const atEdge = (dy) => {
    const max = modal.scrollHeight - modal.clientHeight;
    return max <= 0 || (dy < 0 && modal.scrollTop <= 0) || (dy > 0 && modal.scrollTop >= max - 1);
  };
  document.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (lockedScrollY === null) return;
    const dy = touchY - e.touches[0].clientY; // > 0 — палец идёт вверх, список листается вниз
    touchY = e.touches[0].clientY;
    if (!modal.contains(e.target) || e.target === modal || atEdge(dy)) e.preventDefault();
  }, { passive: false });
  document.addEventListener('wheel', e => {
    if (lockedScrollY === null) return;
    if (!modal.contains(e.target) || e.target === modal || atEdge(e.deltaY)) e.preventDefault();
  }, { passive: false });
}

// === Мобильное меню ===
function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}
function closeMobileMenu() {
  document.getElementById('mobile-menu').classList.add('hidden');
}

// === Sticky nav + steep-bar ===
const nav = document.getElementById('site-nav');
const steepBar = document.getElementById('steep-bar');

function onScroll() {
  if (lockedScrollY !== null) return; // пока страница заблокирована, scrollY = 0 — не сбрасываем полосу и шапку
  if (window.scrollY > 80) {
    nav.classList.add('bg-paper/90', 'backdrop-blur-sm', 'shadow-sm');
  } else {
    nav.classList.remove('bg-paper/90', 'backdrop-blur-sm', 'shadow-sm');
  }
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  steepBar.style.width = percent + '%';
}
window.addEventListener('scroll', onScroll);
onScroll();

// === Scroll-reveal ===
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));