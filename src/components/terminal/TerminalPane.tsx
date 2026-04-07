import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { WebglAddon } from '@xterm/addon-webgl';
import { onPtyData, onPtyExit, ptyWrite, ptyResize } from '../../lib/ipc';

interface TerminalPaneProps {
  ptyId: string;
  isVisible: boolean;
  onExit?: () => void;
}

export const TerminalPane: React.FC<TerminalPaneProps> = React.memo(({ ptyId, isVisible, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      theme: {
        background: '#141414',
        foreground: '#f5f5f5',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bbbbbb',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#50fa7b',
        brightYellow: '#f1fa8c',
        brightBlue: '#bd93f9',
        brightMagenta: '#ff79c6',
        brightCyan: '#8be9fd',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    try {
      terminal.loadAddon(new WebglAddon());
    } catch (e) {
      console.warn('WebGL addon failed to load, falling back to canvas', e);
    }

    terminal.open(containerRef.current);

    // Allow global hotkeys (like Alt+Enter) to bubble up
    terminal.attachCustomKeyEventHandler((e) => {
      // Let global shortcuts pass through to the browser/window
      if ((e.altKey || e.metaKey) && (e.key === 'Enter' || e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'f')) {
        return false;
      }
      if (e.key === 'Escape') {
        return false;
      }
      return true;
    });

    // Initial fit
    setTimeout(() => {
      try {
        fitAddon.fit();
        if (terminal.cols > 0 && terminal.rows > 0) {
          ptyResize(ptyId, terminal.cols, terminal.rows).catch(() => {});
        }
      } catch {
        // ignore fit errors on unmounted
      }
    }, 50);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Forward input to PTY
    terminal.onData((data) => {
      ptyWrite(ptyId, data).catch(console.error);
    });

    // Listen for PTY output
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let isMounted = true;

    const setupListeners = async () => {
      const dataFn = await onPtyData(ptyId, (data) => {
        if (isMounted) terminal.write(data);
      });
      if (isMounted) {
        unlistenData = dataFn;
      } else {
        dataFn();
      }

      const exitFn = await onPtyExit(ptyId, () => {
        if (isMounted) {
          terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
          onExitRef.current?.();
        }
      });
      if (isMounted) {
        unlistenExit = exitFn;
      } else {
        exitFn();
      }
    };

    setupListeners();

    // Resize observer with frame sync to prevent stretching
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!terminalRef.current || !isMounted) return;
        try {
          fitAddon.fit();
          if (terminal.cols > 0 && terminal.rows > 0) {
             ptyResize(ptyId, terminal.cols, terminal.rows).catch(() => {});
          }
        } catch {
          // ignore
        }
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      terminal.dispose();
    };
  }, [ptyId]); // Removed onExit from deps to prevent re-init


  // Refit when visibility changes
  useEffect(() => {
    if (isVisible && fitAddonRef.current && terminalRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          const term = terminalRef.current!;
          if (term.cols > 0 && term.rows > 0) {
            ptyResize(ptyId, term.cols, term.rows).catch(() => {});
          }
          term.focus();
        } catch {
          // ignore
        }
      }, 50);
    }
  }, [isVisible, ptyId]);

  return (
    <div
      ref={containerRef}
      className="xterm-wrapper"
      style={{
        display: isVisible ? 'block' : 'none',
      }}
    />
  );
});

TerminalPane.displayName = 'TerminalPane';
