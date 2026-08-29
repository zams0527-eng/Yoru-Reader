import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Keyboard, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Layers, 
  Volume2, 
  Bookmark, 
  Compass, 
  Database, 
  Download, 
  Zap, 
  BarChart3, 
  Flame, 
  Clock 
} from 'lucide-react';

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDictionaries?: () => void;
  lang?: 'es' | 'en';
}

export const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  isOpen,
  onClose,
  onOpenDictionaries,
  lang = 'es'
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const totalSteps = 6;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('yoru_tutorial_seen_v1', 'true');
    onClose();
  };

  const handleGoToDictionaries = () => {
    handleFinish();
    if (onOpenDictionaries) {
      onOpenDictionaries();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleFinish();
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#0d0d10',
          border: '1px solid rgba(255, 224, 0, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 224, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          color: '#e8e8f0',
          fontFamily: 'var(--font-ui), sans-serif'
        }}
      >
        {/* Header with Close */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: '#FFE000' }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, letterSpacing: '0.05em', color: '#FFE000', textTransform: 'uppercase' }}>
              {lang === 'es' ? `Guía Rápida de Yoru Reader (${currentStep + 1}/${totalSteps})` : `Yoru Reader Guide (${currentStep + 1}/${totalSteps})`}
            </span>
          </div>
          <button
            onClick={handleFinish}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent'; }}
            title={lang === 'es' ? 'Cerrar' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '28px 32px', minHeight: '360px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* STEP 1: Welcome & Formats */}
          {currentStep === 0 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(255, 224, 0, 0.12)',
                border: '1px solid rgba(255, 224, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#FFE000'
              }}>
                <BookOpen size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                {lang === 'es' ? '¡Bienvenido a Yoru Reader!' : 'Welcome to Yoru Reader!'}
              </h2>
              <p style={{ color: '#a0a0b0', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '20px' }}>
                {lang === 'es' 
                  ? 'Tu plataforma completa para leer novelas y libros en japonés con herramientas integradas de inmersión y aprendizaje.'
                  : 'Your complete Japanese novel reader equipped with integrated immersion and learning tools.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFE000', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} /> {lang === 'es' ? 'Formatos Soportados' : 'Supported Formats'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888899', lineHeight: '1.4' }}>
                    {lang === 'es' ? 'Importa EPUB, PDF (con lectura vertical 縦書き), TXT y HTML.' : 'Import EPUB, PDF (with vertical layout), TXT, and HTML.'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFE000', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={15} /> {lang === 'es' ? 'Lectura Vertical' : 'Vertical Reading'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888899', lineHeight: '1.4' }}>
                    {lang === 'es' ? 'Lee en auténtico formato vertical japonés tradicional (縦書き) u horizontal.' : 'Switch between authentic Japanese vertical and horizontal modes.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Instalar Diccionarios (El paso más importante) */}
          {currentStep === 1 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(255, 94, 98, 0.15)',
                border: '1px solid rgba(255, 94, 98, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#ff5e62'
              }}>
                <Database size={28} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {lang === 'es' ? 'Paso Fundamental: Instalar Diccionarios' : 'Key Step: Install Dictionaries'}
                </h2>
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                  {lang === 'es' ? 'IMPORTANTE' : 'IMPORTANT'}
                </span>
              </div>
              <p style={{ color: '#a0a0b0', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '16px' }}>
                {lang === 'es'
                  ? 'Para buscar significados, furigana y clasificar palabras mientras lees, necesitas tener instalados los diccionarios y listas de frecuencias.'
                  : 'To look up definitions, furigana, and track vocabulary, you need to install dictionary and frequency packages.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFE000' }} />
                  <div style={{ fontSize: '0.82rem', color: '#ccc' }}>
                    <strong>{lang === 'es' ? 'Instalar desde nuestra biblioteca:' : 'Install from preset library:'}</strong> {lang === 'es' ? 'Descarga JMdict (Español / Inglés) y frecuencias con 1 clic.' : 'Download JMdict and frequency lists with one click.'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }} />
                  <div style={{ fontSize: '0.82rem', color: '#ccc' }}>
                    <strong>{lang === 'es' ? 'Instalar desde archivo (.zip):' : 'Install from file (.zip):'}</strong> {lang === 'es' ? 'Importa cualquier paquete de diccionario compatible que tengas en tu equipo.' : 'Import any compatible dictionary .zip package.'}
                  </div>
                </div>
              </div>

              {/* DIRECT ACTION BUTTON TO INSTALL DICTIONARIES */}
              <button
                type="button"
                onClick={handleGoToDictionaries}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  background: 'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(255, 94, 98, 0.4)',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Download size={18} />
                {lang === 'es' ? '📖 Ir a Instalar Diccionarios Ahora' : '📖 Install Dictionaries Now'}
              </button>
            </div>
          )}

          {/* STEP 3: Smart Dictionary & Shift+Hover */}
          {currentStep === 2 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#34d399'
              }}>
                <Search size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                {lang === 'es' ? 'Diccionario Inteligente y Furigana' : 'Smart Dictionary & Furigana'}
              </h2>
              <p style={{ color: '#a0a0b0', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '16px' }}>
                {lang === 'es'
                  ? 'Consulta cualquier término japonés mientras lees de forma rápida y sin distracciones:'
                  : 'Look up any Japanese word while reading quickly and seamlessly:'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(255, 224, 0, 0.08)', border: '1px solid rgba(255, 224, 0, 0.3)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ background: '#FFE000', color: '#000', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                    SHIFT
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFE000' }}>
                      {lang === 'es' ? 'Coloca el cursor + Presiona Shift' : 'Hover word + Press Shift'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                      {lang === 'es' 
                        ? 'En el modo de lectura, pon el ratón sobre cualquier palabra y presiona Shift para abrir el diccionario.' 
                        : 'In reading mode, place your cursor over any word and press Shift to show definition.'}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Volume2 size={18} style={{ color: '#38bdf8', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{lang === 'es' ? 'Audio y Pronunciación' : 'Audio & Pronunciation'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#888899' }}>{lang === 'es' ? 'Escucha la pronunciación nativa y consulta el acento tonal (pitch accent).' : 'Listen to native audio and view pitch accent.'}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Bookmark size={18} style={{ color: '#a3e635', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{lang === 'es' ? 'Seguimiento de Vocabulario' : 'Vocabulary Tracking'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#888899' }}>{lang === 'es' ? 'Clasifica palabras en Nuevo, Aprendiendo, Conocido o Ignorado.' : 'Tag words as New, Learning, Known, or Ignored.'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Essential Keyboard Shortcuts */}
          {currentStep === 3 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(244, 114, 182, 0.12)',
                border: '1px solid rgba(244, 114, 182, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#f472b6'
              }}>
                <Keyboard size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px', color: '#fff' }}>
                {lang === 'es' ? 'Atajos de Teclado Esenciales' : 'Essential Keyboard Shortcuts'}
              </h2>
              <p style={{ color: '#a0a0b0', fontSize: '0.88rem', marginBottom: '14px' }}>
                {lang === 'es' ? 'Navega y controla el lector a máxima velocidad:' : 'Control and navigate the reader with speed:'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(255, 224, 0, 0.06)', border: '1px solid rgba(255, 224, 0, 0.25)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>{lang === 'es' ? 'Ver Diccionario' : 'Inspect Dictionary'}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ background: '#FFE000', color: '#000', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>Shift</span>
                    <span style={{ fontSize: '0.75rem', color: '#FFE000', display: 'flex', alignItems: 'center' }}>+ Hover</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Avanzar / Retroceder' : 'Next / Prev page'}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>Space</span>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>J / K</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Pantalla Completa' : 'Toggle Fullscreen'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>F</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Vertical / Horizontal' : 'Vertical / Horizontal'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>V</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Crear tarjeta Anki / SRS' : 'Create Anki/SRS Card'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>A</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Ajustes de Lectura' : 'Reading Settings'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>Q</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Yoru SRS & Estadísticas */}
          {currentStep === 4 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(255, 224, 0, 0.12)',
                border: '1px solid rgba(255, 224, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#FFE000'
              }}>
                <Zap size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                {lang === 'es' ? 'Yoru SRS y Estadísticas de Lectura' : 'Yoru SRS & Reading Statistics'}
              </h2>
              <p style={{ color: '#a0a0b0', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '16px' }}>
                {lang === 'es'
                  ? 'Todo lo que necesitas para memorizar vocabulario y medir tu progreso en tiempo real:'
                  : 'Everything you need to memorize vocabulary and track reading progress in real time:'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFE000', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={16} /> {lang === 'es' ? 'Yoru SRS (Repaso Espaciado)' : 'Yoru SRS (Spaced Repetition)'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888899', lineHeight: '1.4' }}>
                    {lang === 'es' 
                      ? 'Guarda palabras de tus novelas en mazos de estudio con audio y oraciones de contexto para repasarlas a diario.' 
                      : 'Save words into study decks with audio and context sentences to review daily.'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart3 size={16} /> {lang === 'es' ? 'Estadísticas y Racha' : 'Statistics & Streak'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888899', lineHeight: '1.4' }}>
                    {lang === 'es' 
                      ? 'Monitorea tu velocidad de lectura (chars/h), tiempo total, mapa de calor y días consecutivos de lectura.' 
                      : 'Track your reading speed (chars/h), total time, heatmap, and consecutive daily streak.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Ready to Start */}
          {currentStep === 5 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255, 224, 0, 0.15)',
                border: '2px solid #FFE000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#FFE000'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                {lang === 'es' ? '¡Todo Listo para Empezar!' : 'You Are All Set!'}
              </h2>
              <p style={{ color: '#a0a0b0', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                {lang === 'es'
                  ? 'Arrastra tus archivos de libros a la biblioteca o usa el botón "+" para comenzar tu aventura de lectura.'
                  : 'Drag & drop your book files into the library or use the "+" button to begin your Japanese reading adventure.'}
              </p>
              <div style={{ fontSize: '0.82rem', color: '#888899', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '20px', display: 'inline-block' }}>
                💡 {lang === 'es' ? 'Puedes volver a ver este tutorial en cualquier momento desde los Ajustes (⚙️).' : 'You can revisit this tutorial anytime in Settings (⚙️).'}
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: currentStep === idx ? '22px' : '7px',
                  height: '7px',
                  borderRadius: '4px',
                  background: currentStep === idx ? '#FFE000' : 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s ease'
                }}
                title={`Paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <ChevronLeft size={16} />
                {lang === 'es' ? 'Anterior' : 'Back'}
              </button>
            )}

            <button
              onClick={handleNext}
              style={{
                padding: '8px 20px',
                background: 'linear-gradient(135deg, #FFE000 0%, #c2aa00 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(255, 224, 0, 0.3)',
                transition: 'all 0.15s'
              }}
            >
              {currentStep === totalSteps - 1 
                ? (lang === 'es' ? '¡Empezar a leer!' : 'Get Started!')
                : (lang === 'es' ? 'Siguiente' : 'Next')
              }
              {currentStep < totalSteps - 1 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
