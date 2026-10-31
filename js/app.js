/*
 * 画面表示・クイズ・学習状態の保存
 * ------------------------------------------------------------
 * 画面はURLの # 以降で切り替えます（GitHub Pagesでもそのまま動きます）。
 *   #/            ホーム
 *   #/chapter/llm 章の学習画面
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ai-textbook-progress-v1";
  var app = document.getElementById("app");
  var chapters = window.TEXTBOOK.chapters;

  // ---------- 学習状態の保存（localStorage） ----------
  // 形式: { chapters: { [章id]: { completed: bool, answers: { [問題番号]: 選んだ番号 } } } }

  function loadProgress() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && data.chapters) return data;
    } catch (e) { /* 保存できない環境でも表示は続ける */ }
    return { chapters: {} };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* 同上 */ }
  }

  function chapterState(id) {
    if (!progress.chapters[id]) {
      progress.chapters[id] = { completed: false, answers: {} };
    }
    return progress.chapters[id];
  }

  var progress = loadProgress();

  // ---------- 小さな補助関数 ----------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "text") node.textContent = attrs[key];
        else if (key === "onclick") node.addEventListener("click", attrs[key]);
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function findChapter(id) {
    return chapters.filter(function (c) { return c.id === id; })[0];
  }

  function correctCount(chapter) {
    var answers = chapterState(chapter.id).answers;
    return chapter.quiz.filter(function (q, i) { return answers[i] === q.answer; }).length;
  }

  function answeredCount(chapter) {
    return Object.keys(chapterState(chapter.id).answers).length;
  }

  function draftNotice() {
    return el("p", {
      class: "notice",
      text: "この章の本文とクイズは仮データです。正式な教科書の文章に差し替える予定です。"
    });
  }

  // ---------- ホーム画面 ----------

  function renderHome() {
    var doneCount = chapters.filter(function (c) { return chapterState(c.id).completed; }).length;

    var list = el("ul", { class: "chapter-list" }, chapters.map(function (c) {
      var state = chapterState(c.id);
      var status = state.completed
        ? el("span", { class: "status status-done", text: "✓ 学習済み" })
        : el("span", { class: "status", text: "未学習" });
      var quizInfo = answeredCount(c) > 0
        ? el("span", { class: "quiz-info", text: "クイズ " + correctCount(c) + " / " + c.quiz.length + " 問正解" })
        : null;

      return el("li", null, [
        el("a", { class: "chapter-card", href: "#/chapter/" + c.id }, [
          el("span", { class: "chapter-number", text: "第" + c.number + "章" }),
          el("span", { class: "chapter-title", text: c.title }),
          el("span", { class: "chapter-summary", text: c.summary }),
          el("span", { class: "chapter-meta" }, [status, quizInfo])
        ])
      ]);
    }));

    app.replaceChildren(
      el("section", { class: "intro" }, [
        el("h1", { text: "生成AIの基本を、少しずつ。" }),
        el("p", { text: "1章ずつ読んで、最後のクイズで理解を確かめましょう。" })
      ]),
      el("p", { class: "progress-summary", text: "学習済み " + doneCount + " / " + chapters.length + " 章" }),
      list,
      el("button", {
        type: "button",
        class: "btn btn-ghost",
        text: "学習記録をリセット",
        onclick: function () {
          if (confirm("学習済みチェックとクイズの回答をすべて消去します。よろしいですか？")) {
            progress = { chapters: {} };
            saveProgress();
            renderHome();
          }
        }
      })
    );
  }

  // ---------- 章の学習画面 ----------

  function renderChapter(chapter) {
    var state = chapterState(chapter.id);

    var body = chapter.sections.map(function (s) {
      return el("section", { class: "lesson-section" }, [el("h2", { text: s.heading })]
        .concat(s.paragraphs.map(function (p) { return el("p", { text: p }); })));
    });

    var quiz = el("section", { class: "quiz", id: "quiz" }, [
      el("h2", { text: "理解度クイズ" }),
      el("p", { class: "quiz-lead", text: "答えを選ぶと、すぐに正解と解説が表示されます。" })
    ].concat(chapter.quiz.map(function (q, i) { return renderQuestion(chapter, q, i); })));

    var score = el("p", { class: "score", id: "score", "aria-live": "polite" });
    updateScore(chapter, score);

    var completeBtn = el("button", { type: "button", class: "btn btn-primary" });
    function updateCompleteBtn() {
      completeBtn.textContent = state.completed ? "✓ 学習済み（タップで取り消し）" : "この章を学習済みにする";
      completeBtn.className = "btn " + (state.completed ? "btn-done" : "btn-primary");
      completeBtn.setAttribute("aria-pressed", String(state.completed));
    }
    completeBtn.addEventListener("click", function () {
      state.completed = !state.completed;
      saveProgress();
      updateCompleteBtn();
    });
    updateCompleteBtn();

    app.replaceChildren.apply(app, [
      el("a", { class: "back-link", href: "#/", text: "← ホームに戻る" }),
      el("p", { class: "chapter-number", text: "第" + chapter.number + "章" }),
      el("h1", { text: chapter.title }),
      chapter.draft ? draftNotice() : null
    ].filter(Boolean).concat(body, [
      quiz,
      score,
      el("div", { class: "complete-area" }, [completeBtn]),
      el("a", { class: "btn btn-ghost", href: "#/", text: "ホームに戻る" })
    ]));
  }

  function renderQuestion(chapter, q, index) {
    var state = chapterState(chapter.id);
    var feedback = el("div", { class: "feedback", "aria-live": "polite" });
    var buttons = [];

    var choiceList = el("div", { class: "choices", role: "group", "aria-label": "選択肢" },
      q.choices.map(function (choice, ci) {
        var btn = el("button", {
          type: "button",
          class: "choice",
          text: choice,
          onclick: function () {
            state.answers[index] = ci;
            saveProgress();
            showResult(ci);
            updateScore(chapter, document.getElementById("score"));
          }
        });
        buttons.push(btn);
        return btn;
      }));

    function showResult(selected) {
      var isCorrect = selected === q.answer;
      buttons.forEach(function (btn, ci) {
        btn.classList.toggle("is-correct", ci === q.answer);
        btn.classList.toggle("is-wrong", ci === selected && !isCorrect);
        btn.setAttribute("aria-pressed", String(ci === selected));
      });
      feedback.replaceChildren.apply(feedback, [
        el("p", { class: "feedback-title " + (isCorrect ? "ok" : "ng"), text: isCorrect ? "正解です" : "不正解です" }),
        isCorrect ? null : el("p", { text: "正解：" + q.choices[q.answer] }),
        el("p", { class: "explanation", text: q.explanation })
      ].filter(Boolean));
    }

    // 以前の回答があれば復元する
    if (state.answers[index] !== undefined) showResult(state.answers[index]);

    return el("div", { class: "question" }, [
      el("p", { class: "question-label", text: "問" + (index + 1) }),
      el("p", { class: "question-text", text: q.question }),
      choiceList,
      feedback
    ]);
  }

  function updateScore(chapter, node) {
    var answered = answeredCount(chapter);
    node.textContent = answered === 0
      ? ""
      : "現在の結果：" + chapter.quiz.length + "問中 " + correctCount(chapter) + "問正解" +
        (answered < chapter.quiz.length ? "（未回答 " + (chapter.quiz.length - answered) + "問）" : "");
  }

  // ---------- 画面切り替え ----------

  function route() {
    var match = location.hash.match(/^#\/chapter\/([\w-]+)/);
    var chapter = match && findChapter(match[1]);
    if (chapter) {
      document.title = chapter.title + "｜はじめてのAI教科書";
      renderChapter(chapter);
    } else {
      document.title = "はじめてのAI教科書";
      renderHome();
    }
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", route);
  route();
})();
