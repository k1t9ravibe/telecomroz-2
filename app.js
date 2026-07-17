const $ = (selector) => document.querySelector(selector);
const modal = $('#modal');
const toast = $('#toast');
const titles = { dashboard: 'Доброе утро, Тест Тестович', purchases: 'Заявки', documents: 'Документы', analytics: 'Аналитика', knowledge: 'База знаний', settings: 'Настройки' };
let generatedTs = '';

function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function openModal() { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeModal() { modal.classList.remove('show'); document.body.style.overflow = ''; }
function openPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  $('#' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('#page-title').textContent = titles[page] || 'TelecomRoz';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function makeTs(title, requirements, method) {
  const today = new Intl.DateTimeFormat('ru-RU').format(new Date());
  return `ТЕХНИЧЕСКАЯ СПЕЦИФИКАЦИЯ\n\n1. Наименование ТРУ\n${title}\n\n2. Основание и способ закупки\n${method}. Заявка проходит проверку на соответствие Порядку закупок Самрук-Қазына (версия 2.17, изменения от 30.04.2026).\n\n3. Описание потребности и характеристики\n${requirements}\n\n4. Требования к качеству\nТРУ должны быть новыми, соответствовать заявленным характеристикам и действующим нормативным документам. Эквивалентность характеристик допускается, если это не ухудшает потребность Заказчика.\n\n5. Условия поставки\nСрок, место поставки, количество, комплектность и гарантия определяются согласно требованиям заявки и договору о закупках.\n\n6. Контроль соответствия\nПеред направлением на согласование требуется проверить полноту ТС, отсутствие дискриминационных требований и комплектность обосновывающих документов.\n\nДата формирования: ${today}`;
}
function renderRequest(title, method) {
  const number = `TR-2026-${String(Date.now()).slice(-4)}`;
  const today = new Intl.DateTimeFormat('ru-RU').format(new Date());
  $('#dynamic-purchases').insertAdjacentHTML('afterbegin', `<div class="table-row"><strong>${title}</strong><span>${method}</span><span class="badge review">ТС сформирована</span><span>${today}</span></div>`);
  return number;
}

document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.pageLink)));
['#create-btn', '#create-btn-2'].forEach(id => $(id)?.addEventListener('click', openModal));
$('#close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
$('#purchase-type').addEventListener('change', event => $('#store-option').classList.toggle('visible', event.target.value === 'Электронный магазин'));

$('#save-draft').addEventListener('click', () => { closeModal(); showToast('Черновик заявки сохранён'); });
$('#purchase-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#request-title').value.trim();
  const requirements = $('#requirements').value.trim();
  const method = $('#purchase-type').value;
  if (!generatedTs) {
    generatedTs = makeTs(title, requirements, method);
    $('#ts-content').textContent = generatedTs;
    $('#ts-preview').hidden = false;
    $('#generate-btn').innerHTML = 'Создать заявку <span>→</span>';
    showToast('ИИ сформировал проект ТС. Проверьте требования и создайте заявку.');
    return;
  }
  const number = renderRequest(title, method);
  closeModal();
  generatedTs = '';
  $('#purchase-form').reset();
  $('#ts-preview').hidden = true;
  $('#generate-btn').innerHTML = 'Сформировать ТС <span>→</span>';
  openPage('purchases');
  showToast(`Заявка ${number} создана и направлена на проверку ТС.`);
});
$('#configure-store').addEventListener('click', () => showToast('Используйте диапазоны характеристик для сохранения конкуренции.'));
$('#ai-btn').addEventListener('click', () => { openModal(); $('#purchase-type').value = 'Электронный магазин'; $('#store-option').classList.add('visible'); });
function connectUpload(buttonSelector, inputSelector) {
  const button = $(buttonSelector); const input = $(inputSelector);
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files.length) showToast(`Файл «${input.files[0].name}» добавлен к заявке`); });
}
connectUpload('#upload-btn', '#document-file');
connectUpload('#upload-btn-2', '#knowledge-file');
