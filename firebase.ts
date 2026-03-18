import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Datos exactos proporcionados por el usuario
const firebaseConfig = {
  apiKey: "AIzaSyDnhOVu5jaJBp1QXWd0nYBsNipWyQ_46_A",
  authDomain: "apc-odt-app-ii.firebaseapp.com",
  projectId: "apc-odt-app-ii",
  storageBucket: "apc-odt-app-ii.firebasestorage.app",
  messagingSenderId: "1074990701232",
  appId: "1:1074990701232:web:074bccc2e8e2eb8de5b975",
  measurementId: "G-935XEXM0NC",
  // URL base estandarizada
  databaseURL: "https://apc-odt-app-ii-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

/**
 * IMPORTANTE: Si recibes un error de URL, verifica en la consola de Firebase 
 * si la base de datos está en una región distinta a US.
 * Si está en Europa, la URL terminaría en .firebasedatabase.app
 */
const db = getDatabase(app, firebaseConfig.databaseURL);

console.log('--- DIAGNÓSTICO DE CONEXIÓN ---');
console.log('Project ID:', firebaseConfig.projectId);
console.log('Database URL:', firebaseConfig.databaseURL);
console.log('Estado:', db ? 'SISTEMA INICIALIZADO' : 'ERROR DE INSTANCIA');

export { db };