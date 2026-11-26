(function () {
  "use strict";

  const counts = {};
  window.STUDY_QUESTIONS = [];

  function cognitiveLevelFor(level) {
    if (level <= 5) return "Fundamentos";
    if (level <= 10) return "Comprensión y relaciones";
    if (level <= 15) return "Aplicación";
    if (level <= 20) return "Análisis e integración";
    return "Criterio profesional";
  }

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
        explanation: "«" + text + "» no responde a lo que pide «" + prompt + "»; se aparta del criterio «" +
          correctText + "»."
      };
    }));
    const offset = (counts[level] + level) % options.length;
    const shuffledOptions = options.slice(offset).concat(options.slice(0, offset));
    const questionNumber = String(counts[level]).padStart(2, "0");

    window.STUDY_QUESTIONS.push({
      id: "nivel-" + level + "-pregunta-" + questionNumber,
      level: level,
      cognitiveLevel: cognitiveLevelFor(level),
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
