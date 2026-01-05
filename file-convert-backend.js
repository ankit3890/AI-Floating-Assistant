// ============================================
// FILE CONVERT BACKEND HANDLERS
// ============================================
// Add this code to your main.js file

const { ipcMain, dialog, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check LibreOffice Installation
ipcMain.handle('check-libreoffice', async () => {
  const libreOfficePaths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  ];
  
  for (const p of libreOfficePaths) {
    if (fs.existsSync(p)) {
      return { installed: true, path: p };
    }
  }
  
  return { installed: false };
});

// Open External URL
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Open external error:', error);
    return { success: false, error: error.message };
  }
});

// File Convert Handler
ipcMain.handle('convert-file', async (event, options) => {
  const { filePath, sourceFormat, targetFormat } = options;
  
  try {
    // Validate inputs
    if (!filePath || !sourceFormat || !targetFormat) {
      return { success: false, error: 'Missing required parameters' };
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Source file not found' };
    }
    
    // Show save dialog
    const saveResult = await dialog.showSaveDialog({
      title: 'Save Converted File',
      defaultPath: path.basename(filePath, path.extname(filePath)) + '.' + targetFormat,
      filters: [
        { name: getFilterName(targetFormat), extensions: [targetFormat] }
      ]
    });
    
    if (saveResult.canceled) {
      return { success: false, error: 'Save canceled' };
    }
    
    const outputPath = saveResult.filePath;
    
    // Convert using LibreOffice
    const result = await convertWithLibreOffice(filePath, outputPath, targetFormat);
    
    return result;
    
  } catch (error) {
    console.error('Conversion error:', error);
    return { success: false, error: error.message };
  }
});

// Helper: Convert file using LibreOffice
function convertWithLibreOffice(inputPath, outputPath, targetFormat) {
  return new Promise((resolve, reject) => {
    // Determine LibreOffice executable path
    const libreOfficePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      '/usr/bin/libreoffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    ];
    
    let libreOfficePath = null;
    for (const p of libreOfficePaths) {
      if (fs.existsSync(p)) {
        libreOfficePath = p;
        break;
      }
    }
    
    if (!libreOfficePath) {
      return resolve({
        success: false,
        error: 'LibreOffice not found. Please install LibreOffice from https://www.libreoffice.org/'
      });
    }
    
    // Determine conversion filter
    const filterMap = {
      'pdf': 'writer_pdf_Export',
      'docx': 'MS Word 2007 XML',
      'pptx': 'Impress MS PowerPoint 2007 XML'
    };
    
    const filter = filterMap[targetFormat];
    if (!filter) {
      return resolve({ success: false, error: 'Unsupported target format' });
    }
    
    // Build command
    const outputDir = path.dirname(outputPath);
    const outputName = path.basename(outputPath, '.' + targetFormat);
    
    const cmd = `"${libreOfficePath}" --headless --convert-to ${targetFormat}:"${filter}" --outdir "${outputDir}" "${inputPath}"`;
    
    console.log('Executing conversion:', cmd);
    
    // Execute conversion
    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('LibreOffice error:', error);
        return resolve({ success: false, error: 'Conversion failed: ' + error.message });
      }
      
      // Check if output file was created
      const expectedOutput = path.join(outputDir, path.basename(inputPath, path.extname(inputPath)) + '.' + targetFormat);
      
      if (fs.existsSync(expectedOutput)) {
        // Rename to user's chosen name if different
        if (expectedOutput !== outputPath) {
          try {
            fs.renameSync(expectedOutput, outputPath);
          } catch (err) {
            console.error('Rename error:', err);
          }
        }
        
        resolve({ success: true, outputPath });
      } else {
        resolve({ success: false, error: 'Output file not created' });
      }
    });
  });
}

// Helper: Get filter name for save dialog
function getFilterName(format) {
  const names = {
    'pdf': 'PDF Document',
    'docx': 'Word Document',
    'pptx': 'PowerPoint Presentation'
  };
  return names[format] || format.toUpperCase();
}
