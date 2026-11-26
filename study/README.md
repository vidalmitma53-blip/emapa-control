# Estudia — Control de medicamentos

Prototipo web independiente del sitio de inventarios. Abre `index.html` en un navegador moderno para probarlo; no necesita instalar dependencias.

## Alcance de esta primera versión

- Panel de avance, XP, racha diaria y niveles.
- Práctica con retroalimentación inmediata para todas las opciones.
- Reto rápido con temporizador, simulacro y repaso de preguntas falladas.
- Simulacro desde documento con elección múltiple o complementación y duración ajustable entre 1 y 120 minutos.
- Tema claro/oscuro y diseño adaptable a móvil.
- Guardado de respuestas y del reto en curso en `localStorage`.
- Banco de 210 preguntas agrupadas en 21 niveles de 10 preguntas.
- Preguntas de selección múltiple con selección exacta de una o dos respuestas.
- Mapa conceptual interactivo que organiza los 16 temas en cuatro ramas y resume sus conceptos principales.
- Selección de temas para retos rápidos y simulacros mixtos de hasta 20 preguntas.
- Diagnóstico por tema; al responder se muestra por qué la opción elegida es correcta o incorrecta, la respuesta correcta, el fundamento de la página fuente y contexto farmacéutico general por tema.

El banco está dividido por tema y nivel en `questions-foundations.js`, `questions-analysis.js` y `questions-applied.js`. `question-bank.js` proporciona el helper de construcción y `content.js` mantiene los metadatos del curso y sus temas. Revisa editorialmente las preguntas y sus referencias antes de publicar el material como contenido académico oficial.

## Importante: prototipo local

El progreso se guarda únicamente en el navegador y en el dispositivo actual. No hay cuentas reales, sincronización entre dispositivos, API ni almacenamiento centralizado; no uses información sensible ni dependas de este prototipo para conservar datos importantes. Para producción, el siguiente paso es conectar autenticación y progreso a una API y a PostgreSQL, y definir la revisión editorial del banco de preguntas.

Un nivel se supera con al menos 7 de 10 respuestas correctas. El progreso actual se conserva en `localStorage`; los niveles superados, las respuestas, las rachas y las preferencias no se sincronizan entre dispositivos. Si quieres empezar de nuevo, borra los datos del sitio para la clave `estudia.control-medicamentos.v1` desde las herramientas del navegador.
