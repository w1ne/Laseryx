# LaserFather PWA

[![Buy Me A Coffee](https://img.shields.io/badge/Support-Buy%20Me%20A%20Coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/3qutj2ucoq)

LaserFather is a tool for your laser cutter. It runs in your browser. You can design, plan, and cut without installing anything.

## Features

**Design Workspace**
We support SVGs and images like PNG or JPG. The app converts images to scanlines automatically. You can organize your work with layers.

**CAM Engine**
You can configure Cuts or Engraves. Save your settings for different materials like Wood or Leather. Everything happens on your computer locally.

**Machine Control**
Connect directly to your GRBL machine via USB. We have a split view so you can see the preview and controls at the same time. The motion is smooth and reliable.

**Preview & Simulation**
Visualize exactly what the laser will do before it starts. The high-performance canvas engine lets you Zoom and Pan through even the most complex G-code paths.

## Getting Started

### Prerequisites
You need Node.js 18 or newer. We recommend Chrome or Edge for the best experience with Web Serial.

### Installation
Run this command to install dependencies.
```bash
npm install
```

### Development
Start the local server.
```bash
npm run dev
```

### Testing
Run the test suite.
```bash
npm run test
```

## Linux Setup

If you cannot connect to the serial port, check your permissions.
1.  Add your user to the `dialout` group.
    ```bash
    sudo usermod -a -G dialout $USER
    ```
    Log out and back in for this to work.

2.  Ubuntu often lets `ModemManager` grab looking serial devices. You might need to stop it.
    ```bash
    sudo systemctl stop ModemManager
    ```
