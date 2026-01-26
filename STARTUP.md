# Startup Guide

To run the CS2 Demo Viewer, you need to start both the backend server and the frontend client.

## 1. Start the Backend Server
The server handles demo parsing and provides the API.

```bash
cd server
npm install
node index.js
```
*The server will run on `http://localhost:3001`*

## 2. Start the Frontend Client
The client provides the user interface and visualizer.

```bash
cd client
npm install
npm run dev
```
*The client will typically run on `http://localhost:5173`*

## Prerequisites
- **Node.js**: Ensure you have Node.js installed.
- **Demos**: Place your `.dem` files in the `demos/` folder at the root of the project.
