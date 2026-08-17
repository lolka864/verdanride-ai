import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  Copy,
  Gem ,
  History,
  ImagePlus,
  Leaf,
  Lightbulb,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type RoleplayForm = {
  characterName: string;
  appearance: string;
  personality: string;
  world: string;
  scene: string;
  userRole: string;
  tone: string;
};

const emptyRoleplayForm: RoleplayForm = {
  characterName: '',
  appearance: '',
  personality: '',
  world: '',
  scene: '',
  userRole: '',
  tone: '',
};

const roleplayFieldConfig: {
  key: keyof RoleplayForm;
  label: string;
  placeholder: string;
  type: 'input' | 'textarea';
}[] = [
  { key: 'characterName', label: 'Имя персонажа', placeholder: 'Например: Айрин', type: 'input' },
  { key: 'appearance', label: 'Внешность', placeholder: 'Рост, цвет волос и глаз, одежда...', type: 'textarea' },
  { key: 'personality', label: 'Характер персонажа', placeholder: 'Дружелюбная, саркастичная, скрытная...', type: 'textarea' },
  { key: 'world', label: 'Мир / сеттинг', placeholder: 'Средневековое фэнтези, современный город...', type: 'textarea' },
  { key: 'scene', label: 'Начальная сцена', placeholder: 'С чего начинается история', type: 'textarea' },
  { key: 'userRole', label: 'Ваш персонаж', placeholder: 'Кто вы в этой истории', type: 'textarea' },
  { key: 'tone', label: 'Тон и жанр', placeholder: 'Романтика, приключения, юмор, хоррор...', type: 'input' },
];

type Message = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  image?: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const HISTORY_STORAGE_KEY = 'verdantide_conversations';
type RoleplayConversation = {
  id: string;
  title: string;
  form: RoleplayForm;
  messages: Message[];
  updatedAt: number;
};

const ROLEPLAY_HISTORY_STORAGE_KEY = 'verdantide_roleplay_conversations';

function makeRoleplayTitle(form: RoleplayForm) {
  if (form.characterName.trim()) return form.characterName.trim();
  const source = form.scene.trim();
  if (!source) return 'Новая ролевая игра';
  return source.length > 42 ? `${source.slice(0, 42)}…` : source;
}

// Простой парсер для **жирный**, *курсив* и `код`,
// чтобы ответы нейросети не показывались со звёздочками как есть.
function renderFormattedText(text: string) {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code className="inline-code" key={key++}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// Разбивает ответ ИИ в ролевой игре на строки и оформляет действия (в *звёздочках*)
// отдельно от произносимой вслух речи — так текст лучше читается
function renderRoleplayText(text: string) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;

  return lines.map((line, index) => {
    const trimmed = line.trim();
    const isAction = trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 1;
    const content = isAction ? trimmed.slice(1, -1) : line;

    return (
      <p className={isAction ? 'rp-line rp-action' : 'rp-line rp-speech'} key={index}>
        {renderFormattedText(content)}
      </p>
    );
  });
}

function makeConversationTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const source = firstUserMessage?.text?.trim();
  if (!source) return 'Новый диалог';
  return source.length > 42 ? `${source.slice(0, 42)}…` : source;
}

const starterMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    text: 'Здравствуйте. Я Verdantide — ваш спокойный проводник по миру природы. О чём хотите узнать сегодня?',
    time: '09:41',
  },
  
];

const quickPrompts = [
  'Расскажи интересный факт',
  'Помоги придумать идею',
  'Объясни простыми словами',
];

const backgrounds = [
  { name: 'Морской закат', file: '/backgrounds/bc_1.jpg', tone: 'sunset' },
  { name: 'Тёмный лес', file: '/backgrounds/bc_2.jpg', tone: 'forest' },
  { name: 'Горное озеро', file: '/backgrounds/bc_3.jpg', tone: 'alpine' },
  { name: 'Летний луг', file: '/backgrounds/bc_4.jpg', tone: 'meadow' },
  { name: 'Сад сакуры', file: '/backgrounds/bc_5.jpg', tone: 'sakura' },
];

const modes = [
  { title: 'Чат', description: 'Общайся на любые темы и получай полезные ответы', icon: Leaf, tone: 'sage' },
  { title: 'Поиск', description: 'Находи актуальную информацию о мире вокруг', icon: Search, tone: 'blue' },
  { title: 'Креатив', description: 'Поможет с идеями, текстами и вдохновением', icon: Lightbulb, tone: 'sand' },
  { title: 'Анализ', description: 'Анализируй данные и делай выводы', icon: BookOpen, tone: 'mist' },
  { title: 'Ролевая', description: 'Погрузись в историю со своим персонажем', icon: Users, tone: 'plum' },
];

function App() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMysteryOpen, setIsMysteryOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'roleplay'>('main');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `conv-${Date.now()}`
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const [roleplayForm, setRoleplayForm] = useState<RoleplayForm>(emptyRoleplayForm);
  const [roleplayStarted, setRoleplayStarted] = useState(false);
  const [roleplayMessages, setRoleplayMessages] = useState<Message[]>([]);
  const [roleplayInput, setRoleplayInput] = useState('');
  const [roleplayThinking, setRoleplayThinking] = useState(false);
  const roleplayAbortRef = useRef<AbortController | null>(null);
  const roleplayTypingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roleplayEndRef = useRef<HTMLDivElement>(null);
  const [roleplayConversations, setRoleplayConversations] = useState<RoleplayConversation[]>([]);
  const [currentRoleplayId, setCurrentRoleplayId] = useState<string>(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `rp-${Date.now()}`
  );
  const [isRoleplayHistoryOpen, setIsRoleplayHistoryOpen] = useState(false);

  useEffect(() => {
    roleplayEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roleplayMessages, roleplayThinking]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ROLEPLAY_HISTORY_STORAGE_KEY);
      if (stored) setRoleplayConversations(JSON.parse(stored));
    } catch (error) {
      console.error('Не удалось загрузить историю ролевых игр:', error);
    }
  }, []);

  useEffect(() => {
    if (!roleplayStarted || roleplayMessages.length === 0) return;

    setRoleplayConversations((current) => {
      const title = makeRoleplayTitle(roleplayForm);
      const existingIndex = current.findIndex((c) => c.id === currentRoleplayId);
      const updatedConversation: RoleplayConversation = {
        id: currentRoleplayId,
        title,
        form: roleplayForm,
        messages: roleplayMessages,
        updatedAt: Date.now(),
      };
      const next =
        existingIndex >= 0
          ? current.map((c, index) => (index === existingIndex ? updatedConversation : c))
          : [updatedConversation, ...current];
      try {
        localStorage.setItem(ROLEPLAY_HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Не удалось сохранить историю ролевых игр:', error);
      }
      return next;
    });
  }, [roleplayMessages, roleplayStarted, currentRoleplayId, roleplayForm]);

  // Загружаем сохранённую историю чатов один раз при старте
  useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, isThinking]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setConversations(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Не удалось загрузить историю чатов:', error);
    }
  }, []);

  // Сохраняем текущий диалог в историю при каждом изменении сообщений,
  // но только если пользователь уже что-то написал (стартовый диалог не сохраняем)
  useEffect(() => {
    const hasUserMessage = messages.some((message) => message.role === 'user');
    if (!hasUserMessage) return;

    setConversations((current) => {
      const title = makeConversationTitle(messages);
      const existingIndex = current.findIndex((c) => c.id === currentConversationId);
      const updatedConversation: Conversation = {
        id: currentConversationId,
        title,
        messages,
        updatedAt: Date.now(),
      };

      const next =
        existingIndex >= 0
          ? current.map((c, index) => (index === existingIndex ? updatedConversation : c))
          : [updatedConversation, ...current];

      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Не удалось сохранить историю чатов:', error);
      }

      return next;
    });
  }, [messages, currentConversationId]);


const sendMessage = async (event?: FormEvent) => {
  event?.preventDefault();

  const trimmedInput = input.trim();

  if ((!trimmedInput && !selectedImage) || isThinking) return;

  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const userMessage: Message = {
    id: Date.now(),
    role: 'user',
    text: trimmedInput || 'Посмотри на это изображение.',
    time,
    image: selectedImage || undefined,
  };
  const updatedMessages = [...messages, userMessage];

  setMessages(updatedMessages);
  setInput('');
  setIsThinking(true);
  setSelectedImage(null);

  const controller = new AbortController();
  abortControllerRef.current = controller;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: updatedMessages.map((message) => ({
          role: message.role,
          content: message.image
            ? [
                {
                  type: 'text',
                  text: message.text || 'Посмотри на это изображение.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: message.image,
                  },
                },
              ]
            : message.text,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI request failed');
    }

    const fullText: string = data.message;
    const assistantId = Date.now() + 1;
    const assistantTime = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setIsThinking(false);

    // Добавляем сообщение с пустым текстом — будем заполнять его постепенно
    setMessages((current) => [
      ...current,
      { id: assistantId, role: 'assistant', text: '', time: assistantTime },
    ]);

    let charIndex = 0;
    typingIntervalRef.current = setInterval(() => {
      charIndex += 2; // сколько символов добавлять за раз — можно поменять для скорости

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, text: fullText.slice(0, charIndex) }
            : message
        )
      );

      if (charIndex >= fullText.length) {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    }, 20); // скорость печати в миллисекундах — меньше число = быстрее
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // Пользователь сам остановил генерацию — ничего страшного, просто выходим
    } else {
      console.error(error);

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Не удалось получить ответ от AI. Попробуй ещё раз.',
          time: new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    }
  } finally {
    setIsThinking(false);
    abortControllerRef.current = null;
  }
};

const stopGeneration = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  if (typingIntervalRef.current) {
    clearInterval(typingIntervalRef.current);
    typingIntervalRef.current = null;
  }
  setIsThinking(false);
};

const typeOutMessage = (
    fullText: string,
    assistantId: number,
    setter: React.Dispatch<React.SetStateAction<Message[]>>,
    intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
  ) => {
    let charIndex = 0;
    intervalRef.current = setInterval(() => {
      charIndex += 2;
      setter((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, text: fullText.slice(0, charIndex) } : message
        )
      );
      if (charIndex >= fullText.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 20);
  };

  const handleRoleplayFieldChange = (key: keyof RoleplayForm, value: string) => {
    setRoleplayForm((current) => ({ ...current, [key]: value }));
  };

  const isRoleplayFormValid = (Object.values(roleplayForm) as string[]).every(
    (value) => value.trim().length > 0
  );

  const buildRoleplayPrompt = (form: RoleplayForm) =>
    `Начинаем ролевую игру (текстовую RPG). Вот все детали:\n\n` +
    `Персонаж, которого играешь ты (ИИ): ${form.characterName}\n` +
    `Внешность персонажа: ${form.appearance}\n` +
    `Характер персонажа: ${form.personality}\n` +
    `Мир / сеттинг: ${form.world}\n` +
    `Начальная сцена: ${form.scene}\n` +
    `Мой персонаж (кого играю я): ${form.userRole}\n` +
    `Тон и жанр истории: ${form.tone}\n\n` +
    `Войди в роль своего персонажа и начни сцену от первого лица, живо и в деталях ` +
    `(3-6 предложений). Дальше реагируй на мои реплики, оставаясь в роли и не выходя из образа, ` +
    `не пиши от лица моего персонажа — только от лица своего.\n\n` +
    `Важно про форматирование ответа: пиши действия и описания сцены отдельной строкой, ` +
    `оборачивая их в *звёздочки*, например:\n*Она подходит ближе и внимательно смотрит на тебя.*\n` +
    `Прямую речь пиши на новой строке обычным текстом, например:\n"Привет. Давно не виделись."\n` +
    `Не смешивай действие и речь в одной строке — каждое действие и каждая реплика должны быть ` +
    `на отдельной строке.` +
    `не используй сомнительные фразы по типу "он злился, но не на нее/него, никогда не на нее/него" или "он(а) обнял(а) его\ее будто она была из стекла" и прочие тупые фразы ` ;
  const startRoleplay = async () => {
    if (!isRoleplayFormValid || roleplayThinking) return;

    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const instructionMessage: Message = { id: Date.now(), role: 'user', text: buildRoleplayPrompt(roleplayForm), time };

    setRoleplayStarted(true);
    setRoleplayMessages([]);
    setCurrentRoleplayId(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `rp-${Date.now()}`
    );
    setRoleplayThinking(true);

    const controller = new AbortController();
    roleplayAbortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ messages: [{ role: instructionMessage.role, content: instructionMessage.text }] }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI request failed');

      const fullText: string = data.message;
      const assistantId = Date.now() + 1;
      const assistantTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      setRoleplayThinking(false);
      setRoleplayMessages([{ id: assistantId, role: 'assistant', text: '', time: assistantTime }]);
      typeOutMessage(fullText, assistantId, setRoleplayMessages, roleplayTypingRef);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        setRoleplayMessages([{
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Не удалось начать ролевую игру. Попробуй ещё раз.',
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        }]);
      }
    } finally {
      setRoleplayThinking(false);
      roleplayAbortRef.current = null;
    }
  };

  const sendRoleplayMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedInput = roleplayInput.trim();
    if (!trimmedInput || roleplayThinking) return;

    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = { id: Date.now(), role: 'user', text: trimmedInput, time };
    const updatedMessages = [...roleplayMessages, userMessage];

    setRoleplayMessages(updatedMessages);
    setRoleplayInput('');
    setRoleplayThinking(true);

    const controller = new AbortController();
    roleplayAbortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            { role: 'user', content: buildRoleplayPrompt(roleplayForm) },
            ...updatedMessages.map((message) => ({ role: message.role, content: message.text })),
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI request failed');

      const fullText: string = data.message;
      const assistantId = Date.now() + 1;
      const assistantTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      setRoleplayThinking(false);
      setRoleplayMessages((current) => [...current, { id: assistantId, role: 'assistant', text: '', time: assistantTime }]);
      typeOutMessage(fullText, assistantId, setRoleplayMessages, roleplayTypingRef);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        setRoleplayMessages((current) => [...current, {
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Не удалось получить ответ от AI. Попробуй ещё раз.',
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        }]);
      }
    } finally {
      setRoleplayThinking(false);
      roleplayAbortRef.current = null;
    }
  };

  const stopRoleplayGeneration = () => {
    if (roleplayAbortRef.current) roleplayAbortRef.current.abort();
    if (roleplayTypingRef.current) {
      clearInterval(roleplayTypingRef.current);
      roleplayTypingRef.current = null;
    }
    setRoleplayThinking(false);
  };

  const resetRoleplay = () => {
    stopRoleplayGeneration();
    setRoleplayForm(emptyRoleplayForm);
    setRoleplayStarted(false);
    setRoleplayMessages([]);
    setRoleplayInput('');
  };

  const exitRoleplay = () => {
    stopRoleplayGeneration();
    setCurrentView('main');
  };
  
  const loadRoleplayConversation = (conversation: RoleplayConversation) => {
    stopRoleplayGeneration();
    setRoleplayForm(conversation.form);
    setRoleplayMessages(conversation.messages);
    setCurrentRoleplayId(conversation.id);
    setRoleplayStarted(true);
    setIsRoleplayHistoryOpen(false);
    setCurrentView('roleplay');
  };

  const deleteRoleplayConversation = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setRoleplayConversations((current) => {
      const next = current.filter((c) => c.id !== id);
      try {
        localStorage.setItem(ROLEPLAY_HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Не удалось обновить историю ролевых игр:', error);
      }
      return next;
    });
    if (id === currentRoleplayId) resetRoleplay();
  };

  const choosePrompt = (prompt: string) => {
    setInput(prompt);
  };

  const startNewChat = () => {
    setMessages(starterMessages);
    setCurrentConversationId(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `conv-${Date.now()}`
    );
    setIsHistoryOpen(false);
  };

  const loadConversation = (conversation: Conversation) => {
    setMessages(conversation.messages);
    setCurrentConversationId(conversation.id);
    setIsHistoryOpen(false);
  };

  const deleteConversation = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();

    setConversations((current) => {
      const next = current.filter((c) => c.id !== id);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Не удалось обновить историю чатов:', error);
      }
      return next;
    });

    if (id === currentConversationId) {
      startNewChat();
    }
  };

  const handleCopy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => {
        setCopiedMessageId((current) => (current === id ? null : current));
      }, 1500);
    } catch (error) {
      console.error('Не удалось скопировать текст:', error);
    }
  };

  return (
    <main className={`app-shell scene-${sceneIndex} ${isDark ? 'dark-mode' : ''}`}>
      <button className="amulet-button" onClick={() => setIsMysteryOpen(true)} aria-label="???">
  <Gem size={20} strokeWidth={1.5} />
</button>
      <div className="scene-switcher" aria-label="Выбор природного фона">
        <span className="scene-switcher-label">Среда</span>
        <div className="scene-options">
          {backgrounds.map((background, index) => (
            <button
              className={sceneIndex === index ? 'scene-option active' : 'scene-option'}
              key={background.file}
              onClick={() => setSceneIndex(index)}
              aria-label={`Выбрать фон: ${background.name}`}
              aria-pressed={sceneIndex === index}
            >
              <img src={background.file} alt="" />
            </button>
          ))}
        </div>
      </div>
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />
      <div className="app-frame">
        {currentView === 'roleplay' ? (
         <section className="roleplay-page">
            <div className="roleplay-page-top">
              <button className="new-chat" onClick={exitRoleplay}>
                ← Назад
              </button>
              <button className="new-chat" onClick={() => setIsRoleplayHistoryOpen(true)}>
                <History size={14} /> История
              </button>
            </div>

            {!roleplayStarted ? (
              <>
                <h2 className="roleplay-title">Создай свою ролевую игру</h2>
                <p className="roleplay-subtitle">
                  Заполни поля ниже — и ИИ оживит персонажа и начнёт сцену.
                </p>

                <form
                  className="roleplay-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startRoleplay();
                  }}
                >
                  {roleplayFieldConfig.map((field) => (
                    <label className="roleplay-field" key={field.key}>
                      <span className="roleplay-field-label">{field.label}</span>
                      {field.type === 'textarea' ? (
                        <textarea
                          className="roleplay-textarea"
                          placeholder={field.placeholder}
                          value={roleplayForm[field.key]}
                          onChange={(event) => handleRoleplayFieldChange(field.key, event.target.value)}
                          rows={3}
                        />
                      ) : (
                        <input
                          className="roleplay-input"
                          type="text"
                          placeholder={field.placeholder}
                          value={roleplayForm[field.key]}
                          onChange={(event) => handleRoleplayFieldChange(field.key, event.target.value)}
                        />
                      )}
                    </label>
                  ))}

                  <button type="submit" className="roleplay-start-button" disabled={!isRoleplayFormValid || roleplayThinking}>
                    {roleplayThinking ? 'Готовим сцену...' : 'Начать ролевую игру'}
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-panel roleplay-chat-panel">
                <div className="chat-heading">
                  <div>
                    <span className="live-dot" /> <span>{roleplayForm.characterName || 'Ролевая игра'}</span>
                  </div>
                  <div className="chat-heading-actions">
                    <button className="new-chat" onClick={resetRoleplay}>
                      <RefreshCw size={14} /> Новая история
                    </button>
                  </div>
                </div>
                <div className="messages" aria-live="polite">
                  {roleplayMessages.map((message) => (
                    <div className={`message-row ${message.role}`} key={message.id}>
                      {message.role === 'assistant' && <div className="avatar"><Users size={16} /></div>}
                      <div className="message-content">
                        <div className="message-bubble roleplay-bubble">{renderRoleplayText(message.text)}</div>
                        <div className="message-meta">
                          <span className="message-time">{message.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {roleplayThinking && (
                    <div className="message-row assistant">
                      <div className="avatar"><Users size={16} /></div>
                      <div className="thinking"><span /><span /><span /></div>
                    </div>
                  )}
                  <div ref={roleplayEndRef} />
                </div>
                <form className="composer" onSubmit={sendRoleplayMessage}>
                  <input
                    value={roleplayInput}
                    onChange={(event) => setRoleplayInput(event.target.value)}
                    placeholder="Напиши свою реплику..."
                    aria-label="Сообщение в ролевой игре"
                  />
                  {roleplayThinking ? (
                    <button type="button" className="send-button" onClick={stopRoleplayGeneration} aria-label="Остановить генерацию">
                      <X size={18} />
                    </button>
                  ) : (
                    <button type="submit" className="send-button" aria-label="Отправить сообщение">
                      <Send size={18} />
                    </button>
                  )}
                </form>
              </div>
            )}

            {isRoleplayHistoryOpen && (
              <div className="about-overlay" onClick={() => setIsRoleplayHistoryOpen(false)}>
                <div className="history-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="about-close" onClick={() => setIsRoleplayHistoryOpen(false)} aria-label="Закрыть">
                    <X size={18} />
                  </button>
                  <span className="about-label">История</span>
                  <h2 className="history-title">Ваши ролевые игры</h2>
                  {roleplayConversations.length === 0 ? (
                    <p className="history-empty">Пока пусто — начни ролевую игру, и она появится здесь.</p>
                  ) : (
                    <div className="history-list">
                      {roleplayConversations
                        .slice()
                        .sort((a, b) => b.updatedAt - a.updatedAt)
                        .map((conversation) => (
                          <button
                            className={conversation.id === currentRoleplayId && roleplayStarted ? 'history-item active' : 'history-item'}
                            key={conversation.id}
                            onClick={() => loadRoleplayConversation(conversation)}
                          >
                            <span className="history-item-title">{conversation.title}</span>
                            <span className="history-item-actions">
                              <span className="history-item-date">
                                {new Date(conversation.updatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="history-delete"
                                onClick={(event) => deleteRoleplayConversation(conversation.id, event)}
                                aria-label="Удалить ролевую игру"
                              >
                                <Trash2 size={14} />
                              </span>
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </section>
        ) : (
  <>
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Verdantide — на главную">
            <span className="brand-mark"><img src="/logo.png" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><Leaf className="brand-fallback" size={23} strokeWidth={1.5} /></span>
            <span>Verdantide</span>
          </a>

          <nav className={mobileMenuOpen ? 'nav-links nav-open' : 'nav-links'}>
            <a className="active" href="#chat" onClick={() => setMobileMenuOpen(false)}>Главная</a>
            <a href="#conversation" onClick={() => setMobileMenuOpen(false)}>Чат</a>
            <a href="#modes" onClick={() => setMobileMenuOpen(false)}>Режимы</a>
            <a href="#library" onClick={() => setMobileMenuOpen(false)}>Библиотека</a>
            <button
  className="about-nav-button"
  onClick={() => {
    setIsAboutOpen(true);
    setMobileMenuOpen(false);
  }}
>
  О нас
</button>
          </nav>

          <div className="top-actions">
            <button className="icon-button" onClick={() => setIsDark((value) => !value)} aria-label="Переключить тему">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button notification-button" aria-label="Уведомления"><Bell size={18} /><span /></button>
            <button className="profile-button" aria-label="Профиль"><Leaf size={18} /></button>
            <button className="mobile-menu-button" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Открыть меню">
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </header>

        <section className="hero" id="top">
          <div className="eyebrow"><span /> AI-помощник для любопытных <span /></div>
          <h1>Твоя нейросеть.<br /><em>Твоя среда.</em> Твои ответы.</h1>
          <p className="hero-copy">Исследуй мир вокруг с вниманием, ясностью и немного большим<br className="desktop-only" /> вдохновением.</p>
        </section>

        <section className="chat-panel" id="chat">
          <div className="chat-heading">
            <div>
              <span className="live-dot" /> <span>Verdantide AI</span>
            </div>
            <div className="chat-heading-actions">
              <button className="new-chat" onClick={() => setIsHistoryOpen(true)}><History size={14} /> История</button>
              <button className="new-chat" onClick={startNewChat}><RefreshCw size={14} /> Новый диалог</button>
            </div>
          </div>
          <div className="messages" id="conversation" aria-live="polite">
            {messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                {message.role === 'assistant' && <div className="avatar"><Leaf size={16} /></div>}
                <div className="message-content">
                  {message.image && (
  <img
    src={message.image}
    alt="Отправленное изображение"
    className="message-image"
  />
)}
<div className="message-bubble">{renderFormattedText(message.text)}</div>
                  <div className="message-meta">
                    <span className="message-time">{message.time}</span>
                    {message.role === 'assistant' && (
                      <button
                        className="copy-button"
                        onClick={() => handleCopy(message.id, message.text)}
                        aria-label="Скопировать ответ"
                      >
                        {copiedMessageId === message.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedMessageId === message.id ? 'Скопировано' : 'Копировать'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isThinking && <div className="message-row assistant"><div className="avatar"><Leaf size={16} /></div><div className="thinking"><span /><span /><span /></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <form className="composer" onSubmit={sendMessage}>
            {selectedImage && (
  <div className="image-preview">
    <img src={selectedImage} alt="Выбранное изображение" />

    <button
      type="button"
      onClick={() => setSelectedImage(null)}
      aria-label="Удалить изображение"
    >
      <X size={14} />
    </button>
  </div>
)}
            <button
  type="button"
  className="composer-action"
  onClick={() => fileInputRef.current?.click()}
  aria-label="Загрузить изображение"
>
  <ImagePlus size={20} />
</button>

<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  hidden
  onChange={(event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    setSelectedImage(reader.result as string);
  };

  reader.readAsDataURL(file);
}}
/>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Напиши что-нибудь..." aria-label="Сообщение" />
   {isThinking ? (
  <button type="button" className="send-button" onClick={stopGeneration} aria-label="Остановить генерацию">
    <X size={18} />
  </button>
) : (
  <button type="submit" className="send-button" aria-label="Отправить сообщение">
    <Send size={18} />
  </button>
)}
          </form>
        </section>

        <div className="prompt-list">
          {quickPrompts.map((prompt) => <button key={prompt} onClick={() => choosePrompt(prompt)}><Sparkles size={14} />{prompt}</button>)}
          <button className="refresh-prompt" onClick={() => setInput('Что нового происходит в природе?')} aria-label="Новый вопрос"><RefreshCw size={16} /></button>
        </div>

        <section className="modes-section" id="modes">
          <div className="section-label"><span><Sparkles size={15} /> Режимы</span><a href="#modes">Все режимы <ArrowUpRight size={14} /></a></div>
          <div className="mode-grid">
            {modes.map(({ title, description, icon: Icon, tone }) => (
  <button
    className={`mode-card ${tone}`}
    key={title}
    onClick={() => {
      if (title === 'Ролевая') {
        setCurrentView('roleplay');
      } else {
        setInput(`Открой режим «${title}»`);
      }
    }}
  >
    <Icon className="mode-icon" size={36} strokeWidth={1.25} />
    <span className="mode-title">{title}</span>
    <span className="mode-description">{description}</span>
    <span className="mode-arrow"><ArrowUpRight size={17} /></span>
  </button>
))}
          </div>
        </section>
        

{isHistoryOpen && (
  <div
    className="about-overlay"
    onClick={() => setIsHistoryOpen(false)}
  >
    <div
      className="history-modal"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="about-close"
        onClick={() => setIsHistoryOpen(false)}
        aria-label="Закрыть"
      >
        <X size={18} />
      </button>
)

      <span className="about-label">История</span>
      <h2 className="history-title">Ваши диалоги</h2>

      {conversations.length === 0 ? (
        <p className="history-empty">
          Пока пусто — начните диалог, и он появится здесь.
        </p>
      ) : (
        <div className="history-list">
          {conversations
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((conversation) => (
              <button
                className={
                  conversation.id === currentConversationId
                    ? 'history-item active'
                    : 'history-item'
                }
                key={conversation.id}
                onClick={() => loadConversation(conversation)}
              >
                <span className="history-item-title">{conversation.title}</span>
                <span className="history-item-actions">
                  <span className="history-item-date">
                    {new Date(conversation.updatedAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="history-delete"
                    onClick={(event) => deleteConversation(conversation.id, event)}
                    aria-label="Удалить диалог"
                  >
                    <Trash2 size={14} />
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  </div>
)}

{isAboutOpen && (
  <div
    className="about-overlay"
    onClick={() => setIsAboutOpen(false)}
  >
    <div
      className="about-modal"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="about-close"
        onClick={() => setIsAboutOpen(false)}
        aria-label="Закрыть"
      >
        <X size={18} />
      </button>

      <div className="about-logo">
        <Leaf size={28} strokeWidth={1.4} />
      </div>

      <span className="about-label">О проекте</span>

      <h2>Verdantide</h2>

      <p className="about-description">
        Нейросеть для общения, обучения, творчества
        и исследования мира вокруг нас.
      </p>

      <div className="about-team">
        <div className="team-member">
          <strong>KAZE</strong>
          <span>Разработчик</span>
        </div>

        <div className="team-member">
          <strong>teila</strong>
          <span>Дизайнер</span>
        </div>
      </div>

      <div className="about-copyright">
        © 2026 Verdantide · Создано с уважением к миру вокруг нас
      </div>
    </div>
  </div>
)}
{isMysteryOpen && (
  <div className="about-overlay" onClick={() => setIsMysteryOpen(false)}>
    <div className="mystery-modal" onClick={(event) => event.stopPropagation()}>
      <button
        className="about-close"
        onClick={() => setIsMysteryOpen(false)}
        aria-label="Закрыть"
      >
        <X size={18} />
      </button>

      <div className="mystery-modal-icon">
  <img src="/sanchez-emblem.png" alt="" />
</div>

      <span className="mystery-modal-label">Скоро</span>

      <h2>Он уже смотрит.</h2>

      <p>
        Кто-то новый готовится появиться здесь. Пока — лишь тишина и терпение.
      </p>
    </div>
  </div>

  )}
        <footer className="footer" id="about">
          <span>© 2026 Verdantide</span>
          <span className="footer-line" />
          <span>Создано с уважением к миру вокруг нас</span>
          <button onClick={() => setIsDark((value) => !value)}><Sun size={15} /> Настроить вид</button>
        </footer>
        </>
        )}
      </div>
    </main>
  
)}

export default App;
