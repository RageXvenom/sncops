import React, { createContext, useContext, useState, useEffect } from 'react';
import { fileStorageService, StoredFile } from '../services/fileStorage';

export interface Note {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  subject: string;
  unit: string;
  type: 'pdf' | 'image';
  fileData?: string;
  filePath?: string;
  storedFileName?: string;
}

export interface PracticeTest {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  subject: string;
  type: 'pdf' | 'image';
  fileData?: string;
  filePath?: string;
  storedFileName?: string;
}

export interface Practical {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  subject: string;
  type: 'pdf' | 'image';
  fileData?: string;
  filePath?: string;
  storedFileName?: string;
}

export interface Subject {
  id: string;
  name: string;
  units: string[];
}

interface DataContextType {
  subjects: Subject[];
  notes: Note[];
  practiceTests: PracticeTest[];
  practicals: Practical[];
  isLoggedIn: boolean;
  addSubject: (subject: Subject) => void;
  updateSubject: (id: string, subject: Subject) => void;
  deleteSubject: (id: string) => void;
  addNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  addPracticeTest: (test: PracticeTest) => void;
  deletePracticeTest: (id: string) => void;
  addPractical: (practical: Practical) => void;
  deletePractical: (id: string) => void;
  updateNotes: (notes: Note[]) => void;
  updatePracticeTests: (tests: PracticeTest[]) => void;
  updatePracticals: (practicals: Practical[]) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  syncWithServer: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'arvindnag231219@gmail.com';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'ArvindNag@2312199455*';

const defaultSubjects: Subject[] = [
  {
    id: '1',
    name: 'Pharmaceutics',
    units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  },
  {
    id: '2',
    name: 'Pharmaceutical Chemistry',
    units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  },
  {
    id: '3',
    name: 'Pharmacognosy',
    units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  },
  {
    id: '4',
    name: 'Human Anatomy & Physiology',
    units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  },
  {
    id: '5',
    name: 'Pharmaceutical Analysis',
    units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  }
];

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('sncop_subjects');
    return saved ? JSON.parse(saved) : defaultSubjects;
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('sncop_notes');
    return saved ? JSON.parse(saved) : [];
  });

  const [practiceTests, setPracticeTests] = useState<PracticeTest[]>(() => {
    const saved = localStorage.getItem('sncop_practice_tests');
    return saved ? JSON.parse(saved) : [];
  });

  const [practicals, setPracticals] = useState<Practical[]>(() => {
    const saved = localStorage.getItem('sncop_practicals');
    return saved ? JSON.parse(saved) : [];
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('sncop_admin_logged_in') === 'true';
  });

  // Sync with server on component mount and periodically
  useEffect(() => {
    const performSync = async () => {
      await syncWithServer();
    };

    // Initial sync
    performSync();

    // Periodic sync every 30 seconds
    const interval = setInterval(performSync, 30000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    localStorage.setItem('sncop_subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('sncop_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('sncop_practice_tests', JSON.stringify(practiceTests));
  }, [practiceTests]);

  useEffect(() => {
    localStorage.setItem('sncop_practicals', JSON.stringify(practicals));
  }, [practicals]);

  const syncWithServer = async () => {
    try {
      // First, get all files from server storage
      const serverStorage = await fileStorageService.syncWithServer();
      
      // Convert server storage structure to our local format
      const serverNotes: Note[] = [];
      const serverPracticeTests: PracticeTest[] = [];
      const serverPracticals: Practical[] = [];
      
      Object.entries(serverStorage).forEach(([subjectName, subjectData]: [string, any]) => {
        // Process notes
        if (subjectData.notes) {
          Object.entries(subjectData.notes).forEach(([unitName, unitFiles]: [string, any]) => {
            if (Array.isArray(unitFiles)) {
              unitFiles.forEach((file: any) => {
                // Check if we already have this file locally with proper title/description
                const existingNote = notes.find(note => 
                  note.storedFileName === file.filename && 
                  note.subject === subjectName && 
                  note.unit === unitName
                );
                
                const note: Note = {
                  id: `${subjectName}-${unitName}-${file.filename}-${Date.now()}`,
                  title: existingNote?.title || file.title || file.filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, ""),
                  description: existingNote?.description || file.description || '',
                  fileName: file.filename,
                  fileSize: file.size,
                  uploadDate: file.modified,
                  subject: subjectName,
                  unit: unitName,
                  type: file.type,
                  storedFileName: file.filename
                };
                serverNotes.push(note);
              });
            }
          });
        }
        
        // Process practice tests
        if (subjectData['practice-tests'] && Array.isArray(subjectData['practice-tests'])) {
          subjectData['practice-tests'].forEach((file: any) => {
            // Check if we already have this file locally with proper title/description
            const existingTest = practiceTests.find(test => 
              test.storedFileName === file.filename && 
              test.subject === subjectName
            );
            
            const test: PracticeTest = {
              id: `${subjectName}-practice-test-${file.filename}-${Date.now()}`,
              title: existingTest?.title || file.title || file.filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, ""),
              description: existingTest?.description || file.description || '',
              fileName: file.filename,
              fileSize: file.size,
              uploadDate: file.modified,
              subject: subjectName,
              type: file.type,
              storedFileName: file.filename
            };
            serverPracticeTests.push(test);
          });
        }
        
        // Process practicals
        if (subjectData.practicals && Array.isArray(subjectData.practicals)) {
          subjectData.practicals.forEach((file: any) => {
            // Check if we already have this file locally with proper title/description
            const existingPractical = practicals.find(practical => 
              practical.storedFileName === file.filename && 
              practical.subject === subjectName
            );
            
            const practical: Practical = {
              id: `${subjectName}-practical-${file.filename}-${Date.now()}`,
              title: existingPractical?.title || file.title || file.filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, ""),
              description: existingPractical?.description || file.description || '',
              fileName: file.filename,
              fileSize: file.size,
              uploadDate: file.modified,
              subject: subjectName,
              type: file.type,
              storedFileName: file.filename
            };
            serverPracticals.push(practical);
          });
        }
      });
      
      // Merge server files with local files, avoiding duplicates
      const mergeFiles = <T extends { storedFileName?: string; fileName: string; subject: string }>(
        localFiles: T[], 
        serverFiles: T[]
      ): T[] => {
        const merged = [...localFiles];
        
        serverFiles.forEach(serverFile => {
          const exists = merged.some(localFile => 
            localFile.storedFileName === serverFile.storedFileName &&
            localFile.subject === serverFile.subject &&
            (serverFile as any).unit ? (localFile as any).unit === (serverFile as any).unit : true
          );
          
          if (!exists) {
            merged.push(serverFile);
          } else {
            // Update existing file with server data if server has better title/description
            const existingIndex = merged.findIndex(localFile => 
              localFile.storedFileName === serverFile.storedFileName &&
              localFile.subject === serverFile.subject &&
              (serverFile as any).unit ? (localFile as any).unit === (serverFile as any).unit : true
            );
            
            if (existingIndex !== -1) {
              const existingFile = merged[existingIndex];
              // Only update if server has better data (non-filename title)
              if (serverFile.title && serverFile.title !== serverFile.fileName && 
                  (!existingFile.title || existingFile.title === existingFile.fileName)) {
                merged[existingIndex] = {
                  ...existingFile,
                  title: serverFile.title,
                  description: serverFile.description || existingFile.description
                };
              }
            }
          }
        });
        
        return merged;
      };
      
      // Update local storage with merged data
      const mergedNotes = mergeFiles(notes, serverNotes);
      const mergedTests = mergeFiles(practiceTests, serverPracticeTests);
      const mergedPracticals = mergeFiles(practicals, serverPracticals);
      
      // Only update if there are changes
      if (mergedNotes.length !== notes.length) {
        console.log(`Synced ${mergedNotes.length - notes.length} new notes from server`);
        setNotes(mergedNotes);
      }
      
      if (mergedTests.length !== practiceTests.length) {
        console.log(`Synced ${mergedTests.length - practiceTests.length} new practice tests from server`);
        setPracticeTests(mergedTests);
      }
      
      if (mergedPracticals.length !== practicals.length) {
        console.log(`Synced ${mergedPracticals.length - practicals.length} new practicals from server`);
        setPracticals(mergedPracticals);
      }
      
      // Verify all files exist on server
      const allFiles = [
        ...mergedNotes.map(note => ({ ...note, type: 'notes' })),
        ...mergedTests.map(test => ({ ...test, type: 'practice-tests' })),
        ...mergedPracticals.map(practical => ({ ...practical, type: 'practicals' }))
      ];

      if (allFiles.length > 0) {
        const verifiedFiles = await fileStorageService.verifyFiles(allFiles);
        
        // Filter out files that don't exist on server
        const existingFileIds = new Set(
          verifiedFiles.filter(file => file.exists).map(file => file.id)
        );

        // Update notes
        const validNotes = mergedNotes.filter(note => existingFileIds.has(note.id));
        if (validNotes.length !== mergedNotes.length) {
          console.log(`Removed ${mergedNotes.length - validNotes.length} missing notes from local storage`);
          setNotes(validNotes);
        }

        // Update practice tests
        const validTests = mergedTests.filter(test => existingFileIds.has(test.id));
        if (validTests.length !== mergedTests.length) {
          console.log(`Removed ${mergedTests.length - validTests.length} missing practice tests from local storage`);
          setPracticeTests(validTests);
        }

        // Update practicals
        const validPracticals = mergedPracticals.filter(practical => existingFileIds.has(practical.id));
        if (validPracticals.length !== mergedPracticals.length) {
          console.log(`Removed ${mergedPracticals.length - validPracticals.length} missing practicals from local storage`);
          setPracticals(validPracticals);
        }
      }
    } catch (error) {
      console.error('Error syncing with server:', error);
    }
  };
  const addSubject = (subject: Subject) => {
    // Create directory structure on server
    fileStorageService.createSubject(subject.name, subject.units);
    setSubjects(prev => [...prev, subject]);
  };

  const updateSubject = (id: string, updatedSubject: Subject) => {
    const oldSubject = subjects.find(s => s.id === id);
    
    // Create new directory structure if needed
    if (oldSubject) {
      fileStorageService.createSubject(updatedSubject.name, updatedSubject.units);
      
      // Add any new units
      const newUnits = updatedSubject.units.filter(unit => !oldSubject.units.includes(unit));
      newUnits.forEach(unit => {
        fileStorageService.addUnit(updatedSubject.name, unit);
      });
    }
    
    setSubjects(prev => prev.map(s => s.id === id ? updatedSubject : s));
  };

  const deleteSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    // Also remove related notes, practice tests, and practicals
    const subjectToDelete = subjects.find(s => s.id === id);
    if (subjectToDelete) {
      setNotes(prev => prev.filter(n => n.subject !== subjectToDelete.name));
      setPracticeTests(prev => prev.filter(t => t.subject !== subjectToDelete.name));
      setPracticals(prev => prev.filter(p => p.subject !== subjectToDelete.name));
    }
  };

  const addNote = (note: Note) => {
    setNotes(prev => [...prev, note]);
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const addPracticeTest = (test: PracticeTest) => {
    setPracticeTests(prev => [...prev, test]);
  };

  const deletePracticeTest = (id: string) => {
    setPracticeTests(prev => prev.filter(t => t.id !== id));
  };

  const addPractical = (practical: Practical) => {
    setPracticals(prev => [...prev, practical]);
  };

  const deletePractical = (id: string) => {
    setPracticals(prev => prev.filter(p => p.id !== id));
  };

  const updateNotes = (newNotes: Note[]) => {
    setNotes(newNotes);
  };

  const updatePracticeTests = (newTests: PracticeTest[]) => {
    setPracticeTests(newTests);
  };

  const updatePracticals = (newPracticals: Practical[]) => {
    setPracticals(newPracticals);
  };

  const login = (email: string, password: string): boolean => {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      localStorage.setItem('sncop_admin_logged_in', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('sncop_admin_logged_in');
  };

  return (
    <DataContext.Provider value={{
      subjects,
      notes,
      practiceTests,
      practicals,
      isLoggedIn,
      addSubject,
      updateSubject,
      deleteSubject,
      addNote,
      deleteNote,
      addPracticeTest,
      deletePracticeTest,
      addPractical,
      deletePractical,
      updateNotes,
      updatePracticeTests,
      updatePracticals,
      login,
      logout,
      syncWithServer
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};


