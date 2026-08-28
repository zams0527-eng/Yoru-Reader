import React, { useState } from 'react';
import { BookOpen, Search, Keyboard, Sparkles, CheckCircle2, ChevronRight, ChevronLeft, X, Layers, Volume2, Bookmark, Compass } from 'lucide-react';

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'es' | 'en';
}

export const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  isOpen,
  onClose,
  lang = 'es'
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const totalSteps = 4;

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
          maxWidth: '640px',
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
            <span style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em', color: '#FFE000', textTransform: 'uppercase' }}>
              {lang === 'es' ? 'Guía Rápida de Yoru Reader' : 'Yoru Reader Quick Guide'}
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
        <div style={{ padding: '28px 32px', minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* STEP 1: Welcome & Formats */}
          {currentStep === 0 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '56px',
                height: '56px',
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
              <p style={{ color: '#a0a0b0', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px' }}>
                {lang === 'es' 
                  ? 'Tu lector inmersivo para aprender japonés leyendo novelas ligeras y libros con total fluidez.'
                  : 'Your immersive Japanese novel reader designed to learn Japanese effortlessly while reading.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFE000', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} /> {lang === 'es' ? 'Soporte Multiformato' : 'Multi-format Support'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888899', lineHeight: '1.4' }}>
                    {lang === 'es' ? 'Importa EPUB, PDF (con lectura vertical 縦書き), TXT y HTML.' : 'Import EPUB, PDF (with vertical tate-gaki), TXT, and HTML.'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFE000', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={15} /> {lang === 'es' ? 'Lectura Vertical' : 'Vertical Reading'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888899', lineHeight: '1.4' }}>
                    {lang === 'es' ? 'Alterna entre vista vertical japonesa tradicional y horizontal.' : 'Switch between authentic Japanese vertical and horizontal modes.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Yomitan & Dictionary */}
          {currentStep === 1 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '56px',
                height: '56px',
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
                {lang === 'es' ? 'Diccionario Yomitan y Furigana' : 'Integrated Yomitan & Furigana'}
              </h2>
              <p style={{ color: '#a0a0b0', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '16px' }}>
                {lang === 'es'
                  ? 'Haz clic o pasa el cursor sobre cualquier palabra japonesa para consultar su significado al instante.'
                  : 'Click or hover over any Japanese word to instantly view definitions, furigana, and audio.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Volume2 size={20} style={{ color: '#FFE000', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>{lang === 'es' ? 'Audio y Pronunciación' : 'Audio & Pronunciation'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888899' }}>{lang === 'es' ? 'Escucha la pronunciación nativa de cada término y su pitch accent.' : 'Listen to native pronunciation and pitch accent.'}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Bookmark size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>{lang === 'es' ? 'Seguimiento de Vocabulario' : 'Vocabulary Tracking'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888899' }}>{lang === 'es' ? 'Clasifica palabras en Nuevo, Aprendiendo, Conocido o Ignorado.' : 'Tag words as New, Learning, Known, or Ignored.'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Essential Keyboard Shortcuts */}
          {currentStep === 2 && (
            <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '56px',
                height: '56px',
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
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Crear tarjeta Anki' : 'Create Anki Card'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>A</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Ajustes de Lectura' : 'Reading Settings'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>Q</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{lang === 'es' ? 'Cerrar / Salir' : 'Close / Exit'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#FFE000' }}>Esc</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Ready to Start */}
          {currentStep === 3 && (
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: currentStep === idx ? '24px' : '8px',
                  height: '8px',
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
