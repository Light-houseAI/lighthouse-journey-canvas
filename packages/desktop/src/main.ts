import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { config } from 'dotenv';
import { profileLoaderService } from './main/services/profile-loader';
import { llmService } from './main/services/llm-service';
import { documentLoaderService, SampleDocument } from './main/services/document-loader';
import { screenshotProcessingService } from './main/services/screenshot-processing-service';
import { ollamaModelManager } from './main/services/ollama-model-manager';
import type { OllamaStatus, ModelAvailability, ModelInfo } from './main/services/ollama-model-manager';
import {
  LLMRequest,
  IPCResponse,
  UserProfile,
  LLMResponse,
  ScreenshotProcessingRequest,
  ScreenshotProcessingResponse
} from './shared/types';

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

  // Get LLM adapter info
  ipcMain.handle('llm-get-adapter-info', async (): Promise<IPCResponse<{ type: string, model?: string }>> => {
    try {
      const adapterType = llmService.getAdapterType();
      const adapter = llmService.getAdapter();
      let model = undefined;

      if (adapterType === 'ollama' && 'config' in adapter) {
        model = (adapter as any).config.textModel;
      }

      return { success: true, data: { type: adapterType, model }, error: null };
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

  // Process screenshot with vision model (Ollama only)
  ipcMain.handle('process-screenshot', async (_, request: ScreenshotProcessingRequest): Promise<IPCResponse<ScreenshotProcessingResponse>> => {
    try {
      console.log('[IPC] Processing screenshot...');
      const result = await screenshotProcessingService.processScreenshot(request);
      console.log(`[IPC] Screenshot processed successfully (${result.suggestions.length} suggestions)`);
      return { success: true, data: result, error: null };
    } catch (error: any) {
      console.error('[IPC] Screenshot processing error:', error);
      return { success: false, data: null, error: error.message };
    }
  });

  // Check screenshot processing availability (Ollama + vision model)
  ipcMain.handle('check-screenshot-availability', async (): Promise<IPCResponse<{
    available: boolean
    adapterType: string
    visionModelAvailable: boolean
    error?: string
  }>> => {
    try {
      const availability = await screenshotProcessingService.checkAvailability();
      return { success: true, data: availability, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Get Ollama setup instructions
  ipcMain.handle('get-ollama-setup-instructions', async (): Promise<IPCResponse<string[]>> => {
    try {
      const instructions = screenshotProcessingService.getSetupInstructions();
      return { success: true, data: instructions, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // LLM health check (especially for Ollama)
  ipcMain.handle('llm-health-check', async (): Promise<IPCResponse<{
    running: boolean
    textModelAvailable?: boolean
    visionModelAvailable?: boolean
    error?: string
  }>> => {
    try {
      const health = await llmService.healthCheck();
      return { success: true, data: health, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // ============================================
  // OLLAMA MODEL MANAGEMENT
  // ============================================

  // Check Ollama installation and running status
  ipcMain.handle('ollama-check-status', async (): Promise<IPCResponse<OllamaStatus>> => {
    try {
      const status = await ollamaModelManager.checkOllamaStatus();
      return { success: true, data: status, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // List all downloaded models
  ipcMain.handle('ollama-list-models', async (): Promise<IPCResponse<ModelInfo[]>> => {
    try {
      const models = await ollamaModelManager.listModels();
      return { success: true, data: models, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Check if required models are available
  ipcMain.handle('ollama-check-models', async (_, textModel: string, visionModel: string): Promise<IPCResponse<ModelAvailability>> => {
    try {
      const availability = await ollamaModelManager.checkModelsAvailability(textModel, visionModel);
      return { success: true, data: availability, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Pull/download a model with progress updates
  ipcMain.handle('ollama-pull-model', async (event, modelName: string): Promise<IPCResponse<void>> => {
    try {
      console.log(`[IPC] Starting model pull: ${modelName}`);

      await ollamaModelManager.pullModel(modelName, (progress) => {
        // Send progress updates to renderer
        event.sender.send('ollama-model-progress', {
          model: modelName,
          ...progress
        });
      });

      return { success: true, data: null, error: null };
    } catch (error: any) {
      console.error('[IPC] Model pull failed:', error);
      return { success: false, data: null, error: error.message };
    }
  });

  // Pull multiple models sequentially
  ipcMain.handle('ollama-pull-models', async (event, models: string[]): Promise<IPCResponse<{ success: string[]; failed: string[] }>> => {
    try {
      console.log(`[IPC] Starting batch model pull: ${models.join(', ')}`);

      const result = await ollamaModelManager.pullModels(models, (model, progress) => {
        // Send progress updates to renderer
        event.sender.send('ollama-model-progress', {
          model,
          ...progress
        });
      });

      return { success: true, data: result, error: null };
    } catch (error: any) {
      console.error('[IPC] Batch model pull failed:', error);
      return { success: false, data: null, error: error.message };
    }
  });

  // Delete a model
  ipcMain.handle('ollama-delete-model', async (_, modelName: string): Promise<IPCResponse<void>> => {
    try {
      await ollamaModelManager.deleteModel(modelName);
      return { success: true, data: null, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Get installation instructions
  ipcMain.handle('ollama-get-install-instructions', async (): Promise<IPCResponse<string[]>> => {
    try {
      const instructions = ollamaModelManager.getInstallInstructions();
      return { success: true, data: instructions, error: null };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  });

  // Get recommended models
  ipcMain.handle('ollama-get-recommended-models', async (): Promise<IPCResponse<{
    text: { name: string; size: string; description: string }[]
    vision: { name: string; size: string; description: string }[]
  }>> => {
    try {
      const models = ollamaModelManager.getRecommendedModels();
      return { success: true, data: models, error: null };
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
