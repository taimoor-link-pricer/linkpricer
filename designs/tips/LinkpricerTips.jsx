import React, { useState, useEffect } from 'react';

const LinkpricerTips = ({ 
  tips = [
    { text: "Add Forbes.com at $150 (your supplier's price) and see how it compares to your own pricing.", link: null },
    { text: "Our bestie is Rankup.com — use code LINKPRICER for a free month.", link: "https://rankup.com" },
    { text: "Browse related sites by category and country to find the best place to buy.", link: null },
    { text: "Add a site to Favorites and we'll ping vendors to source it for you specifically.", link: null },
    { text: "Fun fact: eSports brands spend ~$20k/month on backlinks 🍻", link: null },
    { text: "Compare supplier prices side-by-side before you commit.", link: null },
    { text: "Turn on alerts to get notified when a watched site drops in price.", link: null }
  ],
  duration = 56.25
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for prefers-reduced-motion on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (isDismissed) return null;

  return (
    <div
      role="region"
      aria-label="Linkpricer tips"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: '40px',
        background: 'linear-gradient(90deg, #f0f7ff 0%, #e6f2ff 100%)',
        borderBottom: '1px solid #d1d5db',
        display: 'flex',
        alignItems: 'center',
        fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
        fontSize: '13px',
        overflow: 'hidden'
      }}
    >
      {/* Label (Fixed Left) */}
      <div
        style={{
          flexShrink: 0,
          paddingLeft: '16px',
          paddingRight: '20px',
          fontWeight: 600,
          color: '#0052cc',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <span>Linkpricer · Tips</span>
      </div>

      {/* Scrolling Container */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        <style>{`
          @keyframes scroll-tips {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }

          .tips-scroll-container {
            display: flex;
            gap: 200px;
            white-space: nowrap;
            animation: scroll-tips ${prefersReducedMotion ? 'none' : duration + 's'} linear infinite;
            padding-right: 40px;
          }

          .tips-scroll-container:hover {
            animation-play-state: ${prefersReducedMotion ? 'paused' : 'paused'};
          }

          .tip-item {
            flex-shrink: 0;
            color: #374151;
            display: flex;
            align-items: center;
          }

          .tip-link {
            color: #0052cc;
            text-decoration: none;
            cursor: pointer;
            display: inline;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s;
          }

          .tip-link:hover {
            border-bottom-color: #0052cc;
          }

          .tip-link:focus {
            outline: 2px solid #0052cc;
            outline-offset: 2px;
            border-radius: 2px;
          }

          @media (prefers-reduced-motion: reduce) {
            .tips-scroll-container {
              animation: none;
              overflow-x: auto;
              overflow-y: hidden;
            }

            .tips-scroll-container::-webkit-scrollbar {
              height: 4px;
            }

            .tips-scroll-container::-webkit-scrollbar-track {
              background: transparent;
            }

            .tips-scroll-container::-webkit-scrollbar-thumb {
              background: #d1d5db;
              border-radius: 2px;
            }
          }

          @media (max-width: 640px) {
            .tips-label {
              font-size: 0;
            }

            .tips-label span:first-child {
              font-size: 16px;
            }

            .tips-scroll-container {
              gap: 24px;
            }
          }
        `}</style>

        <div className="tips-scroll-container">
          {/* Original tips */}
          {tips.map((tip, idx) => (
            <div key={`tip-${idx}`} className="tip-item">
              {tip.link ? (
                <a href={tip.link} target="_blank" rel="noopener noreferrer" className="tip-link">
                  {tip.text}
                </a>
              ) : (
                <span>{tip.text}</span>
              )}
            </div>
          ))}

          {/* Duplicate tips for seamless loop */}
          {tips.map((tip, idx) => (
            <div key={`tip-dup-${idx}`} className="tip-item">
              {tip.link ? (
                <a href={tip.link} target="_blank" rel="noopener noreferrer" className="tip-link">
                  {tip.text}
                </a>
              ) : (
                <span>{tip.text}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dismiss Button (Fixed Right) */}
      <button
        onClick={() => setIsDismissed(true)}
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: '#6b7280',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          transition: 'color 0.2s',
          fontWeight: 'bold'
        }}
        onMouseEnter={(e) => (e.target.style.color = '#374151')}
        onMouseLeave={(e) => (e.target.style.color = '#6b7280')}
        aria-label="Dismiss tips banner"
      >
        ×
      </button>
    </div>
  );
};

export default LinkpricerTips;
