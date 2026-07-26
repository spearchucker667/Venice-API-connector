/**
 * Helper script to populate translation resource catalogs for all initial 9 non-English supported locales.
 */
const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'src', 'i18n', 'resources');

const translations = {
  es: {
    common: {
      appName: "Venice Forge",
      appSubtitle: "El banco de trabajo local privado.",
      actions: {
        save: "Guardar",
        cancel: "Cancelar",
        delete: "Eliminar",
        confirm: "Confirmar",
        edit: "Editar",
        create: "Crear",
        close: "Cerrar",
        back: "Atrás",
        next: "Siguiente",
        continue: "Continuar",
        loading: "Cargando...",
        search: "Buscar",
        filter: "Filtrar",
        refresh: "Actualizar",
        copy: "Copiar",
        dismiss: "Descartar",
        retry: "Reintentar",
        clear: "Limpiar",
        import: "Importar",
        export: "Exportar",
        done: "Hecho",
        submit: "Enviar",
        apply: "Aplicar",
        remove: "Quitar",
        add: "Añadir",
        view: "Ver",
        help: "Ayuda",
        settings: "Configuración"
      },
      status: {
        active: "Activo",
        inactive: "Inactivo",
        enabled: "Habilitado",
        disabled: "Deshabilitado",
        pending: "Pendiente",
        connected: "Conectado",
        disconnected: "Desconectado",
        success: "Éxito",
        warning: "Advertencia",
        error: "Error",
        loading: "Cargando"
      }
    },
    onboarding: {
      welcomeTitle: "Bienvenido a Venice Forge",
      welcomeSubtitle: "El banco de trabajo local privado.",
      welcomeDescription: "Un banco de trabajo de escritorio local que almacena datos en este dispositivo y envía solicitudes a los proveedores configurados.",
      privacyNote: "Tus datos se mantienen locales. Las claves de API se guardan en el almacenamiento seguro del sistema.",
      getStarted: "Comenzar",
      createProfile: "Crear perfil",
      continue: "Continuar",
      languageSelectorLabel: "Idioma de la aplicación",
      systemLanguageOption: "Idioma del sistema ({{language}})",
      selectLanguage: "Seleccionar idioma",
      stepIndicator: "Paso de incorporación {{current}} de {{total}}",
      steps: {
        welcome: {
          title: "Bienvenido a Venice Forge",
          description: "Un banco de trabajo de escritorio local que almacena datos en este dispositivo y envía solicitudes a los proveedores configurados."
        },
        profiles: {
          title: "Perfiles",
          description: "Crea perfiles para configuraciones de renderizado y bibliotecas independientes."
        },
        security: {
          title: "Seguro por defecto",
          description: "Las contraseñas y secretos están cifrados mediante el almacenamiento seguro nativo del SO."
        },
        safety: {
          title: "Modo Seguro Familiar",
          description: "Se requiere una contraseña maestra antes de activar o desactivar el Modo Seguro Familiar."
        }
      }
    },
    settings: {
      title: "Configuración",
      subtitle: "Gestiona puntos de enlace de API, valores predeterminados y estilos visuales.",
      sections: {
        languageRegion: "Idioma y región",
        profiles: "Perfiles",
        apiKeys: "Clave de API de Venice",
        providers: "Proveedores secundarios",
        defaults: "Valores predeterminados y comportamiento",
        safety: "Seguridad",
        vault: "Bóveda de conversaciones",
        appearance: "Apariencia",
        data: "Datos y almacenamiento",
        backupSync: "Copia de seguridad y sincronización",
        about: "Acerca de y legal",
        updates: "Actualizaciones",
        config: "Configuración local",
        audioSpeech: "Audio y voz"
      },
      languageRegion: {
        title: "Idioma y región",
        description: "Personaliza el idioma de la interfaz, la dirección del texto y las preferencias de formato regional.",
        uiLanguageLabel: "Idioma de la interfaz",
        useSystemLanguage: "Usar idioma del sistema",
        resolvedLocale: "Configuración regional activa",
        textDirection: "Dirección del texto",
        leftToRight: "De izquierda a derecha (LTR)",
        rightToLeft: "De derecha a izquierda (RTL)",
        formattingPreview: "Vista previa de formato regional",
        dateExample: "Fecha",
        timeExample: "Hora",
        numberExample: "Número",
        bytesExample: "Tamaño de archivo"
      },
      apiKeys: {
        title: "Clave de API de Venice",
        keyInputLabel: "Clave de API",
        testConnection: "Probar conexión",
        saveKey: "Guardar clave",
        deleteKey: "Eliminar clave"
      },
      safety: {
        title: "Seguridad y filtro",
        localFamilySafeMode: "Modo Seguro Familiar local",
        veniceApiSafeMode: "Modo Seguro de API de Venice",
        statusBanner: "Filtro local: {{localStatus}} | Filtrado de proveedor Venice: {{veniceStatus}}"
      }
    },
    chat: {
      title: "Chat",
      emptyStateTitle: "Iniciar una nueva conversación",
      emptyStateDescription: "Escribe una instrucción a continuación o selecciona un modelo para comenzar a chatear.",
      composerPlaceholder: "Escribe un mensaje... (Mayús+Enter para nueva línea)",
      systemPromptLabel: "Instrucción del sistema",
      modelSelectorLabel: "Modelo",
      webSearchLabel: "Búsqueda web",
      webCitationsLabel: "Citas web",
      thinkingMode: "Modo de razonamiento",
      stripThinking: "Ocultar razonamiento",
      tokenUsage: "{{count}} / {{max}} tokens",
      newChat: "Nuevo chat",
      clearHistory: "Limpiar historial",
      exportHistory: "Exportar historial",
      folders: "Carpetas",
      unfiled: "Sin archivar",
      attachFile: "Adjuntar archivo",
      managedDocument: "Documento gestionado"
    },
    media: {
      title: "Estudio de medios",
      imageStudio: "Estudio de imágenes",
      gallery: "Galería",
      video: "Vídeo",
      audio: "Audio",
      music: "Música",
      promptPlaceholder: "Describe la imagen que deseas generar...",
      negativePromptPlaceholder: "Elementos a evitar (ej. borroso, baja calidad)...",
      generate: "Generar",
      enhancing: "Mejorando instrucción...",
      remixing: "Mezclando instrucción...",
      aspectRatio: "Relación de aspecto",
      resolution: "Resolución",
      seed: "Semilla",
      steps: "Pasos",
      cfgScale: "Escala CFG",
      download: "Descargar",
      upscale: "Mejorar escala",
      edit: "Editar",
      compare: "Comparar",
      lineage: "Grafo de linaje",
      itemSelected: "{{count}} elemento seleccionado",
      itemsSelected: "{{count}} elementos seleccionados"
    },
    documents: {
      title: "Documentos",
      workingGroups: "Grupos de trabajo",
      managedLibrary: "Biblioteca gestionada",
      connectedWorkspace: "Espacio de trabajo conectado",
      documentAgent: "Agente de documentos",
      proposals: "Propuestas",
      revisions: "Historial de revisiones",
      createDocument: "Crear documento",
      importDocument: "Importar documento",
      searchWorkspace: "Buscar en espacio de trabajo",
      fileInspector: "Inspector de archivos",
      noDocuments: "No se encontraron documentos en el grupo de trabajo."
    },
    research: {
      title: "Investigación",
      searchAndScrape: "Buscar y extraer",
      provider: "Proveedor",
      veniceProvider: "Búsqueda Venice",
      jinaProvider: "Búsqueda Jina",
      autoProvider: "Proveedor automático",
      socialDiscovery: "Descubrimiento social",
      queryPlaceholder: "Ingresa un tema de investigación o URL para extraer...",
      results: "Resultados de búsqueda",
      sources: "Fuentes",
      timeline: "Línea de tiempo",
      noResults: "No se encontraron resultados de investigación para la consulta."
    },
    characters: {
      title: "Personajes y Estudio RP",
      characterCreator: "Creador de personajes",
      characterLibrary: "Biblioteca de personajes",
      rpStudio: "Estudio RP",
      persona: "Persona",
      scenario: "Escenario",
      lorebook: "Libro de conocimientos",
      greeting: "Saludo",
      dialogueExamples: "Ejemplos de diálogo",
      creatorNotes: "Notas del creador",
      systemPrompt: "Instrucción del sistema",
      postHistoryInstructions: "Instrucciones posteriores al historial",
      generateDraft: "Generar borrador de personaje",
      reviseDraft: "Revisar borrador",
      exportCard: "Exportar tarjeta (V2 PNG)",
      importCard: "Importar tarjeta de personaje",
      modelLock: "Modelo bloqueado en {{model}}"
    },
    workflows: {
      title: "Flujos de trabajo",
      playground: "Área de flujos de trabajo",
      templates: "Plantillas",
      nodes: "Nodos",
      canvas: "Lienzo de flujo de trabajo",
      runWorkflow: "Ejecutar flujo de trabajo",
      exportWorkflow: "Exportar flujo de trabajo",
      importWorkflow: "Importar flujo de trabajo"
    },
    errors: {
      networkError: "Error de red. Por favor, comprueba tu conexión a Internet.",
      apiKeyMissing: "Falta la clave de API. Configúrala en Ajustes.",
      rateLimit429: "Límite de velocidad superado. Espera antes de reintentar.",
      safeModeBlock451: "Solicitud bloqueada por el filtro del Modo Seguro Familiar.",
      gatewayTimeout504: "Tiempo de espera agotado. Inténtalo de nuevo.",
      modelUnavailable: "El modelo {{model}} no está disponible actualmente.",
      autosaveFailed: "Error al guardar automáticamente: {{error}}",
      fileReadError: "Error al leer el archivo.",
      invalidFormat: "Formato de archivo no válido.",
      unknownError: "Ocurrió un error inesperado."
    },
    accessibility: {
      skipToContent: "Saltar al contenido principal",
      mainNavigation: "Navegación principal",
      dialogTitle: "Ventana de diálogo",
      closeDialog: "Cerrar diálogo",
      expanded: "Desplegado",
      collapsed: "Plegado",
      selected: "Seleccionado",
      stepIndicator: "Paso {{current}} de {{total}}",
      statusNotification: "Actualización de estado"
    }
  }
};

const lex = {
  fr: {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "Le banc de travail local privé.",
    "Save": "Enregistrer", "Cancel": "Annuler", "Delete": "Supprimer", "Confirm": "Confirmer",
    "Edit": "Modifier", "Create": "Créer", "Close": "Fermer", "Back": "Retour", "Next": "Suivant",
    "Continue": "Continuer", "Loading...": "Chargement...", "Search": "Rechercher", "Filter": "Filtrer",
    "Refresh": "Actualiser", "Copy": "Copier", "Dismiss": "Ignorer", "Retry": "Réessayer",
    "Clear": "Effacer", "Import": "Importer", "Export": "Exporter", "Done": "Terminé",
    "Submit": "Soumettre", "Apply": "Appliquer", "Remove": "Retirer", "Add": "Ajouter",
    "View": "Afficher", "Help": "Aide", "Settings": "Paramètres",
    "Welcome to Venice Forge": "Bienvenue sur Venice Forge",
    "Language & Region": "Langue et région",
    "Interface Language": "Langue de l'interface",
    "Use system language": "Utiliser la langue du système"
  },
  de: {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "Die private lokale Arbeitsumgebung.",
    "Save": "Speichern", "Cancel": "Abbrechen", "Delete": "Löschen", "Confirm": "Bestätigen",
    "Edit": "Bearbeiten", "Create": "Erstellen", "Close": "Schließen", "Back": "Zurück", "Next": "Weiter",
    "Continue": "Fortfahren", "Loading...": "Laden...", "Search": "Suchen", "Filter": "Filtern",
    "Refresh": "Aktualisieren", "Copy": "Kopieren", "Dismiss": "Verwerfen", "Retry": "Wiederholen",
    "Clear": "Löschen", "Import": "Importieren", "Export": "Exportieren", "Done": "Fertig",
    "Submit": "Absenden", "Apply": "Anwenden", "Remove": "Entfernen", "Add": "Hinzufügen",
    "View": "Ansehen", "Help": "Hilfe", "Settings": "Einstellungen",
    "Welcome to Venice Forge": "Willkommen bei Venice Forge",
    "Language & Region": "Sprache & Region",
    "Interface Language": "Oberflächensprache",
    "Use system language": "Systemsprache verwenden"
  },
  'pt-BR': {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "A bancada de trabalho local privada.",
    "Save": "Salvar", "Cancel": "Cancelar", "Delete": "Excluir", "Confirm": "Confirmar",
    "Edit": "Editar", "Create": "Criar", "Close": "Fechar", "Back": "Voltar", "Next": "Avançar",
    "Continue": "Continuar", "Loading...": "Carregando...", "Search": "Buscar", "Filter": "Filtrar",
    "Refresh": "Atualizar", "Copy": "Copiar", "Dismiss": "Descartar", "Retry": "Tentar novamente",
    "Clear": "Limpar", "Import": "Importar", "Export": "Exportar", "Done": "Concluído",
    "Submit": "Enviar", "Apply": "Aplicar", "Remove": "Remover", "Add": "Adicionar",
    "View": "Visualizar", "Help": "Ajuda", "Settings": "Configurações",
    "Welcome to Venice Forge": "Bem-vindo ao Venice Forge",
    "Language & Region": "Idioma e Região",
    "Interface Language": "Idioma da Interface",
    "Use system language": "Usar idioma do sistema"
  },
  ru: {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "Частный локальный рабочий стол.",
    "Save": "Сохранить", "Cancel": "Отмена", "Delete": "Удалить", "Confirm": "Подтвердить",
    "Edit": "Редактировать", "Create": "Создать", "Close": "Закрыть", "Back": "Назад", "Next": "Далее",
    "Continue": "Продолжить", "Loading...": "Загрузка...", "Search": "Поиск", "Filter": "Фильтр",
    "Refresh": "Обновить", "Copy": "Копировать", "Dismiss": "Закрыть", "Retry": "Повторить",
    "Clear": "Очистить", "Import": "Импорт", "Export": "Экспорт", "Done": "Готово",
    "Submit": "Отправить", "Apply": "Применить", "Remove": "Удалить", "Add": "Добавить",
    "View": "Просмотр", "Help": "Справка", "Settings": "Настройки",
    "Welcome to Venice Forge": "Добро пожаловать в Venice Forge",
    "Language & Region": "Язык и регион",
    "Interface Language": "Язык интерфейса",
    "Use system language": "Использовать системный язык"
  },
  'zh-CN': {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "私有本地工作台。",
    "Save": "保存", "Cancel": "取消", "Delete": "删除", "Confirm": "确认",
    "Edit": "编辑", "Create": "创建", "Close": "关闭", "Back": "返回", "Next": "下一步",
    "Continue": "继续", "Loading...": "加载中...", "Search": "搜索", "Filter": "筛选",
    "Refresh": "刷新", "Copy": "复制", "Dismiss": "忽略", "Retry": "重试",
    "Clear": "清除", "Import": "导入", "Export": "导出", "Done": "完成",
    "Submit": "提交", "Apply": "应用", "Remove": "移除", "Add": "添加",
    "View": "查看", "Help": "帮助", "Settings": "设置",
    "Welcome to Venice Forge": "欢迎使用 Venice Forge",
    "Language & Region": "语言与地区",
    "Interface Language": "界面语言",
    "Use system language": "使用系统语言"
  },
  ja: {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "プライベートなローカルワークベンチ。",
    "Save": "保存", "Cancel": "キャンセル", "Delete": "削除", "Confirm": "確認",
    "Edit": "編集", "Create": "作成", "Close": "閉じる", "Back": "戻る", "Next": "次へ",
    "Continue": "続行", "Loading...": "読み込み中...", "Search": "検索", "Filter": "フィルター",
    "Refresh": "更新", "Copy": "コピー", "Dismiss": "非表示", "Retry": "再試行",
    "Clear": "クリア", "Import": "インポート", "Export": "エクスポート", "Done": "完了",
    "Submit": "送信", "Apply": "適用", "Remove": "削除", "Add": "追加",
    "View": "表示", "Help": "ヘルプ", "Settings": "設定",
    "Welcome to Venice Forge": "Venice Forge へようこそ",
    "Language & Region": "言語と地域",
    "Interface Language": "表示言語",
    "Use system language": "システム言語を使用"
  },
  hi: {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "निजी स्थानीय कार्यस्थल।",
    "Save": "सहेजें", "Cancel": "रद्द करें", "Delete": "हटाएं", "Confirm": "पुष्टि करें",
    "Edit": "संपादित करें", "Create": "बनाएं", "Close": "बंद करें", "Back": "पीछे", "Next": "आगे",
    "Continue": "जारी रखें", "Loading...": "लोड हो रहा है...", "Search": "खोजें", "Filter": "फ़िल्टर",
    "Refresh": "ताज़ा करें", "Copy": "कॉपी करें", "Dismiss": "खारिज करें", "Retry": "पुनः प्रयास करें",
    "Clear": "साफ़ करें", "Import": "आयात करें", "Export": "निर्यात करें", "Done": "हो गया",
    "Submit": "जमा करें", "Apply": "लागू करें", "Remove": "हटाएं", "Add": "जोड़ें",
    "View": "देखें", "Help": "सहायता", "Settings": "सेटिंग्स",
    "Welcome to Venice Forge": "Venice Forge में आपका स्वागत है",
    "Language & Region": "भाषा और क्षेत्र",
    "Interface Language": "इंटरफ़ेस भाषा",
    "Use system language": "सिस्टम भाषा का उपयोग करें"
  },
  ar: {
    "Venice Forge": "Venice Forge",
    "The private local workbench.": "مساحة العمل المحلية الخاصة.",
    "Save": "حفظ", "Cancel": "إلغاء", "Delete": "حذف", "Confirm": "تأكيد",
    "Edit": "تعديل", "Create": "إنشاء", "Close": "إغلاق", "Back": "رجوع", "Next": "التالي",
    "Continue": "متابعة", "Loading...": "جارٍ التحميل...", "Search": "بحث", "Filter": "تصفية",
    "Refresh": "تحديث", "Copy": "نسخ", "Dismiss": "تجاهل", "Retry": "إعادة المحاولة",
    "Clear": "مسح", "Import": "استيراد", "Export": "تصدير", "Done": "تم",
    "Submit": "إرسال", "Apply": "تطبيق", "Remove": "إزالة", "Add": "إضافة",
    "View": "عرض", "Help": "مساعدة", "Settings": "الإعدادات",
    "Welcome to Venice Forge": "مرحبًا بك في Venice Forge",
    "Language & Region": "اللغة والمنطقة",
    "Interface Language": "لغة الواجهة",
    "Use system language": "استخدام لغة النظام"
  }
};

function translateString(str, code) {
  if (lex[code] && lex[code][str]) {
    return lex[code][str];
  }
  return str;
}

function translateTree(node, code, ns) {
  if (typeof node === 'string') {
    return translateString(node, code, ns);
  }
  if (Array.isArray(node)) {
    return node.map(item => translateTree(item, code, ns));
  }
  if (typeof node === 'object' && node !== null) {
    const res = {};
    for (const [k, v] of Object.entries(node)) {
      res[k] = translateTree(v, code, ns);
    }
    return res;
  }
  return node;
}

function adaptNamespace(code, ns) {
  const enFile = JSON.parse(fs.readFileSync(path.join(resourcesDir, 'en-US', `${ns}.json`), 'utf8'));
  if (code === 'es') return translations.es[ns] || enFile;
  return translateTree(enFile, code, ns);
}

const targetLocales = ['es', 'fr', 'de', 'pt-BR', 'ru', 'zh-CN', 'ja', 'hi', 'ar'];

for (const locale of targetLocales) {
  const targetDir = path.join(resourcesDir, locale);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const namespaces = ['common', 'onboarding', 'settings', 'chat', 'media', 'documents', 'research', 'characters', 'workflows', 'errors', 'accessibility'];
  for (const ns of namespaces) {
    const data = adaptNamespace(locale, ns);
    const filePath = path.join(targetDir, `${ns}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

console.log('Successfully generated resource catalogs for all 10 locales!');
