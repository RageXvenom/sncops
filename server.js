import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - body parsers BEFORE multer, but multer handles multipart
app.use(cors());
app.use(express.urlencoded({ limit: '50gb', extended: true }));
app.use(express.json({ limit: '50gb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50gb' }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(0); // No timeout
  res.setTimeout(0);
  next();
});

// Storage directory
const STORAGE_DIR = path.join(__dirname, 'storage');
const METADATA_FILE = path.join(__dirname, 'file-metadata.json');

// Ensure storage directory exists
try {
  fs.ensureDirSync(STORAGE_DIR);
} catch (error) {
  console.error('Failed to create storage directory:', error);
  process.exit(1);
}

// Load existing metadata from file
let fileMetadata = new Map();
try {
  if (fs.existsSync(METADATA_FILE)) {
    const metadataJson = fs.readFileSync(METADATA_FILE, 'utf8');
    const metadataObj = JSON.parse(metadataJson);
    fileMetadata = new Map(Object.entries(metadataObj));
    console.log(`Loaded ${fileMetadata.size} file metadata entries`);
  }
} catch (error) {
  console.error('Error loading metadata file:', error);
  fileMetadata = new Map();
}

// Function to save metadata to file
const saveMetadata = () => {
  try {
    const metadataObj = Object.fromEntries(fileMetadata);
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadataObj, null, 2));
  } catch (error) {
    console.error('Error saving metadata file:', error);
  }
};

// Configure multer for file uploads - FIXED: Make destination async and use req.headers for early subject access
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Early access to subject from headers (set by frontend as X-Subject header)
      let subject = req.headers['x-subject'] || '';
      subject = String(subject).trim();

      let type = req.headers['x-type'] || '';
      type = String(type).trim();

      let unit = req.headers['x-unit'] || '';
      unit = String(unit).trim();

      console.log('Early destination params:', { subject, type, unit });

      // If headers are missing, we'll use a temp directory and move later
      if (!subject || !type) {
        const tempPath = path.join(STORAGE_DIR, 'temp');
        fs.ensureDirSync(tempPath);
        console.log('Using temp directory, will move file after parsing body');
        return cb(null, tempPath);
      }

      if (!type) {
        return cb(new Error('Type is required'));
      }

      let uploadPath;

      if (type === 'notes' && unit) {
        uploadPath = path.join(STORAGE_DIR, subject, 'notes', unit);
      } else if (type === 'practice-tests') {
        uploadPath = path.join(STORAGE_DIR, subject, 'practice-tests');
      } else if (type === 'practicals') {
        uploadPath = path.join(STORAGE_DIR, subject, 'practicals');
      } else {
        return cb(new Error(`Invalid type: ${type}${type === 'notes' && !unit ? ' (unit required for notes)' : ''}`));
      }

      // Ensure directory exists
      fs.ensureDirSync(uploadPath);
      console.log(`Created/verified directory: ${uploadPath}`);
      cb(null, uploadPath);
    } catch (error) {
      console.error('Error in multer destination:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const sanitizedName = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
      const filename = `${sanitizedName}_${timestamp}${ext}`;
      console.log(`Generated filename: ${filename}`);
      cb(null, filename);
    } catch (error) {
      console.error('Error in multer filename:', error);
      cb(error);
    }
  }
});

const upload = multer({ 
  storage,
  // Completely removed limits - no fileSize or fieldSize restrictions
  fileFilter: (req, file, cb) => {
    try {
      // Accept PDF and image files
      const allowedTypes = /pdf|jpeg|jpg|png|gif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        console.log(`File accepted: ${file.originalname} (${file.mimetype})`);
        return cb(null, true);
      } else {
        console.log(`File rejected: ${file.originalname} (${file.mimetype})`);
        cb(new Error('Only PDF and image files are allowed!'));
      }
    } catch (error) {
      console.error('Error in multer fileFilter:', error);
      cb(error);
    }
  }
});

// Utility function to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Create subject directory structure
const createSubjectStructure = (subjectName, units = []) => {
  const subjectPath = path.join(STORAGE_DIR, subjectName);
  
  // Create main subject directory
  fs.ensureDirSync(subjectPath);
  
  // Create notes directory with units
  const notesPath = path.join(subjectPath, 'notes');
  fs.ensureDirSync(notesPath);
  
  // Create unit directories
  units.forEach(unit => {
    const unitPath = path.join(notesPath, unit);
    fs.ensureDirSync(unitPath);
  });
  
  // Create practice-tests directory
  fs.ensureDirSync(path.join(subjectPath, 'practice-tests'));
  
  // Create practicals directory
  fs.ensureDirSync(path.join(subjectPath, 'practicals'));
  
  return subjectPath;
};

// API Routes

// Create subject with directory structure
app.post('/api/subjects', (req, res) => {
  try {
    const { name, units } = req.body;
    const subjectPath = createSubjectStructure(name, units);
    
    res.json({
      success: true,
      message: 'Subject directory structure created successfully',
      path: subjectPath
    });
  } catch (error) {
    console.error('Error creating subject structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subject structure',
      error: error.message
    });
  }
});

// Add unit to existing subject
app.post('/api/subjects/:subjectName/units', (req, res) => {
  try {
    const { subjectName } = req.params;
    const { unitName } = req.body;
    
    const unitPath = path.join(STORAGE_DIR, subjectName, 'notes', unitName);
    fs.ensureDirSync(unitPath);
    
    res.json({
      success: true,
      message: 'Unit directory created successfully',
      path: unitPath
    });
  } catch (error) {
    console.error('Error creating unit directory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create unit directory',
      error: error.message
    });
  }
});


// Upload file
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    console.log('Upload request received:', {
      body: req.body,
      headers: {
        'x-subject': req.headers['x-subject'],
        'x-type': req.headers['x-type'],
        'x-unit': req.headers['x-unit']
      },
      file: req.file ? {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      } : null
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate required fields - req.body is now fully populated
    const { title, subject, type, unit, description } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }
    
    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required'
      });
    }
    
    if (!type || !type.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Type is required'
      });
    }

    // For notes, unit is required
    if (type === 'notes' && (!unit || !unit.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Unit is required for notes'
      });
    }

    // If file was saved to temp directory, move it to correct location
    if (req.file.path.includes('temp')) {
      let correctPath;
      if (type === 'notes' && unit) {
        correctPath = path.join(STORAGE_DIR, subject.trim(), 'notes', unit.trim());
      } else if (type === 'practice-tests') {
        correctPath = path.join(STORAGE_DIR, subject.trim(), 'practice-tests');
      } else if (type === 'practicals') {
        correctPath = path.join(STORAGE_DIR, subject.trim(), 'practicals');
      }
      
      if (correctPath) {
        fs.ensureDirSync(correctPath);
        const newPath = path.join(correctPath, req.file.filename);
        fs.moveSync(req.file.path, newPath);
        req.file.path = newPath;
        console.log(`Moved file from temp to: ${newPath}`);
      }
    }
    
    const fileInfo = {
      id: Date.now().toString(),
      title: title.trim(),
      description: (description || '').trim(),
      fileName: req.file.originalname,
      storedFileName: req.file.filename,
      fileSize: formatFileSize(req.file.size),
      uploadDate: new Date().toLocaleDateString(),
      subject: subject.trim(),
      unit: (unit || '').trim(),
      type: type.trim(),
      filePath: req.file.path,
      fileType: path.extname(req.file.originalname).toLowerCase().includes('pdf') ? 'pdf' : 'image'
    };
    
    // Store metadata for this file
    const metadataKey = `${subject.trim()}-${type.trim()}-${(unit || '').trim()}-${req.file.filename}`;
    fileMetadata.set(metadataKey, {
      title: title.trim(),
      description: (description || '').trim(),
      originalFileName: req.file.originalname
    });
    
    // Save metadata to persistent storage
    saveMetadata();
    
    console.log('File uploaded successfully:', fileInfo);
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    
    // Send detailed error information
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get file
app.get('/api/files/:subject/:type/:unit?/:filename', (req, res) => {
  try {
    const { subject, type, unit, filename } = req.params;
    
    let filePath;
    if (type === 'notes' && unit) {
      filePath = path.join(STORAGE_DIR, subject, 'notes', unit, filename);
    } else if (type === 'practice-tests') {
      filePath = path.join(STORAGE_DIR, subject, 'practice-tests', filename);
    } else if (type === 'practicals') {
      filePath = path.join(STORAGE_DIR, subject, 'practicals', filename);
    } else {
      filePath = path.join(STORAGE_DIR, subject, type, filename);
    }
    
    console.log('Attempting to serve file:', {
      subject,
      type,
      unit,
      filename,
      filePath,
      exists: fs.existsSync(filePath)
    });
    
    if (!fs.existsSync(filePath)) {
      // Try alternative path structures
      const alternativePaths = [];
      
      if (type === 'notes' && unit) {
        // Try with different unit formats
        alternativePaths.push(
          path.join(STORAGE_DIR, subject, 'notes', unit.replace(/\s+/g, '_'), filename),
          path.join(STORAGE_DIR, subject, 'notes', unit.replace(/\s+/g, '-'), filename),
          path.join(STORAGE_DIR, subject, 'notes', unit.toLowerCase(), filename)
        );
      } else if (type === 'practice-tests') {
        // Try alternative paths for practice tests
        alternativePaths.push(
          path.join(STORAGE_DIR, subject.replace(/\s+/g, '_'), 'practice-tests', filename),
          path.join(STORAGE_DIR, subject.replace(/\s+/g, '-'), 'practice-tests', filename),
          path.join(STORAGE_DIR, subject.toLowerCase(), 'practice-tests', filename)
        );
      } else if (type === 'practicals') {
        // Try alternative paths for practicals
        alternativePaths.push(
          path.join(STORAGE_DIR, subject.replace(/\s+/g, '_'), 'practicals', filename),
          path.join(STORAGE_DIR, subject.replace(/\s+/g, '-'), 'practicals', filename),
          path.join(STORAGE_DIR, subject.toLowerCase(), 'practicals', filename)
        );
      }
      
      // Try with different subject formats
      if (type !== 'practice-tests' && type !== 'practicals') {
        alternativePaths.push(
          path.join(STORAGE_DIR, subject.replace(/\s+/g, '_'), type, filename),
          path.join(STORAGE_DIR, subject.replace(/\s+/g, '-'), type, filename)
        );
      }
      
      let foundPath = null;
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          foundPath = altPath;
          filePath = altPath;
          break;
        }
      }
      
      if (!foundPath) {
        console.error('File not found at path:', filePath);
        console.error('Also tried alternative paths:', alternativePaths);
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
    }
    
    // Set proper headers for file serving
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      const imageType = ext === '.jpg' ? 'jpeg' : ext.substring(1);
      res.setHeader('Content-Type', `image/${imageType}`);
    }
    
    // Set headers for proper file serving and download
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve file',
      error: error.message
    });
  }
});

// Delete file
app.delete('/api/files/:subject/:type/:unit?/:filename', (req, res) => {
  try {
    const { subject, type, unit, filename } = req.params;
    
    let filePath;
    if (type === 'notes' && unit) {
      filePath = path.join(STORAGE_DIR, subject, 'notes', unit, filename);
    } else {
      filePath = path.join(STORAGE_DIR, subject, type, filename);
    }
    
    console.log('Attempting to delete file:', {
      subject,
      type,
      unit,
      filename,
      filePath,
      exists: fs.existsSync(filePath)
    });
    
    if (fs.existsSync(filePath)) {
      try {
        fs.removeSync(filePath);
        
        // Remove metadata for this file
        const metadataKey = `${subject}-${type}-${unit || ''}-${filename}`;
        fileMetadata.delete(metadataKey);
        saveMetadata();
        
        console.log('File deleted successfully:', filePath);
        res.json({
          success: true,
          message: 'File deleted successfully'
        });
      } catch (deleteError) {
        console.error('Error deleting file:', deleteError);
        res.status(500).json({
          success: false,
          message: 'Failed to delete file',
          error: deleteError.message
        });
      }
    } else {
      // Try alternative paths before giving up
      const alternativePaths = [];
      
      if (type === 'notes' && unit) {
        alternativePaths.push(
          path.join(STORAGE_DIR, subject, 'notes', unit.replace(/\s+/g, '_'), filename),
          path.join(STORAGE_DIR, subject, 'notes', unit.replace(/\s+/g, '-'), filename),
          path.join(STORAGE_DIR, subject, 'notes', unit.toLowerCase(), filename)
        );
      }
      
      alternativePaths.push(
        path.join(STORAGE_DIR, subject.replace(/\s+/g, '_'), type, filename),
        path.join(STORAGE_DIR, subject.replace(/\s+/g, '-'), type, filename)
      );
      
      let deletedPath = null;
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          try {
            fs.removeSync(altPath);
            deletedPath = altPath;
            
            // Remove metadata for this file
            const metadataKey = `${subject}-${type}-${unit || ''}-${filename}`;
            fileMetadata.delete(metadataKey);
            saveMetadata();
            
            console.log('File deleted from alternative path:', altPath);
            break;
          } catch (deleteError) {
            console.error('Error deleting file from alternative path:', altPath, deleteError);
          }
        }
      }
      
      if (deletedPath) {
        res.json({
          success: true,
          message: 'File deleted successfully'
        });
      } else {
        console.error('File not found for deletion:', filePath);
        console.error('Also tried alternative paths:', alternativePaths);
        res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

// List files in directory
app.get('/api/files/:subject/:type/:unit?', (req, res) => {
  try {
    const { subject, type, unit } = req.params;
    
    let dirPath;
    if (type === 'notes' && unit) {
      dirPath = path.join(STORAGE_DIR, subject, 'notes', unit);
    } else {
      dirPath = path.join(STORAGE_DIR, subject, type);
    }
    
    if (!fs.existsSync(dirPath)) {
      return res.json({
        success: true,
        files: []
      });
    }
    
    const files = fs.readdirSync(dirPath).map(filename => {
      const filePath = path.join(dirPath, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        size: formatFileSize(stats.size),
        modified: stats.mtime.toLocaleDateString(),
        type: path.extname(filename).toLowerCase().includes('pdf') ? 'pdf' : 'image'
      };
    });
    
    res.json({
      success: true,
      files
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list files',
      error: error.message
    });
  }
});

// Verify file existence on server
app.post('/api/verify-files', (req, res) => {
  try {
    const { files } = req.body;
    
    if (!Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        message: 'Files array is required'
      });
    }
    
    const verifiedFiles = [];
    
    files.forEach(file => {
      try {
        let filePath;
        
        if (file.type === 'notes' && file.unit) {
          filePath = path.join(STORAGE_DIR, file.subject, 'notes', file.unit, file.storedFileName);
        } else if (file.type === 'practice-tests') {
          filePath = path.join(STORAGE_DIR, file.subject, 'practice-tests', file.storedFileName);
        } else if (file.type === 'practicals') {
          filePath = path.join(STORAGE_DIR, file.subject, 'practicals', file.storedFileName);
        }
        
        if (filePath && fs.existsSync(filePath)) {
          verifiedFiles.push({
            id: file.id,
            exists: true,
            filePath: filePath
          });
        } else {
          console.log(`File not found on server: ${filePath}`);
          verifiedFiles.push({
            id: file.id,
            exists: false,
            filePath: filePath || 'unknown'
          });
        }
      } catch (error) {
        console.error(`Error verifying file ${file.id}:`, error);
        verifiedFiles.push({
          id: file.id,
          exists: false,
          error: error.message
        });
      }
    });
    
    res.json({
      success: true,
      verifiedFiles
    });
  } catch (error) {
    console.error('Error verifying files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify files',
      error: error.message
    });
  }
});

// Get all files from server storage (for sync purposes)
app.get('/api/storage-sync/:subject?', (req, res) => {
  try {
    const { subject } = req.params;
    const storageStructure = {};
    
    if (subject) {
      // Get files for specific subject
      const subjectPath = path.join(STORAGE_DIR, subject);
      if (fs.existsSync(subjectPath)) {
        storageStructure[subject] = getSubjectFiles(subjectPath, subject);
      }
    } else {
      // Get all subjects and their files
      if (fs.existsSync(STORAGE_DIR)) {
        const subjects = fs.readdirSync(STORAGE_DIR).filter(item => {
          const itemPath = path.join(STORAGE_DIR, item);
          return fs.statSync(itemPath).isDirectory();
        });
        
        subjects.forEach(subjectName => {
          const subjectPath = path.join(STORAGE_DIR, subjectName);
          storageStructure[subjectName] = getSubjectFiles(subjectPath, subjectName);
        });
      }
    }
    
    res.json({
      success: true,
      storageStructure
    });
  } catch (error) {
    console.error('Error getting storage structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get storage structure',
      error: error.message
    });
  }
});

// Helper function to get all files for a subject
function getSubjectFiles(subjectPath, subjectName) {
  const subjectData = {
    notes: {},
    'practice-tests': [],
    practicals: []
  };
  
  try {
    // Get notes
    const notesPath = path.join(subjectPath, 'notes');
    if (fs.existsSync(notesPath)) {
      const units = fs.readdirSync(notesPath).filter(item => {
        const itemPath = path.join(notesPath, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      units.forEach(unit => {
        const unitPath = path.join(notesPath, unit);
        const files = fs.readdirSync(unitPath).filter(file => {
          const filePath = path.join(unitPath, file);
          return fs.statSync(filePath).isFile();
        });
        
        subjectData.notes[unit] = files.map(filename => {
          const filePath = path.join(unitPath, filename);
          const stats = fs.statSync(filePath);
          
          // Get stored metadata for this file
          const metadataKey = `${subjectName}-notes-${unit}-${filename}`;
          const metadata = fileMetadata.get(metadataKey);
          
          // Better fallback title generation
          let baseTitle = filename.replace(/\.[^/.]+$/, ""); // Remove extension
          baseTitle = baseTitle.replace(/_\d{13}$/, ""); // Remove timestamp
          baseTitle = baseTitle.replace(/_/g, " "); // Replace underscores with spaces
          baseTitle = baseTitle.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
          
          const finalTitle = metadata?.title || baseTitle;
          const description = metadata?.description || '';
          
          return {
            filename,
            title: finalTitle,
            description: description,
            size: formatFileSize(stats.size),
            modified: stats.mtime.toLocaleDateString(),
            type: path.extname(filename).toLowerCase().includes('pdf') ? 'pdf' : 'image',
            subject: subjectName,
            unit: unit
          };
        });
      });
    }
    
    // Get practice tests
    const practiceTestsPath = path.join(subjectPath, 'practice-tests');
    if (fs.existsSync(practiceTestsPath)) {
      const files = fs.readdirSync(practiceTestsPath).filter(file => {
        const filePath = path.join(practiceTestsPath, file);
        return fs.statSync(filePath).isFile();
      });
      
      subjectData['practice-tests'] = files.map(filename => {
        const filePath = path.join(practiceTestsPath, filename);
        const stats = fs.statSync(filePath);
        
        // Get stored metadata for this file
        const metadataKey = `${subjectName}-practice-tests--${filename}`;
        const metadata = fileMetadata.get(metadataKey);
        
        // Better fallback title generation
        let baseTitle = filename.replace(/\.[^/.]+$/, ""); // Remove extension
        baseTitle = baseTitle.replace(/_\d{13}$/, ""); // Remove timestamp
        baseTitle = baseTitle.replace(/_/g, " "); // Replace underscores with spaces
        baseTitle = baseTitle.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
        
        const finalTitle = metadata?.title || baseTitle;
        const description = metadata?.description || '';
        
        return {
          filename,
          title: finalTitle,
          description: description,
          size: formatFileSize(stats.size),
          modified: stats.mtime.toLocaleDateString(),
          type: path.extname(filename).toLowerCase().includes('pdf') ? 'pdf' : 'image',
          subject: subjectName
        };
      });
    }
    
    // Get practicals
    const practicalsPath = path.join(subjectPath, 'practicals');
    if (fs.existsSync(practicalsPath)) {
      const files = fs.readdirSync(practicalsPath).filter(file => {
        const filePath = path.join(practicalsPath, file);
        return fs.statSync(filePath).isFile();
      });
      
      subjectData.practicals = files.map(filename => {
        const filePath = path.join(practicalsPath, filename);
        const stats = fs.statSync(filePath);
        
        // Get stored metadata for this file
        const metadataKey = `${subjectName}-practicals--${filename}`;
        const metadata = fileMetadata.get(metadataKey);
        
        // Better fallback title generation
        let baseTitle = filename.replace(/\.[^/.]+$/, ""); // Remove extension
        baseTitle = baseTitle.replace(/_\d{13}$/, ""); // Remove timestamp
        baseTitle = baseTitle.replace(/_/g, " "); // Replace underscores with spaces
        baseTitle = baseTitle.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
        
        const finalTitle = metadata?.title || baseTitle;
        const description = metadata?.description || '';
        
        return {
          filename,
          title: finalTitle,
          description: description,
          size: formatFileSize(stats.size),
          modified: stats.mtime.toLocaleDateString(),
          type: path.extname(filename).toLowerCase().includes('pdf') ? 'pdf' : 'image',
          subject: subjectName
        };
      });
    }
  } catch (error) {
    console.error(`Error reading subject files for ${subjectName}:`, error);
  }
  
  return subjectData;
}
// Serve static files from storage
app.use('/storage', express.static(STORAGE_DIR));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    storage: STORAGE_DIR,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Handle multer errors
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: error.message,
      code: error.code
    });
  }
  
  // Handle other errors
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 File storage server running on port ${PORT}`);
  console.log(`📁 Storage directory: ${STORAGE_DIR}`);
  console.log(`🌐 Server accessible at http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please use a different port or stop the existing process.`);
  } else {
    console.error('❌ Server error:', error);
  }
});

// Add error handling for uncaught exceptions (but don't exit immediately)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately, let the server continue running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, let the server continue running
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});



