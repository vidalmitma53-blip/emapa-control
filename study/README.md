# Estudia — Control de medicamentos

Prototipo web independiente del sitio de inventarios. Abre `index.html` en un navegador moderno para probarlo; no necesita instalar dependencias.

## Alcance de esta primera versión

- Panel de avance, XP, racha diaria y niveles.
- Práctica con retroalimentación inmediata para todas las opciones.
- Reto rápido con temporizador, simulacro y repaso de preguntas falladas.
- Simulacro desde documento con dos formatos (elección múltiple o examen complementario), hasta 200 preguntas distintas y duración ajustable entre 1 y 120 minutos. El generador local plantea preguntas de comprensión conceptual, aplicación de condiciones y análisis de relaciones causales explícitas; en complementación, prioriza términos clave. La profundidad depende de la estructura del texto y no se envía el documento a una IA externa.
- Tema claro/oscuro y diseño adaptable a móvil.
- Guardado de respuestas y del reto en curso en `localStorage`.
- Es obligatorio guardar un nombre antes de iniciar niveles, prácticas, repasos o simulacros; el nombre y el avance se guardan solo en el navegador actual.
- Banco de 210 preguntas agrupadas en 21 niveles de 10 preguntas, con énfasis progresivo: fundamentos, relaciones, aplicación, análisis e integración, y criterio profesional. Los niveles avanzados incluyen casos de laboratorio, formulación, estabilidad y gestión de residuos.
- Preguntas de selección múltiple con selección exacta de una o dos respuestas.
- Mapa conceptual interactivo que organiza los 16 temas en cuatro ramas y resume sus conceptos principales.
- Selección de temas para retos rápidos y simulacros mixtos de hasta 20 preguntas.
- Diagnóstico por tema; cada respuesta incluye una justificación conceptual, explicación específica de la alternativa elegida y una aplicación farmacéutica vinculada al tema y a la pregunta.
- Historial local de preguntas mostradas: los simulacros y niveles usan preguntas nuevas, incluso entre recargas y partidas. Los errores y preguntas abandonadas pueden repetirse solo en el repaso inteligente. Al agotarse el banco, se bloquean nuevas partidas hasta ampliarlo.
- Para aprobar un nivel se requiere el puntaje mínimo y dominar sus preguntas; corregir los errores en el repaso puede completar el nivel sin repetir el examen.

El banco está dividido por tema y nivel en `questions-foundations.js`, `questions-analysis.js` y `questions-applied.js`. `question-bank.js` proporciona el helper de construcción y `content.js` mantiene los metadatos del curso y sus temas. Revisa editorialmente las preguntas y sus referencias antes de publicar el material como contenido académico oficial.

## Importante: prototipo local

El progreso se guarda únicamente en el navegador y en el dispositivo actual. No hay cuentas reales, sincronización entre dispositivos, API ni almacenamiento centralizado; no uses información sensible ni dependas de este prototipo para conservar datos importantes. Para producción, el siguiente paso es conectar autenticación y progreso a una API y a PostgreSQL, y definir la revisión editorial del banco de preguntas.

Un nivel de 10 preguntas requiere al menos 7 aciertos; si quedan menos preguntas nuevas porque ya se usaron en otras prácticas, el mínimo se calcula sobre las disponibles. El progreso y el historial de preguntas se conservan en `localStorage`; los niveles superados, las respuestas, las rachas y las preferencias no se sincronizan entre dispositivos. Si quieres empezar de nuevo, borra los datos del sitio para la clave `estudia.control-medicamentos.v1` desde las herramientas del navegador.
