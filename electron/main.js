import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import { generateEscposBuffer } from './escposReceipt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('https://sanjaya-erp.vercel.app');
    // mainWindow.webContents.openDevTools();
  }

  // Get list of available system printers
  ipcMain.handle('get-printers', async () => {
    if (!mainWindow || !mainWindow.webContents) return [];
    try {
      return await mainWindow.webContents.getPrintersAsync();
    } catch (e) {
      console.error('Failed to get printers:', e);
      return [];
    }
  });

  // Print graphical receipt via Windows GDI (Standard dialog by default to avoid raw PostScript gibberish on thermal POS)
  ipcMain.handle('print-receipt', async (event, customOptions = {}) => {
    if (!mainWindow || !mainWindow.webContents) return { success: false, error: 'No active window' };

    const printOptions = {
      silent: false, // Default to dialog for graphical receipts so Windows driver rasterizes properly
      printBackground: true,
      deviceName: customOptions.deviceName || undefined,
      margins: {
        marginType: 'none',
      },
      // 80mm thermal paper: width in microns (80mm = 80000), height 0 = auto
      pageSize: {
        width: 80000,
        height: 0,
      },
      ...customOptions,
    };

    return new Promise((resolve) => {
      mainWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          console.error('Receipt print failed:', failureReason);
          resolve({ success: false, failureReason });
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  // Fast direct POS text printing: RAW Windows spooler API (bypasses GDI entirely)
  // Out-Printer uses GDI + large fonts → word-wrap chaos. RAW sends bytes directly
  // to the thermal printer's own ESC/POS interpreter for perfect 42-col output.
  ipcMain.handle('print-text-receipt', async (event, { text, printerName }) => {
    return new Promise((resolve) => {
      try {
        const targetPrinter = printerName || 'Xprinter XP-80';
        const tempPath = path.join(app.getPath('temp'), `receipt_${Date.now()}.txt`);

        // Write with CRLF line endings — required by most thermal printer firmware
        const crlfText = text.replace(/\r?\n/g, '\r\n');
        fs.writeFileSync(tempPath, crlfText, 'latin1'); // latin1 avoids UTF-8 BOM issues

        // Inline C# RAW print via Windows winspool API
        const printerSafe = targetPrinter.replace(/'/g, "''");
        const fileSafe    = tempPath.replace(/\\/g, '\\\\').replace(/'/g, "''");

        const psCmd = `
Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
public class DOCINFOA {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
public class RawPrint {
  [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv",EntryPoint="ClosePrinter")]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr h, int level, [In,MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
}
'@
$pName = '${printerSafe}';
$bytes = [System.IO.File]::ReadAllBytes('${fileSafe}');
$hPrinter = [IntPtr]::Zero;
if (-not [RawPrint]::OpenPrinter($pName, [ref]$hPrinter, [IntPtr]::Zero)) {
  throw "Cannot open printer: $pName";
}
$di = New-Object DOCINFOA;
$di.pDocName  = 'Receipt';
$di.pDataType = 'RAW';
[RawPrint]::StartDocPrinter($hPrinter, 1, $di) | Out-Null;
[RawPrint]::StartPagePrinter($hPrinter) | Out-Null;
$ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length);
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length);
$written = 0;
[RawPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null;
[System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr);
[RawPrint]::EndPagePrinter($hPrinter)  | Out-Null;
[RawPrint]::EndDocPrinter($hPrinter)   | Out-Null;
[RawPrint]::ClosePrinter($hPrinter)    | Out-Null;
Write-Host "RAW printed $written bytes to $pName";
`;

        execFile(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', psCmd],
          { timeout: 20000 },
          (err, stdout, stderr) => {
            try { fs.unlinkSync(tempPath); } catch (_) {}
            if (err) {
              console.error('RAW print error:', err.message, stderr);
              resolve({ success: false, failureReason: err.message || stderr });
            } else {
              console.log('RAW print result:', stdout.trim());
              resolve({ success: true });
            }
          }
        );
      } catch (err) {
        console.error('Failed to print text receipt:', err);
        resolve({ success: false, failureReason: err.message });
      }
    });

  });

  // Fast direct POS printing: RAW Windows spooler API via ESC/POS buffer
  ipcMain.handle('print-escpos-receipt', async (event, { data, printerName }) => {
    return new Promise((resolve) => {
      try {
        const targetPrinter = printerName || 'Xprinter XP-80';
        const tempPath = path.join(app.getPath('temp'), `receipt_escpos_${Date.now()}.bin`);

        // Generate base64 buffer and write as binary
        const b64Data = generateEscposBuffer(data);
        const buffer = Buffer.from(b64Data, 'base64');
        fs.writeFileSync(tempPath, buffer);

        // Inline C# RAW print via Windows winspool API
        const printerSafe = targetPrinter.replace(/'/g, "''");
        const fileSafe    = tempPath.replace(/\\/g, '\\\\').replace(/'/g, "''");

        const psCmd = `
Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
public class DOCINFOA {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
public class RawPrint {
  [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv",EntryPoint="ClosePrinter")]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr h, int level, [In,MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
}
'@
$pName = '${printerSafe}';
$bytes = [System.IO.File]::ReadAllBytes('${fileSafe}');
$hPrinter = [IntPtr]::Zero;
if (-not [RawPrint]::OpenPrinter($pName, [ref]$hPrinter, [IntPtr]::Zero)) {
  throw "Cannot open printer: $pName";
}
$di = New-Object DOCINFOA;
$di.pDocName  = 'Receipt';
$di.pDataType = 'RAW';
[RawPrint]::StartDocPrinter($hPrinter, 1, $di) | Out-Null;
[RawPrint]::StartPagePrinter($hPrinter) | Out-Null;
$ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length);
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length);
$written = 0;
[RawPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null;
[System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr);
[RawPrint]::EndPagePrinter($hPrinter)  | Out-Null;
[RawPrint]::EndDocPrinter($hPrinter)   | Out-Null;
[RawPrint]::ClosePrinter($hPrinter)    | Out-Null;
Write-Host "RAW printed $written bytes to $pName";
`;

        execFile(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', psCmd],
          { timeout: 20000 },
          (err, stdout, stderr) => {
            try { fs.unlinkSync(tempPath); } catch (_) {}
            if (err) {
              console.error('ESC/POS print error:', err.message, stderr);
              resolve({ success: false, failureReason: err.message || stderr });
            } else {
              console.log('ESC/POS print result:', stdout.trim());
              resolve({ success: true });
            }
          }
        );
      } catch (err) {
        console.error('Failed to print ESC/POS receipt:', err);
        resolve({ success: false, failureReason: err.message });
      }
    });

  });

  // Legacy fallback for print-silent
  ipcMain.removeAllListeners('print-silent');
  ipcMain.on('print-silent', (event, customOptions = {}) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.print({
        silent: false,
        printBackground: true,
        deviceName: customOptions.deviceName || undefined,
        margins: { marginType: 'none' }
      }, (success, failureReason) => {
        if (!success) console.error('Print failed:', failureReason);
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
