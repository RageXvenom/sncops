import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FolderPlus, Server, HardDrive,
  FileText,
  Trash2,
  Plus,
  Edit,
  Save,
  X,
  LogOut,
  BookOpen,
  Users,
  TestTube
} from 'lucide-react';
import { useData, Note, PracticeTest, Practical, Subject } from '../context/DataContext';
import { fileStorageService, FileUploadData } from '../services/fileStorage';

const AdminPanel: React.FC = () => {
  const {
    isLoggedIn,
    logout,
    subjects = [],
    notes = [],
    practiceTests = [],
    practicals = [],
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
    syncWithServer
  } = useData();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'subjects' | 'notes' | 'practice-tests' | 'practicals'>('subjects');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState<{ name: string; units: string[] }>({
    name: '',
    units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  });
  const [uploadForm, setUploadForm] = useState<{
    type: 'notes' | 'practice-tests' | 'practicals';
    title: string;
    description: string;
    subject: string;
    unit: string;
    file: File | null;
  }>({
    type: 'notes',
    title: '',
    description: '',
    subject: '',
    unit: '',
    file: null
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Check server status on component mount
  useEffect(() => {
    const checkServer = async () => {
      const isOnline = await fileStorageService.checkServerHealth();
      setServerStatus(isOnline ? 'online' : 'offline');
    };
    
    checkServer();
    const interval = setInterval(checkServer, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Manual sync button handler
  const handleManualSync = async () => {
    try {
      console.log('Starting manual sync...');
      await syncWithServer();
      alert('Successfully synced with server storage! All devices should now see the same files.');
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert('Failed to sync with server. Please try again.');
    }
  };
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/admin-login');
    }
  }, [isLoggedIn, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadForm(prev => ({ ...prev, file }));
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!uploadForm.file || !uploadForm.title || !uploadForm.subject) {
      alert('Please fill in all required fields and select a file');
      return;
    }

    // Check if title and subject are not just whitespace
    if (!uploadForm.title.trim() || !uploadForm.subject.trim()) {
      alert('Title and subject cannot be empty');
      return;
    }

    // For notes, unit is required
    if (activeTab === 'notes' && !uploadForm.unit?.trim()) {
      alert('Please select a unit for notes');
      return;
    }

    // Check server status but don't block upload
    if (serverStatus === 'offline') {
      console.warn('Server appears offline, but attempting upload anyway...');
    }

    setIsUploading(true);
    setUploadProgress(0);

    const currentType = (activeTab === 'notes' || activeTab === 'practice-tests' || activeTab === 'practicals')
      ? activeTab
      : uploadForm.type;

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const uploadData: FileUploadData = {
        title: uploadForm.title.trim(),
        description: uploadForm.description.trim(),
        subject: uploadForm.subject.trim(),
        unit: uploadForm.unit?.trim() || '',
        type: currentType as 'notes' | 'practice-tests' | 'practicals',
        file: uploadForm.file
      };

      console.log('Starting upload with data:', {
        title: uploadData.title,
        subject: uploadData.subject,
        type: uploadData.type,
        unit: uploadData.unit,
        fileName: uploadData.file.name,
        fileSize: uploadData.file.size
      });
      const storedFile = await fileStorageService.uploadFile(uploadData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (storedFile) {
        const baseItem = {
          id: storedFile.id,
          title: storedFile.title,
          description: storedFile.description,
          fileName: storedFile.fileName,
          fileSize: storedFile.fileSize,
          uploadDate: storedFile.uploadDate,
          type: storedFile.fileType,
          filePath: storedFile.filePath,
          storedFileName: storedFile.storedFileName
        };

        if (currentType === 'notes') {
          const note: Note = {
            ...baseItem,
            subject: storedFile.subject,
            unit: storedFile.unit || ''
          } as Note;
          addNote(note);
        } else if (currentType === 'practice-tests') {
          const test: PracticeTest = {
            ...baseItem,
            subject: storedFile.subject
          } as PracticeTest;
          addPracticeTest(test);
        } else if (currentType === 'practicals') {
          const practical: Practical = {
            ...baseItem,
            subject: storedFile.subject
          } as Practical;
          addPractical(practical);
        }

        // Show success message
        alert('File uploaded successfully!');

        // Success animation
        setTimeout(() => {
          setUploadProgress(0);
          setIsUploading(false);
          
          // Reset form
          setUploadForm({
            type: currentType as 'notes' | 'practice-tests' | 'practicals',
            title: '',
            description: '',
            subject: '',
            unit: '',
            file: null
          });
          
          // Reset file input
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
        }, 1000);
      } else {
        throw new Error('No file data returned from server');
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Full error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      alert(`Upload failed: ${errorMessage}\n\nPlease check the console for more details and ensure the server is running.`);
      
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleAddSubject = () => {
    if (newSubject.name.trim()) {
      addSubject({
        id: Date.now().toString(),
        name: newSubject.name.trim(),
        units: newSubject.units?.filter(unit => unit.trim()) ?? []
      } as Subject);
      setNewSubject({ name: '', units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'] });
      setIsAddingSubject(false);
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject.id);
    setNewSubject({ 
      name: subject.name, 
      units: (subject.units ?? []).map(unit => typeof unit === 'object' ? unit.name || '' : unit)
    });
  };

  const handleUpdateSubject = () => {
    if (editingSubject && newSubject.name.trim()) {
      const oldSubject = subjects.find(s => s.id === editingSubject);
      const newSubjectName = newSubject.name.trim();

      updateSubject(editingSubject, {
        id: editingSubject,
        name: newSubjectName,
        units: newSubject.units?.filter(unit => unit.trim()) ?? []
      } as Subject);

      if (oldSubject && oldSubject.name !== newSubjectName) {
        const updatedNotes = notes.map(note =>
          note.subject === oldSubject.name ? { ...note, subject: newSubjectName } : note
        );
        updateNotes(updatedNotes);

        const updatedTests = practiceTests.map(test =>
          test.subject === oldSubject.name ? { ...test, subject: newSubjectName } : test
        );
        updatePracticeTests(updatedTests);

        const updatedPracticals = practicals.map(practical =>
          practical.subject === oldSubject.name ? { ...practical, subject: newSubjectName } : practical
        );
        updatePracticals(updatedPracticals);
      }

      setEditingSubject(null);
      setNewSubject({ name: '', units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'] });
    }
  };

  // Helper function to extract unit name from unit object or string
  const getUnitName = (unit: any): string => {
    if (typeof unit === 'string') return unit;
    if (unit && typeof unit === 'object') return unit.name || '';
    return '';
  };

  // Helper function to extract subject name from subject object or string
  const getSubjectName = (subject: any): string => {
    if (typeof subject === 'string') return subject;
    if (subject && typeof subject === 'object') return subject.name || '';
    return '';
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 slide-up enhanced-shadow glass-effect p-6 rounded-2xl">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient neon-glow enhanced-text">Admin Panel</h1>
            <p className="enhanced-text opacity-80">Manage subjects, notes, and practice tests with dedicated file storage</p>
            
            {/* Server Status */}
            <div className="flex items-center mt-2 space-x-2">
              <Server className={`h-4 w-4 ${serverStatus === 'online' ? 'text-green-500' : serverStatus === 'offline' ? 'text-red-500' : 'text-yellow-500'}`} />
              <span className={`text-sm font-bold ${serverStatus === 'online' ? 'text-green-600 dark:text-green-400' : serverStatus === 'offline' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                Storage Server: {serverStatus === 'online' ? 'Online' : serverStatus === 'offline' ? 'Offline' : 'Checking...'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Storage Info */}
            <div className="text-right">
              <div className="flex items-center space-x-2 text-sm enhanced-text opacity-80">
                <HardDrive className="h-4 w-4" />
                <span>Dedicated File Storage</span>
              </div>
              <div className="flex items-center space-x-2 text-sm enhanced-text opacity-80">
                <FolderPlus className="h-4 w-4" />
                <span>Auto Directory Creation</span>
              </div>
            </div>
            
          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover-scale shimmer-effect"
            type="button"
            title="Sync with server storage"
          >
            <Server className="h-4 w-4" />
            <span>Sync</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover-scale shimmer-effect"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 fade-in-up">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl max-w-2xl">
            {[
              { key: 'subjects', label: 'Subjects', icon: BookOpen },
              { key: 'notes', label: 'Notes', icon: FileText },
              { key: 'practice-tests', label: 'Practice Tests', icon: TestTube },
              { key: 'practicals', label: 'Practicals', icon: Users }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                  activeTab === key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shimmer-effect'
                    : 'enhanced-text opacity-80 hover:opacity-100 hover-scale'
                }`}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            {/* Add Subject Form */}
            <div className="glass-effect p-6 rounded-2xl fade-in-up enhanced-shadow">
              <h3 className="text-xl font-semibold mb-4 enhanced-text neon-glow">
                {isAddingSubject || editingSubject ? 'Manage Subject' : 'Add New Subject'}
              </h3>

              {(isAddingSubject || editingSubject) && (
                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    placeholder="Subject name"
                    value={newSubject.name}
                    onChange={(e) => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text"
                  />

                  <div>
                    <label className="block text-sm font-bold enhanced-text mb-2">
                      Units (one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={(newSubject.units ?? []).join('\n')}
                      onChange={(e) => setNewSubject(prev => ({
                        ...prev,
                        units: e.target.value.split('\n').filter(unit => unit.trim())
                      }))}
                      className="w-full px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text"
                      placeholder="Unit 1&#10;Unit 2&#10;Unit 3&#10;..."
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={editingSubject ? handleUpdateSubject : handleAddSubject}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover-scale shimmer-effect"
                      type="button"
                    >
                      <Save className="h-4 w-4" />
                      <span>{editingSubject ? 'Update' : 'Add'} Subject</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingSubject(false);
                        setEditingSubject(null);
                        setNewSubject({ name: '', units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'] });
                      }}
                      className="flex items-center space-x-2 px-4 py-2 button-secondary hover-scale"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}

              {!isAddingSubject && !editingSubject && (
                <button
                  onClick={() => setIsAddingSubject(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover-scale shimmer-effect folder-icon"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Subject</span>
                </button>
              )}
            </div>

            {/* Subjects List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((subject, index) => (
                <div
                  key={subject.id}
                  className="glass-effect p-6 rounded-2xl hover-scale slide-up enhanced-shadow"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <h4 className="text-lg font-semibold mb-3 enhanced-text neon-glow">
                    {getSubjectName(subject)}
                  </h4>
                  <div className="mb-4">
                    <p className="text-sm enhanced-text opacity-80 mb-2">
                      Units ({subject.units?.length ?? 0}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(subject.units ?? []).slice(0, 3).map((unit, unitIndex) => (
                        <span
                          key={unitIndex}
                          className="px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 text-blue-800 dark:text-blue-200"
                        >
                          {getUnitName(unit)}
                        </span>
                      ))}
                      {(subject.units?.length ?? 0) > 3 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          +{(subject.units?.length ?? 0) - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditSubject(subject)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 button-secondary hover-scale text-sm"
                      type="button"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => deleteSubject(subject.id)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 text-red-700 dark:text-red-300 rounded-lg hover-scale text-sm"
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Upload Tabs */}
        {(activeTab === 'notes' || activeTab === 'practice-tests' || activeTab === 'practicals') && (
          <div className="space-y-6">
            {/* Upload Form */}
            <div className="glass-effect p-6 rounded-2xl fade-in-up enhanced-shadow">
              <h3 className="text-xl font-semibold mb-4 enhanced-text neon-glow">
                Upload {activeTab === 'notes' ? 'Notes' : activeTab === 'practice-tests' ? 'Practice Test' : 'Practical'}
              </h3>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mb-6 file-upload-success">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold enhanced-text">Uploading to dedicated storage...</span>
                    <span className="text-sm font-bold enhanced-text">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="progress-bar h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    className="px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text"
                    required
                    disabled={isUploading}
                  />

                  <select
                    value={uploadForm.subject}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, subject: e.target.value, unit: '' }))}
                    className="px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text"
                    required
                    disabled={isUploading}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(subject => (
                      <option 
                        key={subject.id} 
                        value={getSubjectName(subject)}
                      >
                        {getSubjectName(subject)}
                      </option>
                    ))}
                  </select>
                </div>

                {activeTab === 'notes' && uploadForm.subject && (
                  <select
                    value={uploadForm.unit}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text"
                    required
                    disabled={isUploading}
                  >
                    <option value="">Select Unit</option>
                    {(subjects.find(s => getSubjectName(s) === uploadForm.subject)?.units ?? []).map((unit, index) => (
                      <option 
                        key={index} 
                        value={getUnitName(unit)}
                      >
                        {getUnitName(unit)}
                      </option>
                    ))}
                  </select>
                )}

                <textarea
                  placeholder="Description (optional)"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text"
                  disabled={isUploading}
                />

                <div className="upload-zone p-6 rounded-lg">
                  <label className="block text-sm font-bold enhanced-text mb-2">
                    Upload File (PDF or Image) - No Size Limit
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-high-contrast rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none enhanced-text file-icon"
                    required
                    disabled={isUploading}
                  />
                  {uploadForm.file && (
                    <p className="mt-2 text-sm enhanced-text opacity-80 font-bold">
                      Selected: {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover-scale font-bold shimmer-effect disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="h-4 w-4" />
                  <span>{isUploading ? 'Uploading...' : 'Upload to Storage'}</span>
                </button>
              </form>
            </div>

            {/* Files List */}
            <div className="glass-effect p-6 rounded-2xl enhanced-shadow">
              <h3 className="text-xl font-semibold mb-4 enhanced-text neon-glow">
                Uploaded {activeTab === 'notes' ? 'Notes' : activeTab === 'practice-tests' ? 'Practice Tests' : 'Practicals'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(activeTab === 'notes' ? notes : activeTab === 'practice-tests' ? practiceTests : practicals).map((item, index) => (
                  <div
                    key={item.id}
                    className="glass-effect p-4 rounded-lg hover-scale slide-up enhanced-shadow"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <h4 className="font-bold mb-2 enhanced-text neon-glow">{item.title}</h4>
                    <p className="text-sm enhanced-text opacity-80 mb-2">{item.description}</p>
                    <div className="text-xs enhanced-text opacity-70 mb-3">
                      <p>File: {item.fileName}</p>
                      <p>Size: {item.fileSize}</p>
                      <p>Date: {item.uploadDate}</p>
                      {activeTab === 'notes' && (item as any)?.unit && <p>Unit: {getUnitName((item as any).unit)}</p>}
                      {(item as any)?.subject && <p>Subject: {getSubjectName((item as any).subject)}</p>}
                    </div>
                    <button
                      onClick={() => {
                        // Delete from server storage first
                        const handleDelete = async () => {
                          try {
                            let success = false;
                            
                            if (activeTab === 'notes') {
                              const note = item as any;
                              if (note.storedFileName && note.subject && note.unit) {
                                success = await fileStorageService.deleteFile(
                                  note.subject, 
                                  'notes', 
                                  note.storedFileName, 
                                  note.unit
                                );
                              }
                              if (success || !note.storedFileName) {
                                deleteNote(item.id);
                              }
                            } else if (activeTab === 'practice-tests') {
                              const test = item as any;
                              if (test.storedFileName && test.subject) {
                                success = await fileStorageService.deleteFile(
                                  test.subject, 
                                  'practice-tests', 
                                  test.storedFileName
                                );
                              }
                              if (success || !test.storedFileName) {
                                deletePracticeTest(item.id);
                              }
                            } else {
                              const practical = item as any;
                              if (practical.storedFileName && practical.subject) {
                                success = await fileStorageService.deleteFile(
                                  practical.subject, 
                                  'practicals', 
                                  practical.storedFileName
                                );
                              }
                              if (success || !practical.storedFileName) {
                                deletePractical(item.id);
                              }
                            }
                            
                            if (!success && (item as any).storedFileName) {
                              alert('Failed to delete file from storage. Please try again.');
                            }
                          } catch (error) {
                            console.error('Error deleting file:', error);
                            alert('Error deleting file. Please try again.');
                          }
                        };
                        
                        handleDelete();
                      }}
                      className="flex items-center space-x-1 px-3 py-2 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 text-red-700 dark:text-red-300 rounded-lg hover-scale text-sm font-bold"
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;

