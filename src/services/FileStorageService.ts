const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface FileUploadData {
  title: string;
  description: string;
  subject: string;
  unit?: string;
  type: 'notes' | 'practice-tests' | 'practicals';
  file: File;
}

export interface StoredFile {
  id: string;
  title: string;
  description: string;
  fileName: string;
  storedFileName: string;
  fileSize: string;
  uploadDate: string;
  subject: string;
  unit?: string;
  type: 'notes' | 'practice-tests' | 'practicals';
  filePath: string;
  fileType: 'pdf' | 'image';
}

class FileStorageService {
  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          // If not JSON, use the text as error message
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      return response;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to the server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async createSubject(name: string, units: string[]): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${API_BASE_URL}/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, units }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error creating subject:', error);
      return false;
    }
  }

  async addUnit(subjectName: string, unitName: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${API_BASE_URL}/subjects/${encodeURIComponent(subjectName)}/units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unitName }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error adding unit:', error);
      return false;
    }
  }

  async uploadFile(data: FileUploadData): Promise<StoredFile | null> {
    try {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(data.file.type)) {
        throw new Error('Only PDF and image files are allowed');
      }

      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('title', data.title.trim());
      formData.append('description', data.description.trim());
      formData.append('subject', data.subject.trim());
      formData.append('type', data.type);
      
      // Always append unit, even if empty string
      formData.append('unit', data.unit?.trim() || '');

      console.log('Uploading file:', {
        fileName: data.file.name,
        fileSize: data.file.size,
        fileType: data.file.type,
        subject: data.subject,
        type: data.type,
        unit: data.unit
      });

      const response = await this.makeRequest(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('File uploaded successfully:', result.file);
        return result.file;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error('Unable to connect to the server. Please check if the server is running.');
        } else if (error.message.includes('NetworkError')) {
          throw new Error('Network error. Please check your internet connection.');
        } else if (error.message.includes('timeout')) {
          throw new Error('Upload timeout. Please try again.');
        }
        throw error;
      }
      
      throw new Error('An unexpected error occurred during upload');
    }
  }

  async deleteFile(subject: string, type: string, filename: string, unit?: string): Promise<boolean> {
    try {
      let url = `${API_BASE_URL}/files/${encodeURIComponent(subject)}/${encodeURIComponent(type)}`;
      if (unit) {
        url += `/${encodeURIComponent(unit)}`;
      }
      url += `/${encodeURIComponent(filename)}`;

      console.log('Deleting file from URL:', url);
      
      const response = await this.makeRequest(url, {
        method: 'DELETE',
      });

      const result = await response.json();
      console.log('Delete response:', result);
      return result.success;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async listFiles(subject: string, type: string, unit?: string): Promise<any[]> {
    try {
      let url = `${API_BASE_URL}/files/${encodeURIComponent(subject)}/${encodeURIComponent(type)}`;
      if (unit) {
        url += `/${encodeURIComponent(unit)}`;
      }

      const response = await this.makeRequest(url);
      const result = await response.json();
      
      return result.success ? result.files : [];
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  getFileUrl(subject: string, type: string, filename: string, unit?: string): string {
    let url = `${API_BASE_URL}/files/${encodeURIComponent(subject)}/${type}`;
    if (unit) {
      url += `/${encodeURIComponent(unit)}`;
    }
    url += `/${encodeURIComponent(filename)}`;
    return url;
  }

  async checkServerHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Server health check failed:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: `${API_BASE_URL}/health`,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      return false;
    }
  }
}

export const fileStorageService = new FileStorageService();
