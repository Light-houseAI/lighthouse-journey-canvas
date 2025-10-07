import * as fs from 'fs'
import * as path from 'path'

export interface SampleDocument {
  id: string
  name: string
  description: string
  filePath: string
  intent: 'resume_writing' | 'requirements_documentation'
}

export class DocumentLoaderService {
  private documentsDir: string

  constructor() {
    // In development, data is at package root
    // __dirname in compiled code points to .vite/build
    // Go up to package root: .vite/build -> .vite -> packages/desktop
    this.documentsDir = path.join(__dirname, '../../../data/sample-documents')
  }

  getSampleDocuments(): SampleDocument[] {
    return [
      {
        id: 'lisa-resume',
        name: 'Lisa Chen - Resume (Needs Improvement)',
        description: 'Base resume with weak action verbs and missing metrics',
        filePath: 'lisa-chen-base-resume.md',
        intent: 'resume_writing'
      },
      {
        id: 'jordan-resume',
        name: 'Jordan Williams - Resume (New Graduate)',
        description: 'Entry-level resume with informal language',
        filePath: 'jordan-williams-base-resume.md',
        intent: 'resume_writing'
      },
      {
        id: 'requirements-doc',
        name: 'Real-Time Collaboration - Requirements',
        description: 'Product requirements with vague, non-testable criteria',
        filePath: 'sample-requirements-doc.md',
        intent: 'requirements_documentation'
      }
    ]
  }

  async loadDocument(documentId: string): Promise<string | null> {
    try {
      const documents = this.getSampleDocuments()
      const doc = documents.find(d => d.id === documentId)

      if (!doc) {
        console.error('[DocumentLoader] Document not found:', documentId)
        return null
      }

      const filePath = path.join(this.documentsDir, doc.filePath)

      if (!fs.existsSync(filePath)) {
        console.error('[DocumentLoader] File does not exist:', filePath)
        return null
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      console.log('[DocumentLoader] Loaded document:', documentId, `(${content.length} chars)`)
      return content
    } catch (error) {
      console.error('[DocumentLoader] Failed to load document:', error)
      return null
    }
  }
}

export const documentLoaderService = new DocumentLoaderService()
