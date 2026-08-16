import { FormEvent, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
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
  X,
} from 'lucide-react';

type Message = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

const starterMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    text: 'Здравствуйте. Я Verdantide — ваш спокойный проводник по миру природы. О чём хотите узнать сегодня?',
    time: '09:41',
  },
  {
    id: 2,
    role: 'user',
    text: 'Расскажи, почему леса называют лёгкими планеты?',
    time: '09:42',
  },
  {
    id: 3,
    role: 'assistant',
    text: 'Леса поглощают углекислый газ и выделяют кислород во время фотосинтеза. Но их роль ещё шире: они охлаждают климат, удерживают влагу, защищают почву и дают дом большинству наземных видов. Точнее будет назвать леса живой системой дыхания Земли.',
    time: '09:42',
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
];

function App() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = async (event?: FormEvent) => {
  event?.preventDefault();

  const trimmedInput = input.trim();

  if (!trimmedInput || isThinking) return;

  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const userMessage: Message = {
    id: Date.now(),
    role: 'user',
    text: trimmedInput,
    time,
  };

  const updatedMessages = [...messages, userMessage];

  setMessages(updatedMessages);
  setInput('');
  setIsThinking(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: updatedMessages.map((message) => ({
          role: message.role,
          content: message.text,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI request failed');
    }

    setMessages((current) => [
      ...current,
      {
        id: Date.now() + 1,
        role: 'assistant',
        text: data.message,
        time: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
  } catch (error) {
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
  } finally {
    setIsThinking(false);
  }
};
  const choosePrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <main className={`app-shell scene-${sceneIndex} ${isDark ? 'dark-mode' : ''}`}>
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
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>О нас</a>
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
            <button className="new-chat" onClick={() => setMessages(starterMessages)}><RefreshCw size={14} /> Новый диалог</button>
          </div>
          <div className="messages" id="conversation" aria-live="polite">
            {messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                {message.role === 'assistant' && <div className="avatar"><Leaf size={16} /></div>}
                <div className="message-content">
                  <div className="message-bubble">{message.text}</div>
                  <span className="message-time">{message.time}</span>
                </div>
              </div>
            ))}
            {isThinking && <div className="message-row assistant"><div className="avatar"><Leaf size={16} /></div><div className="thinking"><span /><span /><span /></div></div>}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <button type="button" className="composer-action" onClick={() => fileInputRef.current?.click()} aria-label="Загрузить изображение"><ImagePlus size={20} /></button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden />
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Напиши что-нибудь..." aria-label="Сообщение" />
            <button type="submit" className="send-button" aria-label="Отправить сообщение"><Send size={18} /></button>
          </form>
        </section>

        <div className="prompt-list">
          {quickPrompts.map((prompt) => <button key={prompt} onClick={() => choosePrompt(prompt)}><Sparkles size={14} />{prompt}</button>)}
          <button className="refresh-prompt" onClick={() => setInput('Что нового происходит в природе?')} aria-label="Новый вопрос"><RefreshCw size={16} /></button>
        </div>

        <section className="modes-section" id="modes">
          <div className="section-label"><span><Sparkles size={15} /> Режимы</span><a href="#modes">Все режимы <ArrowUpRight size={14} /></a></div>
          <div className="mode-grid">
            {modes.map(({ title, description, icon: Icon, tone }) => <button className={`mode-card ${tone}`} key={title} onClick={() => setInput(`Открой режим «${title}»`)}><Icon className="mode-icon" size={36} strokeWidth={1.25} /><span className="mode-title">{title}</span><span className="mode-description">{description}</span><span className="mode-arrow"><ArrowUpRight size={17} /></span></button>)}
          </div>
        </section>

        <footer className="footer" id="about">
          <span>© 2024 Verdantide</span>
          <span className="footer-line" />
          <span>Создано с уважением к миру вокруг нас</span>
          <button onClick={() => setIsDark((value) => !value)}><Sun size={15} /> Настроить вид</button>
        </footer>
      </div>
    </main>
  );
}

export default App;
