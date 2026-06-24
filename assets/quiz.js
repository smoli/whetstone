/* ============================================================
   Reusable quiz widget for the game-design course.
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
   ============================================================ */
(function () {
  function build(container, questions) {
    questions.forEach(function (item, qi) {
      var qEl = document.createElement('div');
      qEl.className = 'quiz-q';
      qEl.textContent = item.q;
      container.appendChild(qEl);

      var opts = document.createElement('div');
      opts.className = 'quiz-opts';
      var feedback = document.createElement('div');
      feedback.className = 'quiz-feedback';

      item.opts.forEach(function (text, oi) {
        var btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.type = 'button';
        btn.textContent = text;
        btn.addEventListener('click', function () {
          var all = opts.querySelectorAll('.quiz-opt');
          all.forEach(function (b) { b.disabled = true; });
          if (oi === item.answer) {
            btn.classList.add('correct');
            feedback.textContent = '✓ ' + (item.why || 'Correct.');
          } else {
            btn.classList.add('wrong');
            all[item.answer].classList.add('correct');
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

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.quiz[data-quiz]').forEach(function (container) {
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
  });
})();
