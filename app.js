/* ============================================================
   app.js — Общий JS для предметных страниц
   Поиск, переключение режимов, тест, тема
   ============================================================ */

/**
 * Склонение слова «вопрос» по числу
 * pluralize(1) → "вопрос", pluralize(3) → "вопроса", pluralize(5) → "вопросов"
 */
function pluralize(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'вопрос';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'вопроса';
  return 'вопросов';
}


/* =========================
   ПОИСК И РЕЖИМЫ
   ========================= */

var mode = 'orig';

function setMode(m) {
  mode = m;

  var lo = document.getElementById('lo');
  var la = document.getElementById('la');

  if (lo) {
    lo.className = 'wrap' + (m === 'orig' ? '' : ' hide');
  }

  if (la) {
    la.className = 'wrap' + (m === 'az' ? '' : ' hide');
  }

  var btnOrig = document.getElementById('b-orig');
  var btnAz = document.getElementById('b-az');

  if (btnOrig) btnOrig.className = 'sbtn' + (m === 'orig' ? ' on' : '');
  if (btnAz) btnAz.className = 'sbtn' + (m === 'az' ? ' on' : '');

  doSearch();
}

var srch = document.getElementById('srch');
var nores = document.getElementById('nores');
var cnt = document.getElementById('cnt');

/**
 * Поиск по тексту вопросов и вариантов ответов.
 * Оптимизировано: ищем по data-q и текстовому содержимому .ot,
 * не по innerHTML (который может содержать base64-картинки).
 */
function doSearch() {
  var q = srch.value.trim().toLowerCase();
  var el = document.getElementById(mode === 'orig' ? 'lo' : 'la');

  if (!el) return;

  var cards = Array.from(el.querySelectorAll('.qc'));
  var vis = 0;

  cards.forEach(function(c) {
    var questionText = (c.dataset.q || '').toLowerCase();
    var optionsText = Array.from(c.querySelectorAll('.ot'))
      .map(function(opt) { return opt.textContent.toLowerCase(); })
      .join(' ');

    var ok = !q ||
      questionText.indexOf(q) >= 0 ||
      optionsText.indexOf(q) >= 0;

    c.style.display = ok ? '' : 'none';
    if (ok) vis++;
  });

  // Показ/скрытие «ничего не найдено»
  if (q && vis === 0) {
    nores.style.display = 'block';
    nores.classList.add('visible');
  } else {
    nores.classList.remove('visible');
    nores.style.display = 'none';
  }

  cnt.textContent = q
    ? (vis + ' из ' + cards.length)
    : cards.length + ' ' + pluralize(cards.length);
}

srch.addEventListener('input', doSearch);


/* =========================
   ТЕСТ-РЕЖИМ
   ========================= */

(function() {
  var questions = [];
  var current = 0;
  var answers = {}; // idx → { chosen, correct, right }
  var LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

  /**
   * Собирает вопросы из HTML-карточек в контейнере #lo
   */
  function collectQuestions() {
    var cards = document.querySelectorAll('#lo .qc');
    var qs = [];

    cards.forEach(function(card) {
      var qtext = card.querySelector('.qt');
      var opts = card.querySelectorAll('.option');
      var correctIdx = -1;
      var variants = [];

      opts.forEach(function(opt, i) {
        if (opt.classList.contains('correct')) correctIdx = i;
        variants.push(opt.querySelector('.ot'));
      });

      if (qtext && opts.length && correctIdx >= 0) {
        qs.push({
          qtext: qtext.innerHTML,
          variants: variants.map(function(v) { return v ? v.innerHTML : ''; }),
          correct: correctIdx
        });
      }
    });

    return qs;
  }

  /**
   * Открывает режим тестирования
   */
  function openTest() {
    questions = collectQuestions();
    answers = {};
    current = 0;

    document.getElementById('test-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('tov-title').textContent =
      'Тест — ' + questions.length + ' ' + pluralize(questions.length);

    renderQ();
  }
  window.openTest = openTest;

  /**
   * Закрывает режим тестирования
   */
  function closeTest() {
    document.getElementById('test-overlay').classList.remove('active');
    document.body.style.overflow = '';
  }
  window.closeTest = closeTest;

  /**
   * Рендерит текущий вопрос теста
   */
  function renderQ() {
    if (current >= questions.length) {
      showResults();
      return;
    }

    var q = questions[current];
    var ans = answers[current];
    var pct = ((current + 1) / questions.length * 100).toFixed(1);

    document.getElementById('tov-pbar').style.width = pct + '%';
    document.getElementById('tov-counter').textContent =
      (current + 1) + ' / ' + questions.length;

    var correctCount = Object.values(answers).filter(function(a) { return a.right; }).length;
    var answeredCount = Object.keys(answers).length;
    document.getElementById('tov-score').textContent =
      answeredCount ? '✓ ' + correctCount + ' из ' + answeredCount : '';

    // Генерация вариантов ответов
    var optsHtml = '';
    q.variants.forEach(function(v, i) {
      var cls = 'tov-opt';
      if (ans) {
        cls += ' answered';
        if (i === ans.chosen && !ans.right) cls += ' selected-wrong';
        else if (i === q.correct && !ans.right) cls += ' revealed-correct';
        else if (i === ans.chosen && ans.right) cls += ' correct-chosen';
      }
      optsHtml +=
        '<button class="' + cls + '" onclick="chooseAnswer(' + i + ')">' +
          '<span class="tov-ol">' + (LETTERS[i] || i + 1) + '</span>' +
          '<span>' + v + '</span>' +
        '</button>';
    });

    // Фидбэк
    var feedback = '';
    if (ans) {
      feedback = ans.right
        ? '<div class="tov-feedback correct">✓ Верно!</div>'
        : '<div class="tov-feedback wrong">✗ Неверно. Правильный ответ выделен зелёным.</div>';
    }

    var isLast = current === questions.length - 1;
    var allAnswered = Object.keys(answers).length === questions.length;

    document.getElementById('tov-body').innerHTML =
      '<div class="tov-qcard">' +
        '<div class="tov-qhead">' +
          '<div class="tov-qnum">Вопрос ' + (current + 1) + '</div>' +
          '<div class="tov-qtext">' + q.qtext + '</div>' +
        '</div>' +
        '<div class="tov-options">' + optsHtml + '</div>' +
        feedback +
      '</div>' +
      '<div class="tov-nav">' +
        '<button class="tov-nav-btn" onclick="goQ(-1)"' +
          (current === 0 ? ' disabled' : '') + '>← Назад</button>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:500px">' +
          renderDots() +
        '</div>' +
        (isLast && allAnswered
          ? '<button class="tov-nav-btn primary" onclick="showResults()">Результат →</button>'
          : '<button class="tov-nav-btn' + (ans ? ' primary' : '') +
            '" onclick="goQ(1)"' + (isLast ? ' disabled' : '') + '>Далее →</button>') +
      '</div>';

    document.getElementById('test-overlay').scrollTop = 0;
  }

  /**
   * Рендерит точки навигации (показывает ±2 от текущей + первую/последнюю)
   */
  function renderDots() {
    var total = questions.length;
    var html = '';
    var show = new Set([0, total - 1]);

    for (var i = Math.max(0, current - 2); i <= Math.min(total - 1, current + 2); i++) {
      show.add(i);
    }

    var sorted = Array.from(show).sort(function(a, b) { return a - b; });
    var prev = -1;

    sorted.forEach(function(i) {
      if (prev >= 0 && i - prev > 1) {
        html += '<span style="color:#7b82a0;padding:0 2px">…</span>';
      }
      var a = answers[i];
      var bg = i === current ? '#a78bfa' : a ? (a.right ? '#34d399' : '#f87171') : '#1c2130';
      var bc = i === current ? '#a78bfa' : a ? (a.right ? '#34d399' : '#f87171') : '#232840';
      var tc = (i === current || a) ? '#fff' : '#7b82a0';

      html +=
        '<button onclick="jumpQ(' + i + ')" style="' +
          'width:28px;height:28px;border-radius:6px;' +
          'border:1px solid ' + bc + ';background:' + bg + ';' +
          'color:' + tc + ';font-size:11px;cursor:pointer;' +
          'font-family:Mulish,sans-serif">' +
          (i + 1) +
        '</button>';

      prev = i;
    });

    return html;
  }

  /**
   * Обработка выбора ответа
   */
  function chooseAnswer(idx) {
    if (answers[current] && answers[current].right) return;

    var q = questions[current];
    var right = idx === q.correct;
    answers[current] = { chosen: idx, correct: q.correct, right: right };
    renderQ();

    // Автопереход к следующему вопросу при правильном ответе
    if (right && current < questions.length - 1) {
      setTimeout(function() { goQ(1); }, 900);
    }
  }
  window.chooseAnswer = chooseAnswer;

  function goQ(dir) { jumpQ(current + dir); }
  window.goQ = goQ;

  function jumpQ(idx) {
    if (idx < 0 || idx >= questions.length) return;
    current = idx;
    renderQ();
  }
  window.jumpQ = jumpQ;

  /**
   * Показывает экран результатов
   */
  function showResults() {
    var correctCount = Object.values(answers).filter(function(a) { return a.right; }).length;
    var total = questions.length;
    var pct = Math.round(correctCount / total * 100);

    var msg =
      pct >= 90 ? '🎉 Отлично! Ты великолепно знаешь материал!' :
      pct >= 70 ? '👍 Хороший результат! Ещё немного и будет отлично.' :
      pct >= 50 ? '📚 Неплохо, но стоит повторить слабые места.' :
                  '💪 Нужно ещё поучить. Попробуй ещё раз!';

    document.getElementById('tov-pbar').style.width = '100%';
    document.getElementById('tov-counter').textContent = 'Завершено';
    document.getElementById('tov-score').textContent = '';

    var p2 = function(n) {
      if (n % 10 === 1 && n % 100 !== 11) return 'правильный ответ';
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'правильных ответа';
      return 'правильных ответов';
    };

    document.getElementById('tov-body').innerHTML =
      '<div class="tov-results">' +
        '<div class="tov-results-score">' + correctCount + '</div>' +
        '<div class="tov-results-label">' + p2(correctCount) + ' из</div>' +
        '<div class="tov-results-pct">' + total + ' ' + pluralize(total) + ' (' + pct + '%)</div>' +
        '<div class="tov-results-msg">' + msg + '</div>' +
        '<button class="tov-restart" onclick="openTest()">🔄 Начать заново</button>' +
        '<button class="tov-restart outline" onclick="reviewErrors()">📋 Разбор ошибок</button>' +
      '</div>';
  }
  window.showResults = showResults;

  /**
   * Режим разбора ошибок — показывает только неверно отвеченные вопросы
   */
  function reviewErrors() {
    var wrong = Object.entries(answers)
      .filter(function(e) { return !e[1].right; })
      .map(function(e) { return parseInt(e[0]); });

    if (!wrong.length) {
      alert('Ошибок нет! 🎉');
      return;
    }

    var origQ = questions;
    questions = wrong.map(function(i) { return origQ[i]; });
    answers = {};
    current = 0;

    document.getElementById('tov-title').textContent =
      'Разбор ошибок — ' + questions.length + ' ' + pluralize(questions.length);
    renderQ();
  }
  window.reviewErrors = reviewErrors;

  // Добавляем кнопку теста в навбар
  document.addEventListener('DOMContentLoaded', function() {
    var bar = document.querySelector('.bar');
    if (bar) {
      var btn = document.createElement('button');
      btn.className = 'test-btn';
      btn.textContent = '📝 Тест';
      btn.onclick = openTest;
      bar.appendChild(btn);
    }
  });
})();


/* =========================
   ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ
   ========================= */

(function() {
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-plt-theme', theme);
    try { localStorage.setItem('pltTheme', theme); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    var bar = document.querySelector('.bar') || document.body;

    if (!document.querySelector('.theme-toggle')) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-toggle';
      bar.appendChild(btn);
    }

    applyTheme(document.documentElement.getAttribute('data-plt-theme') || 'light');

    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var current = document.documentElement.getAttribute('data-plt-theme') || 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    });
  });
}());
