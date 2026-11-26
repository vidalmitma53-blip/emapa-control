(function () {
  "use strict";

  const counts = {};
  window.STUDY_QUESTIONS = [];

  window.addStudyQuestion = function (level, topicId, sourcePage, prompt, correctAnswers, distractors, explanation, type) {
    counts[level] = (counts[level] || 0) + 1;
    const answers = Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers];
    const correctText = answers.join(" y ");
    const options = answers.map(function (text) {
      return { text: text, correct: true, explanation: explanation };
    }).concat(distractors.map(function (text) {
      return {
        text: text,
        correct: false,
        explanation: "No es correcta: esa opción no coincide con la fuente. La diapositiva indica que " + correctText + "."
      };
    }));
    const offset = (counts[level] + level) % options.length;
    const shuffledOptions = options.slice(offset).concat(options.slice(0, offset));
    const questionNumber = String(counts[level]).padStart(2, "0");

    window.STUDY_QUESTIONS.push({
      id: "nivel-" + level + "-pregunta-" + questionNumber,
      level: level,
      topicId: topicId,
      sourcePage: sourcePage,
      prompt: prompt,
      type: type || "single",
      selectionCount: answers.length,
      explanation: explanation,
      options: shuffledOptions
    });
  };
})();
