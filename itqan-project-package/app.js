const tracks = [
  { stage: 'school', system: 'general', subject: 'math', type: 'lesson', badge: 'عام · ابتدائي', title: 'مختبر الرياضيات', description: 'مفاهيم بصرية وتمارين تجعل الأرقام أقرب إلى الحياة.', meta: '٢٤ درسًا', glyph: '∑', visual: 'visual-green' },
  { stage: 'azhar', system: 'azhar', subject: 'arabic', type: 'lesson', badge: 'أزهري · ثانوي', title: 'العربية التخصصية', description: 'نحو وصرف وبلاغة عبر خرائط ذهنية ومسارات قصيرة.', meta: '١٨ وحدة', glyph: 'ع', visual: 'visual-coral' },
  { stage: 'school', system: 'general', subject: 'science', type: 'practice', badge: 'عام · إعدادي', title: 'علوم تنبض', description: 'شروحات معملية وتقييمات فورية ترسم فهمك بدقة.', meta: '٣٦ تجربة', glyph: 'H₂O', visual: 'visual-blue' },
  { stage: 'skills', system: 'general', subject: 'arabic', type: 'lesson', badge: 'مهارات · أونلاين', title: 'التعلّم كيف تتعلم', description: 'أدوات عملية لبناء عادة، لا جدول مزدحم جديد.', meta: '٧ جلسات', glyph: '↗', visual: 'visual-yellow' },
  { stage: 'azhar', system: 'azhar', subject: 'arabic', type: 'review', badge: 'أزهري · علوم شرعية', title: 'حفظ المتون', description: 'مسارات تفاعلية للتسميع مع ملاحظات النطق والمخارج.', meta: '١٢ متنًا', glyph: '۞', visual: 'visual-green' },
  { stage: 'school', system: 'general', subject: 'math', type: 'practice', badge: 'عام · ثانوي', title: 'بنك الأسئلة', description: 'نمط امتحان حقيقي مع تحليل نقاط الضعف لكل وحدة.', meta: '٤٨٠ سؤالًا', glyph: 'Q', visual: 'visual-coral' },
  { stage: 'skills', system: 'general', subject: 'science', type: 'review', badge: 'مهارات · تركيز', title: 'جلسة عميقة', description: 'طقوس صغيرة تساعدك على البدء والاستمرار دون تشتيت.', meta: '١٠ تمارين', glyph: '◌', visual: 'visual-blue' },
  { stage: 'azhar', system: 'azhar', subject: 'arabic', type: 'review', badge: 'أزهري · قرآن', title: 'مراجعة التلاوة', description: 'تقدم متدرج في الحفظ والمراجعة بصوتك أنت.', meta: '٣٠ مقطعًا', glyph: 'ن', visual: 'visual-yellow' }
];

const services = [
  { type: 'بحث ومشاريع', filter: 'research', price: '١٢٠', title: 'مراجعة خطة بحث وتنسيق مراجع', description: 'خريطة واضحة قبل أن تبدأ الكتابة وتغرق في التفاصيل.', seller: 'نور الدين', avatar: 'ن', rating: '★ ٤.٩ · ١٨' },
  { type: 'خصوصي وتعليم', filter: 'learning', price: '٨٠', title: 'حصة خصوصية في القدرات الكمي', description: 'جلسة 1:1 مع استراتيجية حل تناسب وقتك ومستواك.', seller: 'عبدالله س.', avatar: 'ع', rating: '★ ٥.٠ · ٢٤' },
  { type: 'إبداع وترجمة', filter: 'creative', price: '٦٥', title: 'ترجمة وتلخيص أكاديمي عربي / English', description: 'نص مفهوم، منسق، ويحافظ على صوتك الأصلي.', seller: 'مريم ع.', avatar: 'م', rating: '★ ٤.٨ · ٣١' },
  { type: 'بحث ومشاريع', filter: 'research', price: '١٨٠', title: 'تحليل بيانات SPSS لمشروع تخرج', description: 'قراءة النتائج وتحويلها إلى فصل يمكن مناقشته بثقة.', seller: 'ياسين ك.', avatar: 'ي', rating: '★ ٤.٩ · ١١' },
  { type: 'خصوصي وتعليم', filter: 'learning', price: '٩٥', title: 'مراجعة نحو وصرف أزهري', description: 'من القاعدة إلى المثال، بدون حفظ منفصل عن السياق.', seller: 'سلمى م.', avatar: 'س', rating: '★ ٤.٩ · ٩' },
  { type: 'إبداع وترجمة', filter: 'creative', price: '٧٥', title: 'عرض تقديمي يحكي فكرتك', description: 'بنية مختصرة وتصميم هادئ يخدم محتوى البحث.', seller: 'عمر ر.', avatar: 'ع', rating: '★ ٤.٧ · ١٦' }
];

const trackGrid = document.querySelector('#trackGrid');
const marketGrid = document.querySelector('#marketGrid');
const systemFilter = document.querySelector('#systemFilter');
const subjectFilter = document.querySelector('#subjectFilter');
const contentFilter = document.querySelector('#contentFilter');
const marketSearch = document.querySelector('#marketSearch');
let activeStage = 'all';
let activeMarket = 'all';
let sessionUser = null;

async function apiFetch(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || data.error || 'API request failed'), { status: response.status, data });
  return data;
}

function mapLiveCourse(course) {
  const stage = course.track.includes('أزهري') ? 'azhar' : course.track.includes('مهارات') ? 'skills' : 'school';
  const system = course.systemName === 'أزهري' ? 'azhar' : 'general';
  const subject = course.subject.includes('رياض') || course.subject.includes('قدرات') ? 'math' : course.subject.includes('علوم') || course.subject.includes('تركيز') ? 'science' : 'arabic';
  const type = course.contentType === 'تمرين' ? 'practice' : course.contentType === 'مراجعة' ? 'review' : 'lesson';
  return { slug: course.slug, stage, system, subject, type, badge: `${course.systemName} · ${course.stage}`, title: course.title, description: course.description, meta: `${course.lessonsCount} درسًا`, glyph: subject === 'math' ? '∑' : subject === 'science' ? 'H₂O' : stage === 'azhar' ? 'ع' : '↗', visual: stage === 'azhar' ? 'visual-coral' : subject === 'science' ? 'visual-blue' : stage === 'skills' ? 'visual-yellow' : 'visual-green' };
}

function mapLiveService(service) {
  const seller = service.sellerName || 'مقدم خدمة';
  return { id: service.id, type: service.category === 'research' ? 'بحث ومشاريع' : service.category === 'learning' ? 'خصوصي وتعليم' : 'إبداع وترجمة', filter: service.category, price: new Intl.NumberFormat('ar-SA').format(Number(service.price)), title: service.title, description: service.description, seller, avatar: seller.slice(0, 1), rating: `★ ${Number(service.rating).toFixed(1)} · ${service.reviewCount}` };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }

async function loadLiveData() {
  try {
    const [courseData, serviceData] = await Promise.all([apiFetch('/api/courses'), apiFetch('/api/market/services')]);
    if (courseData.courses?.length) { tracks.splice(0, tracks.length, ...courseData.courses.map(mapLiveCourse)); renderTracks(); }
    if (serviceData.services?.length) { services.splice(0, services.length, ...serviceData.services.map(mapLiveService)); renderMarket(); }
  } catch (error) {
    console.info('Live data unavailable; using presentation data.', error.message);
  }
}

async function loadSession() {
  try {
    const result = await apiFetch('/api/auth/me');
    sessionUser = result.user || null;
    const loginButton = document.querySelector('.top-actions .outline-button');
    if (loginButton && sessionUser) { loginButton.textContent = `لوحتي · ${sessionUser.name}`; loginButton.dataset.scroll = '#dashboard'; loginButton.removeAttribute('data-toast'); }
    if (sessionUser) {
      const greeting = document.querySelector('.student-header h2');
      const name = sessionUser.name?.split(' ')[0] || 'طالب';
      if (greeting) { greeting.textContent = 'صباح الخير، '; const emphasis = document.createElement('em'); emphasis.textContent = `${name}.`; greeting.appendChild(emphasis); }
      loadDashboard();
      refreshBillingStatus();
    }
  } catch (error) { console.info('Session unavailable.', error.message); }
}

async function loadDashboard() {
  try {
    const result = await apiFetch('/api/dashboard');
    const summary = document.querySelector('.student-header p');
    if (summary && result.enrollments?.length) summary.textContent = `لديك ${result.enrollments.length} مسارًا نشطًا. كل خطوة تقرّبك من هدف أكبر.`;
  } catch (error) { console.info('Dashboard requires a signed-in account.', error.message); }
}

let activePlanCode = 'student-egypt-monthly';
async function loadPlans() {
  try {
    const result = await apiFetch('/api/plans');
    const plan = result.plans?.[0];
    if (!plan) return;
    activePlanCode = plan.code;
    document.querySelector('#planTitle').textContent = plan.title;
    document.querySelector('#planDescription').textContent = plan.description;
    document.querySelector('#planAmount').textContent = new Intl.NumberFormat('ar-EG').format(Number(plan.amount));
    document.querySelector('#planFeatures').innerHTML = (plan.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('');
  } catch (error) { console.info('Plans unavailable; using MVP presentation data.', error.message); }
}
async function refreshBillingStatus() {
  if (!sessionUser) return;
  try {
    const result = await apiFetch('/api/billing/status');
    const active = result.subscriptions?.find((item) => ['active', 'trialing'].includes(item.status));
    if (active) {
      document.querySelector('#planStatus').textContent = 'مفعّلة';
      document.querySelector('#billingMessage').textContent = `اشتراكك فعال حتى ${new Date(active.currentPeriodEnd).toLocaleDateString('ar-EG')}.`;
      document.querySelector('#subscribePlan').textContent = 'الباقة مفعّلة ✓';
    }
  } catch (error) { console.info('Billing status unavailable.', error.message); }
}
async function startCheckout() {
  if (!sessionUser) { window.location.href = `/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`; return; }
  const button = document.querySelector('#subscribePlan');
  button.disabled = true;
  try {
    const result = await apiFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ planCode: activePlanCode }) });
    if (result.provider === 'stripe' && result.checkoutUrl) {
      window.open(result.checkoutUrl, '_blank', 'noopener');
      showToast('فتحنا صفحة الدفع الاختباري في تبويب جديد.');
    } else if (result.provider === 'mock') {
      const confirmMock = window.confirm('هذا وضع اختبار محلي ولن يتم تحصيل أي مبلغ. هل تريد تفعيل الباقة التجريبية؟');
      if (confirmMock) {
        const completed = await apiFetch('/api/billing/mock/confirm', { method: 'POST', body: JSON.stringify({ sessionId: result.sessionId }) });
        showToast(completed.message || 'تم تفعيل الباقة التجريبية.');
        await refreshBillingStatus();
      }
    }
  } catch (error) { showToast(error.message || 'تعذر بدء الاشتراك.'); }
  finally { button.disabled = false; }
}

function renderTracks() {
  const system = systemFilter.value;
  const subject = subjectFilter.value;
  const content = contentFilter.value;
  trackGrid.innerHTML = tracks.map((track, index) => {
    const visible = (activeStage === 'all' || track.stage === activeStage) && (system === 'all' || track.system === system) && (subject === 'all' || track.subject === subject) && (content === 'all' || track.type === content);
    const action = track.slug ? `<button class="track-open" data-course-slug="${escapeHtml(track.slug)}">استكشف ↗</button>` : '<b>استكشف ↗</b>';
    return `<article class="track-card ${track.visual} ${visible ? '' : 'hidden'}"><div class="track-card-top"><span class="track-badge">${escapeHtml(track.badge)}</span><span class="track-index">0${index + 1}</span></div><div class="track-art"><span class="track-glyph"><span>${escapeHtml(track.glyph)}</span></span></div><div><h3>${escapeHtml(track.title)}</h3><p>${escapeHtml(track.description)}</p></div><div class="track-card-bottom"><span>${escapeHtml(track.meta)}</span>${action}</div></article>`;
  }).join('');
}

function renderMarket() {
  const query = marketSearch.value.trim().toLowerCase();
  marketGrid.innerHTML = services.map((service) => {
    const fullText = `${service.title} ${service.description} ${service.type}`.toLowerCase();
    const visible = (activeMarket === 'all' || service.filter === activeMarket) && (!query || fullText.includes(query));
    const action = service.id ? `<button class="service-order" data-service-id="${escapeHtml(service.id)}">اطلب الخدمة ↗</button>` : '';
    return `<article class="market-card ${visible ? '' : 'hidden'}"><div class="market-card-top"><span class="service-type">${escapeHtml(service.type)}</span><span class="service-price">${escapeHtml(service.price)} <small>ر.س</small></span></div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p><div class="market-card-bottom"><div class="seller"><span class="seller-avatar">${escapeHtml(service.avatar)}</span><span><strong>${escapeHtml(service.seller)}</strong><small>مقدم خدمة موثّق</small></span></div><span class="service-rating">${escapeHtml(service.rating)}</span></div>${action}</article>`;
  }).join('');
}

renderTracks();
renderMarket();
loadLiveData();
loadSession();
loadPlans();

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
}

document.querySelectorAll('[data-toast]:not(.top-actions .outline-button)').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));
document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' })));
const loginButton = document.querySelector('.top-actions .outline-button');
if (loginButton) loginButton.addEventListener('click', () => {
  if (sessionUser) document.querySelector('#dashboard')?.scrollIntoView({ behavior: 'smooth' });
  else window.location.href = `/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`;
});
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  document.querySelectorAll('.main-nav a').forEach((item) => item.classList.remove('active'));
  link.classList.add('active');
}));

document.querySelectorAll('#stageFilters button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('#stageFilters button').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  activeStage = button.dataset.stage;
  renderTracks();
}));
[systemFilter, subjectFilter, contentFilter].forEach((filter) => filter.addEventListener('change', renderTracks));
document.querySelectorAll('#marketFilters button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('#marketFilters button').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  activeMarket = button.dataset.market;
  renderMarket();
}));
marketSearch.addEventListener('input', renderMarket);

const courseModal = document.querySelector('#courseModal');
const orderModal = document.querySelector('#orderModal');
let activeCourseSlug = null;
let activeServiceId = null;
let activeLessons = [];
function setModalOpen(modal, open) { modal.classList.toggle('open', open); modal.setAttribute('aria-hidden', open ? 'false' : 'true'); }
async function openCourse(slug) {
  activeCourseSlug = slug;
  setModalOpen(courseModal, true);
  document.querySelector('#courseModalTitle').textContent = 'تحميل المسار...';
  document.querySelector('#courseModalDescription').textContent = 'نجهز لك الخطة والدروس المرتبطة.';
  document.querySelector('#courseLessons').innerHTML = '<div class="lesson-loading">جارٍ تحميل الدروس...</div>';
  try {
    const result = await apiFetch(`/api/courses/${encodeURIComponent(slug)}`);
    activeLessons = result.lessons || [];
    document.querySelector('#courseModalTitle').textContent = result.course.title;
    document.querySelector('#courseModalDescription').textContent = result.course.description;
    document.querySelector('#courseModalMeta').innerHTML = `<span>${escapeHtml(result.course.track)}</span><span>${escapeHtml(result.course.level)}</span><span>${escapeHtml(result.course.lessonsCount)} درسًا</span>`;
    document.querySelector('#courseLessons').innerHTML = result.lessons.map((lesson, index) => `<button class="lesson-row" data-lesson-id="${escapeHtml(lesson.id)}"><span class="lesson-number">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(lesson.durationMinutes)} دقيقة</small><span>↗</span></button>`).join('') || '<div class="lesson-loading">سيُضاف محتوى هذا المسار قريبًا.</div>';
    if (activeLessons[0]) showLesson(activeLessons[0]);
  } catch (error) {
    document.querySelector('#courseModalDescription').textContent = 'تعذر تحميل المسار. حاول مرة أخرى.';
    document.querySelector('#courseLessons').innerHTML = '';
  }
}
function showLesson(lesson) {
  const viewer = document.querySelector('#lessonViewer');
  viewer.innerHTML = `<span class="section-tag">معاينة الدرس · ${escapeHtml(lesson.durationMinutes)} دقيقة</span><strong>${escapeHtml(lesson.title)}</strong><p>${escapeHtml(lesson.content || 'محتوى الدرس سيُرفع هنا مع الفيديو والملفات والتمارين المرتبطة.')}</p><small>اخترت هذا الدرس. سيُحفظ تقدمك بعد تسجيل الدخول والالتحاق بالمسار.</small>`;
}
document.querySelector('#enrollCourseButton').addEventListener('click', async () => {
  if (!sessionUser) { window.location.href = `/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`; return; }
  try {
    const result = await apiFetch(`/api/courses/${encodeURIComponent(activeCourseSlug)}/enroll`, { method: 'POST' });
    showToast(result.message || 'تمت إضافة المسار إلى رحلتك.');
    document.querySelector('#enrollCourseButton').textContent = 'أُضيف إلى رحلتك ✓';
  } catch (error) { showToast(error.message); }
});
trackGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-course-slug]');
  if (button) openCourse(button.dataset.courseSlug);
});
document.querySelector('#courseLessons').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-lesson-id]');
  if (!button) return;
  const lesson = activeLessons.find((item) => Number(item.id) === Number(button.dataset.lessonId));
  if (!lesson) return;
  showLesson(lesson);
  if (sessionUser) {
    try { await apiFetch('/api/progress', { method: 'POST', body: JSON.stringify({ lessonId: lesson.id, completed: true, watchedSeconds: Number(lesson.durationMinutes || 0) * 60 }) }); showToast('تم تسجيل تقدمك في الدرس.'); }
    catch { showToast('التحق بالمسار أولًا لحفظ التقدم.'); }
  }
});
function openOrder(serviceId) {
  activeServiceId = Number(serviceId);
  const service = services.find((item) => Number(item.id) === activeServiceId);
  if (!service) return;
  document.querySelector('#orderModalTitle').textContent = service.title;
  document.querySelector('#orderModalDescription').textContent = `السعر الظاهر: ${service.price} ر.س — سيبقى الطلب في انتظار الدفع دون تحصيل الآن.`;
  setModalOpen(orderModal, true);
}
marketGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-service-id]');
  if (button) openOrder(button.dataset.serviceId);
});
document.querySelector('#orderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sessionUser) { window.location.href = `/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`; return; }
  try {
    const result = await apiFetch('/api/market/orders', { method: 'POST', body: JSON.stringify({ serviceId: activeServiceId, buyerNote: document.querySelector('#orderNote').value }) });
    showToast(result.message || 'تم إنشاء الطلب.');
    document.querySelector('#orderNote').value = '';
    setModalOpen(orderModal, false);
  } catch (error) { showToast(error.message); }
});
document.querySelector('#subscribePlan').addEventListener('click', startCheckout);
document.querySelector('#closeCourse').addEventListener('click', () => setModalOpen(courseModal, false));
document.querySelector('#closeOrder').addEventListener('click', () => setModalOpen(orderModal, false));
courseModal.addEventListener('click', (event) => { if (event.target === courseModal) setModalOpen(courseModal, false); });
orderModal.addEventListener('click', (event) => { if (event.target === orderModal) setModalOpen(orderModal, false); });

const assistantPanel = document.querySelector('#assistantPanel');
const assistantInput = document.querySelector('#assistantInput');
const assistantMessages = document.querySelector('#assistantMessages');
function openAssistant() { assistantPanel.classList.add('open'); assistantPanel.setAttribute('aria-hidden', 'false'); window.setTimeout(() => assistantInput.focus(), 220); }
function closeAssistant() { assistantPanel.classList.remove('open'); assistantPanel.setAttribute('aria-hidden', 'true'); }
document.querySelectorAll('#assistantFab, #openAssistant, #openAssistantTop').forEach((button) => button.addEventListener('click', openAssistant));
document.querySelector('#closeAssistant').addEventListener('click', closeAssistant);
document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => sendAssistantMessage(button.dataset.prompt)));

function appendMessage(text, variant, source = '') {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${variant}`;
  bubble.textContent = text;
  if (source) {
    const sourceLabel = document.createElement('span');
    sourceLabel.className = 'bubble-source';
    sourceLabel.textContent = source;
    bubble.appendChild(sourceLabel);
  }
  assistantMessages.appendChild(bubble);
}

async function sendAssistantMessage(message) {
  if (!message) return;
  appendMessage(message, 'user-bubble');
  assistantInput.value = '';
  assistantMessages.scrollTop = assistantMessages.scrollHeight;
  if (sessionUser) {
    try {
      const result = await apiFetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, context: 'الدرس ٤ · قوانين الجبر · الدقيقة 14:20' }) });
      appendMessage(result.answer, 'assistant-bubble', '↗ إجابة من سياق الدرس');
      assistantMessages.scrollTop = assistantMessages.scrollHeight;
      return;
    } catch (error) {
      appendMessage('المساعد مشغول لحظيًا. احتفظ بسؤالك وسأعيد المحاولة عندما تعود الخدمة.', 'assistant-bubble', '↗ تعذر الاتصال بالخدمة');
      assistantMessages.scrollTop = assistantMessages.scrollHeight;
      return;
    }
  }
  window.setTimeout(() => {
    const response = message.includes('مكان') || message.includes('أين')
      ? 'ستجدينها في الدقيقة 14:20 من الدرس الحالي. افتحي المقطع وسأبقى معك خطوة بخطوة.'
      : message.includes('مشابه')
        ? 'جرّبي: إذا كان 3س + 2 = 14، فما قيمة س؟ لا بأس أن تكتبي خطواتك أولًا.'
        : 'ابدئي بالسؤال: ما العملية العكسية التي تعزل المجهول؟ اكتبي أول خطوة وسأراجعها معك.';
    appendMessage(response, 'assistant-bubble', '↗ اقتراح من سياق الدرس');
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
  }, 500);
}
document.querySelector('#assistantForm').addEventListener('submit', (event) => { event.preventDefault(); sendAssistantMessage(assistantInput.value.trim()); });

const examModal = document.querySelector('#examModal');
let adaptiveSession = null;
function renderAdaptiveQuestion(question, progress) {
  document.querySelector('#modalQuestionLabel').textContent = `${question.examType} · ${String((progress?.answered || 0) + 1).padStart(2, '0')} / ${progress?.total || 5} · مستوى ${question.difficulty}`;
  document.querySelector('#modalQuestionPrompt').textContent = question.prompt;
  const answers = document.querySelector('.modal-answers');
  answers.innerHTML = '';
  question.options.forEach((option, index) => { const button = document.createElement('button'); button.type = 'button'; button.dataset.adaptiveIndex = index; button.textContent = option; answers.appendChild(button); });
}
async function startAdaptiveQuiz() {
  try {
    const result = await apiFetch('/api/quiz/sessions', { method: 'POST', body: JSON.stringify({ examType: 'قدرات كمي', questionCount: 5 }) });
    adaptiveSession = result.session;
    renderAdaptiveQuestion(result.question, result.progress);
  } catch (error) { adaptiveSession = null; showToast('تعذر بدء الاختبار التكيفي الآن.'); }
}
function openExam() { examModal.classList.add('open'); examModal.setAttribute('aria-hidden', 'false'); document.querySelector('#modalResult').classList.remove('show'); document.querySelector('#modalResult p').textContent = 'أجب عن الأسئلة، وسيتغير المستوى مع كل إجابة.'; if (sessionUser) startAdaptiveQuiz(); }
function closeExam() { examModal.classList.remove('open'); examModal.setAttribute('aria-hidden', 'true'); adaptiveSession = null; document.querySelector('#modalResult').classList.remove('show'); document.querySelectorAll('[data-answer], [data-adaptive-index]').forEach((item) => item.classList.remove('correct', 'wrong')); }
document.querySelectorAll('[data-open-exam]').forEach((button) => button.addEventListener('click', openExam));
document.querySelector('#closeExam').addEventListener('click', closeExam);
examModal.addEventListener('click', (event) => { if (event.target === examModal) closeExam(); });
document.querySelector('.modal-answers').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  document.querySelectorAll('.modal-answers button').forEach((item) => item.classList.remove('correct', 'wrong'));
  if (adaptiveSession) {
    button.disabled = true;
    try {
      const result = await apiFetch(`/api/quiz/sessions/${adaptiveSession.id}/answer`, { method: 'POST', body: JSON.stringify({ selectedIndex: Number(button.dataset.adaptiveIndex) }) });
      button.classList.add(result.correct ? 'correct' : 'wrong');
      document.querySelector('#modalResult').classList.add('show');
      document.querySelector('#modalResult strong').textContent = result.correct ? 'إجابة موفقة — ارتفع مستوى التحدي.' : 'ملاحظة ذكية — لنجرب خطوة أبسط.';
      document.querySelector('#modalResult p').textContent = result.completed ? `اكتملت الجلسة بنتيجة ${result.score}%. تم حفظها في لوحة تقدمك.` : result.explanation;
      if (!result.completed) window.setTimeout(() => { document.querySelector('#modalResult').classList.remove('show'); renderAdaptiveQuestion(result.question, result.progress); }, 900);
      else adaptiveSession = null;
    } catch (error) { button.disabled = false; showToast('تعذر حفظ الإجابة.'); }
    return;
  }
  const correct = button.dataset.answer === 'true';
  button.classList.add(correct ? 'correct' : 'wrong');
  if (correct) { document.querySelector('#modalResult').classList.add('show'); }
  else { document.querySelector('#modalResult').classList.remove('show'); showToast('ليس بعد — لاحظ نمط التضاعف وحاول مرة أخرى.'); }
});

document.querySelector('#mobileMenu').addEventListener('click', () => {
  const nav = document.querySelector('.main-nav');
  const visible = nav.style.display === 'flex';
  nav.style.display = visible ? '' : 'flex';
  if (!visible) { nav.style.position = 'absolute'; nav.style.top = '70px'; nav.style.right = '20px'; nav.style.left = '20px'; nav.style.padding = '14px'; nav.style.border = '1px solid var(--line)'; nav.style.borderRadius = '14px'; nav.style.background = 'var(--surface)'; nav.style.boxShadow = 'var(--shadow)'; nav.style.flexDirection = 'column'; nav.style.alignItems = 'stretch'; }
});

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.classList.add('is-visible');
}), { threshold: .12 });
document.querySelectorAll('.track-card, .market-card, .trust-item, .panel').forEach((item) => observer.observe(item));
