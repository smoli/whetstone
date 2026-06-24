/* ============================================================
   Reusable quiz widget.
   Usage: place a container and a JSON config script:

   <div class="quiz" data-quiz></div>
   <script type="application/json" class="quiz-data">
     [{ "q": "Question?",
        "opts": ["Answer one", "Answer two", "Answer three"],
        "answer": 0,
        "why": "Explanation shown after answering." }]
   </script>

   Designed for retrieval practice: immediate feedback, no second
   guesses (options lock after first choice), explanation always
   shown so a wrong answer still teaches.

   Options are SHUFFLED on render so the correct answer's position is
   randomised regardless of how the question was authored. Each button
   records its original index in data-opt-index, so grading (and the
   bridge's result reporting) stays correct after shuffling.
   ============================================================ */
(function () {
  // Fisher–Yates shuffle of [0..n-1].
  function shuffledIndices(n) {
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = order[j];
      order[j] = order[k];
      order[k] = tmp;
    }
    return order;
  }

  function build(container, questions) {
    questions.forEach(function (item) {
      var qEl = document.createElement('div');
      qEl.className = 'quiz-q';
      qEl.textContent = item.q;
      container.appendChild(qEl);

      var opts = document.createElement('div');
      opts.className = 'quiz-opts';
      var feedback = document.createElement('div');
      feedback.className = 'quiz-feedback';

      var order = shuffledIndices(item.opts.length);
      order.forEach(function (originalIndex) {
        var btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.type = 'button';
        btn.textContent = item.opts[originalIndex];
        btn.setAttribute('data-opt-index', String(originalIndex));
        btn.addEventListener('click', function () {
          var all = opts.querySelectorAll('.quiz-opt');
          all.forEach(function (b) { b.disabled = true; });
          if (originalIndex === item.answer) {
            btn.classList.add('correct');
            feedback.textContent = '✓ ' + (item.why || 'Correct.');
          } else {
            btn.classList.add('wrong');
            all.forEach(function (b) {
              if (b.getAttribute('data-opt-index') === String(item.answer)) b.classList.add('correct');
            });
            feedback.textContent = '✗ ' + (item.why || 'Not quite.');
          }
          feedback.classList.add('show');
        });
        opts.appendChild(btn);
      });

      container.appendChild(opts);
      container.appendChild(feedback);
    });
  }

  function buildAll(root) {
    (root || document).querySelectorAll('.quiz[data-quiz]').forEach(function (container) {
      var data = container.nextElementSibling;
      while (data && !data.classList.contains('quiz-data')) {
        data = data.nextElementSibling;
      }
      if (!data) return;
      try {
        build(container, JSON.parse(data.textContent));
      } catch (e) {
        container.textContent = 'Quiz failed to load: ' + e.message;
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.TeachQuiz = { build: build, buildAll: buildAll, shuffledIndices: shuffledIndices };
    document.addEventListener('DOMContentLoaded', function () {
      buildAll(document);
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { build: build, buildAll: buildAll, shuffledIndices: shuffledIndices };
})();
