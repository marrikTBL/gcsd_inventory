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

## 🛠 Development & Setup

To set up the GCSD Inventory Management System for development or to compile it into a production-ready executable, follow the steps below.

### ⚙️ Prerequisites

* **Node.js:** Ensure you have the latest LTS version installed.
* **Git:** Required to clone the repository if hosted remotely.
* **Network Access:** A connection to `\\192.168.0.249` is required for cloud backup and restoration features.
* **Permissions:** You must have write access to the application directory to generate and save the `GCSD-DATA.json` file.

### 🏗 Installation & Local Development

1. **Install Dependencies:**
Download the project and install the required Electron and Node.js packages.
```bash
npm install

```


2. **Run in Development Mode:**
Launch the application with the hardware acceleration and memory flags (4GB JS heap) enabled.
```bash
npm start

```



### 📦 The Build Process

Since this application includes specialized performance flags and a dedicated updater, the build process must package the `updater.js` and `icon.png` files correctly.

1. **Configure Environment:**
Ensure the `updater.js` file is located in the root directory, as the application searches for it at startup to enable version control.
2. **Package the Application:**
Use `electron-builder` or `electron-packager` to create the executable. The build command typically looks like this:
```bash
npm run build

```



### ✅ Production Verification

Once the application is packaged, follow these steps to verify the production environment:

* **Setup Script (`setup.bat`):** Before the first run, execute `setup.bat` to ensure all directory permissions are set, network paths to the cloud backup's are mapped, and any existing legacy instances of the application are cleared.
* **Data Path:** Verify that the app correctly identifies the data path. In a packaged state, it will look for `GCSD-DATA.json` in the same directory as the executable (`process.execPath`).
* **Memory Allocation:** Ensure the production build is correctly applying the `--max-old-space-size=4096` flag to handle large inventory datasets.
* **Updater Integration:** Confirm that `updater.js` is present in the `resources` folder so that "Check for Updates" and "Rollback" features are functional.

---

**Would you like me to write the code for the `setup.bat` file to automate these environment checks and network mappings?**


> [!IMPORTANT]
> The application searches for an `updater.js` file in multiple locations (local folder, app path, and resource directory). Ensure this file is present for update and rollback functionality to work.

---

**Would you like me to create the `preload.js` or `updater.js` logic to complement this main process file?**
