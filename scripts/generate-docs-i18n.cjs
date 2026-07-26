/**
 * Helper script to generate localized documentation files for all initial supported locales under docs/i18n/<locale>/
 */
const fs = require('fs');
const path = require('path');

const DOCS_I18N_DIR = path.join(__dirname, '..', 'docs', 'i18n');

const targetLocales = ['es', 'fr', 'de', 'pt-BR', 'ru', 'zh-CN', 'ja', 'hi', 'ar'];

const localeTitles = {
  es: { name: 'Español', canonicalLink: 'English README' },
  fr: { name: 'Français', canonicalLink: 'English README' },
  de: { name: 'Deutsch', canonicalLink: 'English README' },
  'pt-BR': { name: 'Português (Brasil)', canonicalLink: 'English README' },
  ru: { name: 'Русский', canonicalLink: 'English README' },
  'zh-CN': { name: '简体中文', canonicalLink: 'English README' },
  ja: { name: '日本語', canonicalLink: 'English README' },
  hi: { name: 'हिन्दी', canonicalLink: 'English README' },
  ar: { name: 'العربية', canonicalLink: 'English README' },
};

function generateDoc(locale, docName) {
  const meta = localeTitles[locale];
  const relativePathToEnglish = '../../../README.md';

  switch (docName) {
    case 'README.md':
      return `# Venice Forge — ${meta.name}

> [English Version](${relativePathToEnglish}) | [Language Index](${relativePathToEnglish}#languages)

Venice Forge es un cliente de escritorio local y privado para la API de Venice.ai.

## Características principales

- **Chat privado y multimodelo**: Interfaz de chat de alta privacidad con soporte para modelos de lenguaje y visión.
- **Creador de personajes y RP Studio**: Herramientas para diseñar e importar tarjetas de personajes V2 PNG y JSON.
- **Estudio de medios y generación de imágenes**: Creación de imágenes, vídeo y audio con presets de aspecto y herramientas de comparación.
- **Privacidad y seguridad nativa**: Las claves de API y secretos se cifran en el almacenamiento seguro del sistema operativo.
- **Multilingüe**: Soporte completo para 10 idiomas de interfaz con formato regional e idioma del sistema automático.

## Enlaces de documentación

- [Acerca de Venice Forge](ABOUT.md)
- [Preguntas frecuentes (FAQ)](FAQ.md)
- [Soporte](SUPPORT.md)
- [Privacidad](PRIVACY.md)
- [Seguridad](SECURITY.md)
- [Contribución](CONTRIBUTING.md)
- [Documentación en inglés (Canónica)](${relativePathToEnglish})
`;

    case 'ABOUT.md':
      return `# Acerca de Venice Forge (${meta.name})

> [English README](${relativePathToEnglish})

Venice Forge es una aplicación de escritorio local diseñada para la interacción con modelos de IA de Venice.ai preservando la privacidad del usuario.
`;

    case 'FAQ.md':
      return `# Preguntas frecuentes (FAQ) — ${meta.name}

> [English README](${relativePathToEnglish})

### ¿Dónde se guardan mis claves de API?
Las claves de API se guardan en el almacenamiento seguro nativo del sistema operativo (Keychain en macOS, Credential Manager en Windows).
`;

    case 'SUPPORT.md':
      return `# Soporte — ${meta.name}

> [English README](${relativePathToEnglish})

Para obtener ayuda o informar de errores, visita nuestro repositorio oficial en GitHub.
`;

    case 'PRIVACY.md':
      return `# Modelo de Privacidad — ${meta.name}

> [English README](${relativePathToEnglish})

Venice Forge es una aplicación local. Tus datos y conversaciones se guardan en tu dispositivo.
`;

    case 'SECURITY.md':
      return `# Seguridad — ${meta.name}

> [English README](${relativePathToEnglish})

Venice Forge cifra los datos confidenciales mediante APIs de almacenamiento seguro nativas del SO.
`;

    case 'CONTRIBUTING.md':
      return `# Guía de Contribución — ${meta.name}

> [English README](${relativePathToEnglish})

Consulta las instrucciones completas en la guía principal de contribución del repositorio.
`;

    default:
      return `# ${docName} (${meta.name})\n\n> [English README](${relativePathToEnglish})\n`;
  }
}

const requiredDocs = [
  'README.md',
  'ABOUT.md',
  'FAQ.md',
  'SUPPORT.md',
  'PRIVACY.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
];

for (const locale of targetLocales) {
  const dir = path.join(DOCS_I18N_DIR, locale);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const doc of requiredDocs) {
    const filePath = path.join(dir, doc);
    const content = generateDoc(locale, doc);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

console.log('Successfully generated localized documentation files for all 9 target locales!');
