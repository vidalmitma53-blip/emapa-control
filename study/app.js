(function () {
  "use strict";

  const content = window.STUDY_CONTENT;
  const questionBank = window.STUDY_QUESTIONS || [];
  const topicById = Object.fromEntries(content.topics.map(function (topic) {
    return [topic.id, topic];
  }));
  const questionsByTopic = {};
  const levels = Array.from({ length: content.course.levelCount }, function (_, index) { return index + 1; });
  const storageKey = "estudia.control-medicamentos.v1";
  const defaultState = {
    theme: "light",
    displayName: "",
    xp: 0,
    dailyStudy: [],
    selectedTopics: content.topics.map(function (topic) { return topic.id; }),
    questionStats: {},
    awardedQuestions: [],
    passedLevels: {},
    currentSession: null
  };
  const main = document.getElementById("app-content");
  const toast = document.getElementById("toast");
  let state = loadState();
  let timerHandle = null;
  let toastHandle = null;
  let view = "home";
  let pdfExam = null;

  function loadState() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return structuredCloneSafe(defaultState);
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") throw new Error("Formato de progreso inválido");
      return Object.assign(structuredCloneSafe(defaultState), parsed, {
        questionStats: parsed.questionStats || {},
        awardedQuestions: parsed.awardedQuestions || [],
        dailyStudy: parsed.dailyStudy || [],
        selectedTopics: Array.isArray(parsed.selectedTopics) ? parsed.selectedTopics : defaultState.selectedTopics.slice(),
        passedLevels: parsed.passedLevels || {}
      });
    } catch (error) {
      showStorageError("No se pudo leer el avance guardado. No se modificaron los datos anteriores.");
      return structuredCloneSafe(defaultState);
    }
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch (error) {
      showStorageError("No se pudo guardar el avance en este navegador.");
      return false;
    }
  }

  function showStorageError(message) {
    const notice = document.getElementById("local-notice");
    if (notice) {
      notice.classList.add("notice-error");
      notice.querySelector("span:last-child").textContent = message;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
  }

  function allQuestions() {
    return questionBank.map(function (question) {
      const topic = topicById[question.topicId];
      return Object.assign({}, question, { topicTitle: topic ? topic.title : "Tema sin clasificar" });
    });
  }

  const questions = allQuestions();
  questions.forEach(function (question) {
    if (!questionsByTopic[question.topicId]) questionsByTopic[question.topicId] = [];
    questionsByTopic[question.topicId].push(question);
  });

  function validateQuestionBank() {
    const counts = {};
    let valid = questions.length === content.course.questionCount;
    const ids = new Set();
    questions.forEach(function (question) {
      counts[question.level] = (counts[question.level] || 0) + 1;
      const options = Array.isArray(question.options) ? question.options : [];
      const correctCount = options.filter(function (option) { return option && option.correct; }).length;
      const topic = topicById[question.topicId];
      if (!topic || !question.id || ids.has(question.id) || !question.prompt || !Array.isArray(question.options) ||
          options.length < 2 || options.some(function (option) { return !option || typeof option.text !== "string" || !option.explanation; }) ||
          correctCount !== question.selectionCount || !Number.isInteger(question.sourcePage) || question.sourcePage < topic.sourcePages[0] ||
          question.sourcePage > topic.sourcePages[1] ||
          (question.type === "multiple" ? ![1, 2].includes(question.selectionCount) : question.type !== "single" || question.selectionCount !== 1)) {
        valid = false;
      }
      ids.add(question.id);
    });
    return valid && levels.every(function (level) {
      return counts[level] === content.course.questionsPerLevel;
    });
  }

  if (!validateQuestionBank()) {
    console.error("El banco de preguntas no cumple los conteos o la estructura requerida.");
    main.innerHTML = '<section class="empty-state"><h1>No se pudo cargar el banco de preguntas</h1><p>El banco debe incluir 10 preguntas válidas en cada uno de los 21 niveles.</p></section>';
    return;
  }

  function findQuestion(id) {
    if (state.currentSession && Array.isArray(state.currentSession.customQuestions)) {
      const customQuestion = state.currentSession.customQuestions.find(function (question) { return question.id === id; });
      if (customQuestion) return customQuestion;
    }
    return questions.find(function (question) { return question.id === id; });
  }

  function getStats(questionId) {
    return state.questionStats[questionId] || { attempts: 0, correct: 0, incorrect: 0, lastCorrect: false };
  }

  function getReviewQuestions() {
    return questions.filter(function (question) {
      const stats = getStats(question.id);
      return stats.incorrect > 0 && !stats.lastCorrect;
    });
  }

  function dateKey(date) {
    const localDate = date || new Date();
    return [
      localDate.getFullYear(),
      String(localDate.getMonth() + 1).padStart(2, "0"),
      String(localDate.getDate()).padStart(2, "0")
    ].join("-");
  }

  function currentStreak() {
    const studyDays = new Set(state.dailyStudy);
    let cursor = new Date();
    if (!studyDays.has(dateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!studyDays.has(dateKey(cursor))) return 0;
    }
    let count = 0;
    while (studyDays.has(dateKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function markStudyToday() {
    const today = dateKey();
    if (!state.dailyStudy.includes(today)) state.dailyStudy.push(today);
  }

  function topicProgress(topic) {
    const topicQuestions = questionsByTopic[topic.id] || [];
    const answered = topicQuestions.filter(function (question) {
      return getStats(question.id).attempts > 0;
    });
    const mastered = answered.filter(function (question) {
      return getStats(question.id).lastCorrect;
    }).length;
    return {
      attempted: answered.length,
      total: topicQuestions.length,
      percent: topicQuestions.length ? Math.round((mastered / topicQuestions.length) * 100) : 0
    };
  }

  function nextLevel() {
    return levels.find(function (level) {
      return !state.passedLevels["course:" + level];
    }) || null;
  }

  function levelStatus(level) {
    if (state.passedLevels["course:" + level]) return "passed";
    return level === nextLevel() ? "available" : "locked";
  }

  function selectedTopicQuestions() {
    const selected = new Set(state.selectedTopics);
    return questions.filter(function (question) { return selected.has(question.topicId); });
  }

  function randomQuestionsFromSelectedTopics(limit) {
    const selected = state.selectedTopics.map(function (topicId) {
      const topicQuestions = questionsByTopic[topicId] || [];
      return topicQuestions[Math.floor(Math.random() * topicQuestions.length)];
    }).filter(Boolean);
    const chosenIds = new Set(selected.map(function (question) { return question.id; }));
    const remaining = selectedTopicQuestions().filter(function (question) { return !chosenIds.has(question.id); });
    const mixed = selected.concat(remaining.sort(function () { return Math.random() - 0.5; }));
    return mixed.slice(0, limit);
  }

  function topicSelectionControls() {
    return content.topics.map(function (topic) {
      const checked = state.selectedTopics.includes(topic.id);
      const count = (questionsByTopic[topic.id] || []).length;
      return '<label class="topic-check"><input type="checkbox" data-topic-select="' + escapeHtml(topic.id) + '"' + (checked ? " checked" : "") + '><span>' +
        escapeHtml(topic.title) + '</span><small>' + count + ' preguntas</small></label>';
    }).join("");
  }

  function levelGrid() {
    return '<div class="levels-grid">' + levels.map(function (level) {
      const status = levelStatus(level);
      const disabled = status === "locked";
      const label = status === "passed" ? "Superado" : (disabled ? "Bloqueado" : "Disponible");
      return '<button type="button" class="level-card level-' + status + '" data-action="start-level" data-level="' + level + '"' +
        (disabled ? " disabled" : "") + '><strong>Nivel ' + level + '</strong><span>' + label + '</span><small>10 preguntas</small></button>';
    }).join("") + '</div>';
  }

  function syncHeader() {
    document.getElementById("xp-value").textContent = state.xp + " XP";
    document.getElementById("streak-value").textContent = currentStreak();
    document.getElementById("review-count").textContent = getReviewQuestions().length;
    const profileName = document.querySelector(".profile-mini strong");
    const profileCaption = document.querySelector(".profile-mini small");
    if (profileName) profileName.textContent = state.displayName || "Estudiante";
    if (profileCaption) profileCaption.textContent = state.displayName ? "Tu espacio personal" : "Perfil de demostración";
    document.body.dataset.theme = state.theme;
    const themeButton = document.getElementById("theme-toggle");
    themeButton.setAttribute("aria-label", state.theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    themeButton.innerHTML = '<span aria-hidden="true">' + (state.theme === "dark" ? "☀" : "☾") + "</span>";
    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("is-active", item.dataset.action === view || (view === "home" && item.dataset.action === "home"));
    });
  }

  function button(label, action, className, extra) {
    return '<button type="button" class="' + (className || "button") + '" data-action="' + action + '"' + (extra || "") + ">" + label + "</button>";
  }

  function renderHome() {
    const totalAttempted = questions.filter(function (question) {
      return getStats(question.id).attempts > 0;
    }).length;
    const mastered = questions.filter(function (question) {
      return getStats(question.id).lastCorrect;
    }).length;
    const overallProgress = Math.round((mastered / questions.length) * 100);
    const level = nextLevel();
    const displayLevel = level || content.course.levelCount;
    const questionsToReview = getReviewQuestions().length;
    const resumable = state.currentSession && !state.currentSession.completed;
    const name = String(state.displayName || "").trim();
    const isErlinda = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "erlinda";
    const welcomeName = name ? escapeHtml(name) : "estudiante";
    const personalMessage = isErlinda ?
      "Erlinda, mi corazón, cada página que estudias hoy te acerca a esa meta que tanto mereces. Tú puedes con todo, y yo creo en ti. ✨" :
      name ? "Hola, " + escapeHtml(name) + ". Tu esfuerzo de hoy será tu triunfo de mañana." :
      "Cada reto te acerca a dominar el tema. ¿Continuamos?";
    const nameCard = !name ?
      '<form class="name-greeting" id="name-greeting" autocomplete="off">' +
        '<div><label for="student-name">¿Cómo te llamas?</label><p>Personaliza tu espacio de estudio.</p></div>' +
        '<div class="name-greeting-input"><input id="student-name" name="studentName" type="text" maxlength="40" placeholder="Escribe tu nombre" required>' +
        '<button type="submit" class="button button-primary">Empezar <span aria-hidden="true">→</span></button></div>' +
      '</form>' :
      '<div class="personal-motivator ' + (isErlinda ? "motivator-romantic" : "") + '">' +
        '<span class="motivator-icon" aria-hidden="true">' + (isErlinda ? "♥" : "✦") + '</span>' +
        '<div><small>MENSAJE PARA TI</small><p>' + personalMessage + '</p></div>' +
        '<button type="button" class="text-button" data-action="edit-name">Cambiar nombre</button>' +
      '</div>';
    main.innerHTML =
      '<section class="welcome-row">' +
        '<div><p class="eyebrow">MI ESPACIO DE APRENDIZAJE</p><h1>¡Hola, ' + welcomeName + '! <span class="wave">✦</span></h1>' +
        '<p class="welcome-copy">' + escapeHtml(personalMessage) + '</p></div>' +
        '<div class="daily-card"><span class="daily-icon" aria-hidden="true">☀</span><span><strong>' + currentStreak() + (currentStreak() === 1 ? ' día' : ' días') + '</strong><small>de racha actual</small></span></div>' +
      '</section>' +
      nameCard +
      (resumable ? '<section class="resume-banner"><div><strong>Tienes un reto en curso</strong><p>Tu respuesta se guarda al instante. Puedes continuar donde quedaste.</p></div>' + button("Continuar reto →", "resume", "button button-primary") + '</section>' : "") +
      '<section class="hero-card">' +
        '<div class="hero-copy"><span class="hero-kicker"><span class="status-dot"></span> TU SIGUIENTE AVENTURA</span>' +
        '<h2>' + escapeHtml(content.course.title) + '</h2><p>' + escapeHtml(content.course.subtitle) + '</p>' +
        '<div class="hero-meta"><span>⚗ ' + content.topics.length + ' temas</span><span>◷ ' + content.course.questionCount + ' preguntas</span></div>' +
        button((level ? "Continuar en el nivel " + level : "Repasar nivel " + displayLevel) + ' <span aria-hidden="true">→</span>', "start-level", "button button-light", ' data-level="' + displayLevel + '"') +
        '</div><div class="hero-art" aria-hidden="true"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="beaker"><span>✦</span><i></i></div><div class="art-label">APRENDE<br>JUGANDO</div></div>' +
      '</section>' +
      '<section class="stats-grid" aria-label="Resumen de tu avance">' +
        '<article class="stat-card"><span class="stat-icon mint">◉</span><div><small>Dominio del curso</small><strong>' + overallProgress + '%</strong><div class="mini-progress"><i style="width:' + overallProgress + '%"></i></div></div></article>' +
        '<article class="stat-card"><span class="stat-icon gold">✦</span><div><small>Puntos de experiencia</small><strong>' + state.xp + ' XP</strong><span class="stat-caption">Sigue sumando con cada reto</span></div></article>' +
        '<article class="stat-card"><span class="stat-icon lavender">▤</span><div><small>' + (level ? "Nivel disponible" : "Curso completado") + '</small><strong>' + displayLevel + ' de ' + content.course.levelCount + '</strong><span class="stat-caption">' + Object.keys(state.passedLevels).filter(function (key) { return key.indexOf("course:") === 0 && state.passedLevels[key]; }).length + ' niveles superados · ' + totalAttempted + ' preguntas vistas</span></div></article>' +
      '</section>' +
      '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">RUTA GRADUADA</p><h2>21 niveles · 10 preguntas cada uno</h2></div></div>' + levelGrid() + '</section>' +
      '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">TU RUTA</p><h2>Temas del curso</h2></div>' + button("Ver todos →", "topics", "text-button") + '</div>' +
        '<div class="topic-grid">' + content.topics.map(topicCard).join("") + '</div>' +
      '</section>' +
      '<section class="section-block quick-row"><div><p class="eyebrow">POCO TIEMPO, BUEN PROGRESO</p><h2>Un reto rápido de 90 segundos</h2><p>Una pequeña práctica para mantener el ritmo.</p></div>' +
        button("Empezar reto rápido <span aria-hidden=\"true\">↗</span>", "start-quick", "button button-outline") +
      '</section>' +
      '<section class="review-strip"><span class="review-strip-icon" aria-hidden="true">↻</span><div><strong>' + (questionsToReview ? "Tus repasos te esperan" : "Repaso inteligente") + '</strong><p>' + (questionsToReview ? questionsToReview + " pregunta(s) por reforzar a partir de tus errores." : "Las preguntas que falles aparecerán aquí para reforzar lo aprendido.") + '</p></div>' +
        button(questionsToReview ? "Repasar ahora →" : "Cómo funciona", questionsToReview ? "review" : "topics", "text-button") +
      '</section>';
  }

  function topicCard(topic) {
    const progress = topicProgress(topic);
    return '<article class="topic-card"><div class="topic-card-top"><span class="topic-icon">' + topic.icon + '</span><span class="topic-level">Págs. ' + topic.sourcePages.join("–") + '</span></div>' +
      '<h3>' + escapeHtml(topic.title) + '</h3><p>' + escapeHtml(topic.description) + '</p>' +
      '<div class="topic-progress-label"><span>' + progress.attempted + ' de ' + progress.total + ' preguntas vistas</span><strong>' + progress.percent + '%</strong></div>' +
      '<div class="progress-track"><i style="width:' + progress.percent + '%"></i></div>' +
      '<div class="topic-card-footer"><small>' + (state.selectedTopics.includes(topic.id) ? "Incluido en prácticas" : "No seleccionado") + '</small>' + button("Practicar tema →", "start-topic", "topic-link", ' data-topic="' + escapeHtml(topic.id) + '"') + '</div></article>';
  }

  function renderTopics() {
    main.innerHTML =
      '<section class="page-heading"><p class="eyebrow">CONTENIDO DEL CURSO</p><h1>Elige tu próximo reto</h1><p>Los niveles se desbloquean en orden al alcanzar 7 de 10 respuestas correctas. También puedes combinar uno o varios temas en prácticas y simulacros.</p></section>' +
      '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">PROGRESIÓN</p><h2>Tu ruta de niveles</h2></div></div>' + levelGrid() + '</section>' +
      '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">TEMAS DEL PDF</p><h2>Progreso por tema</h2></div></div>' +
      '<div class="topic-grid topic-grid-page">' + content.topics.map(topicCard).join("") + '</div></section>' +
      '<section class="selection-panel"><div><p class="eyebrow">PRÁCTICA PERSONALIZADA</p><h2>Selecciona uno o varios temas</h2><p>La selección se guarda automáticamente. El simulacro combinará hasta 20 preguntas de los temas marcados.</p></div>' +
      '<div class="topic-selector">' + topicSelectionControls() + '</div>' +
      button("Iniciar simulacro →", "start-exam", "button button-primary") + '</section>';
  }

  function renderExam() {
    const loaded = pdfExam && pdfExam.questions.length;
    main.innerHTML =
      '<section class="page-heading"><p class="eyebrow">SIMULACRO PERSONALIZADO</p><h1>Practica con tu propio PDF</h1><p>Carga un documento para extraer sus textos y crear preguntas de reconocimiento localmente. El archivo no se sube a ningún servidor.</p></section>' +
      '<section class="pdf-upload-card">' +
        '<div class="pdf-upload-icon" aria-hidden="true">PDF</div>' +
        '<div class="pdf-upload-copy"><h2>Sube tu documento</h2><p>Formatos PDF con texto seleccionable. Máximo recomendado: 20 MB.</p></div>' +
        '<label class="pdf-file-button" for="pdf-file">Seleccionar PDF<input id="pdf-file" type="file" accept="application/pdf,.pdf"></label>' +
      '</section>' +
      '<section class="pdf-status" id="pdf-status" role="status">' +
        (loaded ? '<span class="pdf-status-ready">✓</span><div><strong>' + escapeHtml(pdfExam.name) + '</strong><p>' + pdfExam.questions.length + ' fragmentos disponibles · ' + pdfExam.pageCount + ' páginas</p></div>' :
          '<span class="pdf-status-empty">＋</span><div><strong>Sin documento cargado</strong><p>Selecciona un PDF para preparar el simulacro.</p></div>') +
      '</section>' +
      '<section class="pdf-options"><div><p class="eyebrow">CONFIGURACIÓN</p><h2>Cantidad y duración</h2></div>' +
        '<label>Tipo de examen<select id="pdf-question-type"' + (loaded ? "" : " disabled") + '><option value="completion">Complementación</option><option value="multiple-choice">Selección múltiple</option></select></label>' +
        '<label>Cantidad de preguntas<select id="pdf-question-count"' + (loaded ? "" : " disabled") + '><option value="10">10 preguntas</option><option value="20">20 preguntas</option><option value="30">30 preguntas</option><option value="100" selected>100 preguntas</option></select></label>' +
        '<label>Tiempo límite<select id="pdf-time-limit"' + (loaded ? "" : " disabled") + '><option value="20">20 minutos</option><option value="40">40 minutos</option><option value="60">60 minutos</option></select></label>' +
      '</section>' +
      '<div class="pdf-actions">' + button("Usar simulacro del curso", "start-exam", "button button-outline") +
      '<button type="button" class="button button-primary" data-action="start-pdf-exam"' + (loaded ? "" : " disabled") + '>Crear simulacro del PDF <span aria-hidden="true">→</span></button></div>' +
      '<p class="pdf-disclaimer"><strong>Nota:</strong> el prototipo genera preguntas de reconocimiento a partir de fragmentos del PDF. Revisa el contenido antes de usarlo como evaluación académica oficial.</p>';
  }

  function renderReview() {
    const questions = getReviewQuestions();
    main.innerHTML =
      '<section class="page-heading"><p class="eyebrow">APRENDIZAJE ADAPTATIVO</p><h1>Repaso inteligente <span class="heading-mark">↻</span></h1><p>Vuelve sobre preguntas que te costaron y consolida los conceptos paso a paso.</p></section>' +
      (questions.length ?
        '<section class="review-ready"><div><span class="review-big-icon" aria-hidden="true">↻</span><div><h2>' + questions.length + ' pregunta(s) para reforzar</h2><p>Se priorizan las preguntas que respondiste incorrectamente y aún no has resuelto bien.</p></div></div>' +
        '<ul class="review-question-list">' + questions.map(function (question) { return '<li><span class="review-dot"></span><span>' + escapeHtml(question.prompt) + '</span><small>' + escapeHtml(question.topicTitle) + '</small></li>'; }).join("") + '</ul>' +
        button("Iniciar repaso →", "start-review", "button button-primary") + '</section>' :
        '<section class="empty-state"><span class="empty-icon">✦</span><h2>Tu lista de repaso está despejada</h2><p>Cuando falles una pregunta, la añadiremos aquí. Practica un tema para empezar.</p>' + button("Ir a los temas →", "topics", "button button-primary") + '</section>');
  }

  const topicKnowledge = {
    fundamentos: "El control de calidad usa varios atributos complementarios —identidad, potencia, pureza y seguridad—; aprobar una sola prueba no reemplaza la evaluación integral del medicamento.",
    muestreo: "Una muestra representativa ayuda a inferir la calidad del lote. La selección debe seguir un procedimiento documentado para reducir sesgos y conservar la trazabilidad.",
    identificacion: "La identificación responde qué sustancia está presente; por sí sola no determina cuánto hay ni demuestra que el producto cumpla todos los requisitos de calidad.",
    pureza: "La pureza se evalúa frente a especificaciones y límites definidos para el producto. Detectar una impureza requiere considerar su identidad, cantidad y posible impacto.",
    adulteracion: "Cambios intencionales en composición o rotulado comprometen la identidad y la seguridad; la revisión analítica debe acompañarse de documentación y trazabilidad.",
    alteraciones: "La luz, humedad, temperatura y microorganismos pueden modificar un medicamento. Las condiciones de almacenamiento y el envase forman parte de la evaluación de estabilidad.",
    cuantitativo: "Exactitud y precisión son conceptos distintos: una serie puede ser repetible y aun así desviarse del valor verdadero. La calibración y el método influyen en ambos.",
    volumetria: "Una valoración depende de una reacción cuantitativa conocida y de una solución valorante estandarizada. El punto final observado debe aproximarse al punto de equivalencia.",
    hplc: "La separación cromatográfica depende de cómo se distribuyen los componentes entre las fases móvil y estacionaria. La identificación se fortalece con patrones y condiciones validadas.",
    espectrofotometria: "La relación entre absorbancia y concentración se usa dentro de condiciones adecuadas y un intervalo validado; blanco, calibración y longitud de onda importan.",
    microbiologia: "Los criterios microbiológicos dependen de la forma farmacéutica y de si el producto debe ser estéril. Los límites y métodos aplicables deben verificarse en la norma correspondiente.",
    biofarmacia: "La formulación puede influir en liberación, disolución y absorción. Compartir principio activo no basta, por sí solo, para concluir que dos productos son intercambiables.",
    "estudios-estabilidad": "La vida útil debe sustentarse con datos obtenidos bajo condiciones y en envases definidos; no se deduce únicamente de una observación aislada.",
    "estabilidad-fisica": "Cambios físicos pueden afectar uniformidad, facilidad de administración o liberación del principio activo, por lo que deben interpretarse según el tipo de formulación.",
    biodisponibilidad: "En farmacología, biodisponibilidad describe la velocidad y la fracción de principio activo que alcanza la circulación sistémica; puede verse afectada por formulación y administración.",
    residuos: "La eliminación de medicamentos debe seguir las reglas locales y los procedimientos institucionales; no debe asumirse que el desagüe o la basura común son opciones seguras."
  };

  function uniqueExplanations(options) {
    return Array.from(new Set(options.map(function (option) { return option.explanation; }).filter(Boolean)))
      .map(escapeHtml).join(" ");
  }

  function renderAnswerFeedback(question, answer) {
    const completion = question.type === "completion";
    const selected = completion ? [answer.text || ""] : (answer.optionIndexes || []).map(function (index) {
      return question.options[index] ? question.options[index].text : "";
    }).filter(Boolean);
    const correctOptions = completion ? [] : question.options.filter(function (option) { return option.correct; });
    const correctText = completion ? question.correctAnswer : correctOptions.map(function (option) { return option.text; }).join(" · ");
    const selectedReasons = completion ? [] : (answer.optionIndexes || []).map(function (index) {
      return question.options[index];
    }).filter(Boolean);
    const sourceName = question.sourceName || content.course.source;
    const knowledge = question.knowledgeNote || topicKnowledge[question.topicId] ||
      "Compara la respuesta con el fragmento del documento y revisa cómo se aplica el concepto al contexto de la pregunta.";
    const heading = answer.correct ? "¡Correcta! Esta respuesta coincide con el criterio evaluado." : "Respuesta incorrecta: revisemos el razonamiento.";
    const selectedBlock = selected.length ?
      '<div class="feedback-detail ' + (answer.correct ? "is-positive" : "is-negative") + '"><strong>' +
        (selected.length > 1 ? "Tus respuestas" : "Tu respuesta") + '</strong><p>' + selected.map(escapeHtml).join(" · ") + '</p>' +
        (!answer.correct && selectedReasons.length ? '<small>' + uniqueExplanations(selectedReasons) + '</small>' :
          !answer.correct ? '<small>La respuesta escrita no coincide con la solución esperada. Revisa la respuesta correcta y el fundamento antes de continuar.</small>' : "") +
      '</div>' : "";
    return '<div class="answer-feedback ' + (answer.correct ? "answer-feedback-correct" : "answer-feedback-incorrect") + '">' +
      '<strong class="answer-feedback-title">' + heading + '</strong>' +
      selectedBlock +
      '<div class="feedback-detail"><strong>Respuesta correcta</strong><p>' + escapeHtml(correctText) + '</p>' +
        (!completion && correctOptions.length ? '<small>' + uniqueExplanations(correctOptions) + '</small>' : "") +
      '</div>' +
      '<div class="feedback-detail"><strong>Fundamento del documento</strong><p>' + escapeHtml(question.explanation) + '</p></div>' +
      '<div class="feedback-detail feedback-knowledge"><strong>Contexto farmacéutico general</strong><p>' + escapeHtml(knowledge) + '</p></div>' +
      '<p class="source-note">Fuente: ' + escapeHtml(sourceName) + ', página ' + question.sourcePage + '.</p></div>';
  }

  function renderSession() {
    const session = state.currentSession;
    if (!session) {
      view = "home";
      renderHome();
      return;
    }
    if (session.completed) {
      renderResults(session);
      return;
    }
    const question = findQuestion(session.questionIds[session.index]);
    if (!question) {
      view = "home";
      state.currentSession = null;
      saveState();
      renderHome();
      return;
    }
    const answer = session.answers[session.index];
    const selectedOptions = session.selections && session.selections[session.index] || [];
    const multiSelect = question.type === "multiple";
    const completion = question.type === "completion";
    const requiredSelections = multiSelect ? question.selectionCount : 1;
    const progress = Math.round((session.index / session.questionIds.length) * 100);
    const timer = session.deadlineAt ? '<span class="timer-pill" id="session-timer">◷ --:--</span>' : "";
    const completionAnswer = answer ? escapeHtml(answer.text || "") : "";
    const answerArea = completion ?
      '<div class="completion-answer">' +
        '<label for="completion-response">Tu respuesta</label>' +
        '<input id="completion-response" type="text" autocomplete="off" placeholder="Escribe la palabra o frase que falta"' +
          (answer ? ' value="' + completionAnswer + '" disabled' : "") + '>' +
        (answer ? '<div class="completion-correct-answer"><strong>Respuesta correcta:</strong> ' + escapeHtml(question.correctAnswer) + '</div>' : "") +
      '</div>' :
      '<div class="answer-list">' + question.options.map(function (option, index) {
        const chosen = answer ? answer.optionIndexes.includes(index) : selectedOptions.includes(index);
        let classes = "answer-option";
        if (answer && option.correct) classes += " is-correct";
        if (chosen && !option.correct) classes += " is-incorrect";
        if (!answer && chosen) classes += " is-selected";
        return '<button type="button" class="' + classes + '" data-action="' + (multiSelect ? "toggle-option" : "answer") + '" data-option="' + index + '"' +
          (answer ? " disabled" : "") + '><span class="answer-letter">' + String.fromCharCode(65 + index) + '</span><span class="answer-text">' + escapeHtml(option.text) + '</span>' +
          (answer ? '<span class="answer-symbol">' + (option.correct ? "✓" : (chosen ? "×" : "")) + "</span>" : chosen ? '<span class="answer-symbol">✓</span>' : "") + '</button>';
      }).join("") + '</div>';
    main.innerHTML =
      '<section class="quiz-shell">' +
        '<div class="quiz-top"><button class="back-button" data-action="quit-session" type="button">← Salir</button><span class="quiz-mode">' + modeLabel(session.mode) + '</span>' + timer + '</div>' +
        '<div class="quiz-progress-row"><span>Pregunta ' + (session.index + 1) + ' de ' + session.questionIds.length + '</span><strong>' + Math.max(progress, 4) + '%</strong></div>' +
        '<div class="quiz-progress-track"><i style="width:' + Math.max(progress, 4) + '%"></i></div>' +
        '<div class="question-card"><div class="question-meta"><span class="topic-chip">' + escapeHtml(question.topicTitle) + '</span><span class="difficulty-chip">Nivel ' + question.level + (multiSelect ? " · Selección múltiple" : "") + '</span></div>' +
        '<h1>' + escapeHtml(completion && question.textWithBlank ? question.textWithBlank : question.prompt) + '</h1><p class="select-hint">' +
          (answer ? "Respuesta y explicación:" : completion ? "Completa el espacio en blanco." : multiSelect ? "Selecciona exactamente " + requiredSelections + (requiredSelections === 1 ? " opción." : " opciones.") : "Selecciona la respuesta que consideres correcta.") + '</p>' +
        answerArea +
        (answer ? renderAnswerFeedback(question, answer) : "") +
        '</div>' +
        (answer ? button(session.index === session.questionIds.length - 1 ? "Ver resultados →" : "Siguiente pregunta →", "next-question", "button button-primary quiz-next") :
          completion ? button("Confirmar respuesta →", "submit-completion", "button button-primary quiz-next") :
          multiSelect ? button("Confirmar respuesta →", "submit-answer", "button button-primary quiz-next", selectedOptions.length === requiredSelections ? "" : " disabled") : "") +
      '</section>';
    if (session.deadlineAt) updateTimer();
  }

  function modeLabel(mode) {
    return {
      level: "Reto · Nivel " + (state.currentSession.level || 1),
      quick: "Reto rápido · contrarreloj",
      exam: "Simulacro",
      pdf: "Simulacro desde PDF",
      review: "Repaso inteligente"
    }[mode] || "Reto";
  }

  function startSession(mode, questionList, level, seconds, customQuestions) {
    if (!questionList.length) {
      showToast("No hay preguntas disponibles para esta práctica.");
      return;
    }
    const ids = questionList.map(function (question) { return question.id; });
    state.currentSession = {
      mode: mode,
      level: level || null,
      questionIds: ids,
      index: 0,
      answers: [],
      selections: [],
      customQuestions: customQuestions || null,
      startedAt: Date.now(),
      deadlineAt: seconds ? Date.now() + seconds * 1000 : null,
      completed: false
    };
    view = "session";
    saveState();
    render();
  }

  function startLevel(requestedLevel) {
    const level = Number(requestedLevel || nextLevel() || content.course.levelCount);
    if (!Number.isInteger(level) || level < 1 || level > content.course.levelCount) {
      showToast("Ese nivel no está disponible.");
      return;
    }
    if (levelStatus(level) === "locked") {
      showToast("Supera el nivel anterior para desbloquear este reto.");
      return;
    }
    const levelQuestions = questions.filter(function (question) { return question.level === level; });
    const sessionQuestions = levelQuestions.slice().sort(function () { return Math.random() - 0.5; });
    startSession("level", sessionQuestions, level, null);
  }

  function startQuick() {
    const questions = randomQuestionsFromSelectedTopics(3);
    startSession("quick", questions, null, 90);
  }

  function startExam() {
    const questions = randomQuestionsFromSelectedTopics(20);
    startSession("exam", questions, null, null);
  }

  async function loadPdf(file) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Selecciona un archivo PDF válido.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast("El PDF supera el límite recomendado de 20 MB.");
      return;
    }
    if (!window.pdfjsLib) {
      showToast("No se pudo cargar el lector de PDF.");
      return;
    }
    const status = document.getElementById("pdf-status");
    if (status) status.innerHTML = '<span class="pdf-status-loading">…</span><div><strong>Procesando documento</strong><p>Extrayendo el texto localmente...</p></div>';
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const data = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: data }).promise;
      const candidates = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(function (item) { return item.str; }).join(" ").replace(/\s+/g, " ").trim();
        const sentences = pageText.match(/[^.!?]{35,220}[.!?]?/g) || [pageText];
        sentences.forEach(function (sentence) {
          const clean = sentence.replace(/\s+/g, " ").trim();
          if (clean.length >= 35) candidates.push({ text: clean, page: pageNumber });
        });
      }
      if (candidates.length < 4) {
        throw new Error("El PDF no contiene suficiente texto seleccionable.");
      }
      const shuffled = candidates.slice().sort(function () { return Math.random() - 0.5; });
      const generated = shuffled.slice(0, Math.min(30, shuffled.length)).map(function (candidate, index) {
        const distractors = candidates
          .filter(function (item) { return item.text !== candidate.text; })
          .sort(function () { return Math.random() - 0.5; })
          .slice(0, 3)
          .map(function (item) { return item.text.slice(0, 220); });
        const options = [candidate.text].concat(distractors).sort(function () { return Math.random() - 0.5; });
        const correctIndex = options.indexOf(candidate.text);
        return {
          id: "pdf-" + index + "-" + Date.now(),
          topicId: content.topics[0].id,
          topicTitle: "Documento: " + file.name,
          sourceName: file.name,
          knowledgeNote: "Una pregunta de reconocimiento literal comprueba si puedes localizar información explícita. Para evaluar comprensión, relaciona el fragmento con la idea central y el contexto de la página.",
          level: 1,
          type: "single",
          selectionCount: 1,
          prompt: "¿Cuál de las siguientes afirmaciones aparece exactamente en el PDF?",
          options: options.map(function (text, optionIndex) {
            return {
              text: text,
              correct: optionIndex === correctIndex,
              explanation: optionIndex === correctIndex
                ? "Este fragmento corresponde al texto de la página " + candidate.page + "."
                : "Este fragmento no corresponde al texto correcto de esta pregunta."
            };
          }),
          explanation: "La opción correcta reproduce un fragmento localizado en la página " + candidate.page + " del documento.",
          sourcePage: candidate.page
        };
      });
      pdfExam = { name: file.name, pageCount: pdf.numPages, questions: generated, fragments: candidates };
      renderExam();
      showToast("PDF procesado: " + generated.length + " preguntas disponibles.");
    } catch (error) {
      pdfExam = null;
      if (status) status.innerHTML = '<span class="pdf-status-error">!</span><div><strong>No se pudo procesar el PDF</strong><p>' + escapeHtml(error.message || "El documento puede estar protegido o contener solo imágenes.") + '</p></div>';
      showToast("No se pudo preparar el simulacro con ese PDF.");
    }
  }

  function startPdfExam() {
    if (!pdfExam || !pdfExam.questions.length) {
      showToast("Primero carga un PDF válido.");
      return;
    }
    const countSelect = document.getElementById("pdf-question-count");
    const timeSelect = document.getElementById("pdf-time-limit");
    const typeSelect = document.getElementById("pdf-question-type");
    const count = countSelect ? Number(countSelect.value) : 10;
    const minutes = timeSelect ? Number(timeSelect.value) : 20;
    const format = typeSelect ? typeSelect.value : "completion";
    let customQuestions = pdfExam.questions.slice(0, Math.min(count, pdfExam.questions.length));
    if (format === "completion") {
      const uniqueFragments = pdfExam.fragments.slice().sort(function () { return Math.random() - 0.5; });
      const fragments = [];
      while (fragments.length < count) fragments.push(uniqueFragments[fragments.length % uniqueFragments.length]);
      customQuestions = fragments.map(function (fragment, index) {
        const words = fragment.text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+(?:[.,;:][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)?/g) || [];
        const eligible = words.map(function (word, wordIndex) { return { word: word.replace(/[.,;:]$/, ""), wordIndex: wordIndex }; })
          .filter(function (item) { return item.word.length >= 4; });
        if (!eligible.length) return null;
        const chosen = eligible[Math.floor(eligible.length / 2)];
        const answerWords = fragment.text.split(/\s+/);
        let blankIndex = chosen.wordIndex;
        let prompt = "";
        if (answerWords.length >= 2) {
          const approximate = Math.round(answerWords.length / 2);
          blankIndex = approximate;
          const blankWord = answerWords[approximate].replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+$/g, "");
          if (blankWord.length >= 4) {
            const prefix = answerWords.slice(0, approximate).join(" ");
            const suffix = answerWords.slice(approximate + 1).join(" ");
            prompt = (prefix ? prefix + " " : "") + "__________" + (suffix ? " " + suffix : "");
            chosen.word = blankWord;
          } else {
            prompt = fragment.text;
          }
        } else {
          prompt = fragment.text;
        }
        return {
          id: "pdf-completion-" + index + "-" + Date.now(),
          topicId: content.topics[0].id,
          topicTitle: "Documento: " + pdfExam.name,
          sourceName: pdfExam.name,
          knowledgeNote: "La complementación ayuda a recuperar términos clave de memoria. Comprueba también el sentido de la oración completa: escribir una palabra aislada sin entender el concepto no garantiza comprensión.",
          level: 1,
          type: "completion",
          selectionCount: 1,
          prompt: "Completa el fragmento:",
          textWithBlank: prompt,
          correctAnswer: chosen.word,
          options: [],
          explanation: "La palabra o frase completa el texto localizado en la página " + fragment.page + ".",
          sourcePage: fragment.page
        };
      }).filter(Boolean);
    }
    const sessionQuestions = customQuestions.slice();
    startSession("pdf", sessionQuestions, null, minutes * 60, customQuestions);
  }

  function toggleOption(optionIndex) {
    const session = state.currentSession;
    if (!session || session.answers[session.index]) return;
    const question = findQuestion(session.questionIds[session.index]);
    if (!question || question.type !== "multiple" || !question.options[optionIndex]) return;
    const selected = session.selections[session.index] || [];
    const existingIndex = selected.indexOf(optionIndex);
    if (existingIndex >= 0) selected.splice(existingIndex, 1);
    else if (selected.length < question.selectionCount) selected.push(optionIndex);
    else {
      showToast("Esta pregunta requiere exactamente " + question.selectionCount + (question.selectionCount === 1 ? " opción." : " opciones."));
      return;
    }
    session.selections[session.index] = selected;
    saveState();
    renderSession();
  }

  function recordCompletion(text) {
    const session = state.currentSession;
    if (!session || session.answers[session.index]) return;
    const question = findQuestion(session.questionIds[session.index]);
    if (!question || question.type !== "completion") return;
    const normalize = function (value) {
      return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, " ").trim();
    };
    const response = String(text || "").trim();
    if (!response) {
      showToast("Escribe tu respuesta antes de confirmar.");
      return;
    }
    const correct = normalize(response) === normalize(question.correctAnswer);
    session.answers[session.index] = { optionIndexes: [], text: response, correct: correct };
    const stats = getStats(question.id);
    stats.attempts += 1;
    if (correct) stats.correct += 1;
    else stats.incorrect += 1;
    stats.lastCorrect = correct;
    stats.lastSeenAt = Date.now();
    state.questionStats[question.id] = stats;
    markStudyToday();
    if (correct && !state.awardedQuestions.includes(question.id)) {
      state.awardedQuestions.push(question.id);
      state.xp += 10;
      session.xpEarned = (session.xpEarned || 0) + 10;
    }
    saveState();
    syncHeader();
    renderSession();
  }

  function recordAnswer(optionIndexes) {
    const session = state.currentSession;
    if (!session || session.answers[session.index]) return;
    const question = findQuestion(session.questionIds[session.index]);
    if (!question || !Array.isArray(optionIndexes) || !optionIndexes.length ||
        optionIndexes.some(function (index) { return !question.options[index]; })) return;
    const requiredSelections = question.type === "multiple" ? question.selectionCount : 1;
    if (optionIndexes.length !== requiredSelections) {
      showToast("Selecciona exactamente " + requiredSelections + (requiredSelections === 1 ? " opción." : " opciones."));
      return;
    }
    const selected = new Set(optionIndexes);
    const correctIndexes = question.options.reduce(function (indexes, option, index) {
      if (option.correct) indexes.push(index);
      return indexes;
    }, []);
    const correct = selected.size === correctIndexes.length && correctIndexes.every(function (index) { return selected.has(index); });
    session.answers[session.index] = { optionIndexes: Array.from(selected), correct: correct };
    const stats = getStats(question.id);
    stats.attempts += 1;
    if (correct) stats.correct += 1;
    else stats.incorrect += 1;
    stats.lastCorrect = correct;
    stats.lastSeenAt = Date.now();
    state.questionStats[question.id] = stats;
    markStudyToday();
    if (correct && !state.awardedQuestions.includes(question.id)) {
      state.awardedQuestions.push(question.id);
      state.xp += 10;
      session.xpEarned = (session.xpEarned || 0) + 10;
    }
    saveState();
    syncHeader();
    renderSession();
  }

  function nextQuestion() {
    const session = state.currentSession;
    if (!session) return;
    if (session.index >= session.questionIds.length - 1) {
      completeSession(session);
      render();
      return;
    }
    session.index += 1;
    saveState();
    renderSession();
  }

  function completeSession(session) {
    if (session.completed) return;
    session.completed = true;
    session.completedAt = Date.now();
    const correct = session.answers.filter(function (answer) { return answer && answer.correct; }).length;
    session.score = session.answers.length ? Math.round((correct / session.questionIds.length) * 100) : 0;
    if (session.mode === "level" && session.score >= 70) {
      const levelKey = "course:" + session.level;
      if (!state.passedLevels[levelKey]) {
        state.passedLevels[levelKey] = true;
        state.xp += 30;
        session.xpEarned = (session.xpEarned || 0) + 30;
      }
      session.levelPassed = true;
    }
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
    saveState();
    syncHeader();
  }

  function renderResults(session) {
    const correct = session.answers.filter(function (answer) { return answer && answer.correct; }).length;
    const wrong = session.answers.filter(function (answer) { return answer && !answer.correct; }).length;
    const unanswered = session.questionIds.length - session.answers.length;
    const title = session.score >= 80 ? "¡Excelente trabajo!" : (session.score >= 60 ? "¡Vas por buen camino!" : "Cada intento te enseña algo");
    const topicResults = {};
    session.questionIds.forEach(function (questionId, index) {
      const question = findQuestion(questionId);
      if (!question) return;
      if (!topicResults[question.topicId]) topicResults[question.topicId] = { correct: 0, answered: 0 };
      const answer = session.answers[index];
      if (answer) {
        topicResults[question.topicId].answered += 1;
        if (answer.correct) topicResults[question.topicId].correct += 1;
      }
    });
    const diagnosticRows = Object.keys(topicResults).map(function (topicId) {
      const result = topicResults[topicId];
      const topic = topicById[topicId];
      const title = topic ? topic.title : (session.customQuestions && session.customQuestions[0] ? session.customQuestions[0].topicTitle : "Documento PDF");
      const percent = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
      return '<div class="diagnostic-row"><span>' + escapeHtml(title) + '</span><div class="progress-track"><i style="width:' + percent + '%"></i></div><strong>' +
        percent + '% <small>' + result.correct + '/' + result.answered + '</small></strong></div>';
    }).join("");
    main.innerHTML =
      '<section class="results-shell"><div class="results-confetti" aria-hidden="true">✦</div><p class="eyebrow">RETO COMPLETADO</p><h1>' + title + '</h1><p class="results-copy">Terminaste ' + escapeHtml(modeLabel(session.mode).toLowerCase()) + '. Revisa tu diagnóstico y elige qué hacer después.</p>' +
      '<div class="score-card"><div class="score-ring" style="--score:' + session.score + '%"><div><strong>' + session.score + '%</strong><small>acierto</small></div></div><div class="score-details"><div><span class="result-check">✓</span><span><strong>' + correct + '</strong><small>correctas</small></span></div><div><span class="result-cross">×</span><span><strong>' + wrong + '</strong><small>por repasar</small></span></div><div><span class="result-xp">✦</span><span><strong>+' + (session.xpEarned || 0) + ' XP</strong><small>experiencia ganada</small></span></div></div></div>' +
      (unanswered ? '<p class="diagnostic-caption">' + unanswered + ' pregunta(s) quedaron sin responder.</p>' : "") +
      (session.levelPassed ? '<div class="unlock-banner"><span aria-hidden="true">🔓</span><div><strong>¡Nivel superado!</strong><p>' + (session.level < content.course.levelCount ? "El nivel " + (session.level + 1) + " ya está disponible." : "Has completado todos los niveles del curso.") + '</p></div></div>' :
        session.mode === "level" ? '<div class="unlock-banner"><span aria-hidden="true">↻</span><div><strong>Necesitas 7 de 10 aciertos</strong><p>Vuelve a intentarlo; el nivel seguirá disponible.</p></div></div>' : "") +
      '<section class="diagnostic-card"><div class="section-heading"><div><p class="eyebrow">DIAGNÓSTICO POR TEMA</p><h2>Tu resultado</h2></div></div>' + diagnosticRows + '<p class="diagnostic-caption">El diagnóstico se calcula con tus respuestas de esta práctica.</p></section>' +
      '<div class="results-actions">' + button("Volver al inicio", "home", "button button-outline") + (getReviewQuestions().length ? button("Repasar errores →", "review", "button button-primary") : button("Seguir practicando →", "start-level", "button button-primary")) + '</div>' +
      '<p class="source-note">Banco de preguntas basado en ' + escapeHtml(content.course.source) + '.</p></section>';
  }

  function render() {
    syncHeader();
    if (view === "topics") renderTopics();
    else if (view === "exam") renderExam();
    else if (view === "review") renderReview();
    else if (view === "session") renderSession();
    else renderHome();
  }

  function updateTimer() {
    const session = state.currentSession;
    const timer = document.getElementById("session-timer");
    if (!session || !session.deadlineAt || !timer) return;
    const remaining = Math.max(0, Math.ceil((session.deadlineAt - Date.now()) / 1000));
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    timer.textContent = "◷ " + minutes + ":" + seconds;
    timer.classList.toggle("timer-warning", remaining <= 20);
    if (remaining <= 0) {
      completeSession(session);
      view = "session";
      render();
    }
  }

  function startTimer() {
    if (timerHandle) clearInterval(timerHandle);
    if (state.currentSession && state.currentSession.deadlineAt && !state.currentSession.completed) {
      timerHandle = setInterval(updateTimer, 1000);
      updateTimer();
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastHandle) clearTimeout(toastHandle);
    toastHandle = setTimeout(function () { toast.classList.remove("is-visible"); }, 2800);
  }

  document.addEventListener("click", function (event) {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (action === "home") {
      view = "home";
      if (state.currentSession && state.currentSession.completed) state.currentSession = null;
    } else if (action === "topics") {
      view = "topics";
    } else if (action === "review") {
      view = "review";
    } else if (action === "exam") {
      view = "exam";
      render();
      return;
    } else if (action === "start-level") {
      startLevel(actionElement.dataset.level);
      return;
    } else if (action === "start-topic") {
      state.selectedTopics = [actionElement.dataset.topic];
      saveState();
      startExam();
      return;
    } else if (action === "start-quick") {
      startQuick();
      return;
    } else if (action === "start-exam") {
      startExam();
      return;
    } else if (action === "start-pdf-exam") {
      startPdfExam();
      return;
    } else if (action === "start-review") {
      startSession("review", getReviewQuestions(), null, null);
      return;
    } else if (action === "edit-name") {
      state.displayName = "";
      saveState();
      render();
      setTimeout(function () {
        const nameInput = document.getElementById("student-name");
        if (nameInput) nameInput.focus();
      }, 0);
      return;
    } else if (action === "resume") {
      view = "session";
    } else if (action === "answer") {
      recordAnswer([Number(actionElement.dataset.option)]);
      return;
    } else if (action === "toggle-option") {
      toggleOption(Number(actionElement.dataset.option));
      return;
    } else if (action === "submit-answer") {
      const session = state.currentSession;
      if (session) recordAnswer(session.selections[session.index] || []);
      return;
    } else if (action === "submit-completion") {
      const input = document.getElementById("completion-response");
      if (input) recordCompletion(input.value);
      return;
    } else if (action === "next-question") {
      nextQuestion();
      return;
    } else if (action === "quit-session") {
      view = "home";
      showToast("Tu reto quedó guardado. Puedes continuarlo desde Inicio.");
    }
    render();
  });

  document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "student-name") {
      const name = event.target.value.trim();
      const heading = document.querySelector(".welcome-row h1");
      const copy = document.querySelector(".welcome-copy");
      if (heading) heading.innerHTML = "¡Hola, " + escapeHtml(name || "estudiante") + '! <span class="wave">✦</span>';
      if (copy) {
        const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        copy.textContent = normalized === "erlinda" ?
          "Erlinda, mi corazón, cada página que estudias hoy te acerca a esa meta que tanto mereces. Tú puedes con todo, y yo creo en ti. ✨" :
          name ? "Hola, " + name + ". Tu esfuerzo de hoy será tu triunfo de mañana." :
          "Cada reto te acerca a dominar el tema. ¿Continuamos?";
      }
    }
  });

  document.addEventListener("submit", function (event) {
    if (event.target && event.target.id === "name-greeting") {
      event.preventDefault();
      const input = document.getElementById("student-name");
      const name = input ? input.value.trim().replace(/\s+/g, " ") : "";
      if (!name) {
        showToast("Escribe tu nombre para personalizar el inicio.");
        if (input) input.focus();
        return;
      }
      state.displayName = name.slice(0, 40);
      saveState();
      showToast("¡Listo, " + state.displayName + "! Tu espacio está preparado.");
      render();
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "pdf-file") {
      loadPdf(event.target.files && event.target.files[0]);
      return;
    }
    const topicInput = event.target.closest("[data-topic-select]");
    if (!topicInput) return;
    const topicId = topicInput.dataset.topicSelect;
    if (topicInput.checked && !state.selectedTopics.includes(topicId)) state.selectedTopics.push(topicId);
    if (!topicInput.checked) state.selectedTopics = state.selectedTopics.filter(function (selectedId) { return selectedId !== topicId; });
    saveState();
    renderTopics();
  });

  document.getElementById("theme-toggle").addEventListener("click", function () {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveState();
    syncHeader();
  });

  document.getElementById("mobile-menu").addEventListener("click", function () {
    const sidebar = document.getElementById("sidebar");
    const isOpen = sidebar.classList.toggle("is-open");
    this.setAttribute("aria-expanded", String(isOpen));
    this.setAttribute("aria-label", isOpen ? "Cerrar navegación" : "Abrir navegación");
  });

  document.querySelector(".sidebar").addEventListener("click", function (event) {
    if (event.target.closest("[data-action]") && window.matchMedia("(max-width: 760px)").matches) {
      this.classList.remove("is-open");
      document.getElementById("mobile-menu").setAttribute("aria-expanded", "false");
    }
  });

  state.selectedTopics = state.selectedTopics.filter(function (topicId) { return Boolean(topicById[topicId]); });
  view = state.currentSession && !state.currentSession.completed ? "session" : "home";
  render();
  startTimer();
})();
