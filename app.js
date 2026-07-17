const $ = (selector) => document.querySelector(selector);
const modal = $('#modal');
const toast = $('#toast');
const STORAGE_KEY = 'telecomroz-requests-v1';
const titles = { dashboard: 'Доброе утро, Тест Тестович', purchases: 'Мои заявки', documents: 'Документы', specifications: 'Готовые ТС', analytics: 'Аналитика', knowledge: 'База знаний', settings: 'Настройки' };
let generatedTs = '';
let activeDraftId = null;
let requests = [];
try { requests = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (!Array.isArray(requests)) requests = []; } catch { localStorage.removeItem(STORAGE_KEY); }

function addTsFields() {
  const requirementsLabel = $('#requirements').closest('label');
  requirementsLabel.insertAdjacentHTML('beforebegin', `<div class="form-grid"><label>Количество<input id="ts-quantity" inputmode="numeric" placeholder="Например, 25" /></label><label>Единица измерения<input id="ts-unit" placeholder="шт., услуга, комплект" /></label><label>Место поставки<input id="ts-delivery" placeholder="Город, адрес" /></label><label>Срок поставки<input id="ts-deadline" placeholder="Например, 30 календарных дней" /></label></div><label>Гарантия<input id="ts-warranty" placeholder="Например, не менее 12 месяцев" /></label>`);
}
addTsFields();

function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200); }
function openModal() { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeModal() { modal.classList.remove('show'); document.body.style.overflow = ''; }
function openPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  $('#' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('#page-title').textContent = titles[page] || 'TelecomRoz';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function makeTs(title, requirements, method, details) {
  const today = new Intl.DateTimeFormat('ru-RU').format(new Date());
  const value = (key, fallback = 'Уточняется в заявке') => details[key]?.trim() || fallback;
  return `ТЕХНИЧЕСКАЯ СПЕЦИФИКАЦИЯ\n\n1. Предмет закупки\n${title}\n\n2. Способ закупки\n${method}\n\n3. Количество и единица измерения\n${value('quantity', 'Не указано')} ${value('unit', '')}\n\n4. Функциональные и технические характеристики\n${requirements}\n\n5. Требования к качеству\nТРУ должны соответствовать заявленным характеристикам и применимым нормативным документам. Допускаются эквивалентные решения, если они не ухудшают функциональные, качественные и эксплуатационные свойства.\n\n6. Условия поставки\nМесто поставки: ${value('delivery')}\nСрок поставки: ${value('deadline')}\n\n7. Гарантийные обязательства\n${value('warranty')}\n\n8. Проверка соответствия\nПеред согласованием проверяются полнота ТС, отсутствие дискриминационных требований и комплектность обосновывающих документов по Порядку закупок.\n\nДата формирования: ${today}`;
}
function makeCompliance(requirements, method) {
  const checks = ['Планирование и формирование лота: проверить до направления на закупку (ст. 33–34).', 'Техническая спецификация сформирована: проверить полноту, отсутствие дискриминационных условий и комплектность документов.'];
  if (method === 'Открытый тендер') checks.push('Подготовить тендерную документацию и состав комиссии (ст. 35).');
  if (method === 'Запрос ценовых предложений') checks.push('Подготовить и утвердить объявление о запросе ценовых предложений (ст. 37).');
  if (method === 'Электронный магазин') checks.push('Характеристики должны сохранять конкуренцию; используйте диапазоны вместо избыточно точных ограничений (ст. 58).');
  if (method === 'Из одного источника') checks.push(/обоснован|основани|исключительн/i.test(requirements) ? 'Обоснование применения способа указано: направить на проверку документации из одного источника (ст. 38, 59).' : 'ВНИМАНИЕ: добавьте обоснование применения способа из одного источника (ст. 38, 59).');
  return checks;
}
function saveRequests() { localStorage.setItem(STORAGE_KEY, JSON.stringify(requests)); }
function makeRequest(title, requirements, method, details, ts) {
  return { id: String(Date.now()), number: `TR-2026-${String(Date.now()).slice(-4)}`, title, requirements, details, method, ts, compliance: makeCompliance(requirements, method), date: new Intl.DateTimeFormat('ru-RU').format(new Date()), stage: 1, draft: true };
}
function getFlowContainer() {
  let container = $('#request-flow');
  if (!container) { container = document.createElement('div'); container.id = 'request-flow'; document.querySelector('#purchases .table-panel').before(container); }
  return container;
}
function renderFlow(request) {
  const container = getFlowContainer();
  if (!request) { container.innerHTML = ''; return; }
  const stages = ['Требования приняты', 'ТС сформирована', 'Проверка на соответствие', 'Маркетинговое заключение', 'Согласование'];
  const current = request.stage || 1;
  const compliance = request.compliance || ['Проверка по Порядку будет сформирована для новой заявки.'];
  container.innerHTML = `<section class="panel" style="margin-bottom:20px;padding:18px 21px"><div class="panel-head" style="padding:0 0 14px"><div><h2>${request.title}</h2><p>${request.number} · ${request.method}</p></div><span class="badge review">${stages[current]}</span></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">${stages.map((stage, index) => `<span style="padding:7px 9px;border-radius:6px;font-size:10px;font-weight:700;background:${index <= current ? '#e5f4ff' : '#f2f4f8'};color:${index <= current ? '#147fd0' : '#8d97a9'}">${index + 1}. ${stage}</span>`).join('')}</div><div style="padding:12px;background:#eef9ff;border:1px solid #bde9ff;border-radius:8px;margin-bottom:12px"><strong style="font-size:11px;color:#147fd0">Результат проверки TelecomRoz AI по Порядку закупок</strong><ul style="margin:8px 0 0;padding-left:17px;color:#40506b;font-size:10px;line-height:1.55">${compliance.map(check => `<li>${check}</li>`).join('')}</ul></div><details><summary style="cursor:pointer;color:#147fd0;font-weight:700;font-size:11px">Посмотреть сформированную техническую спецификацию</summary><pre style="white-space:pre-wrap;margin:12px 0 0;color:#40506b;font:10px/1.55 Manrope,sans-serif">${request.ts}</pre></details><div class="modal-actions" style="margin-top:15px"><button class="secondary" type="button" id="download-ts">Скачать ТС</button>${current < stages.length - 1 ? '<button class="primary" type="button" id="next-stage">Передать на следующий этап →</button>' : ''}</div></section>`;
  $('#next-stage')?.addEventListener('click', () => { request.stage += 1; saveRequests(); renderAll(); showToast(`Заявка передана: ${stages[request.stage]}.`); });
  $('#download-ts')?.addEventListener('click', () => { const blob = new Blob([request.ts], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${request.number}-ТС.txt`; link.click(); URL.revokeObjectURL(link.href); });
}
function renderAll() {
  const list = $('#dynamic-purchases');
  list.innerHTML = requests.map(request => `<div class="table-row" data-id="${request.id}" style="cursor:pointer"><strong>${request.title}</strong><span>${request.method}</span><span class="badge review">${request.stage >= 3 ? 'На согласовании' : 'ТС сформирована'}</span><span>${request.date}</span></div>`).join('');
  document.querySelectorAll('#dynamic-purchases .table-row').forEach(row => row.addEventListener('click', () => { const request = requests.find(item => item.id === row.dataset.id); renderFlow(request); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  const specifications = $('#ready-specifications');
  specifications.innerHTML = requests.length ? requests.map(request => `<div class="table-row"><strong>${request.title}<small style="display:block;margin-top:3px;color:#8d97a9">${request.number}</small></strong><span>${request.method}</span><span class="badge complete">${request.draft ? 'Черновик ТС' : 'Проверено'}</span><span><button class="text-button download-spec" data-id="${request.id}">Скачать ТС ↓</button></span></div>`).join('') : '<div style="padding:28px;text-align:center;color:#8d97a9">После формирования заявки готовые технические спецификации появятся здесь.</div>';
  document.querySelectorAll('.download-spec').forEach(button => button.addEventListener('click', () => { const request = requests.find(item => item.id === button.dataset.id); const blob = new Blob([request.ts], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${request.number}-ТС.txt`; link.click(); URL.revokeObjectURL(link.href); }));
  renderFlow(requests[0]);
}

document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.pageLink)));
['#create-btn', '#create-btn-2'].forEach(id => $(id)?.addEventListener('click', openModal));
$('#close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
$('#purchase-type').addEventListener('change', event => $('#store-option').classList.toggle('visible', event.target.value === 'Электронный магазин'));
$('#purchase-form').noValidate = true;
['#requirements', '#request-title', '#ts-quantity', '#ts-unit', '#ts-delivery', '#ts-deadline', '#ts-warranty'].forEach(selector => $(selector).addEventListener('input', () => { generatedTs = ''; $('#ts-preview').hidden = true; $('#generate-btn').innerHTML = 'Сформировать ТС <span>→</span>'; }));
$('#save-draft').addEventListener('click', () => { closeModal(); showToast('Черновик заявки сохранён'); });
$('#purchase-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#request-title').value.trim(); const requirements = $('#requirements').value.trim(); const method = $('#purchase-type').value;
  if (!title || !requirements) { showToast('Заполните название заявки и технические требования, чтобы сформировать ТС.'); return; }
  const details = { quantity: $('#ts-quantity').value, unit: $('#ts-unit').value, delivery: $('#ts-delivery').value, deadline: $('#ts-deadline').value, warranty: $('#ts-warranty').value };
  if (!generatedTs) { generatedTs = makeTs(title, requirements, method, details); const request = makeRequest(title, requirements, method, details, generatedTs); requests.unshift(request); activeDraftId = request.id; saveRequests(); renderAll(); $('#ts-content').textContent = generatedTs; $('#ts-preview').hidden = false; $('#generate-btn').innerHTML = 'Создать заявку <span>→</span>'; showToast('ТС сформирована и закреплена во вкладке «Готовые ТС».'); return; }
  let request = requests.find(item => item.id === activeDraftId) || requests.find(item => item.draft && item.title === title);
  if (!request) { request = makeRequest(title, requirements, method, details, generatedTs); requests.unshift(request); }
  request.title = title; request.requirements = requirements; request.method = method; request.details = details; request.ts = generatedTs; request.compliance = makeCompliance(requirements, method); request.draft = false;
  saveRequests(); renderAll(); closeModal(); generatedTs = ''; activeDraftId = null; $('#purchase-form').reset(); $('#ts-preview').hidden = true; $('#generate-btn').innerHTML = 'Сформировать ТС <span>→</span>'; openPage('purchases'); showToast(`Заявка ${request.number} сохранена. Следующий этап — проверка ТС.`);
});
$('#configure-store').addEventListener('click', () => showToast('Используйте диапазоны характеристик для сохранения конкуренции.'));
$('#ai-btn').addEventListener('click', () => { openModal(); $('#purchase-type').value = 'Электронный магазин'; $('#store-option').classList.add('visible'); });
function connectUpload(buttonSelector, inputSelector) { const button = $(buttonSelector); const input = $(inputSelector); button.addEventListener('click', () => input.click()); input.addEventListener('change', () => { if (input.files.length) showToast(`Файл «${input.files[0].name}» добавлен к заявке`); }); }
connectUpload('#upload-btn', '#document-file');
connectUpload('#upload-btn-2', '#knowledge-file');
document.querySelector('#purchases .section-title h2').textContent = 'Мои заявки';
renderAll();
