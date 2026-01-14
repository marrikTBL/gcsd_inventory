# GCSD Inventory Management System

**Version:** 6.1.0-BETA

**Platform:** Cross-platform (optimized for Windows)

The **GCSD Inventory Management System** is a robust, Electron-based desktop application designed for high-performance inventory tracking. It features a sophisticated local and cloud data management system, integrated update capabilities, and specialized performance optimizations for handling large datasets.

---

## 🚀 Key Features

### 📦 Data Management

* **Local Storage:** Automatically persists data to `GCSD-DATA.json` within the application directory.
* **Cloud Backup & Sync:** Integrated support for network-based backups. It connects to a central repository for seamless data sharing and redundancy.
* **Validation:** Built-in data integrity checks to ensure that loaded files match the expected schema before processing.

### 🔄 Update & Maintenance System

* **Automated Updates:** Features a dedicated update module to check for, download, and apply new versions (ZIP-based).
* **Progress Tracking:** Real-time download progress reporting via the UI.
* **Rollback Capability:** Includes a version management system that allows users to view available backups and roll back to previous stable versions if necessary.

### ⚡ Performance Optimizations

The application is configured to handle intensive operations by leveraging hardware acceleration:

* **Increased Memory:** Allocated up to **4GB** of JS heap size (`--max-old-space-size=4096`).
* **GPU Acceleration:** Utilizes GPU rasterization and zero-copy transfers for a smooth UI experience.
* **V8 Optimization:** Uses V8 cache options and bypassed "heat checks" for faster script execution.

---

## 🛠 Technical Specifications

| Feature | Specification |
| --- | --- |
| **Framework** | Electron |
| **Runtime** | Node.js |
| **Window Size** | 1400x900 (Min: 1024x700) |
| **Data Format** | JSON (UTF-8) |
| **Background** | Hex #1a1a1a (Dark Mode) |
| **Security** | Context Isolation enabled; Node Integration disabled in renderer. |

---

## 📂 File Structure

* `main.js`: The entry point of the application, managing window lifecycle, IPC communication, and hardware flags.
* `preload.js`: The bridge between the main process and the web environment.
* `index.html`: The primary UI structure.
* `updater.js`: A specialized module for handling versioning, downloads, and file extraction.
* `GCSD-DATA.json`: Local database file.

---

## 🖥 Hardware Requirements

To ensure the performance optimizations function correctly, the system should have:

1. **Network Access:** Connectivity to the desired subnet for cloud backup features.
2. **GPU Support:** A dedicated or integrated GPU that supports hardware acceleration for optimal rendering.
3. **RAM:** At least 8GB recommended (due to the 4GB allocation for the application process).

---

## ⌨️ Development & Setup

To run the application in a development environment:

1. **Install Dependencies:**
```bash
npm install

```


2. **Start Application:**
```bash
npm start

```



> [!IMPORTANT]
> The application searches for an `updater.js` file in multiple locations (local folder, app path, and resource directory). Ensure this file is present for update and rollback functionality to work.

---

**Would you like me to create the `preload.js` or `updater.js` logic to complement this main process file?**
