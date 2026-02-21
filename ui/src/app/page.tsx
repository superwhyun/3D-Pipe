'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

const FbxViewer = dynamic(() => import('./components/FbxViewer'), { ssr: false });
const GlbViewer = dynamic(() => import('./components/GlbViewer'), { ssr: false });

type FileStatus = 'pending' | 'converting' | 'done' | 'error';
type ApiMode = 'local' | 'runpod';
type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'error';

const SETTINGS_STORAGE_KEY = '3dpipe.backend.settings.v1';

interface FileItem {
  id: string;
  file: File;
  status: FileStatus;
  glbUrl?: string; // Store original URL for comparison
  resultUrl?: string;
  error?: string;
}

export default function Home() {
  const defaultMode: ApiMode = process.env.NEXT_PUBLIC_API_MODE === 'local' ? 'local' : 'runpod';
  const defaultLocalUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:9001/convert';
  const defaultRunpodUrl = process.env.NEXT_PUBLIC_RUNPOD_URL || 'https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync';
  const defaultRunpodApiKey = process.env.NEXT_PUBLIC_RUNPOD_API_KEY || '';

  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [apiMode, setApiMode] = useState<ApiMode>(defaultMode);
  const [localApiUrl, setLocalApiUrl] = useState(defaultLocalUrl);
  const [runpodUrl, setRunpodUrl] = useState(defaultRunpodUrl);
  const [runpodApiKey, setRunpodApiKey] = useState(defaultRunpodApiKey);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState('Not checked');

  const activeEndpoint = useMemo(() => {
    return apiMode === 'local' ? localApiUrl.trim() : runpodUrl.trim();
  }, [apiMode, localApiUrl, runpodUrl]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        setSettingsLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed.apiMode === 'local' || parsed.apiMode === 'runpod') setApiMode(parsed.apiMode);
      if (typeof parsed.localApiUrl === 'string') setLocalApiUrl(parsed.localApiUrl);
      if (typeof parsed.runpodUrl === 'string') setRunpodUrl(parsed.runpodUrl);
      if (typeof parsed.runpodApiKey === 'string') setRunpodApiKey(parsed.runpodApiKey);
    } catch (err) {
      console.error('Failed to load backend settings:', err);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ apiMode, localApiUrl, runpodUrl, runpodApiKey })
    );
  }, [settingsLoaded, apiMode, localApiUrl, runpodUrl, runpodApiKey]);

  const checkConnection = useCallback(async () => {
    const endpoint = activeEndpoint;
    if (!endpoint) {
      setConnectionStatus('error');
      setConnectionMessage('Endpoint is empty');
      return;
    }

    setConnectionStatus('checking');
    setConnectionMessage('Checking...');
    try {
      await fetch(endpoint, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
      setConnectionStatus('connected');
      setConnectionMessage('Reachable (network)');
    } catch (err) {
      setConnectionStatus('error');
      setConnectionMessage('Unreachable');
      console.error('Connection check failed:', err);
    }
  }, [activeEndpoint]);

  useEffect(() => {
    if (!settingsLoaded) return;
    void checkConnection();
  }, [settingsLoaded, checkConnection]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.glb'));
    const newFiles = droppedFiles.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      status: 'pending' as const,
      glbUrl: URL.createObjectURL(f)
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.glb'));
      const newFiles = selectedFiles.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        status: 'pending' as const,
        glbUrl: URL.createObjectURL(f)
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const convertFile = async (fileItem: FileItem) => {
    setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'converting' } : f));

    try {
      // 1. Convert file to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(fileItem.file);
      });
      const glbBase64 = await base64Promise;

      if (apiMode === 'local') {
        // --- LOCAL DOCKER MODE ---
        if (!localApiUrl.trim()) throw new Error('Local API URL is empty');
        const formData = new FormData();
        formData.append('file', fileItem.file);

        const response = await fetch(localApiUrl.trim(), {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Local conversion failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'done', resultUrl: url } : f));

      } else {
        // --- RUNPOD MODE ---
        if (!runpodUrl.trim()) throw new Error('RunPod URL is empty');
        if (!runpodApiKey.trim()) throw new Error('RunPod API Key is empty');

        const response = await fetch(runpodUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${runpodApiKey.trim()}`
          },
          body: JSON.stringify({
            input: {
              glb_base64: glbBase64,
              filename: fileItem.file.name
            }
          })
        });

        const raw = await response.text();
        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw };
        }

        if (!response.ok) {
          const detail = data?.error || data?.message || data?.raw || `HTTP ${response.status}`;
          throw new Error(`RunPod request failed (${response.status}): ${detail}`);
        }

        if (data.status === 'COMPLETED' && data.output?.fbx_base64) {
          const fbxBytes = atob(data.output.fbx_base64);
          const fbxArray = new Uint8Array(fbxBytes.length);
          for (let i = 0; i < fbxBytes.length; i++) fbxArray[i] = fbxBytes.charCodeAt(i);

          const blob = new Blob([fbxArray], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);

          setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'done', resultUrl: url } : f));
        } else {
          throw new Error(data.error || 'RunPod conversion failed');
        }
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to convert';
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: message } : f));
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const processQueue = async () => {
    setIsProcessing(true);
    // Process one by one
    for (const fileItem of files) {
      if (fileItem.status === 'pending') {
        await convertFile(fileItem);
      }
    }
    setIsProcessing(false);
  };

  return (
    <main className="container">
      <header>
        <h1>3D Pipe</h1>
        <p className="subtitle">GLB to FBX Serverless Converter</p>
        <div className="backend-toolbar">
          <div className={`connection-pill connection-${connectionStatus}`}>
            <span className="connection-dot" />
            <span>{connectionMessage}</span>
          </div>
          <button className="toolbar-btn" onClick={() => void checkConnection()}>Check</button>
          <button className="toolbar-btn" onClick={() => setSettingsOpen(v => !v)}>
            {settingsOpen ? 'Close Settings' : 'Backend Settings'}
          </button>
        </div>
        {settingsOpen && (
          <div className="settings-panel">
            <div className="settings-row">
              <label>Backend Type</label>
              <select value={apiMode} onChange={(e) => setApiMode(e.target.value as ApiMode)}>
                <option value="local">Remote Convert API (POST /convert)</option>
                <option value="runpod">RunPod Runsync API</option>
              </select>
            </div>

            {apiMode === 'local' ? (
              <div className="settings-row">
                <label>Remote API URL</label>
                <input
                  type="text"
                  value={localApiUrl}
                  onChange={(e) => setLocalApiUrl(e.target.value)}
                  placeholder="https://your-server/convert"
                />
              </div>
            ) : (
              <>
                <div className="settings-row">
                  <label>RunPod URL</label>
                  <input
                    type="text"
                    value={runpodUrl}
                    onChange={(e) => setRunpodUrl(e.target.value)}
                    placeholder="https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync"
                  />
                </div>
                <div className="settings-row">
                  <label>RunPod API Key</label>
                  <input
                    type="password"
                    value={runpodApiKey}
                    onChange={(e) => setRunpodApiKey(e.target.value)}
                    placeholder="rpa_..."
                  />
                </div>
              </>
            )}
            <p className="settings-note">Settings are auto-saved in this browser.</p>
          </div>
        )}
      </header>

      <div
        className="drop-zone"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove('dragging'); }}
        onDrop={(e) => { onDrop(e); e.currentTarget.classList.remove('dragging'); }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <span className="drop-zone-icon">📦</span>
        <div className="drop-zone-text">
          <h3>Drop GLB files here</h3>
          <p>or click to select from your folder</p>
        </div>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".glb"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map(file => (
            <div key={file.id} className="file-item-container">
              <div className="file-item">
                <div className="file-info" onClick={() => file.status === 'done' && setPreviewId(file.id === previewId ? null : file.id)}>
                  <span className="file-name">{file.file.name}</span>
                  {file.status === 'done' && <span className="preview-hint"> (Click to preview)</span>}
                </div>
                <div className="file-actions">
                  <span className={`file-status status-${file.status}`}>
                    {file.status}
                  </span>
                  {file.status === 'error' && file.error && (
                    <span className="file-error-message">{file.error}</span>
                  )}
                  {file.status === 'done' && (
                    <button
                      className="download-small-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerDownload(file.resultUrl!, file.file.name.replace('.glb', '.fbx'));
                      }}
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
              {previewId === file.id && (
                <div className="comparison-grid">
                  <div className="preview-item">
                    <h4 className="preview-title">Original GLB</h4>
                    <div className="preview-container">
                      {file.glbUrl && <GlbViewer url={file.glbUrl} />}
                    </div>
                  </div>
                  <div className="preview-item">
                    <h4 className="preview-title">Converted FBX</h4>
                    <div className="preview-container">
                      {file.resultUrl ? (
                        <FbxViewer url={file.resultUrl} />
                      ) : (
                        <div className="preview-placeholder">Wait for conversion...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            className="convert-btn"
            onClick={processQueue}
            disabled={isProcessing || !files.some(f => f.status === 'pending')}
          >
            {isProcessing ? 'Processing...' : 'Convert to FBX'}
          </button>
        </div>
      )}
    </main>
  );
}
