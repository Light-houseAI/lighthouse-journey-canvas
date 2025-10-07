import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { config } from 'dotenv';
import { profileLoaderService } from './main/services/profile-loader';
import { llmService } from './main/services/llm-service';
import { documentLoaderService, SampleDocument } from './main/services/document-loader';
import { LLMRequest, IPCResponse, UserProfile, LLMResponse } from './shared/types';

// Load environment variables from .env file
config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// Setup IPC handlers
function setupIpcHandlers() {
  // Load profiles
  ipcMain.handle('load-profiles', async (): Promise<IPCResponse<UserProfile[]>> => {
    try {
      console.log('[IPC] Loading profiles...');
      const profiles = await profileLoaderService.loadAll();
      console.log(`[IPC] Loaded ${profiles.length} profiles`);
      return { success: true, data: profiles, error: null };
    } catch (error: any) {
      console.error('[IPC] Error loading profiles:', error);
      return { success: false, data: null, error: error.message };
    }
  });

  // Get profile by ID
  ipcMain.handle('get-profile', async (_, profileId: string): Promise<IPCResponse<UserProfile>> => {
    try {
      const profile = await profileLoaderService.getById(profileId);
      if (!profile) {
        return { success: false, data: null, error: 'Profile not found' };
      }
      return { success: true, data: profile, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Get LLM suggestion
  ipcMain.handle('llm-suggest', async (_, request: LLMRequest): Promise<IPCResponse<LLMResponse>> => {
    try {
      const response = await llmService.getSuggestion(request);
      return { success: true, data: response, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Get sample documents list
  ipcMain.handle('get-sample-documents', async (): Promise<IPCResponse<SampleDocument[]>> => {
    try {
      const documents = documentLoaderService.getSampleDocuments();
      return { success: true, data: documents, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Load sample document content
  ipcMain.handle('load-sample-document', async (_, documentId: string): Promise<IPCResponse<string>> => {
    try {
      const content = await documentLoaderService.loadDocument(documentId);
      if (!content) {
        return { success: false, data: null, error: 'Document not found' };
      }
      return { success: true, data: content, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  setupIpcHandlers();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
