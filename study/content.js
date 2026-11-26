window.STUDY_CONTENT = {
  course: {
    id: "control-medicamentos",
    title: "Control de medicamentos",
    subtitle: "21 niveles, 10 preguntas por nivel y explicaciones basadas en las diapositivas.",
    source: "Control de medicamentos — Jenny Pinto",
    levelCount: 21,
    questionsPerLevel: 10,
    questionCount: 210
  },
  topics: [
    { id: "fundamentos", title: "Fundamentos y calidad", description: "Medicamentos, eficacia, calidad y farmacopea.", icon: "⚗", sourcePages: [1, 6] },
    { id: "muestreo", title: "Muestreo", description: "Lotes, representatividad y etapas del muestreo.", icon: "◉", sourcePages: [7, 9] },
    { id: "identificacion", title: "Identificación farmacéutica", description: "Identidad, caracterización y recursos de identificación.", icon: "⌕", sourcePages: [10, 12] },
    { id: "pureza", title: "Pureza e impurezas", description: "Pureza relativa, fuentes y criterios de análisis.", icon: "◇", sourcePages: [13, 16] },
    { id: "adulteracion", title: "Adulteración y falsificación", description: "Señales, técnicas y consecuencias.", icon: "!", sourcePages: [17, 20] },
    { id: "alteraciones", title: "Alteración y degradación", description: "Agentes y fenómenos que afectan medicamentos.", icon: "↯", sourcePages: [21, 25] },
    { id: "cuantitativo", title: "Análisis cuantitativo", description: "Concentración, métodos, errores y muestreo analítico.", icon: "∑", sourcePages: [26, 28] },
    { id: "volumetria", title: "Métodos volumétricos", description: "Valoración, soluciones patrón e indicadores.", icon: "◷", sourcePages: [29, 38] },
    { id: "hplc", title: "Cromatografía y HPLC", description: "Separación, fases, equipos y cromatogramas.", icon: "⌁", sourcePages: [39, 45] },
    { id: "espectrofotometria", title: "Espectrofotometría UV-Visible", description: "Radiación, absorbancia y análisis instrumental.", icon: "☼", sourcePages: [46, 50] },
    { id: "microbiologia", title: "Control microbiológico", description: "Entorno, agua, personal y productos.", icon: "⊙", sourcePages: [51, 60] },
    { id: "biofarmacia", title: "Biofarmacia y formas farmacéuticas", description: "Relación entre la formulación y el efecto biológico.", icon: "◌", sourcePages: [61, 65] },
    { id: "estudios-estabilidad", title: "Estudios de estabilidad", description: "Planificación, muestras y registro de resultados.", icon: "⌛", sourcePages: [69, 78] },
    { id: "estabilidad-fisica", title: "Estabilidad física", description: "Emulsiones, suspensiones, sólidos y envases.", icon: "▱", sourcePages: [79, 84] },
    { id: "biodisponibilidad", title: "Biodisponibilidad", description: "Factores que pueden modificar la disponibilidad biológica.", icon: "↗", sourcePages: [85, 89] },
    { id: "residuos", title: "Medicamentos vencidos y residuos", description: "Responsabilidades y criterios generales de disposición segura.", icon: "♻", sourcePages: [90, 98] }
  ],
  conceptGroups: [
    {
      title: "Fundamentos del control de calidad",
      summary: "Qué es un medicamento, cómo se asegura su calidad y cómo se obtiene evidencia confiable.",
      topics: [
        { id: "fundamentos", concepts: ["Medicamento: principio activo y sustancias auxiliares con una finalidad terapéutica.", "Atributos de calidad: identidad, pureza, potencia, seguridad y cumplimiento de especificaciones.", "Responsabilidad ética y legal; eficacia, eficiencia, farmacopeas y organismos de referencia."] },
        { id: "muestreo", concepts: ["Lote: unidades producidas bajo condiciones definidas; la muestra debe representarlo.", "Etapas: toma, reducción, preparación y obtención de la muestra analítica.", "Selección aleatoria o sistemática, documentación y prevención de sesgos."] },
        { id: "identificacion", concepts: ["Identificar confirma qué sustancia está presente; caracterizar describe sus atributos.", "Pruebas de orientación y confirmación; propiedades físicas como punto de fusión e índice de refracción.", "Evaluación organoléptica y métodos analíticos apropiados; no sustituir una prueba por otra."] },
        { id: "pureza", concepts: ["La identificación precede a la evaluación de pureza.", "Pureza relativa: impurezas dentro de límites y especificaciones establecidos.", "Impurezas tóxicas, potentes, alterantes o incompatibles; la purificación puede causar pérdidas."] }
      ]
    },
    {
      title: "Composición, medición y estabilidad",
      summary: "Cómo se detectan cambios, se cuantifica el principio activo y se estudia la vida útil.",
      topics: [
        { id: "adulteracion", concepts: ["Adulteración: modificación deliberada; incluye sustracción, adición, dilución o sustitución.", "Alertas: precio inusual, proveedor dudoso, aspecto alterado o rotulado inconsistente.", "Investigación con identificación, microscopía, ensayos cuantitativos y técnicas cromatográficas."] },
        { id: "alteraciones", concepts: ["Distinguir adulteración intencional de alteración por agentes ambientales o biológicos.", "Humedad, temperatura, luz y microorganismos pueden degradar el producto.", "Estabilidad y cinética de degradación: orden cero, primer orden y vida útil."] },
        { id: "cuantitativo", concepts: ["Concentración: cantidad de principio activo en relación con una cantidad definida de producto o solución.", "Métodos analíticos y tamaños de muestra; selección según el propósito del ensayo.", "Errores determinados y aleatorios; calibración, exactitud y precisión."] },
        { id: "estudios-estabilidad", concepts: ["Estudios preliminares y definitivos para estimar la vida útil.", "Definir formulación, envase, condiciones, muestras representativas y calendario de análisis.", "Etiquetado, almacenamiento, registro y seguimiento ordenado de resultados."] },
        { id: "estabilidad-fisica", concepts: ["Cambios en emulsiones: separación, coalescencia o difusión; en suspensiones: sedimentación.", "Disgregación y disolución influyen en el desempeño de formas sólidas.", "Compatibilidad del envase primario: migración, humedad e integridad de cierres."] }
      ]
    },
    {
      title: "Métodos de análisis",
      summary: "Principios de valoración, separación instrumental, medición óptica y control microbiológico.",
      topics: [
        { id: "volumetria", concepts: ["Valoración con analito y solución patrón de concentración conocida; reacción completa y estequiométrica.", "Familias: neutralización, redox, precipitación y complejometría.", "Molaridad, normalidad, punto de equivalencia e indicadores para reconocer el punto final."] },
        { id: "hplc", concepts: ["Cromatografía: separación por interacción diferencial con fase móvil y fase estacionaria.", "Sistema HPLC: reservorio, bomba, inyector, columna, detector y manejo de datos.", "Fases normal y reversa; lectura de cromatogramas y comparación con patrones."] },
        { id: "espectrofotometria", concepts: ["Absorción y emisión; regiones ultravioleta y visible.", "Absorbancia en función de longitud de onda; relación con concentración bajo condiciones adecuadas.", "Ley de Lambert-Beer, blanco, patrones y curva de calibración."] },
        { id: "microbiologia", concepts: ["Control del entorno de fabricación y de la forma farmacéutica.", "Monitoreo de aire y superficies, agua, personal y condiciones de trabajo.", "Criterios según el producto; esterilidad, límites microbianos y vigilancia de pirógenos cuando corresponda."] }
      ]
    },
    {
      title: "Desempeño, biodisponibilidad y disposición",
      summary: "Cómo la formulación afecta el efecto y qué hacer con medicamentos que ya no pueden utilizarse.",
      topics: [
        { id: "biofarmacia", concepts: ["Relación entre propiedades del principio activo, forma farmacéutica y efecto biológico.", "Formas sólidas, líquidas, semisólidas y gaseosas; excipientes e incompatibilidades.", "Polimorfismo, disolución y estudios in vitro e in vivo."] },
        { id: "biodisponibilidad", concepts: ["Cantidad y velocidad con que el principio activo queda disponible para producir su efecto.", "Tamaño de partícula y disolución pueden influir en absorción.", "Interacciones, como la quelación de calcio con tetraciclinas, pueden reducir la disponibilidad."] },
        { id: "residuos", concepts: ["Separar productos vencidos, inutilizables, derrames y objetos punzocortantes.", "Priorizar devolución o disposición segura conforme a procedimientos y normativa aplicable.", "Métodos de disposición, como encapsulación, requieren control y documentación adecuados."] }
      ]
    }
  ]
};
