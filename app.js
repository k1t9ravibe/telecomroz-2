const $ = (selector) => document.querySelector(selector);
const modal = $('#modal');
const toast = $('#toast');
const titles = {dashboard:'Доброе утро, Тест Тестович',purchases:'Закупки',documents:'Документы',analytics:'Аналитика',knowledge:'База знаний',settings:'Настройки'};
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function openModal(){modal.classList.add('show');document.body.style.overflow='hidden'}
function closeModal(){modal.classList.remove('show');document.body.style.overflow=''}
function openPage(page){document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));$('#'+page).classList.add('active');document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));$('#page-title').textContent=titles[page]||'TelecomRoz';window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>openPage(button.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach(button=>button.addEventListener('click',()=>openPage(button.dataset.pageLink)));
['#create-btn','#create-btn-2'].forEach(id=>{const button=$(id);if(button)button.addEventListener('click',openModal)});
$('#close-modal').addEventListener('click',closeModal);modal.addEventListener('click',(e)=>{if(e.target===modal)closeModal()});
$('#purchase-type').addEventListener('change',(e)=>$('#store-option').classList.toggle('visible',e.target.value==='Электронный магазин'));
$('#save-draft').addEventListener('click',()=>{closeModal();showToast('Черновик закупки сохранён')});
$('#purchase-form').addEventListener('submit',(e)=>{e.preventDefault();closeModal();showToast('Заявка создана. AI приступает к анализу потребности.')});
$('#configure-store').addEventListener('click',()=>showToast('Открыт режим диапазонных характеристик'));
$('#ai-btn').addEventListener('click',()=>{openModal();$('#purchase-type').value='Электронный магазин';$('#store-option').classList.add('visible')});
['#upload-btn','#upload-btn-2'].forEach(id=>{const button=$(id);if(button)button.addEventListener('click',()=>showToast('Выберите DOCX или PDF для загрузки'))});
