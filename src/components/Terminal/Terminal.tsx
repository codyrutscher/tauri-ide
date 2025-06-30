import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Command } from '@tauri-apps/plugin-shell';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  workingDirectory?: string | null;
}

export const Terminal: React.FC<TerminalProps> = ({ workingDirectory }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState<string>(workingDirectory || '~');

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    // Write welcome message
    term.writeln('Welcome to Cody Editor Terminal');
    if (workingDirectory) {
      term.writeln(`Working directory: ${workingDirectory}`);
    }
    term.writeln('');
    term.write('$ ');

    // Handle input
    term.onData((data) => {
      handleTerminalInput(data);
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.warn('Failed to fit terminal:', e);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (workingDirectory && xtermRef.current && cwd !== workingDirectory) {
      setCwd(workingDirectory);
      const term = xtermRef.current;
      term.writeln('');
      term.writeln(`Working directory changed to: ${workingDirectory}`);
      term.write(`$ `);
      setCurrentCommand('');
    }
  }, [workingDirectory]);

  const handleTerminalInput = async (data: string) => {
    const term = xtermRef.current;
    if (!term) return;

    // Handle special keys
    if (data === '\r') { // Enter
      term.write('\r\n');
      
      if (currentCommand.trim()) {
        // Add to history
        setCommandHistory(prev => [...prev, currentCommand]);
        setHistoryIndex(-1);
        
        // Execute command
        await executeCommand(currentCommand);
      }
      
      term.write('$ ');
      setCurrentCommand('');
    } else if (data === '\x7f') { // Backspace
      if (currentCommand.length > 0) {
        term.write('\b \b');
        setCurrentCommand(prev => prev.slice(0, -1));
      }
    } else if (data === '\x1b[A') { // Up arrow
      navigateHistory('up');
    } else if (data === '\x1b[B') { // Down arrow
      navigateHistory('down');
    } else if (data === '\x03') { // Ctrl+C
      term.write('^C\r\n$ ');
      setCurrentCommand('');
    } else if (data.charCodeAt(0) >= 32) { // Printable characters
      term.write(data);
      setCurrentCommand(prev => prev + data);
    }
  };

  const navigateHistory = (direction: 'up' | 'down') => {
    const term = xtermRef.current;
    if (!term || commandHistory.length === 0) return;

    let newIndex = historyIndex;
    if (direction === 'up') {
      newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex === -1 ? -1 : Math.min(commandHistory.length - 1, historyIndex + 1);
    }

    setHistoryIndex(newIndex);

    // Clear current line
    term.write('\r\x1b[K$ ');
    
    if (newIndex >= 0 && newIndex < commandHistory.length) {
      const command = commandHistory[newIndex];
      term.write(command);
      setCurrentCommand(command);
    } else {
      setCurrentCommand('');
    }
  };

  const executeCommand = async (command: string) => {
    const term = xtermRef.current;
    if (!term) return;

    console.log('Executing command:', command, 'in directory:', cwd);

    try {
      // Parse command
      const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      if (parts.length === 0) return;

      const cmd = parts[0];
      const args = parts.slice(1).map(arg => arg.replace(/^"(.*)"$/, '$1'));

      // Special handling for 'clear' command
      if (cmd === 'clear') {
        term.clear();
        return;
      }

      // Special handling for 'cd' command
      if (cmd === 'cd') {
        let newPath = args[0] || workingDirectory || '/';
        
        // Handle relative paths
        if (!newPath.startsWith('/')) {
          newPath = cwd !== '~' ? `${cwd}/${newPath}` : newPath;
        }
        
        // Test if directory exists
        const testCmd = Command.create('sh', ['-c', `cd "${newPath}" && pwd`], {
          cwd: cwd !== '~' ? cwd : workingDirectory || undefined
        });
        
        try {
          const result = await testCmd.execute();
          if (result.stdout) {
            const actualPath = result.stdout.trim();
            setCwd(actualPath);
            console.log('Changed directory to:', actualPath);
          }
        } catch (e) {
          term.write(`\x1b[31mcd: ${newPath}: No such file or directory\x1b[0m\r\n`);
        }
        return;
      }

      // Execute command through shell with current directory
      const options: any = {};
      if (cwd && cwd !== '~') {
        options.cwd = cwd;
      } else if (workingDirectory) {
        options.cwd = workingDirectory;
      }

      console.log('Creating command:', 'sh -c', command, 'with options:', options);
      const shellCmd = Command.create('sh', ['-c', command], options);
      
      const output = await shellCmd.execute();
      console.log('Command output:', output);

      if (output.stdout) {
        term.write(output.stdout.replace(/\n/g, '\r\n'));
      }
      if (output.stderr) {
        term.write(`\x1b[31m${output.stderr.replace(/\n/g, '\r\n')}\x1b[0m`);
      }
    } catch (error: any) {
      console.error('Command execution error:', error);
      term.write(`\x1b[31mError: ${error.message || error}\x1b[0m\r\n`);
    }
  };

  const testCommand = async () => {
    console.log('=== TEST COMMAND ===');
    try {
      const testCmd = Command.create('sh', ['-c', 'echo "Hello from shell"']);
      console.log('Created test command');
      const result = await testCmd.execute();
      console.log('Test command result:', result);
      if (xtermRef.current) {
        xtermRef.current.writeln(`Test result: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      console.error('Test command failed:', error);
      if (xtermRef.current) {
        xtermRef.current.writeln(`Test error: ${error.message}`);
      }
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>Terminal</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="terminal-clear-btn"
            onClick={testCommand}
          >
            Test
          </button>
          <button
            className="terminal-clear-btn"
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear();
              }
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="terminal-content" />
    </div>
  );
};